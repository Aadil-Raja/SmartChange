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
from pydantic import BaseModel, Field

from app.core.config import get_settings
import sys
import json

settings = get_settings()


class AgentFinalOutput(BaseModel):
    """Structured output schema for agent's final response."""
    answer: str = Field(description="The complete answer to the user's question")
    has_contradiction: bool = Field(default=False, description="Whether contradictions were found")
    citations: List[dict] = Field(default_factory=list, description="List of citations")
    tokens_input: int = Field(default=0, description="Total input tokens used")
    tokens_output: int = Field(default=0, description="Total output tokens used")
    call_type: str = Field(default="", description="Type of tool call made")


def _group_citations(flat_citations: list) -> list:
    """
    Convert flat list of {doc_id, doc_title, cloudinary_url, page, section, snippets}
    into grouped list of {doc_id, doc_title, cloudinary_url, references: [{page, section, snippets}]}.
    
    Note: snippets is now an array of strings from the LLM, not a single string.
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
            "snippets": c.get("snippets", [])  # ✅ Array of snippets from LLM
        })
    return list(grouped.values())

SYSTEM_PROMPT_V2 = """
You are a corporate training assistant.

Conversation History:
{chat_history}

Available tools:
- doc_qa_multi_tool: For specific factual questions about document content (handles multi-document questions automatically)
- list_document_sections_tool: FIRST STEP for any summary/overview request — lists sections so the user can pick one
- generate_section_summary_tool: SECOND STEP — generates summary of a specific named section

## CRITICAL: YOU MUST ALWAYS USE A TOOL

You MUST NEVER answer questions directly from your own knowledge or from the conversation history.
EVERY response MUST come from calling one of the three tools above.
Even if you think you know the answer from the history, you MUST call a tool to retrieve it from the document.

## CRITICAL: PASS FULL QUESTIONS TO TOOLS

When calling doc_qa_multi_tool:
- ALWAYS pass the COMPLETE user question as-is
- DO NOT break the question into parts yourself
- DO NOT call the tool multiple times for one question
- The tool will automatically handle multi-document questions internally
- Let the tool decide if decomposition is needed

Examples:
✅ CORRECT: doc_qa_multi_tool(question="What is Aadil's GPA and what are the PSL team names?")
❌ WRONG: Call doc_qa_multi_tool twice with separate questions
❌ WRONG: Rewrite or simplify the user's question

## QUERY ENRICHMENT — DO THIS BEFORE EVERY TOOL CALL

Before selecting a tool, always check if the user's message is a short or vague
follow-up (e.g. "can you tell me in detail", "what about his projects?", "tell me more", "elaborate", "and?", "what else?", "in detail", "explain further").

If it is, reconstruct a FULL, self-contained question by:
1. Looking at the Conversation History above to find what topic was last discussed
2. Identifying the specific entity, section, or topic in focus
3. Appending relevant context from the history to make the question complete

Examples of enrichment:
- User says: "can you tell me in detail"
  History shows: last answer was about Aadil Raja's FYP (Digital Adoption Platform)
  Enriched question: "Tell me in detail about Aadil Raja's Digital Adoption Platform final year project, including its features, tech stack, and architecture"

- User says: "what about his experience?"
  History shows: conversation is about Aadil Raja's resume
  Enriched question: "What is Aadil Raja's work experience and internships?"

- User says: "elaborate on that"
  History shows: last answer discussed the PSL's impact on Pakistan cricket
  Enriched question: "Elaborate on PSL's impact on Pakistan cricket"

- User says: "and the chatbot?"
  History shows: previous message was about Aadil's Digital Adoption Platform
  Enriched question: "What are the details of the chatbot in Aadil Raja's Digital Adoption Platform?"

RULE: Never pass a vague short message directly to a tool. Always enrich it first. The enriched question is what you pass as the `question` argument to the tool. This enrichment happens silently — do not tell the user you are enriching the query.

## TOOL SELECTION — READ THIS CAREFULLY

### ALWAYS use list_document_sections_tool when the user says ANY of:
- "summarize", "summary", "summarise"
- "overview", "give me an overview"
- "what is this document about", "explain this document"
- "what topics", "what sections", "table of contents"
- "tell me about [document/topic]" when asking about the document as a whole
- Anything that sounds like they want a high-level digest of the document
- Examples: "Can you summarize this?", "Give me an overview", "What topics are covered?"

### ALWAYS use generate_section_summary_tool when:
- User names a SPECIFIC section title (e.g. "summarize Day 3", "tell me about Chapter 2")
- This usually happens AFTER list_document_sections_tool has shown them the section list
- Examples: "Summarize Day 1", "Tell me about the Introduction section"

### ALWAYS use doc_qa_multi_tool when:
- User asks a specific factual question: "What is X?", "Who is Y?", "How does Z work?"
- User asks for details about a named person, project, achievement, or event
- User asks "does X include Y?", "what did X do at Y?"
- The question has a specific answer extractable from the document
- User asks multiple questions in one message (the tool handles this automatically)
- Examples: "What is the tournament format?", "Who are the notable players?", "How many teams participated?"
- Examples: "What is Aadil's GPA and what are the PSL team names?" (pass as single question)

