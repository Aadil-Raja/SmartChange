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
import threading

settings = get_settings()


# ============================================================================
# REQUEST-BASED METADATA REGISTRY
# ============================================================================
# Stores tool metadata (tokens, citations, etc.) keyed by request_id
# This bypasses LLM's JSON rewriting which drops numeric fields
# Uses request_id instead of thread_id because LangChain may spawn new threads
_last_tool_metadata: dict = {}  # {request_id: {tokens_input, tokens_output, ...}}
_meta_lock = threading.Lock()


def _store_tool_metadata(
    request_id: str,
    tokens_input: int,
    tokens_output: int,
    call_type: str,
    citations: list,
    has_contradiction: bool
):
    """
    Called from inside the tool to persist metadata before LLM can corrupt it.
    Thread-safe storage keyed by request_id (not thread_id, since LangChain may spawn threads).
    
    Also stores under sentinel key "__latest__" as fallback when request_id can't be extracted.
    """
    metadata = {
        "request_id": request_id,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "call_type": call_type,
        "citations": citations,
        "has_contradiction": has_contradiction,
    }
    
    with _meta_lock:
        # Store under request_id
        _last_tool_metadata[request_id] = metadata
        # Also store under sentinel key as fallback
        _last_tool_metadata["__latest__"] = metadata
    
    print(f"[AGENT] ✅ Stored metadata for request {request_id}: tokens={tokens_input}/{tokens_output}", file=sys.stderr)


def _pop_tool_metadata(request_id: str = None) -> dict:
    """
    Retrieve and remove stored metadata for this request.
    Called immediately after invoke() returns.
    
    Args:
        request_id: The request ID to retrieve metadata for (may be None)
        
    Returns:
        Metadata dict, or {} if not found
        
    Fallback: If request_id is None or not found, tries sentinel key "__latest__"
    """
    with _meta_lock:
        # Try to get by request_id first
        if request_id and request_id in _last_tool_metadata:
            meta = _last_tool_metadata.pop(request_id)
            # Also clean up sentinel
            _last_tool_metadata.pop("__latest__", None)
            print(f"[AGENT] ✅ Retrieved metadata for request {request_id}: tokens={meta.get('tokens_input')}/{meta.get('tokens_output')}", file=sys.stderr)
            return meta
        
        # Fallback to sentinel key
        if "__latest__" in _last_tool_metadata:
            meta = _last_tool_metadata.pop("__latest__")
            # Clean up any stale request_id entries
            stale_id = meta.get("request_id")
            if stale_id:
                _last_tool_metadata.pop(stale_id, None)
            print(f"[AGENT] ✅ Retrieved metadata via sentinel (request_id was lost): tokens={meta.get('tokens_input')}/{meta.get('tokens_output')}", file=sys.stderr)
            return meta
        
        # Nothing found
        print(f"[AGENT] ⚠️  No metadata found for request {request_id} (and no sentinel)", file=sys.stderr)
        return {}

class AgentFinalOutput(BaseModel):
    """Structured output schema for agent's final response."""
    answer: str = Field(description="The complete answer to the user's question")
    has_contradiction: bool = Field(default=False, description="Whether contradictions were found")
    citations: List[dict] = Field(default_factory=list, description="List of citations")
    tokens_input: int = Field(default=0, description="Total input tokens used")
    tokens_output: int = Field(default=0, description="Total output tokens used")
    call_type: str = Field(default="", description="Type of tool call made")


def _format_dict_answer(answer: str) -> str:
    """
    Format Python dict-like answers into readable markdown.
    Converts {'key': 'value', 'list': [1, 2, 3]} into formatted text.
    """
    # Check if it looks like a Python dict
    if not (answer.strip().startswith('{') and ':' in answer):
        return answer
    
    try:
        # Try to parse as Python literal
        import ast
        obj = ast.literal_eval(answer)
        
        # Convert to readable markdown
        return _format_object_to_markdown(obj)
    except:
        # If parsing fails, return original
        return answer


