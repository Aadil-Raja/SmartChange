"""
Preprocessing for PyMuPDF extracted documents.
Uses font size and formatting to intelligently detect headings and structure.
"""

import re
import logging
import unicodedata
from typing import List, Dict, Any, Optional, Tuple
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
    heading_level: int = 0  # 0=body, 1=h1, 2=h2, etc.
    font_size: float = 0.0
    # Tracks (page_num, char_start, char_end) for each element in this segment
    # Used by chunking to calculate accurate page per chunk
    element_pages: Optional[List[Tuple[int, int, int]]] = None

    def __post_init__(self):
        # Always ensure element_pages is populated as fallback
        if self.element_pages is None:
            self.element_pages = [(self.page_num, 0, len(self.text))]


class PreprocessingResultFitz:
    """Result from text preprocessing with font-based structure."""
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
    
    # Normalize whitespace - collapse multiple spaces
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Normalize newlines - max 2 consecutive
    text = re.sub(r'\n{3,}', '\n\n', text)
    
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


# ============================================================================
# WATERMARK DETECTION FUNCTIONS
# ============================================================================

def normalize_text_for_comparison(text: str) -> str:
    """
    Normalize text for frequency comparison.
    Removes variations that don't affect meaning.
    
    Args:
        text: Raw text
        
    Returns:
        Normalized text (lowercase, no extra spaces/punctuation)
    """
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove punctuation
    text = re.sub(r'[^\w\s]', '', text)
    # Lowercase and strip
    text = text.lower().strip()
    return text


def get_position_zone(bbox: tuple, page_height: float) -> str:
    """
    Determine vertical position zone on page.
    
    Args:
        bbox: (x0, y0, x1, y1) bounding box
        page_height: Total page height
        
    Returns:
        "top", "middle", or "bottom"
    """
    if page_height == 0:
        return "middle"
    
    y_position = bbox[1]  # y0
    
    if y_position < page_height * 0.15:
        return "top"
    elif y_position > page_height * 0.85:
        return "bottom"
    else:
        return "middle"


def collect_text_frequencies(loader_result) -> Tuple[Dict, int]:
    """
    Scan all pages and count text occurrences.
    
    Args:
        loader_result: LoaderResultFitz
        
    Returns:
        (frequency_map, total_pages)
        frequency_map: {(text, font_size, position): [page_numbers]}
    """
    frequency_map = {}
    total_pages = loader_result.total_pages
    
    for page in loader_result.pages:
        page_num = page.page_num
        page_height = page.height
        
        for block in page.blocks:
            if block.block_type != 0:  # Skip non-text blocks
                continue
            
            for span in block.spans:
                # Normalize text
                text = normalize_text_for_comparison(span.text)
                
                if not text or len(text) < 3:
                    continue
                
                # Get metadata
                font_size = round(span.font_size, 1)
                position = get_position_zone(span.bbox, page_height)
                
                # Create key
                key = (text, font_size, position)
                
                # Add to frequency map
                if key not in frequency_map:
                    frequency_map[key] = []
                
                # Avoid duplicates on same page
                if page_num not in frequency_map[key]:
                    frequency_map[key].append(page_num)
    
    return frequency_map, total_pages


def calculate_adaptive_threshold(total_pages: int) -> float:
    """
    Calculate watermark threshold based on document length.
    
    Args:
        total_pages: Number of pages in document
        
    Returns:
        Threshold ratio (0.0 to 1.0)
    """
    if total_pages <= 5:
        # Short documents: be conservative
        return 0.8
    elif total_pages <= 20:
        # Medium documents: balanced
        return 0.7
    else:
        # Long documents: can be more aggressive
        return 0.5


def detect_watermarks_in_document(loader_result) -> set:
    """
    Main watermark detection function.
    Identifies text that appears on many pages (likely watermarks/headers/footers).
    
    Args:
        loader_result: LoaderResultFitz
        
    Returns:
        Set of (normalized_text, font_size, position) tuples
    """
    frequency_map, total_pages = collect_text_frequencies(loader_result)
    threshold = calculate_adaptive_threshold(total_pages)
    
    watermarks = set()
    
    for key, page_list in frequency_map.items():
        text, font_size, position = key
        
        # Calculate frequency ratio
        frequency_ratio = len(page_list) / total_pages
        
        # Check if exceeds threshold
        if frequency_ratio >= threshold:
            watermarks.add(key)
            
            logger.info(
                f"Detected watermark: '{text[:50]}...' "
                f"({font_size}pt, {position}) "
                f"on {len(page_list)}/{total_pages} pages "
                f"({frequency_ratio:.1%})"
            )
    
    return watermarks


