"""
Pipeline Testing Tool - Test document processing without saving to database
Logs output to file in logs/ directory
Usage: python test_pipeline.py <path_to_pdf>
"""
import sys
import os
import logging
from datetime import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from loaders import load_pdf, load_document
from preprocess import preprocess_document, extract_section_headers
from chunking import chunk_document, ChunkingConfig, count_tokens


# Global logger
logger = None


def setup_logging(file_path: str):
    """Setup logging to both file and console."""
    global logger
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate log filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    doc_name = os.path.splitext(os.path.basename(file_path))[0]
    log_file = os.path.join(log_dir, f"pipeline_test_{doc_name}_{timestamp}.log")
    
    # Create logger
    logger = logging.getLogger('pipeline_test')
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    logger.handlers = []
    
    # File handler
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter('%(message)s')
    file_handler.setFormatter(file_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(message)s')
    console_handler.setFormatter(console_formatter)
    
    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return log_file


def log(message):
    """Log message to both file and console."""
    if logger:
        logger.info(message)
    else:
        print(message)


def print_separator(title="", char="=", width=80):
    """Print a formatted separator line."""
    if title:
        padding = (width - len(title) - 2) // 2
        log(f"\n{char * padding} {title} {char * padding}")
    else:
        log(f"\n{char * width}")


def test_document_pipeline(file_path: str, mime_type: str = None):
    """
    Test the full document processing pipeline without database.
    
    Args:
        file_path: Path to document file
        mime_type: MIME type (optional, will auto-detect)
    """
    
    print_separator("DOCUMENT PROCESSING PIPELINE TEST", "=")
    log(f"File: {file_path}")
    log(f"MIME Type: {mime_type or 'Auto-detect'}")
    
    # ========================================
    # STEP 1: LOAD DOCUMENT
    # ========================================
    print_separator("STEP 1: LOADING DOCUMENT", "=")
    
    try:
        if mime_type:
            loader_result = load_document(file_path, mime_type)
        else:
            # Try PDF first
            loader_result = load_pdf(file_path)
        
        log(f"✓ Successfully loaded document")
        log(f"  Total pages: {loader_result.total_pages}")
        log(f"  Total characters: {len(loader_result.full_text)}")
        
        # Show first page preview
        if loader_result.pages:
            first_page = loader_result.pages[0]
            log(f"\n📄 First Page Preview (Page {first_page.page_num}):")
            log(f"  Length: {len(first_page.text)} characters")
            preview = first_page.text[:500].replace('\n', ' ')
            log(f"  Preview: {preview}...")
        
        # Show all pages summary
        log(f"\n📚 All Pages Summary:")
        for page in loader_result.pages:
            log(f"  Page {page.page_num}: {len(page.text)} chars")
            
    except Exception as e:
        log(f"❌ Failed to load document: {e}")
        import traceback
        log(traceback.format_exc())
        return
    
    # ========================================
    # STEP 2: PREPROCESSING
    # ========================================
    print_separator("STEP 2: PREPROCESSING", "=")
    
    try:
        preprocess_result = preprocess_document(loader_result)
        
        log(f"✓ Preprocessing complete")
        log(f"  Total segments: {len(preprocess_result.segments)}")
        log(f"  Has TOC: {preprocess_result.has_toc}")
        
        # Analyze segments
        section_count = sum(1 for s in preprocess_result.segments if s.segment_type == "section")
        paragraph_count = sum(1 for s in preprocess_result.segments if s.segment_type == "paragraph")
        
        log(f"\n📊 Segment Breakdown:")
        log(f"  Sections: {section_count}")
        log(f"  Paragraphs: {paragraph_count}")
        
        # Show detected headers
        log(f"\n🔍 Detected Section Headers:")
        headers_found = False
        for seg in preprocess_result.segments:
            if seg.section_title:
                headers_found = True
                log(f"  ✓ '{seg.section_title}' (Page {seg.page_num}, {len(seg.text)} chars)")
        
        if not headers_found:
            log(f"  ⚠️  No section headers detected")
            log(f"  → Document will be split by paragraphs instead")
        
        # Show each segment details
        log(f"\n📝 Segment Details:")
        for i, seg in enumerate(preprocess_result.segments):
            log(f"\n  Segment {i + 1}:")
            log(f"    Type: {seg.segment_type}")
            log(f"    Page: {seg.page_num}")
            log(f"    Title: {seg.section_title or '(none)'}")
            log(f"    Length: {len(seg.text)} chars (~{count_tokens(seg.text)} tokens)")
            log(f"    Position: chars {seg.char_start}-{seg.char_end}")
            
            # Show text preview
            preview = seg.text[:200].replace('\n', ' ')
            if len(seg.text) > 200:
                preview += "..."
            log(f"    Preview: {preview}")
        
    except Exception as e:
        log(f"❌ Preprocessing failed: {e}")
        import traceback
        log(traceback.format_exc())
        return
    
    # ========================================
    # STEP 3: CHUNKING
    # ========================================
    print_separator("STEP 3: CHUNKING", "=")
    
    try:
        # Use default config
        config = ChunkingConfig(
            chunk_size=512,
            overlap=50,
            min_chunk_size=100
        )
        
        log(f"Chunking Configuration:")
        log(f"  Max chunk size: {config.chunk_size} tokens")
        log(f"  Overlap: {config.overlap} tokens")
        log(f"  Min chunk size: {config.min_chunk_size} tokens")
    
        
        chunks = chunk_document(preprocess_result, document_id=0, config=config)
        
        log(f"\n✓ Chunking complete")
        log(f"  Total chunks: {len(chunks)}")
        
        if not chunks:
            log(f"  ⚠️  No chunks created!")
            log(f"  Possible reasons:")
            log(f"    - Document is empty")
            log(f"    - All segments are below minimum chunk size")
            log(f"    - Text extraction failed")
            return
        
        # Analyze chunks
        total_tokens = sum(chunk.token_count or 0 for chunk in chunks)
        avg_tokens = total_tokens / len(chunks) if chunks else 0
        
        log(f"\n📊 Chunk Statistics:")
        log(f"  Total tokens: {total_tokens}")
        log(f"  Average tokens per chunk: {avg_tokens:.1f}")
        log(f"  Smallest chunk: {min(chunk.token_count or 0 for chunk in chunks)} tokens")
        log(f"  Largest chunk: {max(chunk.token_count or 0 for chunk in chunks)} tokens")
        
        # Show each chunk
        log(f"\n📦 Chunk Details:")
        for chunk in chunks:
            log(f"\n  Chunk {chunk.chunk_index + 1}:")
            log(f"    Section: {chunk.section_title or '(none)'}")
            log(f"    Page: {chunk.page_num}")
            log(f"    Tokens: {chunk.token_count}")
            log(f"    Length: {len(chunk.text)} chars")
            log(f"    Position: chars {chunk.char_start}-{chunk.char_end}")
            
            # Show full text
            log(f"    --- Full Text Start ---")
            log(f"{chunk.text}")
            log(f"    --- Full Text End ---")
        
    except Exception as e:
        log(f"❌ Chunking failed: {e}")
        import traceback
        log(traceback.format_exc())
        return
    
    # ========================================
    # SUMMARY
    # ========================================
    print_separator("PIPELINE SUMMARY", "=")
    log(f"✓ Document loaded: {loader_result.total_pages} pages")
    log(f"✓ Preprocessed: {len(preprocess_result.segments)} segments")
    log(f"✓ Chunked: {len(chunks)} chunks")
    log(f"\nPipeline completed successfully!")
    log(f"Note: No data was saved to database (test mode)")
    print_separator("", "=")


def test_header_detection(file_path: str):
    """
    Test only the header detection on a document.
    
    Args:
        file_path: Path to document file
    """
    print_separator("HEADER DETECTION TEST", "=")
    log(f"File: {file_path}")
    
    try:
        # Load document
        loader_result = load_pdf(file_path)
        log(f"✓ Loaded {loader_result.total_pages} pages")
        
        # Get full text
        full_text = loader_result.full_text
        log(f"✓ Total text length: {len(full_text)} characters")
        
        # Extract headers
        log(f"\n🔍 Detecting headers...")
        headers = extract_section_headers(full_text)
        
        if headers:
            log(f"✓ Found {len(headers)} headers:")
            for i, header in enumerate(headers, 1):
                log(f"\n  Header {i}:")
                log(f"    Title: {header['title']}")
                log(f"    Type: {header['pattern_type']}")
                log(f"    Line: {header['line_num']}")
                log(f"    Position: char {header['position']}")
        else:
            log(f"⚠️  No headers detected")
            log(f"\nShowing first 20 lines for manual inspection:")
            lines = full_text.split('\n')[:20]
            for i, line in enumerate(lines, 1):
                if line.strip():
                    log(f"  Line {i}: {line.strip()}")
        
    except Exception as e:
        log(f"❌ Failed: {e}")
        import traceback
        log(traceback.format_exc())
    
    print_separator("", "=")


if __name__ == "__main__":
    log("""
╔══════════════════════════════════════════════════════════════╗
║         Document Processing Pipeline Tester                  ║
║         Test extraction, preprocessing, and chunking         ║
║         Logs saved to: logs/pipeline_test_*.log              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    if len(sys.argv) < 2:
        log("Usage:")
        log("  python test_pipeline.py <path_to_document>")
        log("  python test_pipeline.py <path_to_document> --headers-only")
        log("\nExamples:")
        log("  python test_pipeline.py document.pdf")
        log("  python test_pipeline.py resume.pdf --headers-only")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        log(f"❌ Error: File not found: {file_path}")
        sys.exit(1)
    
    # Setup logging
    log_file = setup_logging(file_path)
    log(f"\n📝 Log file: {log_file}\n")
    
    # Check for flags
    headers_only = "--headers-only" in sys.argv
    
    if headers_only:
        test_header_detection(file_path)
    else:
        test_document_pipeline(file_path)
    
    log(f"\n✓ Log saved to: {log_file}")
