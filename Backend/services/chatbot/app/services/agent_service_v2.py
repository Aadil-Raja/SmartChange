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
    Convert flat list of {doc_id, doc_title, page, section, snippet}
    into grouped list of {doc_id, doc_title, references: [{page, section, snippet}]}.
    """
    grouped = {}
    for c in flat_citations:
        doc_id = c.get("doc_id")
        if doc_id not in grouped:
            grouped[doc_id] = {
                "doc_id": doc_id,
                "doc_title": c.get("doc_title", f"Document {doc_id}"),
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

Tool selection:
- Use list_document_sections_tool when user asks for overview, summary, topics, sections.
- Use generate_section_summary_tool when user names a specific section.
- Use doc_qa_tool for all specific factual questions about content.
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
        try:
            parsed = json.loads(raw_output)
            flat_citations = parsed.get("citations", [])
            return {
                "answer": parsed.get("answer", raw_output),
                "has_contradiction": parsed.get("has_contradiction", False),
                "citations": _group_citations(flat_citations)
            }
        except (json.JSONDecodeError, TypeError):
            print(f"[AGENT V2] Could not parse JSON from output, returning as plain answer", file=sys.stderr)
            return {
                "answer": raw_output,
                "has_contradiction": False,
                "citations": []
            }
