"""
Document loaders - extract raw text from different file formats.
Handles PDF, DOCX, TXT, and images (with OCR).

NOTE: This is the OLD version using PyPDF2.
Kept as backup. New version uses PyMuPDF (fitz) in loaders.py
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import mimetypes

logger = logging.getLogger(__name__)


class PageContent:
    """Container for a single page's content with metadata."""
    def __init__(self, text: str, page_num: int, metadata: Optional[Dict[str, Any]] = None):
        self.text = text
        self.page_num = page_num
        self.metadata = metadata or {}


class LoaderResult:
    """Result from document loading."""
    def __init__(self, pages: List[PageContent], total_pages: int, metadata: Optional[Dict[str, Any]] = None):
        self.pages = pages
        self.total_pages = total_pages
        self.metadata = metadata or {}
        self.full_text = "\n\n".join(p.text for p in pages)


def load_pdf(file_path: str) -> LoaderResult:
    """
    Extract text from PDF file, preserving page structure.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        LoaderResult with page-by-page text
    """
    try:
        from PyPDF2 import PdfReader
        
        logger.info(f"Loading PDF: {file_path}")
        pages = []
        
        with open(file_path, 'rb') as f:
            reader = PdfReader(f)
            total_pages = len(reader.pages)
            
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                pages.append(PageContent(
                    text=text,
                    page_num=page_num,
                    metadata={"extraction_method": "PyPDF2"}
                ))
        
        logger.info(f"Extracted {total_pages} pages from PDF")
        return LoaderResult(pages=pages, total_pages=total_pages)
        
    except Exception as e:
        logger.error(f"Failed to load PDF {file_path}: {e}")
        raise


def load_docx(file_path: str) -> LoaderResult:
    """
    Extract text from DOCX file.
    
    Args:
        file_path: Path to DOCX file
        
    Returns:
        LoaderResult with single-page text (DOCX doesn't have strict pages)
    """
    try:
        from docx import Document
        
        logger.info(f"Loading DOCX: {file_path}")
        doc = Document(file_path)
        
        # Extract all paragraphs
        text = "\n".join(paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip())
        
        # DOCX doesn't have native page concept, treat as single page
        pages = [PageContent(text=text, page_num=1, metadata={"extraction_method": "python-docx"})]
        
        logger.info(f"Extracted DOCX content ({len(text)} characters)")
        return LoaderResult(pages=pages, total_pages=1)
        
    except Exception as e:
        logger.error(f"Failed to load DOCX {file_path}: {e}")
        raise


def load_txt(file_path: str) -> LoaderResult:
    """
    Load plain text file.
    
    Args:
        file_path: Path to TXT file
        
    Returns:
        LoaderResult with single-page text
    """
    try:
        logger.info(f"Loading TXT: {file_path}")
        
        # Try common encodings
        encodings = ['utf-8', 'utf-16', 'latin-1', 'cp1252']
        text = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    text = f.read()
                logger.info(f"Successfully read with encoding: {encoding}")
                break
            except UnicodeDecodeError:
                continue
        
        if text is None:
            raise ValueError(f"Could not decode file with any standard encoding")
        
        pages = [PageContent(text=text, page_num=1, metadata={"encoding": encoding})]
        return LoaderResult(pages=pages, total_pages=1)
        
    except Exception as e:
        logger.error(f"Failed to load TXT {file_path}: {e}")
        raise


def load_image_ocr(file_path: str) -> LoaderResult:
    """
    Extract text from image using OCR (Tesseract).
    
    Args:
        file_path: Path to image file
        
    Returns:
        LoaderResult with OCR-extracted text
    """
    try:
        from PIL import Image
        import pytesseract
        
        logger.info(f"Loading image with OCR: {file_path}")
        
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image)
        
        # Get OCR confidence data
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = [float(conf) for conf in data['conf'] if conf != '-1']
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        pages = [PageContent(
            text=text,
            page_num=1,
            metadata={
                "extraction_method": "tesseract_ocr",
                "confidence": avg_confidence
            }
        )]
        
        logger.info(f"OCR extraction complete (confidence: {avg_confidence:.2f}%)")
        return LoaderResult(pages=pages, total_pages=1)
        
    except Exception as e:
        logger.error(f"Failed to OCR image {file_path}: {e}")
        raise


def load_document(file_path: str, mime_type: Optional[str] = None) -> LoaderResult:
    """
    Load document based on MIME type or file extension.
    
    Args:
        file_path: Path to document
        mime_type: MIME type (optional, will auto-detect if not provided)
        
    Returns:
        LoaderResult with extracted content
        
    Raises:
        ValueError: If file type is unsupported
    """
    # Auto-detect MIME type if not provided
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(file_path)
        logger.info(f"Auto-detected MIME type: {mime_type}")
    
    if not mime_type:
        raise ValueError(f"Could not determine MIME type for {file_path}")
    
    mime_lower = mime_type.lower()
    
    # Route to appropriate loader
    if mime_lower == "application/pdf":
        return load_pdf(file_path)
    
    elif mime_lower in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
        return load_docx(file_path)
    
    elif mime_lower in ["text/plain", "text/markdown"]:
        return load_txt(file_path)
    
    elif mime_lower.startswith("image/"):
        return load_image_ocr(file_path)
    
    else:
        raise ValueError(f"Unsupported MIME type: {mime_type}")


# Convenience function for task integration
def extract_text(storage_key: str, mime_type: str) -> LoaderResult:
    """
    Main entry point for text extraction.
    
    Args:
        storage_key: File path (local storage key)
        mime_type: Document MIME type
        
    Returns:
        LoaderResult with all extracted content
    """
    return load_document(storage_key, mime_type)