def _format_object_to_markdown(obj, depth=0) -> str:
    """Recursively format Python objects to markdown."""
    if obj is None:
        return ""
    
    if not isinstance(obj, (dict, list)):
        return str(obj)
    
    result = []
    
    if isinstance(obj, list):
        # Format arrays as bullet points
        for item in obj:
            if isinstance(item, (dict, list)):
                result.append(_format_object_to_markdown(item, depth))
            else:
                result.append(f"- {item}")
        return '\n'.join(result)
    
    # Format dict with bold keys
    for key, value in obj.items():
        # Make key readable (replace underscores with spaces, capitalize)
        readable_key = key.replace('_', ' ').title()
        
        if isinstance(value, list):
            result.append(f"\n**{readable_key}:**")
            for item in value:
                if isinstance(item, (dict, list)):
                    result.append(_format_object_to_markdown(item, depth + 1))
                else:
                    result.append(f"- {item}")
        elif isinstance(value, dict):
            result.append(f"\n**{readable_key}:**")
            result.append(_format_object_to_markdown(value, depth + 1))
        else:
            result.append(f"**{readable_key}:** {value}")
    
    return '\n'.join(result)


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
            "snippets": c.get("snippets", [])
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
- ALWAYS pass the COMPLETE user question as-is in a SINGLE tool call
- DO NOT break the question into parts yourself
- DO NOT call the tool multiple times for one question
- Even if the user asks multiple questions (e.g., "What is X and what is Y?"), pass the ENTIRE question as ONE string
- The tool will automatically handle multi-part and multi-document questions internally
- Let the tool decide if decomposition is needed

Examples:
✅ CORRECT: doc_qa_multi_tool(questions=["What is Aadil's GPA and what are the PSL team names?"])
✅ CORRECT: doc_qa_multi_tool(questions=["What are teams in PSL and tell me about FYP?"])
❌ WRONG: Call doc_qa_multi_tool twice with questions=["What is Aadil's GPA?"] then questions=["What are PSL team names?"]
❌ WRONG: Call doc_qa_multi_tool with questions=["What is Aadil's GPA?", "What are PSL team names?"]
❌ WRONG: Rewrite or simplify the user's question

CRITICAL RULE: ONE user message = ONE tool call with ONE question string, no matter how many sub-questions it contains.

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

## HANDLING CORRECTIONS AND CLARIFICATIONS — CRITICAL

When users correct a previous answer (keywords: "not", "I meant", "I said", "I asked about", "no I want"), you MUST:
1. Detect that this is a correction - the previous answer was WRONG
2. Identify what was WRONG in the previous answer (the term/concept to EXCLUDE)
3. Identify what the user ACTUALLY wants (the term/concept to EMPHASIZE)
4. Rewrite the query to emphasize what they want and explicitly exclude what was wrong

Format: "What is X? I need X specifically, NOT Y. Focus only on X."

Use UPPERCASE, "specifically", "only", and "NOT" so retrieval and the LLM prioritize the right information.

Examples of correction requests:

- User says: "I asked about college not uni"
  History shows: Previous question was "where did Aadil study?" and answer mentioned "university"
  Enriched question: "Which college did Aadil study at? I need information about his COLLEGE education specifically, NOT university. Focus only on college-level education."

- User says: "no I meant his projects not experience"
  History shows: Previous answer was about work experience
  Enriched question: "What are Aadil's projects? I need information about his PROJECTS specifically, NOT his work experience. Focus only on project work."

- User says: "I said PSL teams not players"
  History shows: Previous answer listed player names
  Enriched question: "What are the PSL team names? I need the TEAM names specifically, NOT player names. Focus only on the teams."

- User says: "I want to know about his GPA not courses"
  History shows: Previous answer listed course names
  Enriched question: "What is Aadil's GPA? I need his GPA score specifically, NOT the course names. Focus only on the GPA number."

- User says: "I meant backend not frontend"
  History shows: Previous answer discussed frontend technologies
  Enriched question: "What backend technologies did Aadil use? I need BACKEND technologies specifically, NOT frontend. Focus only on backend stack."

CRITICAL RULES FOR CORRECTIONS:
- Always use the format: "What is X? I need X specifically, NOT Y. Focus only on X."
- Use UPPERCASE for the correct term (what to include)
- Use "NOT" before the wrong term (what to exclude)
- Use "specifically", "only", "Focus only on" to emphasize
- This helps retrieval find the right chunks and helps the LLM focus on correct information
- ALWAYS call doc_qa_multi_tool with the corrected enriched question

