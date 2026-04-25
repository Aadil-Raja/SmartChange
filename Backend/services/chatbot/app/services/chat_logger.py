# app/services/chat_logger.py
"""
Logging service for chat interactions.
Creates a single log file per chathead that tracks the entire conversation flow.
"""
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path


class ChatLogger:
    """Logger for tracking chat interactions with detailed RAG pipeline information."""
    
    def __init__(self, chathead_id: int):
        self.chathead_id = chathead_id
        
        # Get the absolute path to the app directory
        app_dir = Path(__file__).parent.parent
        self.log_dir = app_dir / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / f"chathead_{chathead_id}.log"
        
        print(f"[LOGGER INIT] Log directory: {self.log_dir.absolute()}", file=sys.stderr)
        print(f"[LOGGER INIT] Log file: {self.log_file.absolute()}", file=sys.stderr)
        
        if not self.log_file.exists():
            self._initialize_log()
        else:
            print(f"[LOGGER] Log file exists, will append to it", file=sys.stderr)
    
    def _initialize_log(self):
        """Initialize the log file with header (only for new files)."""
        try:
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.write("="*100 + "\n")
                f.write(f"CHAT LOG - Chathead ID: {self.chathead_id}\n")
                f.write(f"Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("="*100 + "\n\n")
        except Exception as e:
            print(f"[LOGGER] Error creating log file: {e}", file=sys.stderr)
    
    
    def log_turn(
        self,
        user_message: str,
        active_doc_ids: List[int],
        retrieved_chunks: Dict[int, List[Dict]],
        dropped_chunks: Dict[int, List[Dict]],
        passing_chunks: Dict[int, List[Dict]],
        thresholds: Dict[str, float],
        doc_histories: Dict[int, Dict],
        llm_answer: str,
        citations: List[Dict],
        has_contradiction: bool
    ):
        """Log a complete turn of the conversation."""
        try:
            print(f"[LOGGER] Starting log_turn for {self.log_file}", file=sys.stderr)

            with open(self.log_file, 'a', encoding='utf-8') as f:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                # Header
                f.write("\n" + "="*100 + "\n")
                f.write(f"TURN LOGGED AT: {timestamp}\n")
                f.write("="*100 + "\n\n")

                # User message
                f.write("┌─ USER MESSAGE\n")
                f.write(f"│ {user_message}\n")
                f.write(f"└─ Active Documents: {active_doc_ids}\n\n")

                # Retrieved chunks
                f.write("┌─ CHUNK RETRIEVAL (HYBRID: Dense + Sparse + Reranking)\n")
                for doc_id, chunks in retrieved_chunks.items():
                    doc_title = chunks[0].get('doc_title', f'Document {doc_id}') if chunks else f'Document {doc_id}'
                    f.write(f"│\n│ Document {doc_id}: {doc_title}\n")
                    f.write(f"│ Retrieved {len(chunks)} chunks\n")

                    for i, chunk in enumerate(chunks, 1):
                        score = chunk.get('score', 0)
                        dense_score = chunk.get('dense_score', 0)
                        sparse_score = chunk.get('sparse_score', 0)
                        rerank_score = chunk.get('rerank_score', 0)
                        combined_score = chunk.get('combined_score', 0)
                        page = chunk.get('start_page_num', '?')
                        section = chunk.get('section_title', 'Unknown')
                        preview = chunk.get('text', '')[:100].replace('\n', ' ')
                        
                        f.write(f"│   {i}. Final Score: {score:.4f} | Page: {page} | Section: {section}\n")
                        
                        # Show hybrid retrieval breakdown if available
                        if dense_score or sparse_score or rerank_score:
                            f.write(f"│      ├─ Dense (Embeddings): {dense_score:.4f}\n")
                            f.write(f"│      ├─ Sparse (BM25): {sparse_score:.4f}\n")
                            if combined_score:
                                f.write(f"│      ├─ Combined: {combined_score:.4f}\n")
                            if rerank_score:
                                f.write(f"│      └─ Reranked: {rerank_score:.4f}\n")
                        
                        f.write(f"│      Preview: {preview}...\n")

                f.write("└─\n\n")

                # Thresholds
                f.write("┌─ FILTERING THRESHOLDS\n")
                f.write(f"│ Best Score: {thresholds.get('best_score', 0):.4f}\n")
                f.write(f"│ Best Doc ID: {thresholds.get('best_doc_id', 'N/A')}\n")
                f.write(f"│ Same-Doc Threshold: {thresholds.get('same_doc_threshold', 0):.4f}\n")
                f.write(f"│ Other-Doc Threshold: {thresholds.get('other_doc_threshold', 0):.4f}\n")
                f.write("└─\n\n")

                # Dropped chunks
                if dropped_chunks:
                    f.write("┌─ DROPPED CHUNKS (Below Threshold)\n")
                    for doc_id, chunks in dropped_chunks.items():
                        doc_title = chunks[0].get('doc_title', f'Document {doc_id}') if chunks else f'Document {doc_id}'
                        f.write(f"│\n│ Document {doc_id}: {doc_title}\n")
                        f.write(f"│ Dropped {len(chunks)} chunks\n")

                        for i, chunk in enumerate(chunks, 1):
                            score = chunk.get('score', 0)
                            threshold = thresholds.get(
                                'same_doc_threshold' if doc_id == thresholds.get('best_doc_id')
                                else 'other_doc_threshold', 0
                            )
                            f.write(f"│   {i}. Score: {score:.4f} < Threshold: {threshold:.4f}\n")

                    f.write("└─\n\n")

                # Passing chunks
                f.write("┌─ PASSING CHUNKS (Above Threshold)\n")
                for doc_id, chunks in passing_chunks.items():
                    doc_title = chunks[0].get('doc_title', f'Document {doc_id}') if chunks else f'Document {doc_id}'
                    f.write(f"│\n│ Document {doc_id}: {doc_title}\n")
                    f.write(f"│ Passed {len(chunks)} chunks\n")

                    for i, chunk in enumerate(chunks, 1):
                        score = chunk.get('score', 0)
                        page = chunk.get('start_page_num', '?')
                        f.write(f"│   {i}. Score: {score:.4f} | Page: {page}\n")

                f.write("└─\n\n")
                # Document histories
                f.write("┌─ DOCUMENT HISTORIES (Passed to LLM)\n")
                passing_doc_ids = list(passing_chunks.keys())

                for doc_id in passing_doc_ids:
                    if doc_id in doc_histories:
                        history = doc_histories[doc_id]

                        f.write(f"│\n│ ╔══════════════════════════════════════════════════════════════════════════════\n")
                        f.write(f"│ ║ Document {doc_id}: {history.get('doc_title', 'Unknown')}\n")
                        f.write(f"│ ╚══════════════════════════════════════════════════════════════════════════════\n")

                        # Summary
                        if history.get('summary'):
                            f.write(f"│\n│   📝 SUMMARY:\n")
                            f.write(f"│   ┌─────────────────────────────────────────────────────────────────────────\n")
                            summary_lines = history['summary'].split('\n')
                            for line in summary_lines:
                                f.write(f"│   │ {line}\n")
                            f.write(f"│   └─────────────────────────────────────────────────────────────────────────\n")
                        else:
                            f.write(f"│\n│   📝 SUMMARY: None\n")

                        # Unsummarized messages
                        messages = history.get('last_n_messages', [])
                        if messages:
                            f.write(f"│\n│   💬 UNSUMMARIZED MESSAGES ({len(messages)} messages):\n")
                            f.write(f"│   ┌─────────────────────────────────────────────────────────────────────────\n")

                            for idx, msg in enumerate(messages, 1):
                                role = "USER" if hasattr(msg, 'role') and str(msg.role) == "MessageRole.USER" else "ASSISTANT"
                                msg_text = msg.message if hasattr(msg, 'message') else str(msg)
                                msg_id = msg.id if hasattr(msg, 'id') else '?'

                                f.write(f"│   │ [{idx}] Message ID: {msg_id} | Role: {role}\n")

                                for line in msg_text.split('\n'):
                                    f.write(f"│   │     {line}\n")

                                f.write(f"│   │ ─────────────────────────────────────────────────────────────────────\n")

                            f.write(f"│   └─────────────────────────────────────────────────────────────────────────\n")
                        else:
                            f.write(f"│\n│   💬 UNSUMMARIZED MESSAGES: None\n")

                        f.write(f"│\n")

                f.write("└─\n\n")
                # LLM Response
                f.write("┌─ LLM RESPONSE\n")
                f.write(f"│ Has Contradiction: {has_contradiction}\n")
                f.write(f"│ Citations: {len(citations)}\n")
                f.write(f"│\n│ Answer:\n")

                for line in llm_answer.split('\n'):
                    f.write(f"│ {line}\n")

                f.write("└─\n\n")

                # Citations
                if citations:
                    f.write("┌─ CITATIONS\n")
                    for i, citation in enumerate(citations, 1):
                        f.write(f"│ {i}. Doc {citation.get('doc_id')}: {citation.get('doc_title', 'Unknown')}\n")
                        f.write(f"│    Page: {citation.get('page', '?')} | Section: {citation.get('section', 'Unknown')}\n")
                        f.write(f"│    Snippet: {citation.get('snippet', '')[:100]}...\n")
                    f.write("└─\n\n")

                f.write("="*100 + "\n\n")

            print(f"[LOGGER] Successfully wrote turn to log file: {self.log_file}", file=sys.stderr)

        except Exception as e:
            print(f"[LOGGER ERROR] Failed to write to log file: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    
    
    def log_chunk_retrieval(
        self,
        sub_question: str,
        raw_results: dict,
        best_score: float,
        best_doc_id: int,
        same_doc_threshold: float,
        other_doc_threshold: float,
        passing_doc_ids: list
    ):
        """Log chunk retrieval details for a sub-question."""
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write("\n┌─ CHUNK RETRIEVAL (HYBRID: Dense + Sparse + Reranking)\n")
                f.write(f"│ Sub-Question: {sub_question}\n")
                f.write(f"│ Best Score: {best_score:.4f} from Doc {best_doc_id}\n")
                f.write(f"│ Thresholds: Same-Doc={same_doc_threshold:.4f}, Other-Doc={other_doc_threshold:.4f}\n")
                f.write(f"│\n")
                
                total_pass = 0
                total_drop = 0
                
                for doc_id, data in raw_results.items():
                    doc_title = data.get('doc_title', f'Document {doc_id}')
                    chunks = data.get('chunks', [])
                    
                    if not chunks:
                        continue
                    
                    thresh = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
                    passing_chunks = [c for c in chunks if c.get('score', 0) >= thresh]
                    dropped_chunks = [c for c in chunks if c.get('score', 0) < thresh]
                    
                    total_pass += len(passing_chunks)
                    total_drop += len(dropped_chunks)
                    
                    f.write(f"│ Document {doc_id}: {doc_title}\n")
                    f.write(f"│   Retrieved: {len(chunks)} chunks | Passed: {len(passing_chunks)} | Dropped: {len(dropped_chunks)}\n")
                    f.write(f"│   Threshold: {thresh:.4f}\n")
                    f.write(f"│\n")
                    
                    # Show passing chunks
                    if passing_chunks:
                        f.write(f"│   ✅ PASSING CHUNKS:\n")
                        for i, chunk in enumerate(passing_chunks[:5], 1):  # Show top 5
                            score = chunk.get('score', 0)
                            dense = chunk.get('dense_score', 0)
                            sparse = chunk.get('sparse_score', 0)
                            rerank = chunk.get('rerank_score', 0)
                            page = chunk.get('start_page_num', '?')
                            section = chunk.get('section_title', 'Unknown')[:40]
                            text_preview = chunk.get('text', '')[:100].replace('\n', ' ')
                            
                            f.write(f"│     {i}. Score: {score:.4f} | Page: {page} | Section: {section}\n")
                            if rerank:
                                f.write(f"│        Rerank: {rerank:.4f} | Dense: {dense:.4f} | Sparse: {sparse:.4f}\n")
                            f.write(f"│        Text: {text_preview}...\n")
                        
                        if len(passing_chunks) > 5:
                            f.write(f"│     ... and {len(passing_chunks) - 5} more passing chunks\n")
                        f.write(f"│\n")
                    
                    # Show dropped chunks (first 3)
                    if dropped_chunks:
                        f.write(f"│   ❌ DROPPED CHUNKS (below threshold):\n")
                        for i, chunk in enumerate(dropped_chunks[:3], 1):
                            score = chunk.get('score', 0)
                            page = chunk.get('start_page_num', '?')
                            section = chunk.get('section_title', 'Unknown')[:40]
                            
                            f.write(f"│     {i}. Score: {score:.4f} < {thresh:.4f} | Page: {page} | Section: {section}\n")
                        
                        if len(dropped_chunks) > 3:
                            f.write(f"│     ... and {len(dropped_chunks) - 3} more dropped chunks\n")
                        f.write(f"│\n")
                
                f.write(f"│ TOTAL: {total_pass} chunks passed, {total_drop} chunks dropped\n")
                f.write(f"│ Passing Documents: {passing_doc_ids}\n")
                f.write("└─\n\n")
                
                f.flush()
                
        except Exception as e:
            print(f"[LOGGER ERROR] Failed to log chunk retrieval: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)


_current_logger = None


def initialize_logger(chathead_id: int):
    global _current_logger
    _current_logger = ChatLogger(chathead_id)


def get_logger() -> ChatLogger:
    return _current_logger


def log_turn(**kwargs):
    if _current_logger:
        _current_logger.log_turn(**kwargs)