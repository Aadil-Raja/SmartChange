"""
PyMuPDF (fitz) based document loader - extracts text with formatting metadata.
Captures font size, font name, and positioning for intelligent heading detection.
Supports PDF, DOCX, TXT, and images (with OCR).
"""

import logging
import mimetypes
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class TextSpan:
    """A span of text with formatting metadata."""
    text: str
    font_size: float
    font_name: str
    is_bold: bool
    is_italic: bool
    bbox: tuple  # (x0, y0, x1, y1)
    

@dataclass
class TextBlock:
    """A block of text spans (usually a paragraph or line)."""
    spans: List[TextSpan]
    bbox: tuple
    block_type: int  # 0=text, 1=image


@dataclass
class PageContentFitz:
    """Container for a page's content with rich formatting metadata."""
    page_num: int  # Physical page position (1-based)
    blocks: List[TextBlock]
    width: float
    height: float
    
    def get_all_text(self) -> str:
        """Get all text from the page."""
        texts = []
        for block in self.blocks:
            if block.block_type == 0:  # text block
                for span in block.spans:
                    texts.append(span.text)
        return " ".join(texts)


class LoaderResultFitz:
    """Result from PyMuPDF document loading."""
    def __init__(self, pages: List[PageContentFitz], total_pages: int, metadata: Optional[Dict[str, Any]] = None):
        self.pages = pages
        self.total_pages = total_pages
        self.metadata = metadata or {}
        
        # Calculate document-wide font statistics
        self._calculate_font_stats()
    
    def _calculate_font_stats(self):
        """Calculate average font size and common fonts across document."""
        all_font_sizes = []
        font_counts = {}
        
        for page in self.pages:
            for block in page.blocks:
                if block.block_type == 0:  # text block
                    for span in block.spans:
                        if span.text.strip():  # Only count non-empty spans
                            all_font_sizes.append(span.font_size)
                            font_counts[span.font_name] = font_counts.get(span.font_name, 0) + 1
        
        if all_font_sizes:
            self.metadata['avg_font_size'] = sum(all_font_sizes) / len(all_font_sizes)
            self.metadata['min_font_size'] = min(all_font_sizes)
            self.metadata['max_font_size'] = max(all_font_sizes)
            self.metadata['font_sizes'] = sorted(set(all_font_sizes), reverse=True)
        else:
            self.metadata['avg_font_size'] = 12.0
            self.metadata['min_font_size'] = 12.0
            self.metadata['max_font_size'] = 12.0
            self.metadata['font_sizes'] = [12.0]
        
        # Most common font (body text font)
        if font_counts:
            self.metadata['body_font'] = max(font_counts.items(), key=lambda x: x[1])[0]
        else:
            self.metadata['body_font'] = 'unknown'
        
        logger.info(f"Font stats - Avg: {self.metadata['avg_font_size']:.1f}, "
                   f"Range: {self.metadata['min_font_size']:.1f}-{self.metadata['max_font_size']:.1f}, "
                   f"Unique sizes: {len(self.metadata['font_sizes'])}")


def load_pdf_fitz(file_path: str) -> LoaderResultFitz:
    """
    Extract text from PDF with formatting metadata using PyMuPDF.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        LoaderResultFitz with rich formatting data
    """
    try:
        import fitz  # PyMuPDF
        
        logger.info(f"Loading PDF with PyMuPDF: {file_path}")
        pages = []
        
        doc = fitz.open(file_path)
        total_pages = len(doc)
        
        for page_num in range(total_pages):
            page = doc[page_num]
            page_dict = page.get_text("dict")
            
            blocks = []
            for block in page_dict.get("blocks", []):
                block_type = block.get("type", 0)
                
                if block_type == 0:  # Text block
                    spans = []
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "")
                            if not text.strip():
                                continue
                            
                            font_name = span.get("font", "")
                            is_bold = "bold" in font_name.lower()
                            is_italic = "italic" in font_name.lower() or "oblique" in font_name.lower()
                            
                            text_span = TextSpan(
                                text=text,
                                font_size=span.get("size", 12.0),
                                font_name=font_name,
                                is_bold=is_bold,
                                is_italic=is_italic,
                                bbox=span.get("bbox", (0, 0, 0, 0))
                            )
                            spans.append(text_span)
                    
                    if spans:  # Only add blocks with content
                        text_block = TextBlock(
                            spans=spans,
                            bbox=block.get("bbox", (0, 0, 0, 0)),
                            block_type=0
                        )
                        blocks.append(text_block)
            
            page_content = PageContentFitz(
                page_num=page_num + 1,
                blocks=blocks,
                width=page.rect.width,
                height=page.rect.height
            )
            pages.append(page_content)
        
        doc.close()
        
        logger.info(f"Extracted {total_pages} pages with formatting metadata")
        result = LoaderResultFitz(pages=pages, total_pages=total_pages)
        
        return result
        
    except ImportError:
        logger.error("PyMuPDF (fitz) not installed. Install with: pip install PyMuPDF")
        raise
    except Exception as e:
        logger.error(f"Failed to load PDF with PyMuPDF {file_path}: {e}")
        raise


