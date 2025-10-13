"""
Chunking strategies - split text into embedable chunks.
Supports fixed-size, semantic, and recursive splitting with configurable overlap.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A chunk of text ready for embedding."""
    text: str
    chunk_index: int
    page_num: int
    section_title: Optional[str] = None
    char_start: int = 0
    char_end: int = 0
    token_count: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class ChunkingConfig:
    """Configuration for chunking strategy."""
    def __init__(
        self,
        chunk_size: int = 512,  # tokens
        overlap: int = 50,  # tokens
        min_chunk_size: int = 100,  # minimum tokens
        use_semantic: bool = True,  # prefer sentence boundaries
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size
        self.use_semantic = use_semantic


def estimate_tokens(text: str) -> int:
    """
    Rough token count estimation (words * 1.3).
    For production, use tiktoken or similar.
    
    Args:
        text: Input text
        
    Returns:
        Estimated token count
    """
    # Rough approximation: 1 token ≈ 0.75 words
    words = len(text.split())
    return int(words * 1.3)


def find_sentence_boundaries(text: str) -> List[int]:
    """
    Find positions of sentence endings.
    
    Args:
        text: Input text
        
    Returns:
        List of character positions where sentences end
    """
    # Pattern for sentence endings: . ! ? followed by space/newline/EOF
    pattern = r'[.!?][\s\n]+'
    boundaries = [0]
    
    for match in re.finditer(pattern, text):
        boundaries.append(match.end())
    
    if boundaries[-1] != len(text):
        boundaries.append(len(text))
    
    return boundaries


def chunk_by_tokens_semantic(text: str, config: ChunkingConfig) -> List[str]:
    """
    Chunk text respecting sentence boundaries.
    
    Args:
        text: Input text
        config: ChunkingConfig
        
    Returns:
        List of text chunks
    """
    if not text.strip():
        return []
    
    boundaries = find_sentence_boundaries(text)
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for i in range(len(boundaries) - 1):
        sentence = text[boundaries[i]:boundaries[i + 1]]
        sentence_tokens = estimate_tokens(sentence)
        
        # If single sentence exceeds chunk_size, force split it
        if sentence_tokens > config.chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
                current_tokens = 0
            
            # Split long sentence by words
            words = sentence.split()
            temp_chunk = ""
            for word in words:
                if estimate_tokens(temp_chunk + " " + word) > config.chunk_size:
                    if temp_chunk:
                        chunks.append(temp_chunk.strip())
                    temp_chunk = word
                else:
                    temp_chunk += " " + word if temp_chunk else word
            
            if temp_chunk:
                current_chunk = temp_chunk
                current_tokens = estimate_tokens(temp_chunk)
            continue
        
        # Try adding sentence to current chunk
        if current_tokens + sentence_tokens <= config.chunk_size:
            current_chunk += sentence
            current_tokens += sentence_tokens
        else:
            # Save current chunk and start new one
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            # Start new chunk with overlap
            overlap_text = ""
            overlap_tokens = 0
            
            # Add sentences from end of previous chunk for overlap
            for j in range(len(chunks) - 1, -1, -1):
                potential_overlap = chunks[j].split('.')[-1] + '.'
                potential_tokens = estimate_tokens(potential_overlap)
                if overlap_tokens + potential_tokens <= config.overlap:
                    overlap_text = potential_overlap + overlap_text
                    overlap_tokens += potential_tokens
                else:
                    break
            
            current_chunk = overlap_text + sentence
            current_tokens = estimate_tokens(current_chunk)
    
    # Add final chunk (allow smaller chunks if it's the only content)
    if current_chunk.strip():
        if current_tokens >= config.min_chunk_size or len(chunks) == 0:
            chunks.append(current_chunk.strip())
        else:
            logger.debug(f"Skipping small final chunk: {current_tokens} tokens < {config.min_chunk_size} min")
    
    return chunks


def chunk_by_tokens_fixed(text: str, config: ChunkingConfig) -> List[str]:
    """
    Chunk text by fixed token count (word-based, no sentence boundary respect).
    
    Args:
        text: Input text
        config: ChunkingConfig
        
    Returns:
        List of text chunks
    """
    words = text.split()
    chunks = []
    
    # Rough conversion: chunk_size tokens ≈ chunk_size / 1.3 words
    words_per_chunk = int(config.chunk_size / 1.3)
    overlap_words = int(config.overlap / 1.3)
    
    i = 0
    while i < len(words):
        chunk_words = words[i:i + words_per_chunk]
        chunk_text = " ".join(chunk_words)
        token_count = estimate_tokens(chunk_text)
        
        # Keep chunk if it meets min size OR if it's the only/first chunk (handles small documents)
        if token_count >= config.min_chunk_size or len(chunks) == 0:
            chunks.append(chunk_text)
            logger.debug(f"Added chunk: {token_count} tokens")
        else:
            logger.debug(f"Skipped small chunk: {token_count} tokens < {config.min_chunk_size} min")
        
        i += words_per_chunk - overlap_words
    
    return chunks


def create_chunks_from_segments(
    segments: List[Any],
    document_id: int,
    config: Optional[ChunkingConfig] = None
) -> List[Chunk]:
    """
    Convert preprocessed segments into chunks.
    
    Args:
        segments: List of TextSegment from preprocess.py
        document_id: Document ID for metadata
        config: ChunkingConfig (uses defaults if None)
        
    Returns:
        List of Chunk objects
    """
    if config is None:
        config = ChunkingConfig()
    
    all_chunks = []
    global_chunk_index = 0
    
    logger.debug(f"Processing {len(segments)} segments with config: chunk_size={config.chunk_size}, min_chunk_size={config.min_chunk_size}")
    
    for segment in segments:
        logger.debug(f"Segment {segments.index(segment)}: {len(segment.text)} chars, ~{estimate_tokens(segment.text)} tokens")
        # Choose chunking strategy
        if config.use_semantic and len(segment.text) > config.chunk_size:
            chunk_texts = chunk_by_tokens_semantic(segment.text, config)
        else:
            chunk_texts = chunk_by_tokens_fixed(segment.text, config)
        
        # Create Chunk objects
        for chunk_text in chunk_texts:
            token_count = estimate_tokens(chunk_text)
            logger.debug(f"Chunk candidate: {token_count} tokens (min required: {config.min_chunk_size})")
            
            chunk = Chunk(
                text=chunk_text,
                chunk_index=global_chunk_index,
                page_num=segment.page_num,
                section_title=segment.section_title,
                char_start=segment.char_start,
                char_end=segment.char_start + len(chunk_text),
                token_count=token_count,
                metadata={
                    "document_id": document_id,
                    "segment_type": segment.segment_type,
                }
            )
            
            all_chunks.append(chunk)
            global_chunk_index += 1
    
    logger.info(f"Created {len(all_chunks)} chunks from {len(segments)} segments")
    return all_chunks


def chunk_document(
    preprocess_result,
    document_id: int,
    config: Optional[ChunkingConfig] = None
) -> List[Chunk]:
    """
    Main entry point for chunking a preprocessed document.
    
    Args:
        preprocess_result: PreprocessingResult from preprocess.py
        document_id: Document ID
        config: Optional ChunkingConfig
        
    Returns:
        List of Chunk objects ready for embedding
    """
    return create_chunks_from_segments(
        preprocess_result.segments,
        document_id,
        config
    )