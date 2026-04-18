# app/services/agent_service_v2.py
"""
V2 agent - returns structured {answer, has_contradiction, citations} dict.
Used by the /respond-v2 endpoint.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent

from app.core.config import get_settings
import sys
import json

settings = get_settings()


def _group_citations(flat_citations: list) -> list:
    """
    Convert flat list of {doc_id, doc_title, cloudinary_url, page, section, snippet}
    into grouped list of {doc_id, doc_title, cloudinary_url, references: [{page, section, snippet}]}.
    """
    grouped = {}
    for c in flat_citations:
        doc_id = c.get("doc_id")
        if doc_id not in grouped:
            grouped[doc_id] = {
                "doc_id": doc_id,
                "doc_title": c.get("doc_title", f"Document {doc_id}"),
                "cloudinary_url": c.get("cloudinary_url"),
                "references": []
            }
        grouped[doc_id]["references"].append({
            "page": c.get("page"),
            "section": c.get("section"),
            "snippet": c.get("snippet")
        })
    return list(grouped.values())

SYSTEM_PROMPT_V2 = """
You are a corporate training assistant.

Conversation History:
{chat_history}

Available tools:
- doc_qa_tool: For specific questions about document content (FINAL - returns complete answer)
- list_document_sections_tool: For listing all sections available for summarization
- generate_section_summary_tool: For generating summary of a specific section

CRITICAL INSTRUCTIONS:
1. Every tool returns a JSON string with keys: "answer", "has_contradiction", "citations".
2. You MUST return the tool's JSON output EXACTLY as-is without any modification.
3. Do NOT rewrite, summarize, or reformat the tool output.
4. Do NOT strip or remove the citations or has_contradiction fields.
5. If the tool returns JSON, your final response must be that exact JSON string.

Tool selection rules:
- Use list_document_sections_tool ONLY when user explicitly asks for: "list sections", "show topics", "what sections are there", "give me an overview/table of contents". NOT for factual questions.
- Use generate_section_summary_tool when user names a specific section they want summarized.
- Use doc_qa_tool for ALL other questions — any question asking for facts, names, details, explanations, or specific information from the document. When in doubt, use doc_qa_tool.

STRICT TOOL CHAINING RULES - READ CAREFULLY:
- doc_qa_tool is FINAL. After calling it, STOP IMMEDIATELY. Do NOT call any other tool.
- list_document_sections_tool is FINAL. After calling it, STOP IMMEDIATELY. Do NOT call doc_qa_tool or any other tool.
- generate_section_summary_tool is FINAL. After calling it, STOP IMMEDIATELY. Do NOT call any other tool.
- NEVER chain tools. One tool call per turn. The tool output is complete and needs no enhancement.
- If list_document_sections_tool returns "Multiple documents selected", return that message as-is. Do NOT try another tool.
- CRITICAL: If user asks multiple questions in one message (e.g. "tell tournament format and notable players"), combine them into ONE single call to doc_qa_tool with the full question. Never call doc_qa_tool more than once per turn.
- CRITICAL: If user asks for multiple sections (e.g. "Day 1 and Day 7", "all days", "days 5 to 12"), call generate_section_summary_tool EXACTLY ONCE with selection_type='many'. NEVER call it multiple times.

