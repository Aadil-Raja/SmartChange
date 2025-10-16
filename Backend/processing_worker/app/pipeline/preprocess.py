"""
Text preprocessing - clean and normalize extracted text.
Handles whitespace, unicode normalization, section detection.
"""

import re
import logging
import unicodedata
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TextSegment:
    """A segment of cleaned text with metadata."""
    text: str
    page_num: int
    segment_type: str = "paragraph"  # paragraph, section, heading
    section_title: Optional[str] = None
    char_start: int = 0
    char_end: int = 0


class PreprocessingResult:
    """Result from text preprocessing."""
    def __init__(self, segments: List[TextSegment], metadata: Optional[Dict[str, Any]] = None):
        self.segments = segments
        self.metadata = metadata or {}
        self.has_toc = metadata.get("has_toc", False) if metadata else False


def clean_text(text: str) -> str:
    """
    Clean and normalize text.
    
    Args:
        text: Raw text to clean
        
    Returns:
        Cleaned text
    """
    # Normalize unicode (NFC form)
    text = unicodedata.normalize('NFC', text)
    
    # Remove control characters except newlines and tabs
    text = ''.join(char for char in text if unicodedata.category(char)[0] != 'C' or char in '\n\t')
    
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)  # multiple spaces/tabs to single space
    text = re.sub(r'\n{3,}', '\n\n', text)  # multiple newlines to double
    
    # Remove leading/trailing whitespace from lines
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    return text.strip()


def detect_toc_patterns(text: str) -> bool:
    """
    Detect if text contains a table of contents.
    
    Args:
        text: Document text
        
    Returns:
        True if TOC patterns detected
    """
    toc_patterns = [
        r'(?i)table\s+of\s+contents',
        r'(?i)contents',
        r'(?i)index',
        r'\d+\.{2,}\s*\d+',  # "1..... 5" (dot leaders)
        r'(?:chapter|section)\s+\d+\s*\.{2,}\s*\d+',
    ]
    
    for pattern in toc_patterns:
        if re.search(pattern, text[:2000]):  # Check first 2000 chars
            return True
    
    return False


def extract_section_headers(text: str) -> List[Dict[str, Any]]:
    """
    Extract section headers from text.
    Looks for patterns like:
    - "1. Introduction"
    - "Section 2: Methods"
    - "CHAPTER 3"
    - All caps lines (potential headers)
    
    Args:
        text: Document text
        
    Returns:
        List of {title, position, pattern_type}
    """
    headers = []
    
    patterns = [
        # Numbered sections: "1. Title" or "1.1 Title"
        (r'^(\d+(?:\.\d+)*)\.\s+([A-Z][^\n]{3,50})', 'numbered'),
        # Section/Chapter: "Section 2: Title"
        (r'^(?:Section|Chapter)\s+(\d+)[:\s]+([^\n]{3,50})', 'labeled'),
        # All caps lines (4-50 chars)
        (r'^([A-Z][A-Z\s]{3,49})$', 'allcaps'),
    ]
    
    for line_num, line in enumerate(text.split('\n')):
        line = line.strip()
        if not line:
            continue
            
        for pattern, pattern_type in patterns:
            match = re.match(pattern, line)
            if match:
                # Calculate position in text
                position = text.find(line)
                
                # Extract title (handle different capture groups)
                if pattern_type == 'allcaps':
                    title = match.group(1).strip()
                elif pattern_type == 'numbered':
                    title = f"{match.group(1)} {match.group(2)}".strip()
                else:
                    title = match.group(2).strip()
                
                headers.append({
                    'title': title,
                    'position': position,
                    'line_num': line_num,
                    'pattern_type': pattern_type
                })
                break  # Only match one pattern per line
    
    return headers


def split_by_sections(text: str, page_num: int) -> List[TextSegment]:
    """
    Split text into sections based on detected headers.
    
    Args:
        text: Cleaned text
        page_num: Page number for metadata
        
    Returns:
        List of TextSegments
    """
    headers = extract_section_headers(text)
    
    if not headers:
        # No headers found, return whole text as one segment
        return [TextSegment(
            text=text,
            page_num=page_num,
            segment_type="paragraph",
            char_start=0,
            char_end=len(text)
        )]
    
    segments = []
    
    for i, header in enumerate(headers):
        start = header['position']
        end = headers[i + 1]['position'] if i + 1 < len(headers) else len(text)
        
        section_text = text[start:end].strip()
        
        if section_text:
            segments.append(TextSegment(
                text=section_text,
                page_num=page_num,
                segment_type="section",
                section_title=header['title'],
                char_start=start,
                char_end=end
            ))
    
    return segments


def split_by_paragraphs(text: str, page_num: int) -> List[TextSegment]:
    """
    Split text into paragraphs (simple fallback).
    
    Args:
        text: Cleaned text
        page_num: Page number
        
    Returns:
        List of TextSegments
    """
    paragraphs = re.split(r'\n\n+', text)
    segments = []
    char_pos = 0
    
    for para in paragraphs:
        para = para.strip()
        if len(para) > 50:  # Only keep substantial paragraphs
            segments.append(TextSegment(
                text=para,
                page_num=page_num,
                segment_type="paragraph",
                char_start=char_pos,
                char_end=char_pos + len(para)
            ))
        char_pos += len(para) + 2  # +2 for \n\n
    
    return segments


def preprocess_pages(pages: List[Any]) -> PreprocessingResult:
    """
    Main preprocessing function for page-based documents.
    
    Args:
        pages: List of PageContent objects from loaders
        
    Returns:
        PreprocessingResult with cleaned segments
    """
    all_segments = []
    full_text = "\n\n".join(p.text for p in pages)
    
    # Detect TOC in first few pages
    has_toc = detect_toc_patterns(full_text[:5000])
    logger.info(f"TOC detected: {has_toc}")
    
    for page in pages:
        cleaned = clean_text(page.text)
        
        logger.debug(f"=== Page {page.page_num} ===")
        logger.debug(f"Raw text length: {len(page.text)} chars")
        logger.debug(f"Cleaned text length: {len(cleaned)} chars")
        logger.debug(f"First 500 chars of cleaned text:\n{cleaned[:500]}")
        
        if not cleaned:
            continue
        
        # Try section-based splitting first
        segments = split_by_sections(cleaned, page.page_num)
        logger.debug(f"Section-based splitting found {len(segments)} segments")
        
        # If no sections found, fall back to paragraphs
        if len(segments) == 1 and segments[0].segment_type == "paragraph":
            logger.debug("No sections detected, trying paragraph splitting...")
            segments = split_by_paragraphs(cleaned, page.page_num)
            logger.debug(f"Paragraph splitting found {len(segments)} segments")
        
        # Log segment details
        for i, seg in enumerate(segments):
            logger.debug(f"Segment {i}: type={seg.segment_type}, title={seg.section_title}, length={len(seg.text)} chars")
            logger.debug(f"  First 100 chars: {seg.text[:100]}")
        
        all_segments.extend(segments)
    
    logger.info(f"Preprocessed {len(pages)} pages into {len(all_segments)} segments")
    
    return PreprocessingResult(
        segments=all_segments,
        metadata={
            "has_toc": has_toc,
            "total_pages": len(pages),
            "total_segments": len(all_segments)
        }
    )


def preprocess_document(loader_result) -> PreprocessingResult:
    """
    Convenience function to preprocess LoaderResult.
    
    Args:
        loader_result: LoaderResult from loaders.py
        
    Returns:
        PreprocessingResult
    """
    return preprocess_pages(loader_result.pages)