### NEVER use doc_qa_multi_tool for:
- Summary or overview requests — even if the user says "can you tell me more" or "in detail" after asking about a topic
- Follow-ups about summaries should go to list_document_sections_tool
- If the previous context was about summaries/overviews, stay with section tools

## CRITICAL INSTRUCTIONS:
1. YOU MUST ALWAYS CALL A TOOL. NEVER answer directly without calling a tool.
2. ALWAYS pass the COMPLETE question to doc_qa_multi_tool - do NOT break it into parts.
3. CALL doc_qa_multi_tool ONLY ONCE per user message, even if there are multiple questions.
4. Every tool returns a JSON string with keys: "answer", "has_contradiction", "citations".
5. After the tool returns, you MUST output ONLY the exact JSON string the tool returned.
6. Do NOT add any text before or after the JSON.
7. Do NOT rewrite, summarize, or reformat the tool output.
8. Do NOT strip or remove the citations or has_contradiction fields.
9. Your ENTIRE final response must be ONLY the JSON string from the tool, nothing else.

CRITICAL: Output ONLY the JSON. No explanations, no formatting, no additional text.

## STRICT TOOL CHAINING RULES:
- doc_qa_multi_tool is FINAL. After calling it ONCE, STOP IMMEDIATELY.
- list_document_sections_tool is FINAL. After calling it, STOP IMMEDIATELY.
- generate_section_summary_tool is FINAL. After calling it, STOP IMMEDIATELY.
- NEVER chain tools. One tool call per turn. The tool output is complete and needs no enhancement.
- If list_document_sections_tool returns "Multiple documents selected", return that message as-is. Do NOT try another tool.
- CRITICAL: If user asks multiple questions in one message (e.g. "What are Aadil's projects and what are PSL teams?"), pass the ENTIRE question to doc_qa_multi_tool in ONE SINGLE call. The tool will handle decomposition internally. DO NOT call the tool multiple times.
- CRITICAL: If user asks for multiple sections (e.g. "Day 1 and Day 7", "all days", "days 5 to 12"), call generate_section_summary_tool EXACTLY ONCE with selection_type='many'. NEVER call it multiple times.