## HANDLING RE-EXPLANATION REQUESTS — CRITICAL

When the user asks to re-explain, elaborate, or simplify a PREVIOUS answer, you MUST:
1. Look at the Conversation History to find the last answer and identify the topic/entity discussed
2. Extract key details from that previous answer (names, concepts, features mentioned)
3. Create an enriched question that includes:
   - The specific topic name or entity
   - Request for simple/easy explanation
   - Key details or aspects mentioned in the previous response
4. Call doc_qa_multi_tool with this enriched question

Examples of re-explanation requests and how to enrich them:

- User says: "explain in easy words"
  History shows: Last answer was about "Aadil Raja's Digital Adoption Platform with AI chatbot, interactive guides, and analytics dashboard"
  Enriched question: "Explain Aadil Raja's Digital Adoption Platform in simple and easy words, including what the AI chatbot does, how the interactive guides work, and what the analytics dashboard shows"

- User says: "explain again"
  History shows: Last answer discussed "PSL tournament format with 6 teams playing double round-robin"
  Enriched question: "Explain the PSL tournament format again in detail, including how the 6 teams play in the double round-robin system and how playoffs work"

- User says: "tell me more details"
  History shows: Last answer was about "Aadil's internship at TechCorp as Backend Developer"
  Enriched question: "Tell me more details about Aadil Raja's internship at TechCorp as a Backend Developer, including his responsibilities, technologies used, and achievements"

- User says: "elaborate on that"
  History shows: Last answer mentioned "PSL's impact on Pakistan cricket through player development and international exposure"
  Enriched question: "Elaborate on PSL's impact on Pakistan cricket, specifically how it helps with player development and provides international exposure to local players"

- User says: "in simple terms"
  History shows: Last answer explained "microservices architecture with Docker containers and Kubernetes orchestration"
  Enriched question: "Explain the microservices architecture in simple terms, including what Docker containers are and how Kubernetes orchestration works"

- User says: "can you simplify?"
  History shows: Last answer was about "neural network training with backpropagation and gradient descent"
  Enriched question: "Explain neural network training in simple terms, including what backpropagation means and how gradient descent works"

CRITICAL RULES FOR RE-EXPLANATION:
- These are NOT summary requests → Do NOT call list_document_sections_tool
- These are NOT new questions → They refer to EXISTING conversation context
- ALWAYS enrich with: topic name + "in simple/easy words" + key details from previous answer
- ALWAYS call doc_qa_multi_tool with the enriched question
- The enriched question should be detailed enough to retrieve the same content but ask for simpler explanation

## TOOL SELECTION — READ THIS CAREFULLY

### ALWAYS use list_document_sections_tool when the user says ANY of:
- "summarize", "summary", "summarise" (when asking about the ENTIRE document)
- "overview", "give me an overview" (when asking about the ENTIRE document structure)
- "what is this document about", "what topics does this document cover"
- "what sections", "table of contents", "list all sections"
- Anything that asks for the DOCUMENT STRUCTURE or SECTION LIST
- Examples: "Can you summarize this document?", "Give me an overview of what's in this document", "What topics are covered?"

### NEVER use list_document_sections_tool for:
- "explain in easy words", "explain again", "tell me more", "elaborate", "in detail", "simplify", "can you explain"
- These are re-explanation requests → Use doc_qa_multi_tool with enriched question
- Follow-ups about a specific topic/entity from previous answer → Use doc_qa_multi_tool

### ALWAYS use generate_section_summary_tool when:
- User names a SPECIFIC section title (e.g. "summarize Day 3", "tell me about Chapter 2")
- This usually happens AFTER list_document_sections_tool has shown them the section list
- Examples: "Summarize Day 1", "Tell me about the Introduction section"

