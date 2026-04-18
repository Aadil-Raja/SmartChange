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
        app_dir = Path(__file__).parent.parent  # Go up from services/ to app/
        self.log_dir = app_dir / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / f"chathead_{chathead_id}.log"
        
        print(f"[LOGGER INIT] Log directory: {self.log_dir.absolute()}", file=sys.stderr)
        print(f"[LOGGER INIT] Log file: {self.log_file.absolute()}", file=sys.stderr)
        
        # Overwrite the file when a new chathead is created
        self._initialize_log()
    
    def _initialize_log(self):
        """Initialize/overwrite the log file with header."""
        try:
            print(f"[LOGGER] Writing to: {self.log_file}", file=sys.stderr)
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.write("="*100 + "\n")
                f.write(f"CHAT LOG - Chathead ID: {self.chathead_id}\n")
                f.write(f"Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("="*100 + "\n\n")
            print(f"[LOGGER] Log file created successfully", file=sys.stderr)
        except Exception as e:
            print(f"[LOGGER] Error creating log file: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    
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
            f.write("┌─ CHUNK RETRIEVAL\n")
            for doc_id, chunks in retrieved_chunks.items():
                doc_title = chunks[0].get('doc_title', f'Document {doc_id}') if chunks else f'Document {doc_id}'
                f.write(f"│\n│ Document {doc_id}: {doc_title}\n")
                f.write(f"│ Retrieved {len(chunks)} chunks\n")
                for i, chunk in enumerate(chunks, 1):
                    score = chunk.get('score', 0)
                    page = chunk.get('start_page_num', '?')
                    section = chunk.get('section_title', 'Unknown')
                    preview = chunk.get('text', '')[:100].replace('\n', ' ')
                    f.write(f"│   {i}. Score: {score:.4f} | Page: {page} | Section: {section}\n")
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
                        threshold = thresholds.get('same_doc_threshold' if doc_id == thresholds.get('best_doc_id') else 'other_doc_threshold', 0)
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
                    f.write(f"│\n│ Document {doc_id}: {history.get('doc_title', 'Unknown')}\n")
                    
                    # Summary
                    if history.get('summary'):
                        f.write(f"│   Summary: {history['summary']}\n")
                    else:
                        f.write(f"│   Summary: None\n")
                    
                    # Recent messages
                    messages = history.get('last_n_messages', [])
                    if messages:
                        f.write(f"│   Recent Messages ({len(messages)}):\n")
                        for msg in messages:
                            role = "USER" if hasattr(msg, 'role') and str(msg.role) == "MessageRole.USER" else "ASST"
                            msg_text = msg.message if hasattr(msg, 'message') else str(msg)
                            f.write(f"│     [{role}]: {msg_text[:80]}...\n")
                    else:
                        f.write(f"│   Recent Messages: None\n")
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


# Global logger instance (will be set per chathead)
_current_logger = None


def initialize_logger(chathead_id: int):
    """Initialize logger for a chathead."""
    global _current_logger
    _current_logger = ChatLogger(chathead_id)


def get_logger() -> ChatLogger:
    """Get current logger instance."""
    return _current_logger


def log_turn(**kwargs):
    """Log a turn using the current logger."""
    if _current_logger:
        _current_logger.log_turn(**kwargs)