REMEMBER: You are a tool-calling agent. You MUST call a tool for every user question. Never answer directly. Always pass complete questions to tools.
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
            max_iterations=1,
            handle_parsing_errors=True
        )
        return executor

    def _format_doc_histories_for_prompt(self, doc_histories: Dict, active_doc_ids: List[int]) -> str:
        """
        Format per-document histories into a single string for system prompt.
        
        Format:
        [Doc Title 1]:
        Summary: ... (all previously summarized conversation)
        Recent messages: (all messages NOT in summary)
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
            
            # Add all unsummarized messages
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
        doc_histories: Dict = None,  # NEW: per-doc histories
        section_names_map: Dict[int, List[str]] = None  # NEW: pre-fetched sections
    ) -> Dict[str, Any]:
        from app.services.tools.doc_qa_multi import make_doc_qa_multi_tool
        from app.services.tools.section_summary_tool_v2 import (
            make_list_sections_tool_v2,
            make_generate_summary_tool_v2,
        )

        if doc_histories is None:
            doc_histories = {}

        # Format doc histories for system prompt
        chat_history_string = self._format_doc_histories_for_prompt(doc_histories, active_doc_ids)

        tools = [
            make_doc_qa_multi_tool(self.management_db, active_doc_ids, doc_histories, section_names_map),
            make_list_sections_tool_v2(self.management_db, self.management_db, active_doc_ids),
            make_generate_summary_tool_v2(self.management_db, self.management_db, active_doc_ids),
        ]

        executor = self._build(tools)
        
        # Escape curly braces in chat history to prevent template variable errors
        # Replace { with {{ and } with }} so they're treated as literal characters
        escaped_chat_history = chat_history_string.replace('{', '{{').replace('}', '}}')
        
        # Format system prompt with escaped chat history
        formatted_system_prompt = SYSTEM_PROMPT_V2.format(chat_history=escaped_chat_history)
        
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
            max_iterations=2,  # Need 2: one to call tool, one to return output
            handle_parsing_errors=True,
            early_stopping_method="force"  # Force stop after tool returns to prevent multiple calls
        )
        
        result = executor_with_history.invoke({"input": user_message})
        raw_output = result.get("output", "")

        # Try to recover tool metadata (tokens, call_type) from intermediate_steps
        # when the LLM rewrites the tool output as plain text (losing the structured data)
        tool_metadata = {}
        for action, observation in result.get("intermediate_steps", []):
            obs = observation
            # observation may be a dict, JSON string, or plain string
            if isinstance(obs, str):
                try:
                    obs = json.loads(obs)
                except (json.JSONDecodeError, TypeError):
                    pass
            if isinstance(obs, dict) and (obs.get("call_type") or obs.get("tokens_input")):
                tool_metadata = obs
                print(f"[AGENT] Recovered tool_metadata from intermediate_steps: tokens_input={obs.get('tokens_input')}, tokens_output={obs.get('tokens_output')}, call_type={obs.get('call_type')}", file=sys.stderr)
                break
        
        print(f"[AGENT] raw_output type={type(raw_output)}, tool_metadata={bool(tool_metadata)}", file=sys.stderr)

        # Handle both dict and JSON string responses from tools
        # Tools now return dicts directly, but agent might still stringify them
        try:
            # If raw_output is already a dict, use it directly
            if isinstance(raw_output, dict):
                parsed = raw_output
            else:
                # Try to parse as JSON string
                parsed = json.loads(raw_output)
            
            flat_citations = parsed.get("citations", []) or tool_metadata.get("citations", [])

            # Use structured output schema for consistency
            # Prefer parsed values, fall back to tool_metadata from intermediate_steps
            raw_call_type = parsed.get("call_type") or tool_metadata.get("call_type") or ""
            if not raw_call_type:
                raw_call_type = "doc_qa"

            # Ensure answer is always a string
            raw_answer = parsed.get("answer", str(raw_output))
            if not isinstance(raw_answer, str):
                raw_answer = str(raw_answer)

            structured_response = AgentFinalOutput(
                answer=raw_answer,
                has_contradiction=parsed.get("has_contradiction", False) or tool_metadata.get("has_contradiction", False),
                citations=flat_citations,
                # ALWAYS use tool_metadata for tokens when available — it's the raw tool output
                # before the LLM potentially rewrites/zeroes them out.
                # Only fall back to parsed values if tool_metadata has nothing.
                tokens_input=tool_metadata.get("tokens_input") if tool_metadata.get("tokens_input") is not None else parsed.get("tokens_input", 0),
                tokens_output=tool_metadata.get("tokens_output") if tool_metadata.get("tokens_output") is not None else parsed.get("tokens_output", 0),
                call_type=raw_call_type,
            )
            
            print(f"[AGENT] Happy path: tokens_input={structured_response.tokens_input}, tokens_output={structured_response.tokens_output}, call_type={structured_response.call_type}", file=sys.stderr)
            
            return {
                "answer": structured_response.answer,
                "has_contradiction": structured_response.has_contradiction,
                "citations": _group_citations(structured_response.citations),
                "tokens_input": structured_response.tokens_input,
                "tokens_output": structured_response.tokens_output,
                "call_type": structured_response.call_type,
            }
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            print(f"[AGENT] Failed to parse tool output: {e}", file=sys.stderr)
            print(f"[AGENT] Raw output type: {type(raw_output)}", file=sys.stderr)
            print(f"[AGENT] Raw output: {str(raw_output)[:200]}...", file=sys.stderr)
            
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
                    idx = end_idx  # end_idx is absolute position, not delta
                except json.JSONDecodeError:
                    idx += 1

            if json_objects:
                merged_parts = []
                for o in json_objects:
                    ans = o.get("answer", "")
                    if isinstance(ans, list):
                        ans = " ".join(str(x) for x in ans)
                    merged_parts.append(str(ans))
                # Use only the FIRST object's answer (tool output), not the LLM's rewrite
                merged_answer = merged_parts[0] if merged_parts else ""
                merged_citations = json_objects[0].get("citations", [])
                has_contradiction = json_objects[0].get("has_contradiction", False)
                
                # Always prefer tool_metadata (from intermediate_steps) for tokens
                # Fall back to first json_object (the actual tool output, not LLM rewrite)
                first_obj = json_objects[0]
                ti = tool_metadata.get("tokens_input") if tool_metadata.get("tokens_input") is not None else first_obj.get("tokens_input", 0)
                to = tool_metadata.get("tokens_output") if tool_metadata.get("tokens_output") is not None else first_obj.get("tokens_output", 0)
                ct = tool_metadata.get("call_type") or first_obj.get("call_type") or "doc_qa"
                
                print(f"[AGENT] Multi-JSON path: tokens_input={ti}, tokens_output={to}, call_type={ct}", file=sys.stderr)
                
                structured_response = AgentFinalOutput(
                    answer=merged_answer,
                    has_contradiction=has_contradiction,
                    citations=merged_citations,
                    tokens_input=ti,
                    tokens_output=to,
                    call_type=ct,
                )
                
                return {
                    "answer": structured_response.answer,
                    "has_contradiction": structured_response.has_contradiction,
                    "citations": _group_citations(structured_response.citations),
                    "tokens_input": structured_response.tokens_input,
                    "tokens_output": structured_response.tokens_output,
                    "call_type": structured_response.call_type,
                }

            # Last resort: return raw output as answer, use tool_metadata if available
            print(f"[AGENT] Could not parse any JSON, returning raw output", file=sys.stderr)
            raw_answer_str = raw_output if isinstance(raw_output, str) else str(raw_output)
            return {
                "answer": raw_answer_str,
                "has_contradiction": tool_metadata.get("has_contradiction", False),
                "citations": tool_metadata.get("citations", []),
                "tokens_input": tool_metadata.get("tokens_input", 0),
                "tokens_output": tool_metadata.get("tokens_output", 0),
                "call_type": tool_metadata.get("call_type") or "doc_qa",
            }