def load_docx_fitz(file_path: str) -> LoaderResultFitz:
    """
    Extract text from DOCX file with heading detection.
    
    Args:
        file_path: Path to DOCX file
        
    Returns:
        LoaderResultFitz with heading styles detected
    """
    try:
        from docx import Document
        
        logger.info(f"Loading DOCX: {file_path}")
        doc = Document(file_path)
        
        # Map heading styles to font sizes for consistency
        style_to_size = {
            'Heading 1': 18.0,
            'Heading 2': 16.0,
            'Heading 3': 14.0,
            'Heading 4': 13.0,
            'Heading 5': 12.5,
            'Heading 6': 12.0,
            'Normal': 11.0,
            'Body Text': 11.0,
        }
        
        blocks = []
        
        for para in doc.paragraphs:
            if not para.text.strip():
                continue
            
            # Detect style
            style_name = para.style.name if para.style else 'Normal'
            font_size = style_to_size.get(style_name, 11.0)
            
            # Check for bold/italic in runs
            is_bold = any(run.bold for run in para.runs if run.bold is not None)
            is_italic = any(run.italic for run in para.runs if run.italic is not None)
            
            # Create a single span for the paragraph
            text_span = TextSpan(
                text=para.text,
                font_size=font_size,
                font_name=style_name,
                is_bold=is_bold,
                is_italic=is_italic,
                bbox=(0, 0, 0, 0)
            )
            
            text_block = TextBlock(
                spans=[text_span],
                bbox=(0, 0, 0, 0),
                block_type=0
            )
            blocks.append(text_block)
        
        # Create single page (DOCX doesn't have native pages)
        page_content = PageContentFitz(
            page_num=1,
            blocks=blocks,
            width=0,
            height=0
        )
        
        logger.info(f"Extracted DOCX content ({len(blocks)} paragraphs)")
        result = LoaderResultFitz(pages=[page_content], total_pages=1)
        result.metadata['extraction_method'] = 'python-docx'
        
        return result
        
    except ImportError:
        logger.error("python-docx not installed. Install with: pip install python-docx")
        raise
    except Exception as e:
        logger.error(f"Failed to load DOCX {file_path}: {e}")
        raise


def load_txt_fitz(file_path: str) -> LoaderResultFitz:
    """
    Load plain text file.
    
    Args:
        file_path: Path to TXT file
        
    Returns:
        LoaderResultFitz with single page
    """
    try:
        logger.info(f"Loading TXT: {file_path}")
        
        # Try common encodings
        encodings = ['utf-8', 'utf-16', 'latin-1', 'cp1252']
        text = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    text = f.read()
                used_encoding = encoding
                logger.info(f"Successfully read with encoding: {encoding}")
                break
            except UnicodeDecodeError:
                continue
        
        if text is None:
            raise ValueError(f"Could not decode file with any standard encoding")
        
        # Create single span with default formatting
        text_span = TextSpan(
            text=text,
            font_size=11.0,
            font_name='Plain Text',
            is_bold=False,
            is_italic=False,
            bbox=(0, 0, 0, 0)
        )
        
        text_block = TextBlock(
            spans=[text_span],
            bbox=(0, 0, 0, 0),
            block_type=0
        )
        
        page_content = PageContentFitz(
            page_num=1,
            blocks=[text_block],
            width=0,
            height=0
        )
        
        logger.info(f"Extracted TXT content ({len(text)} characters)")
        result = LoaderResultFitz(pages=[page_content], total_pages=1)
        result.metadata['extraction_method'] = 'plain_text'
        result.metadata['encoding'] = used_encoding
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to load TXT {file_path}: {e}")
        raise


def load_image_ocr_fitz(file_path: str) -> LoaderResultFitz:
    """
    Extract text from image using OCR (Tesseract).
    
    Args:
        file_path: Path to image file
        
    Returns:
        LoaderResultFitz with OCR-extracted text
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
        
        # Create single span
        text_span = TextSpan(
            text=text,
            font_size=11.0,
            font_name='OCR',
            is_bold=False,
            is_italic=False,
            bbox=(0, 0, 0, 0)
        )
        
        text_block = TextBlock(
            spans=[text_span],
            bbox=(0, 0, 0, 0),
            block_type=0
        )
        
        page_content = PageContentFitz(
            page_num=1,
            blocks=[text_block],
            width=image.width,
            height=image.height
        )
        
        logger.info(f"OCR extraction complete (confidence: {avg_confidence:.2f}%)")
        result = LoaderResultFitz(pages=[page_content], total_pages=1)
        result.metadata['extraction_method'] = 'tesseract_ocr'
        result.metadata['confidence'] = avg_confidence
        
        return result
        
    except ImportError as e:
        logger.error(f"Missing dependency: {e}. Install with: pip install Pillow pytesseract")
        raise
    except Exception as e:
        logger.error(f"Failed to OCR image {file_path}: {e}")
        raise


def load_document_fitz(file_path: str, mime_type: Optional[str] = None) -> LoaderResultFitz:
    """
    Load document based on MIME type or file extension.
    
    Args:
        file_path: Path to document
        mime_type: MIME type (optional, will auto-detect if not provided)
        
    Returns:
        LoaderResultFitz with extracted content and formatting
        
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
        return load_pdf_fitz(file_path)
    
    elif mime_lower in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
        return load_docx_fitz(file_path)
    
    elif mime_lower in ["text/plain", "text/markdown"]:
        return load_txt_fitz(file_path)
    
    elif mime_lower.startswith("image/"):
        return load_image_ocr_fitz(file_path)
    
    else:
        raise ValueError(f"Unsupported MIME type: {mime_type}")


