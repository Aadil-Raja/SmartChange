# app/services/chat_logger.py
"""
Logging service for chat interactions.
Creates a single log file per chathead that tracks the entire conversation flow.
"""
import os
import sys
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path


class SubQuestionLog:
    """Holds all log data for one sub-question in memory."""
    def __init__(self, question: str, index: int, total: int):
        self.question = question
        self.index = index
        self.total = total
        self.stage1 = None
        self.stage2 = None
        self.stage3 = None
        self.stage4 = None
        self.stage5 = None


class ChatLogger:
    """Logger for tracking chat interactions with detailed RAG pipeline information."""
    
    def __init__(self, chathead_id: int):
        self.chathead_id = chathead_id
        
        # Get the absolute path to the app directory
        app_dir = Path(__file__).parent.parent
        self.log_dir = app_dir / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / f"chathead_{chathead_id}.log"
        
        # Thread safety for parallel sub-question processing
        self._lock = threading.Lock()
        self._sub_question_logs = {}  # question_index -> SubQuestionLog
        
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
    
    def write(self, message: str):
        """Write a message directly to the log file (thread-safe)."""
        try:
            with self._lock:
                with open(self.log_file, 'a', encoding='utf-8') as f:
                    f.write(message + "\n")
        except Exception as e:
            print(f"[LOGGER] Error writing to log file: {e}", file=sys.stderr)
    
    def log_user_turn(self, user_message: str, active_doc_ids: List[int]):
        """Log the start of a new user turn."""
        with self._lock:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write("\n" + "="*80 + "\n")
                f.write(f" USER MESSAGE: \"{user_message}\"\n")
                f.write(f" Active Documents: {active_doc_ids}\n")
                f.write("="*80 + "\n")
    
    def get_sub_question_buffer(self, index: int, question: str, total: int) -> SubQuestionLog:
        """Get or create a buffer for this sub-question."""
        if index not in self._sub_question_logs:
            self._sub_question_logs[index] = SubQuestionLog(question, index, total)
        return self._sub_question_logs[index]
    
    def flush_sub_question(self, index: int):
        """Write a completed sub-question log to file atomically."""
        buf = self._sub_question_logs.get(index)
        if not buf:
            print(f"[LOGGER] No buffer found for sub-question {index}", file=sys.stderr)
            return
        
        try:
            with self._lock:
                with open(self.log_file, 'a', encoding='utf-8') as f:
                    # Write all 5 stages in one atomic write
                    f.write("\n" + "━"*80 + "\n")
                    f.write(f" SUB-QUESTION {buf.index} of {buf.total}: \"{buf.question}\"\n")
                    f.write("━"*80 + "\n")
                    
                    if buf.stage1:
                        f.write(buf.stage1)
                    if buf.stage2:
                        f.write(buf.stage2)
                    if buf.stage3:
                        f.write(buf.stage3)
                    if buf.stage4:
                        f.write(buf.stage4)
                    if buf.stage5:
                        f.write(buf.stage5)
            
            print(f"[LOGGER] Flushed sub-question {index} to log file", file=sys.stderr)
            
            # Clean up buffer
            del self._sub_question_logs[index]
            
        except Exception as e:
            print(f"[LOGGER] Error flushing sub-question {index}: {e}", file=sys.stderr)
    
    def format_stage1_all_chunks(self, doc_chunks_map: Dict[int, Dict]) -> str:
        """
        Format Stage 1: All chunks with dense and sparse scores.
        
        doc_chunks_map: {
            doc_id: {
                'doc_title': str,
                'chunks': [{chunk_index, dense_score, sparse_score, combined_score, start_page_num, section_title, passed}]
            }
        }
        """
        lines = []
        lines.append("\n┌─ STAGE 1: ALL CHUNKS (Dense + Sparse scores)")
        lines.append("│")
        
        for doc_id, data in doc_chunks_map.items():
            doc_title = data.get('doc_title', f'Document {doc_id}')
            chunks = data.get('chunks', [])
            
            lines.append(f"│  Doc {doc_id} - {doc_title} ({len(chunks)} chunks total)")
            lines.append("│  ┌" + "─"*75)
            lines.append(f"│  │ {'Status':<8} {'Chunk':<8} {'Page':<6} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Section':<30}")
            lines.append(f"│  │ {'-'*8} {'-'*8} {'-'*6} {'-'*10} {'-'*10} {'-'*10} {'-'*30}")
            
            for chunk in chunks:
                chunk_idx = chunk.get('chunk_index', '?')
                page = chunk.get('start_page_num', '?')
                dense = chunk.get('dense_score', 0)
                sparse = chunk.get('sparse_score', 0)
                combined = chunk.get('combined_score', 0)
                section = (chunk.get('section_title', 'Unknown') or 'Unknown')[:30]
                passed = chunk.get('passed', False)
                status = "✓" if passed else "✗"
                
                lines.append(f"│  │ {status:<8} #{chunk_idx:<7} {page:<6} {dense:<10.4f} {sparse:<10.4f} {combined:<10.4f} {section}")
            
            lines.append("│  └" + "─"*75)
            lines.append("│")
        
        lines.append("└─\n")
        return '\n'.join(lines)
    
    def format_stage2_top20(self, top20_chunks: List[Dict]) -> str:
        """
        Format Stage 2: Top 20 chunks passed to reranker.
        
        top20_chunks: list of {doc_id, chunk_index, dense_score, sparse_score, combined_score, start_page_num, section_title}
        """
        lines = []
        lines.append("\n┌─ STAGE 2: TOP 20 PASSED TO RERANKER (sorted by combined score across all docs)")
        lines.append("│")
        lines.append(f"│  {'Rank':<6} {'Doc':<5} {'Chunk':<8} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Page':<6} {'Section':<30}")
        lines.append(f"│  {'-'*6} {'-'*5} {'-'*8} {'-'*10} {'-'*10} {'-'*10} {'-'*6} {'-'*30}")
        
        for rank, chunk in enumerate(top20_chunks, 1):
            doc_id = chunk.get('doc_id', '?')
            chunk_idx = chunk.get('chunk_index', '?')
            dense = chunk.get('dense_score', 0)
            sparse = chunk.get('sparse_score', 0)
            combined = chunk.get('combined_score', 0)
            page = chunk.get('start_page_num', '?')
            section = (chunk.get('section_title', 'Unknown') or 'Unknown')[:30]
            
            lines.append(f"│  {rank:<6} {doc_id:<5} #{chunk_idx:<7} {dense:<10.4f} {sparse:<10.4f} {combined:<10.4f} {page:<6} {section}")
        
        lines.append("└─\n")
        return '\n'.join(lines)
    
    def format_stage3_reranked(self, reranked_chunks: List[Dict]) -> str:
        """
        Format Stage 3: Chunks with reranker scores.
        
        reranked_chunks: list of {doc_id, chunk_index, rerank_score, dense_score, sparse_score, start_page_num, section_title}
        """
        lines = []
        lines.append("\n┌─ STAGE 3: RERANKER SCORES (sorted by rerank score)")
        lines.append("│")
        lines.append(f"│  {'Rank':<6} {'Doc':<5} {'Chunk':<8} {'Rerank':<10} {'Dense':<10} {'Sparse':<10} {'Page':<6} {'Section':<30}")
        lines.append(f"│  {'-'*6} {'-'*5} {'-'*8} {'-'*10} {'-'*10} {'-'*10} {'-'*6} {'-'*30}")
        
        for rank, chunk in enumerate(reranked_chunks, 1):
            doc_id = chunk.get('doc_id', '?')
            chunk_idx = chunk.get('chunk_index', '?')
            rerank = chunk.get('rerank_score', 0)
            dense = chunk.get('dense_score', 0)
            sparse = chunk.get('sparse_score', 0)
            page = chunk.get('start_page_num', '?')
            section = (chunk.get('section_title', 'Unknown') or 'Unknown')[:30]
            
            lines.append(f"│  {rank:<6} {doc_id:<5} #{chunk_idx:<7} {rerank:<10.4f} {dense:<10.4f} {sparse:<10.4f} {page:<6} {section}")
        
        lines.append("└─\n")
        return '\n'.join(lines)
    
    def format_stage4_threshold(self, best_score: float, best_doc_id: int, best_section: str, 
                                thresholds: Dict[str, float], passed_chunks: List[Dict], dropped_chunks: List[Dict]) -> str:
        """
        Format Stage 4: Threshold filtering results.
        
        thresholds: {same_section, same_doc, other_doc}
        passed/dropped_chunks: list of {chunk_index, doc_id, rerank_score, threshold_used, tier, start_page_num, section_title}
        """
        lines = []
        lines.append("\n┌─ STAGE 4: THRESHOLD FILTERING")
        lines.append(f"│  Best rerank score: {best_score:.4f} (Doc {best_doc_id}, Section: \"{best_section}\")")
        lines.append(f"│  Same-section threshold: {thresholds.get('same_section', 0):.4f} (50%)")
        lines.append(f"│  Same-doc threshold:     {thresholds.get('same_doc', 0):.4f} (65%)")
        lines.append(f"│  Other-doc threshold:    {thresholds.get('other_doc', 0):.4f} (75%)")
        lines.append("│")
        
        if passed_chunks:
            lines.append("│  PASSED (chunks sent to LLM):")
            lines.append("│  ┌" + "─"*90)
            lines.append(f"│  │ {'Chunk':<8} {'Doc':<5} {'Rerank':<10} {'Dense':<10} {'Threshold':<10} {'Reason':<15} {'Page':<6} {'Section':<20}")
            lines.append(f"│  │ {'-'*8} {'-'*5} {'-'*10} {'-'*10} {'-'*10} {'-'*15} {'-'*6} {'-'*20}")
            
            for chunk in passed_chunks:
                chunk_idx = chunk.get('chunk_index', '?')
                doc_id = chunk.get('doc_id', '?')
                rerank = chunk.get('rerank_score', 0)
                dense = chunk.get('dense_score', 0)
                threshold = chunk.get('threshold_used', 0)
                pass_reason = chunk.get('pass_reason', 'unknown')
                page = chunk.get('start_page_num', '?')
                section = (chunk.get('section_title', 'Unknown') or 'Unknown')[:20]
                
                lines.append(f"│  │ #{chunk_idx:<7} {doc_id:<5} {rerank:<10.4f} {dense:<10.4f} {threshold:<10.4f} {pass_reason:<15} {page:<6} {section}")
            
            lines.append("│  └" + "─"*90)
        
        if dropped_chunks:
            lines.append("│")
            lines.append("│  DROPPED:")
            lines.append("│  ┌" + "─"*75)
            lines.append(f"│  │ {'Chunk':<8} {'Doc':<5} {'Rerank':<10} {'Threshold':<10} {'Reason':<15} {'Page':<6} {'Section':<20}")
            lines.append(f"│  │ {'-'*8} {'-'*5} {'-'*10} {'-'*10} {'-'*15} {'-'*6} {'-'*20}")
            
            for chunk in dropped_chunks:
                chunk_idx = chunk.get('chunk_index', '?')
                doc_id = chunk.get('doc_id', '?')
                rerank = chunk.get('rerank_score', 0)
                threshold = chunk.get('threshold_used', 0)
                tier = chunk.get('tier', 'unknown').upper()
                page = chunk.get('start_page_num', '?')
                section = (chunk.get('section_title', 'Unknown') or 'Unknown')[:20]
                
                lines.append(f"│  │ #{chunk_idx:<7} {doc_id:<5} {rerank:<10.4f} {threshold:<10.4f} {tier:<15} {page:<6} {section}")
            
            lines.append("│  └" + "─"*75)
        
        lines.append("└─\n")
        return '\n'.join(lines)
    
    def format_stage5_answer(self, answer: str, citations: List[Dict], tokens_input: int, tokens_output: int) -> str:
        """Format Stage 5: LLM answer and citations."""
        lines = []
        lines.append("\n┌─ STAGE 5: LLM ANSWER")
        lines.append(f"│  Tokens: {tokens_input} input / {tokens_output} output")
        lines.append(f"│  Citations: {len(citations)}")
        lines.append("│")
        lines.append("│  Answer:")
        
        # Write answer with proper indentation
        for line in answer.split('\n'):
            lines.append(f"│  {line}")
        
        if citations:
            lines.append("│")
            lines.append("│  Citations:")
            for i, citation in enumerate(citations, 1):
                doc_id = citation.get('doc_id', '?')
                page = citation.get('page', '?')
                section = citation.get('section', 'Unknown')
                lines.append(f"│  {i}. Doc {doc_id} | Page {page} | Section: {section}")
        
        lines.append("└─\n")
        return '\n'.join(lines)
    
    def log_merged_answer(self, answer: str, citations: List[Dict]):
        """Log the final merged answer (for multi-question queries)."""
        with self._lock:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write("\n" + "="*80 + "\n")
                f.write(" FINAL MERGED ANSWER\n")
                f.write("="*80 + "\n")
                
                for line in answer.split('\n'):
                    f.write(line + "\n")
                
                if citations:
                    f.write("\nCitations:\n")
                    for i, citation in enumerate(citations, 1):
                        doc_id = citation.get('doc_id', '?')
                        page = citation.get('page', '?')
                        section = citation.get('section', 'Unknown')
                        f.write(f"{i}. Doc {doc_id} | Page {page} | Section: {section}\n")
                
                f.write("="*80 + "\n\n")


# Global logger instance
_current_logger = None


def initialize_logger(chathead_id: int):
    global _current_logger
    _current_logger = ChatLogger(chathead_id)


def get_logger() -> ChatLogger:
    return _current_logger