### ALWAYS use doc_qa_multi_tool when:
- User asks a specific factual question: "What is X?", "Who is Y?", "How does Z work?"
- User asks for details about a named person, project, achievement, or event
- User asks "does X include Y?", "what did X do at Y?"
- User asks to re-explain, elaborate, or simplify a previous answer (with enrichment)
- The question has a specific answer extractable from the document
- User asks multiple questions in one message (the tool handles this automatically)
- Examples: "What is the tournament format?", "Who are the notable players?", "How many teams participated?"
- Examples: "What is Aadil's GPA and what are the PSL team names?" (pass as single question)
- Examples: "explain in easy words" (after enriching with previous topic and details)

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
    def __init__(self, db: Session, management_db: Session, chathead=None):
        self.db = db
        self.management_db = management_db
        self.chathead = chathead  # NEW: Store chathead to access use_deep_reranker

        provider = settings.llm_provider.lower()
        model = settings.llm_model

        # Prepare kwargs for LLM initialization
        llm_kwargs = {"model": model, "temperature": settings.llm_temperature}
        if settings.max_output_tokens is not None:
            if provider == "openai":
                llm_kwargs["max_tokens"] = settings.max_output_tokens
            elif provider == "gemini":
                llm_kwargs["max_output_tokens"] = settings.max_output_tokens

        if provider == "openai":
            self.llm = ChatOpenAI(api_key=settings.openai_api_key, **llm_kwargs)
        elif provider == "gemini":
            self.llm = ChatGoogleGenerativeAI(google_api_key=settings.google_api_key, **llm_kwargs)
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
            handle_parsing_errors=True,
            return_intermediate_steps=True  # ✅ NEW: Expose tool outputs
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

        # Get use_deep_reranker flag from chathead
        use_deep_reranker = self.chathead.use_deep_reranker if self.chathead else False
        
        print(f"[AGENT V2] Using deep reranker: {use_deep_reranker}", file=sys.stderr)

        tools = [
            make_doc_qa_multi_tool(self.management_db, active_doc_ids, doc_histories, section_names_map, use_deep_reranker),
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
            early_stopping_method="force",  # Force stop after tool returns to prevent multiple calls
            return_intermediate_steps=True  # ✅ NEW: Expose tool outputs
        )
        
        # ✅ DEBUG: Print thread ID before invoke
        tid_before = threading.get_ident()
        print(f"[AGENT] Thread ID before invoke: {tid_before}", file=sys.stderr)
        
        result = executor_with_history.invoke({"input": user_message})
        raw_output = result.get("output", "")

        # ✅ DEBUG: Print thread ID after invoke
        tid_after = threading.get_ident()
        print(f"[AGENT] Thread ID after invoke: {tid_after}", file=sys.stderr)

        # ✅ NEW: Extract request_id from tool output to retrieve metadata
        # The tool includes request_id in its return dict, which survives JSON serialization
        request_id = None
        
        # Try to extract request_id from intermediate_steps first
        for action, observation in result.get("intermediate_steps", []):
            if isinstance(observation, dict) and "request_id" in observation:
                request_id = observation["request_id"]
                print(f"[AGENT] Found request_id in intermediate_steps: {request_id}", file=sys.stderr)
                break
            elif isinstance(observation, str):
                try:
                    obs_dict = json.loads(observation)
                    if "request_id" in obs_dict:
                        request_id = obs_dict["request_id"]
                        print(f"[AGENT] Found request_id in intermediate_steps (parsed): {request_id}", file=sys.stderr)
                        break
                except:
                    pass
        
        # If not in intermediate_steps, try raw_output
        if not request_id:
            if isinstance(raw_output, dict) and "request_id" in raw_output:
                request_id = raw_output["request_id"]
                print(f"[AGENT] Found request_id in raw_output dict: {request_id}", file=sys.stderr)
            elif isinstance(raw_output, str):
                try:
                    parsed = json.loads(raw_output)
                    if "request_id" in parsed:
                        request_id = parsed["request_id"]
                        print(f"[AGENT] Found request_id in raw_output (parsed): {request_id}", file=sys.stderr)
                except:
                    pass
        
        # Retrieve stored metadata using request_id (or sentinel if request_id is None)
        stored_meta = _pop_tool_metadata(request_id)
        print(f"[AGENT] Stored metadata: {stored_meta}", file=sys.stderr)
        
        # ✅ DEBUG: Check all stored request IDs
        with _meta_lock:
            print(f"[AGENT] All stored request IDs: {list(_last_tool_metadata.keys())}", file=sys.stderr)

        # Try to recover tool metadata (tokens, call_type) from intermediate_steps
        # when the LLM rewrites the tool output as plain text (losing the structured data)
        tool_metadata = {}
        
        # ✅ DEBUG: Print all intermediate steps
        print(f"[AGENT] Checking {len(result.get('intermediate_steps', []))} intermediate_steps for tool_metadata", file=sys.stderr)
        
        for idx, (action, observation) in enumerate(result.get("intermediate_steps", [])):
            obs = observation
            print(f"[AGENT] Step {idx}: observation type={type(obs)}", file=sys.stderr)
            
            # observation may be a dict, JSON string, or plain string
            if isinstance(obs, str):
                print(f"[AGENT] Step {idx}: observation is string, length={len(obs)}, preview={obs[:200]}", file=sys.stderr)
                try:
                    obs = json.loads(obs)
                    print(f"[AGENT] Step {idx}: parsed to dict, keys={list(obs.keys())}", file=sys.stderr)
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"[AGENT] Step {idx}: JSON parse failed: {e}", file=sys.stderr)
                    pass
            elif isinstance(obs, dict):
                print(f"[AGENT] Step {idx}: observation is dict, keys={list(obs.keys())}", file=sys.stderr)
            
            # ✅ FIXED: Also check for retrieved_contexts to ensure it's always captured
            if isinstance(obs, dict) and (obs.get("call_type") or obs.get("tokens_input") or obs.get("retrieved_contexts")):
                tool_metadata = obs
                print(f"[AGENT] Recovered tool_metadata from intermediate_steps: tokens_input={obs.get('tokens_input')}, tokens_output={obs.get('tokens_output')}, call_type={obs.get('call_type')}, retrieved_contexts={len(obs.get('retrieved_contexts', []))} chunks", file=sys.stderr)
                break
        
        print(f"[AGENT] raw_output type={type(raw_output)}, tool_metadata={bool(tool_metadata)}", file=sys.stderr)

        # Try normal JSON parsing first
        try:
            # If raw_output is already a dict, use it directly
            if isinstance(raw_output, dict):
                parsed = raw_output
                print(f"[AGENT] Parsed as dict: retrieved_contexts={len(parsed.get('retrieved_contexts', []))} chunks", file=sys.stderr)
            else:
                # Try to parse as JSON string
                parsed = json.loads(raw_output)
                print(f"[AGENT] Parsed from JSON: retrieved_contexts={len(parsed.get('retrieved_contexts', []))} chunks", file=sys.stderr)
                # ✅ DEBUG: Print token values from parsed dict
                print(f"[AGENT] Parsed dict tokens: tokens_input={parsed.get('tokens_input')}, tokens_output={parsed.get('tokens_output')}", file=sys.stderr)
            
            # Handle case where parsed is a list (multiple tool calls returned as array)
            if isinstance(parsed, list):
                print(f"[AGENT] Parsed output is a list with {len(parsed)} items, merging...", file=sys.stderr)
                
                # Merge all items in the list
                merged_answers = []
                all_citations = []
                all_retrieved_contexts = []  # ✅ NEW: Collect all retrieved contexts
                has_any_contradiction = False
                total_tokens_input = 0
                total_tokens_output = 0
                
                for item in parsed:
                    if not isinstance(item, dict):
                        continue
                    
                    # Collect answers
                    ans = item.get("answer", "")
                    if isinstance(ans, list):
                        merged_answers.extend(ans)
                    else:
                        merged_answers.append(str(ans))
                    
                    # Deduplicate citations
                    existing_keys = {
                        (c.get('doc_id'), c.get('page'), c.get('section'))
                        for c in all_citations
                    }
                    for citation in item.get("citations", []):
                        key = (citation.get('doc_id'), citation.get('page'), citation.get('section'))
                        if key not in existing_keys:
                            all_citations.append(citation)
                            existing_keys.add(key)
                    
                    # ✅ NEW: Collect retrieved contexts (no deduplication - keep all chunks)
                    contexts = item.get("retrieved_contexts", [])
                    if contexts:
                        all_retrieved_contexts.extend(contexts)
                    
                    # Track contradictions and tokens
                    if item.get("has_contradiction"):
                        has_any_contradiction = True
                    total_tokens_input += item.get("tokens_input", 0)
                    total_tokens_output += item.get("tokens_output", 0)
                
                # Create merged dict
                parsed = {
                    "answer": "\n\n".join(str(a) for a in merged_answers if a),
                    "citations": all_citations,
                    "retrieved_contexts": all_retrieved_contexts,  # ✅ NEW: Include merged contexts
                    "has_contradiction": has_any_contradiction,
                    "tokens_input": total_tokens_input,
                    "tokens_output": total_tokens_output,
                    "call_type": "doc_qa"
                }
                print(f"[AGENT] Merged list into single response with {len(all_citations)} citations and {len(all_retrieved_contexts)} contexts", file=sys.stderr)
            
            flat_citations = parsed.get("citations", []) or tool_metadata.get("citations", [])

            # Use structured output schema for consistency
            raw_call_type = parsed.get("call_type") or tool_metadata.get("call_type") or "doc_qa"

            # Ensure answer is always a string
            raw_answer = parsed.get("answer", str(raw_output))
            if not isinstance(raw_answer, str):
                raw_answer = str(raw_answer)

            # ✅ ROBUST TOKEN RECOVERY: Priority chain
            # 1. stored_meta (thread-local, written by tool before LLM sees anything) ← ALWAYS WINS
            # 2. tool_metadata (from intermediate_steps, sometimes populated)
            # 3. parsed (from raw_output, LLM-rewritten, unreliable for numeric fields)
            
            if stored_meta:
                # stored_meta is written by the tool BEFORE the LLM gets a chance to corrupt it
                final_tokens_input = stored_meta["tokens_input"]
                final_tokens_output = stored_meta["tokens_output"]
                final_call_type = stored_meta.get("call_type") or raw_call_type
                
                # Also prefer stored citations/contradiction if LLM dropped them
                if not flat_citations:
                    flat_citations = stored_meta.get("citations", [])
                if not parsed.get("has_contradiction"):
                    has_contradiction = stored_meta.get("has_contradiction", False)
                else:
                    has_contradiction = parsed.get("has_contradiction", False)
                
                print(f"[AGENT] ✅ Using stored_meta tokens: input={final_tokens_input}, output={final_tokens_output}", file=sys.stderr)
                
            elif tool_metadata:
                # Fallback to intermediate_steps
                final_tokens_input = tool_metadata.get("tokens_input") or 0
                final_tokens_output = tool_metadata.get("tokens_output") or 0
                final_call_type = tool_metadata.get("call_type") or raw_call_type
                has_contradiction = parsed.get("has_contradiction", False) or tool_metadata.get("has_contradiction", False)
                
                print(f"[AGENT] ⚠️  Using intermediate_steps tokens: input={final_tokens_input}, output={final_tokens_output}", file=sys.stderr)
                
            else:
                # Last resort: use parsed (unreliable)
                final_tokens_input = parsed.get("tokens_input") or 0
                final_tokens_output = parsed.get("tokens_output") or 0
                final_call_type = raw_call_type
                has_contradiction = parsed.get("has_contradiction", False)
                
                print(f"[AGENT] ❌ No metadata found, using parsed tokens: input={final_tokens_input}, output={final_tokens_output}", file=sys.stderr)
            
            structured_response = AgentFinalOutput(
                answer=raw_answer,
                has_contradiction=has_contradiction,
                citations=flat_citations,
                tokens_input=final_tokens_input,  # ✅ Use prioritized values
                tokens_output=final_tokens_output,  # ✅ Use prioritized values
                call_type=final_call_type,
            )
            
            print(f"[AGENT] Structured parsing: tokens_input={structured_response.tokens_input}, tokens_output={structured_response.tokens_output}", file=sys.stderr)
            
            return {
                "answer": structured_response.answer,
                "has_contradiction": structured_response.has_contradiction,
                "citations": _group_citations(structured_response.citations),
                "tokens_input": structured_response.tokens_input,
                "tokens_output": structured_response.tokens_output,
                "call_type": structured_response.call_type,
            }
        
        except (json.JSONDecodeError, TypeError, ValueError, AttributeError) as e:
            # Fallback: Use regex extraction for malformed output
            print(f"[AGENT] JSON parsing failed: {e}, using regex fallback", file=sys.stderr)
            import re
            
            # Convert to string if it's a dict
            if isinstance(raw_output, dict):
                raw_str = str(raw_output)
            else:
                raw_str = raw_output
            
            print(f"[AGENT] Using regex extraction for raw output", file=sys.stderr)
            
            # Extract all answers (handles both "answer": and 'answer':)
            answer_pattern = r'["\']answer["\']\s*:\s*["\']([^"\']*(?:["\']["\']|\\["\'])*[^"\']*)["\']'
            answers = re.findall(answer_pattern, raw_str, re.DOTALL)
            
            # If no answers found with quotes, try without quotes (for multiline strings)
            if not answers:
                # Try to find answer values more broadly
                answer_pattern2 = r'["\']answer["\']\s*:\s*(["\'])(((?!\1).)*)\1'
                matches = re.finditer(answer_pattern2, raw_str, re.DOTALL)
                answers = [m.group(2) for m in matches]
            
            # Extract has_contradiction
            contradiction_pattern = r'["\']has_contradiction["\']\s*:\s*(true|false|True|False)'
            contradictions = re.findall(contradiction_pattern, raw_str, re.IGNORECASE)
            has_contradiction = any(c.lower() == 'true' for c in contradictions)
            
            # Extract tokens
            tokens_input_pattern = r'["\']tokens_input["\']\s*:\s*(\d+)'
            tokens_inputs = [int(x) for x in re.findall(tokens_input_pattern, raw_str)]
            total_tokens_input = sum(tokens_inputs) if tokens_inputs else tool_metadata.get("tokens_input", 0)
            
            tokens_output_pattern = r'["\']tokens_output["\']\s*:\s*(\d+)'
            tokens_outputs = [int(x) for x in re.findall(tokens_output_pattern, raw_str)]
            total_tokens_output = sum(tokens_outputs) if tokens_outputs else tool_metadata.get("tokens_output", 0)
            
            # Build citations from extracted data
            citations = []
            seen_citations = set()
            
            # Try to extract full citation objects
            citation_pattern = r'\{[^}]*["\']doc_id["\']\s*:\s*(\d+)[^}]*["\']doc_title["\']\s*:\s*["\']([^"\']+)["\'][^}]*\}'
            for match in re.finditer(citation_pattern, raw_str):
                doc_id = int(match.group(1))
                doc_title = match.group(2)
                
                # Extract other citation fields from this block
                block = match.group(0)
                page_match = re.search(r'["\']page["\']\s*:\s*(\d+)', block)
                section_match = re.search(r'["\']section["\']\s*:\s*["\']([^"\']+)["\']', block)
                url_match = re.search(r'["\']cloudinary_url["\']\s*:\s*["\']([^"\']+)["\']', block)
                
                page = int(page_match.group(1)) if page_match else None
                section = section_match.group(1) if section_match else None
                url = url_match.group(1) if url_match else None
                
                # Deduplicate
                key = (doc_id, page, section)
                if key not in seen_citations:
                    citations.append({
                        "doc_id": doc_id,
                        "doc_title": doc_title,
                        "cloudinary_url": url,
                        "page": page,
                        "section": section
                    })
                    seen_citations.add(key)
            
            # Merge all answers
            merged_answer = "\n\n".join(answers) if answers else str(raw_output)
            
            print(f"[AGENT] Regex extracted: {len(answers)} answers, {len(citations)} citations", file=sys.stderr)
            
            structured_response = AgentFinalOutput(
                answer=merged_answer,
                has_contradiction=has_contradiction or tool_metadata.get("has_contradiction", False),
                citations=citations or tool_metadata.get("citations", []),
                tokens_input=total_tokens_input,
                tokens_output=total_tokens_output,
                call_type=tool_metadata.get("call_type", "doc_qa"),
            )
            
            print(f"[AGENT] Regex fallback: tokens_input={structured_response.tokens_input}, tokens_output={structured_response.tokens_output}", file=sys.stderr)
            
            # Format dict-like answers to readable markdown
            formatted_answer = _format_dict_answer(structured_response.answer)
            
            return {
                "answer": formatted_answer,
                "has_contradiction": structured_response.has_contradiction,
                "citations": _group_citations(structured_response.citations),
                "tokens_input": structured_response.tokens_input,
                "tokens_output": structured_response.tokens_output,
                "call_type": structured_response.call_type,
            }