def is_watermark(
    text: str,
    font_size: float,
    bbox: tuple,
    page,
    watermarks: set
) -> bool:
    """
    Check if specific text is a detected watermark.
    
    Args:
        text: Text to check
        font_size: Font size of text
        bbox: Bounding box
        page: Page object (for height)
        watermarks: Set of detected watermarks
        
    Returns:
        True if watermark, False if legitimate content
    """
    # Normalize
    normalized_text = normalize_text_for_comparison(text)
    font_size_rounded = round(font_size, 1)
    position = get_position_zone(bbox, page.height)
    
    # Check against watermark set
    key = (normalized_text, font_size_rounded, position)
    return key in watermarks


def is_likely_heading(text: str) -> bool:
    """
    Check if text looks like a heading based on content patterns.
    
    Args:
        text: Text to check
        
    Returns:
        True if likely a heading
    """
    text = text.strip()
    
    # Too short or too long
    if len(text) < 3 or len(text) > 200:
        return False
    
    # Ends with punctuation (unlikely for headings)
    if text.endswith(('.', ',', ';', ':')):
        return False
    
    # Common heading patterns
    heading_patterns = [
        r'^\d+\.?\s+[A-Z]',  # "1. Introduction" or "1 Introduction"
        r'^[A-Z][a-z]+\s+\d+',  # "Chapter 1", "Section 2"
        r'^[IVX]+\.\s+[A-Z]',  # Roman numerals "I. Introduction"
    ]
    
    for pattern in heading_patterns:
        if re.match(pattern, text):
            return True
    
    # Check if mostly capitalized (but not all caps single words)
    words = text.split()
    if len(words) >= 2:
        capitalized = sum(1 for w in words if w and w[0].isupper())
        if capitalized / len(words) > 0.7:
            return True
    
    return False


def extract_section_headers(text: str) -> List[Dict[str, Any]]:
    """
    Extract section headers from text using pattern matching.
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


def split_by_paragraphs_fitz(text: str, page_num: int, font_size: float = 11.0) -> List[TextSegment]:
    """
    Split text into paragraphs (fallback method).
    
    Args:
        text: Cleaned text
        page_num: Page number
        font_size: Default font size for segments
        
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
                char_end=char_pos + len(para),
                font_size=font_size
            ))
        char_pos += len(para) + 2  # +2 for \n\n
    
    return segments