def extract_text_fitz(storage_key: str, mime_type: str, document_id: int = None, db_session = None) -> LoaderResultFitz:
    """
    Main entry point for text extraction with Cloudinary fallback.
    
    Args:
        storage_key: File path (local storage key)
        mime_type: Document MIME type
        document_id: Document ID for Cloudinary fallback (optional)
        db_session: Database session for Cloudinary fallback (optional)
        
    Returns:
        LoaderResultFitz with all extracted content
    """
    import os
    import shutil
    from pathlib import Path
    
    # Check if local file exists
    if os.path.exists(storage_key):
        logger.info(f"✓ Using local file: {storage_key}")
        return load_document_fitz(storage_key, mime_type)
    
    # Local file doesn't exist, try Cloudinary fallback
    logger.warning(f"⚠ Local file not found: {storage_key}")
    
    if document_id and db_session:
        logger.info(f"🔄 Attempting Cloudinary fallback for document {document_id}")
        
        temp_dir = None
        try:
            # Get document from database to get Cloudinary URL
            from shared.repos import documents_repo
            doc = documents_repo.get_by_id(db_session, document_id)
            
            if not doc or not doc.cloudinary_url:
                raise ValueError(f"No Cloudinary URL found for document {document_id}")
            
            logger.info(f"🔗 Found Cloudinary URL: {doc.cloudinary_url}")
            
            # Create temporary directory in current folder
            temp_dir = f"temp_doc_{document_id}"
            os.makedirs(temp_dir, exist_ok=True)
            logger.info(f"📁 Created temporary directory: {temp_dir}")
            
            # Download file from Cloudinary to temp directory
            temp_file_path = _download_from_cloudinary(doc.cloudinary_url, temp_dir, mime_type, document_id)
            
            # Process the downloaded file
            logger.info(f"📄 Processing downloaded file: {temp_file_path}")
            result = load_document_fitz(temp_file_path, mime_type)
            
            logger.info(f"✅ Cloudinary fallback successful for document {document_id}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Cloudinary fallback failed: {e}")
            raise ValueError(f"File not found locally and Cloudinary fallback failed: {e}")
        
        finally:
            # Clean up temporary directory and all its contents
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"🧹 Cleaned up temporary directory: {temp_dir}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠ Failed to cleanup temp directory: {cleanup_error}")
    
    # No fallback options available
    raise FileNotFoundError(f"File not found: {storage_key} (no Cloudinary fallback available)")


def _download_from_cloudinary(cloudinary_url: str, temp_dir: str, mime_type: str, document_id: int) -> str:
    """
    Download file from Cloudinary URL to a temporary directory.
    
    Args:
        cloudinary_url: Cloudinary URL to download from
        temp_dir: Temporary directory to save file in
        mime_type: MIME type for file extension
        document_id: Document ID for filename
        
    Returns:
        Path to downloaded file in temp directory
    """
    import os
    import requests
    import mimetypes
    from pathlib import Path
    
    logger.info(f"⬇️ Downloading from Cloudinary: {cloudinary_url}")
    
    try:
        # Make request to download file
        response = requests.get(cloudinary_url, timeout=60)
        response.raise_for_status()
        
        # Determine file extension from MIME type
        extension = mimetypes.guess_extension(mime_type) or '.pdf'
        
        # Create file path in temp directory
        filename = f"document_{document_id}{extension}"
        temp_file_path = os.path.join(temp_dir, filename)
        
        # Write file to temp directory
        with open(temp_file_path, 'wb') as temp_file:
            temp_file.write(response.content)
        
        logger.info(f"✅ Downloaded {len(response.content)} bytes to: {temp_file_path}")
        return temp_file_path
        
    except requests.RequestException as e:
        logger.error(f"Failed to download from Cloudinary: {e}")
        raise
    except Exception as e:
        logger.error(f"Error during Cloudinary download: {e}")
        raise


# Alias for compatibility with old interface
extract_text = extract_text_fitz
load_document = load_document_fitz
