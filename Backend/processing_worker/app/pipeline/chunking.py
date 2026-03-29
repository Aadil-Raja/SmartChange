"""
Chunking strategies - split text into embedable chunks.
Supports semantic splitting with configurable overlap.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import tiktoken

logger = logging.getLogger(__name__)

# Initialize tokenizer (cl100k_base is used by GPT-4 and text-embedding models)
_tokenizer = tiktoken.get_encoding("cl100k_base")


@dataclass
class Chunk:
    """A chunk of text ready for embedding."""
    text: str
    chunk_index: int
    page_num: int  # Starting page (for backward compatibility)
    section_title: Optional[str] = None
    char_start: int = 0
    char_end: int = 0
    token_count: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    start_page_num: int = 0  # Starting page number (physical)
    end_page_num: int = 0    # Ending page number (physical)


class ChunkingConfig:
    """Configuration for chunking strategy."""
    def __init__(
        self,
        chunk_size: int = 512,  # tokens
        overlap: int = 50,  # tokens
        min_chunk_size: int = 100,  # minimum tokens
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size


def count_tokens(text: str) -> int:
    """
    Accurate token count using tiktoken.
    
    Args:
        text: Input text
        
    Returns:
        Exact token count
    """
    return len(_tokenizer.encode(text))


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


def calculate_chunk_page(
    chunk_start: int,
    chunk_end: int,
    element_pages: List[Tuple[int, int, int]],
    fallback_page: int
) -> int:
    """
    Calculate which page a chunk belongs to based on character position.
    Picks the page where most of the chunk's content is.

    Args:
        chunk_start: Chunk start position in segment text
        chunk_end: Chunk end position in segment text
        element_pages: List of (page_num, elem_start, elem_end) from segment
        fallback_page: Page to use if no overlap found

    Returns:
        Page number for this chunk
    """
    if not element_pages:
        return fallback_page

    page_overlaps: Dict[int, int] = {}

    for page_num, elem_start, elem_end in element_pages:
        overlap_start = max(chunk_start, elem_start)
        overlap_end = min(chunk_end, elem_end)
        if overlap_end > overlap_start:
            page_overlaps[page_num] = page_overlaps.get(page_num, 0) + (overlap_end - overlap_start)

    if not page_overlaps:
        return fallback_page

    # Return the page with the most overlap
    return max(page_overlaps.items(), key=lambda x: x[1])[0]


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
        sentence_tokens = count_tokens(sentence)
        
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
                if count_tokens(temp_chunk + " " + word) > config.chunk_size:
                    if temp_chunk:
                        chunks.append(temp_chunk.strip())
                    temp_chunk = word
                else:
                    temp_chunk += " " + word if temp_chunk else word
            
            if temp_chunk:
                current_chunk = temp_chunk
                current_tokens = count_tokens(temp_chunk)
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
                potential_tokens = count_tokens(potential_overlap)
                if overlap_tokens + potential_tokens <= config.overlap:
                    overlap_text = potential_overlap + overlap_text
                    overlap_tokens += potential_tokens
                else:
                    break
            
            current_chunk = overlap_text + sentence
            current_tokens = count_tokens(current_chunk)
    
    # Add final chunk (allow smaller chunks if it's the only content)
    if current_chunk.strip():
        if current_tokens >= config.min_chunk_size or len(chunks) == 0:
            chunks.append(current_chunk.strip())
        else:
            logger.debug(f"Skipping small final chunk: {current_tokens} tokens < {config.min_chunk_size} min")
    
    return chunks



def create_chunks_from_segments(
    segments: List[Any],
    document_id: int,
    config: Optional[ChunkingConfig] = None
) -> List[Chunk]:
    """
    Convert preprocessed segments into chunks.
    Tracks page range for each chunk based on segments it spans.
    
    Args:
        segments: List of TextSegment from preprocess.py
        document_id: Document ID for metadata
        config: ChunkingConfig (uses defaults if None)
        
    Returns:
        List of Chunk objects with page ranges
    """
    if config is None:
        config = ChunkingConfig()
    
    all_chunks = []
    global_chunk_index = 0
    
    logger.debug(f"Processing {len(segments)} segments with config: chunk_size={config.chunk_size}, min_chunk_size={config.min_chunk_size}")
    
    for segment in segments:
        logger.debug(f"Segment {segments.index(segment)}: {len(segment.text)} chars, ~{count_tokens(segment.text)} tokens, page {segment.page_num}")
        
        # Use semantic chunking
        chunk_texts = chunk_by_tokens_semantic(segment.text, config)

        # Track character position within segment to calculate page per chunk
        segment_char_pos = 0

        for chunk_text in chunk_texts:
            token_count = count_tokens(chunk_text)
            logger.debug(f"Chunk candidate: {token_count} tokens (min required: {config.min_chunk_size})")

            chunk_start = segment_char_pos
            chunk_end = chunk_start + len(chunk_text)

            # Calculate accurate page using element_pages
            chunk_page = calculate_chunk_page(
                chunk_start,
                chunk_end,
                segment.element_pages,
                segment.page_num  # fallback
            )

            chunk = Chunk(
                text=chunk_text,
                chunk_index=global_chunk_index,
                page_num=chunk_page,           # Updated to accurate page
                section_title=segment.section_title,
                char_start=segment.char_start + chunk_start,
                char_end=segment.char_start + chunk_end,
                token_count=token_count,
                metadata={
                    "document_id": document_id,
                    "segment_type": segment.segment_type,
                },
                start_page_num=chunk_page,
                end_page_num=chunk_page
            )

            all_chunks.append(chunk)
            global_chunk_index += 1
            segment_char_pos = chunk_end
    
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