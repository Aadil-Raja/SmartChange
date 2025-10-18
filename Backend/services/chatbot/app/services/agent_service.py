# app/services/agent_service.py
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from langchain.agents import AgentExecutor, create_tool_calling_agent
from app.core.config import get_settings
import sys

settings = get_settings()
from app.services.tools.doc_qa_tool import make_doc_qa_tool

SYSTEM_PROMPT = """
You are a corporate training assistant.
This chat turn is restricted to ONE selected document.
Use the conversation history to understand context and follow-up questions.
When the user says "it", "that", "the previous answer", refer to the chat history.
If the tool returns no context, say you don't know. Keep responses concise.
Always reflect the tool's result faithfully.
"""

class DocumentAgent:
    def __init__(self, db: Session, chunk_db: Session, model: str | None = None):
        self.db = db
        self.chunk_db = chunk_db
        
        print(f"[AGENT] Initializing with model: {model or settings.llm_model}", file=sys.stderr)
        
        self.llm = ChatGoogleGenerativeAI(
            model=model or settings.llm_model,
            temperature=0,
            google_api_key=settings.google_api_key
        )

        # Updated prompt to include chat_history placeholder
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("placeholder", "{chat_history}"),  # ← Added this
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
            max_iterations=2,
            handle_parsing_errors=True
        )
        return agent, executor

    def get_response(
        self, 
        *, 
        active_doc_id: int, 
        user_message: str,
        chat_history: List = None  # ← Added this parameter
    ) -> Dict[str, Any]:
        print(f"\n{'='*80}", file=sys.stderr)
        print(f"[AGENT] Processing query", file=sys.stderr)
        print(f"[AGENT] Document ID: {active_doc_id}", file=sys.stderr)
        print(f"[AGENT] User Message: {user_message}", file=sys.stderr)
        print(f"[AGENT] Chat History Length: {len(chat_history) if chat_history else 0}", file=sys.stderr)
        print(f"{'='*80}\n", file=sys.stderr)
        
        # Default to empty list if no history provided
        if chat_history is None:
            chat_history = []
        
        # Bind tool with the server-known doc_id (LLM cannot change it)
        doc_qa_tool = make_doc_qa_tool(self.chunk_db, active_doc_id)
        tools = [doc_qa_tool]

        agent, executor = self._build(tools)
        
        print(f"[AGENT] Invoking executor with {len(chat_history)} history messages...", file=sys.stderr)
        result = executor.invoke({
            "input": user_message,
            "chat_history": chat_history  # ← Pass history to agent
        })
        
        print(f"\n[AGENT] Executor result keys: {result.keys()}", file=sys.stderr)
        
        answer = result.get("output", "Sorry, I couldn't produce an answer.")
        
        print(f"[AGENT] Final answer length: {len(answer)} chars", file=sys.stderr)
        print(f"[AGENT] Final answer: {answer}", file=sys.stderr)
        print(f"{'='*80}\n", file=sys.stderr)
        
        return {"answer": answer}