REMEMBER: Each tool is self-contained and complete. After ANY tool call, your job is done. Return the output immediately.
"""


class DocumentAgentV2:
    def __init__(self, db: Session, management_db: Session):
        self.db = db
        self.management_db = management_db

        provider = settings.llm_provider.lower()
        model = settings.llm_model

        if provider == "openai":
            self.llm = ChatOpenAI(model=model, temperature=0, api_key=settings.openai_api_key)
        elif provider == "gemini":
            self.llm = ChatGoogleGenerativeAI(model=model, temperature=0, google_api_key=settings.google_api_key)
        else:
            raise ValueError(f"Unknown provider: {provider}")

        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_V2),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ])

    def _build(self, tools):
        agent = create_tool_calling_agent(llm=self.llm, tools=tools, prompt=self.prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            max_iterations=3,
            handle_parsing_errors=True
        )
        return executor

    def _format_doc_histories_for_prompt(self, doc_histories: Dict, active_doc_ids: List[int]) -> str:
        """
        Format per-document histories into a single string for system prompt.
        
        Format:
        [Doc Title 1]:
        Summary: ...
        Recent messages:
        User: ...
        Assistant: ...
        
        [Doc Title 2]:
        ...
        """
        if not doc_histories:
            return ""
        
        doc_sections = []
        
        for doc_id in active_doc_ids:
            if doc_id not in doc_histories:
                continue
            
            doc_data = doc_histories[doc_id]
            doc_section = f"[{doc_data['doc_title']}]:\n"
            
            # Add summary if exists
            if doc_data.get('summary'):
                doc_section += f"Summary: {doc_data['summary']}\n"
            
            # Add last N messages
            if doc_data.get('last_n_messages'):
                doc_section += "Recent messages:\n"
                from app.models import MessageRole
                for msg in doc_data['last_n_messages']:
                    role = "User" if msg.role == MessageRole.USER else "Assistant"
                    doc_section += f"{role}: {msg.message}\n"
            
            doc_sections.append(doc_section)
        
        formatted_history = "\n\n".join(doc_sections)
        
        return formatted_history

    def get_response(
        self,
        *,
        active_doc_ids: List[int],
        user_message: str,
        doc_histories: Dict = None  # NEW: per-doc histories
    ) -> Dict[str, Any]:
        from app.services.tools.doc_qa_tool_structured import make_doc_qa_tool_structured
        from app.services.tools.section_summary_tool_v2 import (
            make_list_sections_tool_v2,
            make_generate_summary_tool_v2,
        )

        if doc_histories is None:
            doc_histories = {}

        # Format doc histories for system prompt
        chat_history_string = self._format_doc_histories_for_prompt(doc_histories, active_doc_ids)

        tools = [
            make_doc_qa_tool_structured(self.management_db, active_doc_ids, doc_histories),
            make_list_sections_tool_v2(self.management_db, self.management_db, active_doc_ids),
            make_generate_summary_tool_v2(self.management_db, self.management_db, active_doc_ids),
        ]

        executor = self._build(tools)
        
        # Format system prompt with chat history
        formatted_system_prompt = SYSTEM_PROMPT_V2.format(chat_history=chat_history_string)
        
        # Create prompt with formatted system message
        prompt_with_history = ChatPromptTemplate.from_messages([
            ("system", formatted_system_prompt),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ])
        
        # Rebuild executor with updated prompt
        agent = create_tool_calling_agent(llm=self.llm, tools=tools, prompt=prompt_with_history)
        executor_with_history = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            max_iterations=3,
            handle_parsing_errors=True
        )
        
        result = executor_with_history.invoke({"input": user_message})
        raw_output = result.get("output", "")

        # Parse structured JSON from tool output
        # Handle case where agent called tool multiple times and concatenated outputs
        try:
            parsed = json.loads(raw_output)
            flat_citations = parsed.get("citations", [])
            return {
                "answer": parsed.get("answer", raw_output),
                "has_contradiction": parsed.get("has_contradiction", False),
                "citations": _group_citations(flat_citations),
                "tokens_input": parsed.get("tokens_input", 0),
                "tokens_output": parsed.get("tokens_output", 0),
                "call_type": parsed.get("call_type", None),
            }
        except (json.JSONDecodeError, TypeError):
            # Try to extract and merge multiple JSON objects from concatenated output
            import re
            json_objects = []
            decoder = json.JSONDecoder()
            idx = 0
            while idx < len(raw_output):
                try:
                    obj, end_idx = decoder.raw_decode(raw_output, idx)
                    if isinstance(obj, dict) and "answer" in obj:
                        json_objects.append(obj)
                    idx += end_idx
                except json.JSONDecodeError:
                    idx += 1

            if json_objects:
                merged_answer = "\n\n".join(o.get("answer", "") for o in json_objects)
                merged_citations = []
                for o in json_objects:
                    merged_citations.extend(o.get("citations", []))
                has_contradiction = any(o.get("has_contradiction", False) for o in json_objects)
                return {
                    "answer": merged_answer,
                    "has_contradiction": has_contradiction,
                    "citations": _group_citations(merged_citations),
                    "tokens_input": sum(o.get("tokens_input", 0) for o in json_objects),
                    "tokens_output": sum(o.get("tokens_output", 0) for o in json_objects),
                }

            return {
                "answer": raw_output,
                "has_contradiction": False,
                "citations": [],
                "tokens_input": 0,
                "tokens_output": 0,
            }