def split_by_sections_pattern(text: str, page_num: int, font_size: float = 11.0) -> List[TextSegment]:
    """
    Split text into sections based on pattern-detected headers.
    
    Args:
        text: Cleaned text
        page_num: Page number for metadata
        font_size: Default font size
        
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
            char_end=len(text),
            font_size=font_size
        )]
    
    segments = []
    
    for i, header in enumerate(headers):
        start = header['position']
        end = headers[i + 1]['position'] if i + 1 < len(headers) else len(text)
        
        section_text = text[start:end].strip()
        
        if section_text:
            # Estimate heading level from pattern type
            heading_level = 1 if header['pattern_type'] in ['numbered', 'labeled'] else 2
            
            segments.append(TextSegment(
                text=section_text,
                page_num=page_num,
                segment_type="section",
                section_title=header['title'],
                char_start=start,
                char_end=end,
                heading_level=heading_level,
                font_size=font_size
            ))
    
    return segments


def detect_heading_threshold(loader_result) -> Tuple[float, Dict[int, float]]:
    """
    Detect font size threshold for headings based on document statistics.
    
    Args:
        loader_result: LoaderResultFitz from loader_fitz.py
        
    Returns:
        Tuple of (body_text_size, heading_level_sizes)
    """
    avg_size = loader_result.metadata.get('avg_font_size', 12.0)
    all_sizes = loader_result.metadata.get('font_sizes', [12.0])
    
    # Body text is typically the most common size (around average)
    body_size = avg_size
    
    # Heading levels: sizes significantly larger than body
    heading_levels = {}
    level = 1
    
    for size in all_sizes:
        if size > body_size + 1.5:  # At least 1.5 points larger
            heading_levels[level] = size
            level += 1
            if level > 6:  # Max 6 heading levels
                break
    
    logger.info(f"Detected body text size: {body_size:.1f}pt")
    logger.info(f"Detected heading levels: {heading_levels}")
    
    return body_size, heading_levels


def extract_structured_content(loader_result) -> List[Dict[str, Any]]:
    """
    Extract structured content with heading detection based on font size.
    Filters out watermarks, headers, and footers completely from all content.
    
    Args:
        loader_result: LoaderResultFitz from loader_fitz.py
        
    Returns:
        List of content elements with type, text, and metadata
    """
    body_size, heading_levels = detect_heading_threshold(loader_result)
    
    # Reverse mapping: font_size -> heading_level
    size_to_level = {}
    for level, size in heading_levels.items():
        size_to_level[size] = level
    
    # Detect watermarks before processing
    watermarks = detect_watermarks_in_document(loader_result)
    logger.info(f"Detected {len(watermarks)} watermark patterns")
    
    content_elements = []
    skipped_watermarks = 0
    
    for page in loader_result.pages:
        for block in page.blocks:
            if block.block_type != 0:  # Skip non-text blocks
                continue
            
            # Group spans by similar font size (within 0.5 points)
            current_group = []
            current_size = None
            
            for span in block.spans:
                if not span.text.strip():
                    continue
                
                # FIRST: Check if this individual span is a watermark
                if is_watermark(
                    span.text,
                    span.font_size,
                    span.bbox,
                    page,
                    watermarks
                ):
                    skipped_watermarks += 1
                    continue  # Skip this span entirely
                
                # Start new group if font size changes significantly
                if current_size is None or abs(span.font_size - current_size) > 0.5:
                    if current_group:
                        # Process previous group
                        group_text = " ".join(s.text for s in current_group)
                        group_size = current_size
                        
                        element = process_text_group(
                            group_text, group_size, page.page_num,
                            body_size, size_to_level, current_group[0].is_bold
                        )
                        if element:
                            content_elements.append(element)
                    
                    current_group = [span]
                    current_size = span.font_size
                else:
                    current_group.append(span)
            
            # Process last group
            if current_group:
                group_text = " ".join(s.text for s in current_group)
                group_size = current_size
                
                element = process_text_group(
                    group_text, group_size, page.page_num,
                    body_size, size_to_level, current_group[0].is_bold
                )
                if element:
                    content_elements.append(element)
    
    logger.info(f"Extracted {len(content_elements)} content elements")
    logger.info(f"Filtered {skipped_watermarks} watermark occurrences")
    return content_elements


def process_text_group(
    text: str,
    font_size: float,
    page_num: int,
    body_size: float,
    size_to_level: Dict[float, int],
    is_bold: bool
) -> Optional[Dict[str, Any]]:
    """
    Process a group of text spans with similar formatting.
    
    Args:
        text: Combined text
        font_size: Font size of the group
        page_num: Page number
        body_size: Body text font size
        size_to_level: Mapping of font sizes to heading levels
        is_bold: Whether text is bold
        
    Returns:
        Content element dict or None
    """
    cleaned = clean_text(text)
    if not cleaned or len(cleaned) < 3:
        return None
    
    # Determine if this is a heading based on font size
    is_heading = False
    heading_level = 0
    
    # Check exact size match first
    if font_size in size_to_level:
        is_heading = True
        heading_level = size_to_level[font_size]
    # Check if size is close to any heading level (within 0.5 points)
    else:
        for size, level in size_to_level.items():
            if abs(font_size - size) <= 0.5:
                is_heading = True
                heading_level = level
                break
    
    # Additional heuristics for headings
    if not is_heading and font_size > body_size + 1.0:
        # Larger than body text
        if is_bold or is_likely_heading(cleaned):
            is_heading = True
            heading_level = 3  # Default to h3 if not in predefined levels
    
    element_type = "heading" if is_heading else "paragraph"
    
    return {
        "text": cleaned,
        "type": element_type,
        "page_num": page_num,
        "font_size": font_size,
        "heading_level": heading_level,
        "is_bold": is_bold
    }


def build_sections_from_elements(elements: List[Dict[str, Any]]) -> List[TextSegment]:
    """
    Build hierarchical sections from content elements.
    Groups paragraphs under their preceding heading.
    Also tracks per-element page boundaries for accurate chunk page calculation.
    
    Args:
        elements: List of content elements
        
    Returns:
        List of TextSegments organized by sections
    """
    segments = []
    current_section_title = None
    current_section_text = []
    current_page = 1
    current_heading_level = 0
    char_position = 0
    current_element_pages: List[Tuple[int, int, int]] = []  # (page, start, end) per element

    for element in elements:
        if element["type"] == "heading":
            # Save previous section if exists
            if current_section_text:
                section_text = "\n\n".join(current_section_text)
                segments.append(TextSegment(
                    text=section_text,
                    page_num=current_page,
                    segment_type="section",
                    section_title=current_section_title,
                    char_start=char_position,
                    char_end=char_position + len(section_text),
                    heading_level=current_heading_level,
                    font_size=element["font_size"],
                    element_pages=current_element_pages
                ))
                char_position += len(section_text) + 2

            # Start new section
            current_section_title = element["text"]
            current_section_text = [element["text"]]
            current_page = element["page_num"]
            current_heading_level = element["heading_level"]
            # First element in new section
            current_element_pages = [(element["page_num"], 0, len(element["text"]))]

        else:  # paragraph
            if current_section_text:
                # Calculate this element's start position in the combined section text
                elem_start = sum(len(t) + 2 for t in current_section_text)  # +2 for \n\n separator
                elem_end = elem_start + len(element["text"])
                current_element_pages.append((element["page_num"], elem_start, elem_end))
                current_section_text.append(element["text"])
            else:
                # Standalone paragraph (no heading before it)
                segments.append(TextSegment(
                    text=element["text"],
                    page_num=element["page_num"],
                    segment_type="paragraph",
                    char_start=char_position,
                    char_end=char_position + len(element["text"]),
                    font_size=element["font_size"],
                    element_pages=[(element["page_num"], 0, len(element["text"]))]
                ))
                char_position += len(element["text"]) + 2

    # Save last section
    if current_section_text:
        section_text = "\n\n".join(current_section_text)
        segments.append(TextSegment(
            text=section_text,
            page_num=current_page,
            segment_type="section",
            section_title=current_section_title,
            char_start=char_position,
            char_end=char_position + len(section_text),
            heading_level=current_heading_level,
            element_pages=current_element_pages
        ))

    logger.info(f"Built {len(segments)} sections from {len(elements)} elements")

    for i, seg in enumerate(segments):
        logger.debug(f"Section {i+1}: '{seg.section_title}' - {len(seg.text)} chars, "
                    f"level {seg.heading_level}, page {seg.page_num}")

    return segments


def get_full_text_from_loader(loader_result) -> str:
    """
    Extract full text from loader result.
    
    Args:
        loader_result: LoaderResultFitz
        
    Returns:
        Full document text
    """
    texts = []
    for page in loader_result.pages:
        page_text = page.get_all_text()
        if page_text:
            texts.append(page_text)
    return "\n\n".join(texts)


def preprocess_fitz(loader_result) -> PreprocessingResultFitz:
    """
    Main preprocessing function for PyMuPDF loaded documents.
    Uses font size to detect headings and build document structure.
    
    Args:
        loader_result: LoaderResultFitz from loader_fitz.py
        
    Returns:
        PreprocessingResultFitz with structured segments
    """
    logger.info("Starting font-based preprocessing...")
    
    # Detect TOC
    full_text = get_full_text_from_loader(loader_result)
    has_toc = detect_toc_patterns(full_text[:5000])
    logger.info(f"TOC detected: {has_toc}")
    
    # Extract structured content with heading detection
    elements = extract_structured_content(loader_result)
    
    # Build sections from elements
    segments = build_sections_from_elements(elements)
    
    # Calculate statistics
    heading_count = sum(1 for s in segments if s.segment_type == "section")
    paragraph_count = sum(1 for s in segments if s.segment_type == "paragraph")
    
    metadata = {
        "total_segments": len(segments),
        "heading_count": heading_count,
        "paragraph_count": paragraph_count,
        "avg_font_size": loader_result.metadata.get("avg_font_size", 12.0),
        "font_sizes": loader_result.metadata.get("font_sizes", []),
        "has_toc": has_toc,
        "detection_method": "font_based",
        "watermark_filtering": True
    }
    
    logger.info(f"Preprocessing complete: {len(segments)} segments "
               f"({heading_count} sections, {paragraph_count} paragraphs)")
    
    return PreprocessingResultFitz(segments=segments, metadata=metadata)


def preprocess_fitz_pattern(loader_result) -> PreprocessingResultFitz:
    """
    Pattern-based preprocessing (fallback when font info is unreliable).
    
    Args:
        loader_result: LoaderResultFitz from loader_fitz.py
        
    Returns:
        PreprocessingResultFitz with pattern-detected segments
    """
    logger.info("Starting pattern-based preprocessing...")
    
    all_segments = []
    full_text = get_full_text_from_loader(loader_result)
    
    # Detect TOC
    has_toc = detect_toc_patterns(full_text[:5000])
    logger.info(f"TOC detected: {has_toc}")
    
    for page in loader_result.pages:
        page_text = page.get_all_text()
        cleaned = clean_text(page_text)
        
        if not cleaned:
            continue
        
        # Try section-based splitting first
        segments = split_by_sections_pattern(cleaned, page.page_num)
        logger.debug(f"Pattern-based splitting found {len(segments)} segments on page {page.page_num}")
        
        # If no sections found, fall back to paragraphs
        if len(segments) == 1 and segments[0].segment_type == "paragraph":
            logger.debug("No sections detected, trying paragraph splitting...")
            segments = split_by_paragraphs_fitz(cleaned, page.page_num)
            logger.debug(f"Paragraph splitting found {len(segments)} segments")
        
        all_segments.extend(segments)
    
    # Calculate statistics
    heading_count = sum(1 for s in all_segments if s.segment_type == "section")
    paragraph_count = sum(1 for s in all_segments if s.segment_type == "paragraph")
    
    metadata = {
        "total_segments": len(all_segments),
        "heading_count": heading_count,
        "paragraph_count": paragraph_count,
        "has_toc": has_toc,
        "total_pages": loader_result.total_pages,
        "detection_method": "pattern_based",
        "watermark_filtering": False  # Pattern-based doesn't use watermark filtering
    }
    
    logger.info(f"Pattern-based preprocessing complete: {len(all_segments)} segments "
               f"({heading_count} sections, {paragraph_count} paragraphs)")
    
    return PreprocessingResultFitz(segments=all_segments, metadata=metadata)


def preprocess_fitz_hybrid(loader_result) -> PreprocessingResultFitz:
    """
    Hybrid preprocessing: tries font-based first, falls back to pattern-based.
    
    Args:
        loader_result: LoaderResultFitz from loader_fitz.py
        
    Returns:
        PreprocessingResultFitz with best available segmentation
    """
    logger.info("Starting hybrid preprocessing...")
    
    # Check if font information is reliable
    font_sizes = loader_result.metadata.get('font_sizes', [])
    has_font_variation = len(font_sizes) > 1
    
    # Check extraction method
    extraction_method = loader_result.metadata.get('extraction_method', '')
    is_plain_text = extraction_method in ['plain_text', 'tesseract_ocr']
    
    if has_font_variation and not is_plain_text:
        # Use font-based detection
        logger.info("Using font-based detection (font variation detected)")
        result = preprocess_fitz(loader_result)
        
        # Check if font-based detection found headings
        if result.metadata.get('heading_count', 0) == 0:
            logger.warning("Font-based detection found no headings, falling back to pattern-based")
            result = preprocess_fitz_pattern(loader_result)
            result.metadata['detection_method'] = 'hybrid_fallback'
    else:
        # Use pattern-based detection
        logger.info("Using pattern-based detection (no font variation or plain text)")
        result = preprocess_fitz_pattern(loader_result)
    
    return result


def preprocess_document_fitz(loader_result) -> PreprocessingResultFitz:
    """
    Convenience function to preprocess any loader result.
    Compatible with both LoaderResult and LoaderResultFitz.
    
    Args:
        loader_result: LoaderResult or LoaderResultFitz
        
    Returns:
        PreprocessingResultFitz
    """
    # Check if it's a LoaderResultFitz (has pages with blocks)
    if hasattr(loader_result, 'pages') and loader_result.pages:
        first_page = loader_result.pages[0]
        
        # Check if it's LoaderResultFitz (has blocks attribute)
        if hasattr(first_page, 'blocks'):
            # Use hybrid preprocessing for best results
            return preprocess_fitz_hybrid(loader_result)
        else:
            # It's a regular LoaderResult, convert to pattern-based
            logger.warning("LoaderResult detected, using pattern-based preprocessing")
            # This would need conversion logic, but for now just use pattern-based
            return preprocess_fitz_pattern(loader_result)
    
    raise ValueError("Invalid loader_result: must have pages attribute")


# Alias for compatibility with old interface
preprocess_document = preprocess_document_fitz
preprocess_pages = preprocess_fitz_hybrid  # Use hybrid as default for preprocess_pages
