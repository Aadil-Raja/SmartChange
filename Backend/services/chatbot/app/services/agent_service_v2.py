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
Use the conversation history to understand context and follow-up questions.

Available tools:
- doc_qa_tool: For specific questions about document content
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

STRICT TOOL CHAINING RULES:
- After calling list_document_sections_tool, STOP. Return its output immediately. Do NOT call doc_qa_tool or any other tool after it.
- After calling generate_section_summary_tool, STOP. Return its output immediately. Do NOT call any other tool after it.
- Do NOT call doc_qa_tool immediately after list_document_sections_tool. They serve different purposes.
- If list_document_sections_tool returns a message like "Multiple documents selected" or "Please select one document", return that message as-is. Do NOT try another tool.
- One tool call per turn. Never chain tools sequentially.
- CRITICAL: If user asks multiple questions in one message (e.g. "tell tournament format and notable players"), combine them into ONE single call to doc_qa_tool with the full question. Never call doc_qa_tool more than once per turn.
- CRITICAL: If user asks for multiple sections (e.g. "Day 1 and Day 7", "all days", "days 5 to 12"), call generate_section_summary_tool EXACTLY ONCE with selection_type='many'. NEVER call it multiple times.
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
            ("placeholder", "{chat_history}"),
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

    def get_response(
        self,
        *,
        active_doc_ids: List[int],
        user_message: str,
        chat_history: List = None
    ) -> Dict[str, Any]:
        from app.services.tools.doc_qa_tool_v2 import make_doc_qa_tool_v2
        from app.services.tools.section_summary_tool_v2 import (
            make_list_sections_tool_v2,
            make_generate_summary_tool_v2,
        )

        if chat_history is None:
            chat_history = []

        tools = [
            make_doc_qa_tool_v2(self.management_db, active_doc_ids),
            make_list_sections_tool_v2(self.management_db, self.management_db, active_doc_ids),
            make_generate_summary_tool_v2(self.management_db, self.management_db, active_doc_ids),
        ]

        executor = self._build(tools)

        print(f"[AGENT V2] Invoking with {len(chat_history)} history messages...", file=sys.stderr)
        result = executor.invoke({"input": user_message, "chat_history": chat_history})
        raw_output = result.get("output", "")

        print(f"[AGENT V2] Raw output: {raw_output[:200]}", file=sys.stderr)

        # Parse structured JSON from tool output
        # Handle case where agent called tool multiple times and concatenated outputs
        try:
            parsed = json.loads(raw_output)
            flat_citations = parsed.get("citations", [])
            return {
                "answer": parsed.get("answer", raw_output),
                "has_contradiction": parsed.get("has_contradiction", False),
                "citations": _group_citations(flat_citations)
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
                print(f"[AGENT V2] Merged {len(json_objects)} tool outputs", file=sys.stderr)
                return {
                    "answer": merged_answer,
                    "has_contradiction": has_contradiction,
                    "citations": _group_citations(merged_citations)
                }

            print(f"[AGENT V2] Could not parse JSON from output, returning as plain answer", file=sys.stderr)
            return {
                "answer": raw_output,
                "has_contradiction": False,
                "citations": []
            }
