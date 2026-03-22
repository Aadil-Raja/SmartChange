# app/services/agent_service.py
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage

# Use langchain-classic for both AgentExecutor and agent creation
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent

from app.core.config import get_settings
import sys

settings = get_settings()
from app.services.tools.doc_qa_tool import make_doc_qa_tool
# from app.services.tools.doc_topics_tool import make_doc_topics_tool
# from app.services.tools.doc_summary_tool import make_doc_summary_tool
from app.services.tools.section_summary_tool import make_list_sections_tool, make_generate_summary_tool


SYSTEM_PROMPT = """
You are a corporate training assistant.
This chat turn is restricted to ONE selected document.
Use the conversation history to understand context and follow-up questions.
When the user says "it", "that", "the previous answer", refer to the chat history.

Available tools:
- doc_qa_tool: For specific questions about document content
- doc_topics_tool: For getting an overview or main topics list
- doc_summary_tool: For generating a comprehensive summary of the entire document
- list_document_sections_tool: For listing all sections/topics available for section-wise summarization
- generate_section_summary_tool: For generating summary of a specific section

Use doc_topics_tool when user asks for:
- Overview or list of topics
- What topics are covered
- Main topics/themes


Use list_document_sections_tool when user asks for:
- Summary of the entire document
- Summarize this whole document
- Give me a complete summary

Use generate_section_summary_tool when user:
- Selects a specific section after seeing the list
- Asks to summarize a specific section by name

Use doc_qa_tool for specific questions about document content.

CRITICAL: When a tool returns a response with follow-up questions (marked with 📌), you MUST include them in your final response EXACTLY as provided. Do NOT reformulate or omit the follow-up questions section.

If the tool returns no context, say you don't know.
Always return the tool's result EXACTLY as provided, including any follow-up questions.
"""
class DocumentAgent:
    def __init__(self, db: Session, management_db: Session, model: str | None = None):
        self.db = db  # Chatbot database (for chat messages)
        self.management_db = management_db  # Management database (documents, chunks, sections, users)
        
        # Use provided model or fall back to settings
        model_to_use = model or settings.llm_model
        provider = settings.llm_provider.lower()
        
        print(f"[AGENT] Initializing with provider: {provider}, model: {model_to_use}", file=sys.stderr)
        
        # Create LLM based on provider
        if provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key is required for OpenAI provider")
            self.llm = ChatOpenAI(
                model=model_to_use,
                temperature=0,
                api_key=settings.openai_api_key
            )
        elif provider == "gemini":
            if not settings.google_api_key:
                raise ValueError("Google API key is required for Gemini provider")
            self.llm = ChatGoogleGenerativeAI(
                model=model_to_use,
                temperature=0,
                google_api_key=settings.google_api_key
            )
        else:
            raise ValueError(f"Unknown LLM provider: {provider}. Supported: 'openai', 'gemini'")

        # Updated prompt to include chat_history placeholder
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ])

    def _build(self, tools):
        print(f"[AGENT] Building agent with {len(tools)} tools", file=sys.stderr)
        for tool in tools:
            print(f"  → Tool: {tool.name}", file=sys.stderr)
        
        agent = create_tool_calling_agent(
            llm=self.llm, 
            tools=tools, 
            prompt=self.prompt
        )
        executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=True,
            max_iterations=3,  # Increased to allow both tools if needed
            handle_parsing_errors=True
        )
        return agent, executor

    def get_response(
        self, 
        *, 
        active_doc_ids: List[int], 
        user_message: str,
        chat_history: List = None
    ) -> Dict[str, Any]:
        print(f"\n{'='*80}", file=sys.stderr)
        print(f"[AGENT] Processing query", file=sys.stderr)
        print(f"[AGENT] Active Document IDs: {active_doc_ids}", file=sys.stderr)
        print(f"[AGENT] User Message: {user_message}", file=sys.stderr)
        print(f"[AGENT] Chat History Length: {len(chat_history) if chat_history else 0}", file=sys.stderr)
        print(f"{'='*80}\n", file=sys.stderr)
        
        # Default to empty list if no history provided
        if chat_history is None:
            chat_history = []
        
        # Create all tools with the list of active document IDs
        doc_qa_tool = make_doc_qa_tool(self.management_db, active_doc_ids)
        # doc_topics_tool = make_doc_topics_tool(self.management_db, active_doc_ids)
        # doc_summary_tool = make_doc_summary_tool(self.management_db, active_doc_ids)
        # All data (documents, chunks, sections) is in management_db
        list_sections_tool = make_list_sections_tool(self.management_db, self.management_db, active_doc_ids)
        generate_summary_tool = make_generate_summary_tool(self.management_db, self.management_db, active_doc_ids)
        tools = [doc_qa_tool, list_sections_tool, generate_summary_tool]

        agent, executor = self._build(tools)
        
        print(f"[AGENT] Invoking executor with {len(chat_history)} history messages...", file=sys.stderr)
        result = executor.invoke({
            "input": user_message,
            "chat_history": chat_history
        })
        
        print(f"\n[AGENT] Executor result keys: {result.keys()}", file=sys.stderr)
        
        answer = result.get("output", "Sorry, I couldn't produce an answer.")
        
        print(f"[AGENT] Final answer length: {len(answer)} chars", file=sys.stderr)
        print(f"[AGENT] Final answer: {answer}", file=sys.stderr)
        print(f"{'='*80}\n", file=sys.stderr)
        
        return {"answer": answer}