"""
Test script for PyMuPDF-based document processing pipeline.
Tests: loader_fitz -> preprocess_fitz -> chunking (existing)
"""

import sys
import logging
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.loader_fitz import load_document_fitz
from pipeline.preprocess_fitz import preprocess_fitz
from pipeline.chunking import chunk_document, ChunkingConfig

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def format_size(chars: int) -> str:
    """Format character count."""
    return f"{chars} chars"


def print_separator(title: str, char: str = "="):
    """Print a formatted separator."""
    print(f"\n{char * 80}")
    print(f"{title:^80}")
    print(f"{char * 80}\n")


def test_pipeline_fitz(pdf_path: str, output_log: bool = True):
    """
    Test the complete PyMuPDF-based pipeline.
    
    Args:
        pdf_path: Path to PDF file
        output_log: Whether to save detailed log to file
    """
    # Setup log file
    log_file = None
    log_handler = None
    
    if output_log:
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        pdf_name = Path(pdf_path).stem
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"pipeline_fitz_test_{pdf_name}_{timestamp}.log"
        
        log_handler = logging.FileHandler(log_file, encoding='utf-8')
        log_handler.setLevel(logging.INFO)
        log_handler.setFormatter(logging.Formatter('%(message)s'))
        logging.getLogger().addHandler(log_handler)
        
        print(f"\n📝 Log file: {log_file.absolute()}\n")
    
    print_separator("DOCUMENT PROCESSING PIPELINE TEST (PyMuPDF)")
    print(f"File: {Path(pdf_path).name}")
    
    try:
        # ==================== STEP 1: LOADING ====================
        print_separator("STEP 1: LOADING DOCUMENT WITH PyMuPDF", "=")
        
        loader_result = load_document_fitz(pdf_path)
        
        print(f"✓ Successfully loaded document")
        print(f"  Total pages: {loader_result.total_pages}")
        print(f"  Average font size: {loader_result.metadata.get('avg_font_size', 0):.1f}pt")
        print(f"  Font size range: {loader_result.metadata.get('min_font_size', 0):.1f}pt - "
              f"{loader_result.metadata.get('max_font_size', 0):.1f}pt")
        print(f"  Unique font sizes: {len(loader_result.metadata.get('font_sizes', []))}")
        print(f"  Body font: {loader_result.metadata.get('body_font', 'unknown')}")
        
        # Show font sizes
        font_sizes = loader_result.metadata.get('font_sizes', [])
        if font_sizes:
            print(f"\n📊 Font Sizes Found (largest to smallest):")
            for size in font_sizes[:10]:  # Show top 10
                print(f"  • {size:.1f}pt")
        
        # Show first page preview
        if loader_result.pages:
            first_page = loader_result.pages[0]
            preview_text = first_page.get_all_text()[:500]
            print(f"\n📄 First Page Preview (Page 1):")
            print(f"  Blocks: {len(first_page.blocks)}")
            print(f"  Preview: {preview_text}...")
        
        # ==================== STEP 2: PREPROCESSING ====================
        print_separator("STEP 2: PREPROCESSING WITH FONT-BASED HEADING DETECTION", "=")
        
        preprocess_result = preprocess_fitz(loader_result)
        
        print(f"✓ Preprocessing complete")
        print(f"  Total segments: {len(preprocess_result.segments)}")
        print(f"  Sections (with headings): {preprocess_result.metadata.get('heading_count', 0)}")
        print(f"  Paragraphs: {preprocess_result.metadata.get('paragraph_count', 0)}")
        
        # Show detected headings
        print(f"\n🔍 Detected Section Headers:")
        heading_segments = [s for s in preprocess_result.segments if s.segment_type == "section"]
        
        if heading_segments:
            for seg in heading_segments:  # Show ALL headings
                level_indicator = "  " * (seg.heading_level - 1) if seg.heading_level > 0 else ""
                print(f"  {level_indicator}✓ '{seg.section_title}' "
                      f"(Page {seg.page_num}, {len(seg.text)} chars, "
                      f"Level {seg.heading_level}, Font: {seg.font_size:.1f}pt)")
        else:
            print("  ⚠ No section headers detected")
        
        # Show ALL segment details
        print(f"\n📝 ALL SEGMENT DETAILS (Complete for Debugging):\n")
        print(f"{'=' * 100}\n")
        
        for i, seg in enumerate(preprocess_result.segments, 1):
            print(f"{'─' * 100}")
            print(f"SEGMENT #{i} of {len(preprocess_result.segments)}")
            print(f"{'─' * 100}")
            print(f"  📍 Type: {seg.segment_type.upper()}")
            print(f"  📄 Page: {seg.page_num}")
            
            if seg.section_title:
                print(f"  📑 Title: '{seg.section_title}'")
            else:
                print(f"  📑 Title: [No title]")
            
            print(f"  📏 Length: {len(seg.text)} chars (~{len(seg.text.split())} words)")
            print(f"  🔤 Font Size: {seg.font_size:.1f}pt")
            print(f"  📊 Heading Level: {seg.heading_level} {'(H' + str(seg.heading_level) + ')' if seg.heading_level > 0 else '(Body text)'}")
            print(f"  📌 Position: chars {seg.char_start} → {seg.char_end}")
            
            # Show first 200 chars
            preview = seg.text[:200].replace('\n', ' ')
            print(f"  👁️  Preview: {preview}...")
            
            # Show full text for shorter segments
            if len(seg.text) <= 500:
                print(f"\n  📝 FULL TEXT:")
                print(f"  {'┌' + '─' * 98 + '┐'}")
                lines = seg.text.split('\n')
                for line in lines[:20]:  # Max 20 lines
                    display_line = line if len(line) <= 94 else line[:91] + "..."
                    print(f"  │ {display_line}")
                if len(lines) > 20:
                    print(f"  │ ... ({len(lines) - 20} more lines)")
                print(f"  {'└' + '─' * 98 + '┘'}")
            
            print(f"\n{'=' * 100}\n")
        
        # ==================== STEP 3: CHUNKING ====================
        print_separator("STEP 3: CHUNKING", "=")
        
        config = ChunkingConfig(
            chunk_size=512,
            overlap=50,
            min_chunk_size=100
        )
        
        print(f"Chunking Configuration:")
        print(f"  Max chunk size: {config.chunk_size} tokens")
        print(f"  Overlap: {config.overlap} tokens")
        print(f"  Min chunk size: {config.min_chunk_size} tokens")
        
        chunks = chunk_document(preprocess_result, document_id=1, config=config)
        
        print(f"\n✓ Chunking complete")
        print(f"  Total chunks: {len(chunks)}")
        
        # Calculate statistics
        if chunks:
            token_counts = [c.token_count for c in chunks if c.token_count]
            total_tokens = sum(token_counts)
            avg_tokens = total_tokens / len(token_counts) if token_counts else 0
            min_tokens = min(token_counts) if token_counts else 0
            max_tokens = max(token_counts) if token_counts else 0
            
            print(f"\n📊 Chunk Statistics:")
            print(f"  Total tokens: {total_tokens}")
            print(f"  Average tokens per chunk: {avg_tokens:.1f}")
            print(f"  Smallest chunk: {min_tokens} tokens")
            print(f"  Largest chunk: {max_tokens} tokens")
            
            # Check for problematic chunks
            small_chunks = [c for c in chunks if c.token_count and c.token_count < config.min_chunk_size]
            if small_chunks:
                print(f"\n⚠ Warning: {len(small_chunks)} chunks below minimum size ({config.min_chunk_size} tokens)")
                print(f"   Small chunks: {[f'Chunk {c.chunk_index+1} ({c.token_count} tokens)' for c in small_chunks]}")
            
            # Check for very large chunks
            large_chunks = [c for c in chunks if c.token_count and c.token_count > config.chunk_size * 0.95]
            if large_chunks:
                print(f"\n📊 Info: {len(large_chunks)} chunks near maximum size (>{config.chunk_size * 0.95:.0f} tokens)")
            
            # Token distribution
            if token_counts:
                print(f"\n📈 Token Distribution:")
                ranges = [
                    (0, 100, "Very Small"),
                    (100, 200, "Small"),
                    (200, 300, "Medium-Small"),
                    (300, 400, "Medium"),
                    (400, 500, "Large"),
                    (500, 600, "Very Large")
                ]
                for min_t, max_t, label in ranges:
                    count = sum(1 for t in token_counts if min_t <= t < max_t)
                    if count > 0:
                        bar = "█" * (count * 3)
                        print(f"  {label:15} ({min_t:3d}-{max_t:3d} tokens): {count:2d} chunks {bar}")
            
            # Show ALL chunk details for debugging
            print(f"\n📦 ALL CHUNK DETAILS (Complete for Debugging):\n")
            print(f"{'=' * 100}\n")
            
            for i, chunk in enumerate(chunks, 1):
                print(f"{'─' * 100}")
                print(f"CHUNK #{i} of {len(chunks)}")
                print(f"{'─' * 100}")
                
                # Basic info
                print(f"  📍 Chunk Index: {chunk.chunk_index}")
                print(f"  📄 Page Number: {chunk.page_num}")
                print(f"  📏 Token Count: {chunk.token_count} tokens")
                print(f"  📐 Character Length: {len(chunk.text)} chars")
                print(f"  📌 Character Position: {chunk.char_start} → {chunk.char_end}")
                
                # Section/Heading info
                if chunk.section_title:
                    print(f"  📑 Section Title: '{chunk.section_title}'")
                else:
                    print(f"  📑 Section Title: [No section title]")
                
                # Metadata
                if chunk.metadata:
                    print(f"  🏷️  Metadata:")
                    for key, value in chunk.metadata.items():
                        print(f"      • {key}: {value}")
                
                # Text preview (first 100 chars)
                preview = chunk.text[:100].replace('\n', ' ')
                print(f"  👁️  Preview: {preview}...")
                
                # Full text
                print(f"\n  📝 FULL CHUNK TEXT:")
                print(f"  {'┌' + '─' * 98 + '┐'}")
                
                # Print text with line numbers for easier debugging
                lines = chunk.text.split('\n')
                for line_num, line in enumerate(lines, 1):
                    # Truncate very long lines for readability
                    display_line = line if len(line) <= 94 else line[:91] + "..."
                    print(f"  │ {line_num:3d} │ {display_line}")
                
                print(f"  {'└' + '─' * 98 + '┘'}")
                
                # Quality checks
                print(f"\n  🔍 QUALITY CHECKS:")
                
                # Check 1: Token count
                if chunk.token_count < config.min_chunk_size:
                    print(f"      ⚠️  WARNING: Below minimum size ({chunk.token_count} < {config.min_chunk_size})")
                else:
                    print(f"      ✅ Token count OK ({chunk.token_count} >= {config.min_chunk_size})")
                
                # Check 2: Word count
                word_count = len(chunk.text.split())
                if word_count < 10:
                    print(f"      ⚠️  WARNING: Very few words ({word_count} words)")
                else:
                    print(f"      ✅ Word count OK ({word_count} words)")
                
                # Check 3: Has meaningful content
                if len(chunk.text.strip()) < 20:
                    print(f"      ⚠️  WARNING: Very short text")
                else:
                    print(f"      ✅ Text length OK")
                
                # Check 4: Whitespace issues
                if '  ' in chunk.text:  # Multiple spaces
                    space_count = chunk.text.count('  ')
                    print(f"      ⚠️  WARNING: Contains {space_count} instances of multiple spaces")
                else:
                    print(f"      ✅ No excessive whitespace")
                
                # Check 5: Newline issues
                newline_count = chunk.text.count('\n')
                if newline_count > len(chunk.text) / 50:  # More than 2% newlines
                    print(f"      ⚠️  WARNING: High newline density ({newline_count} newlines)")
                else:
                    print(f"      ✅ Newline density OK ({newline_count} newlines)")
                
                print(f"\n{'=' * 100}\n")
        
        # ==================== SECTION-TO-CHUNKS MAPPING ====================
        print_separator("SECTION-TO-CHUNKS MAPPING", "=")
        
        # Group chunks by section
        from collections import defaultdict
        section_chunks = defaultdict(list)
        
        for chunk in chunks:
            section_key = chunk.section_title if chunk.section_title else "[No Section]"
            section_chunks[section_key].append(chunk)
        
        print(f"Document has {len(section_chunks)} unique sections:\n")
        
        for section_name, section_chunk_list in section_chunks.items():
            print(f"📑 Section: '{section_name}'")
            print(f"   • Number of chunks: {len(section_chunk_list)}")
            print(f"   • Total tokens: {sum(c.token_count for c in section_chunk_list)}")
            print(f"   • Total characters: {sum(len(c.text) for c in section_chunk_list)}")
            print(f"   • Chunk indices: {[c.chunk_index for c in section_chunk_list]}")
            print(f"   • Token sizes: {[c.token_count for c in section_chunk_list]}")
            
            # Show if any chunks are problematic
            small = [c for c in section_chunk_list if c.token_count < config.min_chunk_size]
            if small:
                print(f"   ⚠️  WARNING: {len(small)} chunk(s) below minimum size")
            
            print()
        
        print(f"{'=' * 80}\n")
        
        # ==================== CHUNK SUMMARY TABLE ====================
        print_separator("CHUNK SUMMARY TABLE", "=")
        
        # Print table header
        print(f"{'#':<5} {'Page':<6} {'Tokens':<8} {'Chars':<8} {'Words':<8} {'Quality':<10} {'Section/Heading':<40}")
        print(f"{'-'*5} {'-'*6} {'-'*8} {'-'*8} {'-'*8} {'-'*10} {'-'*40}")
        
        for i, chunk in enumerate(chunks, 1):
            section = chunk.section_title if chunk.section_title else "[No section]"
            section_display = section[:37] + "..." if len(section) > 40 else section
            
            # Calculate quality indicators
            word_count = len(chunk.text.split())
            has_multiple_spaces = '  ' in chunk.text
            
            # Quality assessment
            quality_issues = []
            if chunk.token_count < config.min_chunk_size:
                quality_issues.append("Small")
            if word_count < 10:
                quality_issues.append("FewWords")
            if has_multiple_spaces:
                quality_issues.append("Spaces")
            
            quality = ", ".join(quality_issues) if quality_issues else "✓ Good"
            quality_display = quality[:9] if len(quality) <= 10 else quality[:7] + ".."
            
            print(f"{i:<5} {chunk.page_num:<6} {chunk.token_count:<8} {len(chunk.text):<8} {word_count:<8} {quality_display:<10} {section_display}")
        
        print(f"\n{'=' * 80}\n")
        
        # ==================== TEXT QUALITY ANALYSIS ====================
        print_separator("TEXT QUALITY ANALYSIS", "=")
        
        total_chunks = len(chunks)
        
        # Analyze quality issues
        issues = {
            "Below minimum tokens": [c for c in chunks if c.token_count < config.min_chunk_size],
            "Very few words (<10)": [c for c in chunks if len(c.text.split()) < 10],
            "Multiple spaces": [c for c in chunks if '  ' in c.text],
            "High newline density": [c for c in chunks if c.text.count('\n') > len(c.text) / 50],
            "Very short text (<50 chars)": [c for c in chunks if len(c.text.strip()) < 50],
            "Empty or whitespace only": [c for c in chunks if not c.text.strip()],
        }
        
        print(f"Quality Issues Found:\n")
        
        has_issues = False
        for issue_name, problematic_chunks in issues.items():
            if problematic_chunks:
                has_issues = True
                percentage = (len(problematic_chunks) / total_chunks) * 100
                print(f"  ⚠️  {issue_name}: {len(problematic_chunks)} chunks ({percentage:.1f}%)")
                print(f"      Chunk IDs: {[c.chunk_index for c in problematic_chunks[:10]]}")
                if len(problematic_chunks) > 10:
                    print(f"      ... and {len(problematic_chunks) - 10} more")
                print()
        
        if not has_issues:
            print(f"  ✅ No quality issues detected! All chunks look good.\n")
        
        # Positive metrics
        print(f"Positive Metrics:\n")
        good_chunks = [c for c in chunks 
                      if c.token_count >= config.min_chunk_size 
                      and len(c.text.split()) >= 10
                      and '  ' not in c.text]
        
        if good_chunks:
            percentage = (len(good_chunks) / total_chunks) * 100
            print(f"  ✅ High quality chunks: {len(good_chunks)}/{total_chunks} ({percentage:.1f}%)")
        
        # Average metrics
        avg_words = sum(len(c.text.split()) for c in chunks) / len(chunks)
        avg_sentences = sum(c.text.count('.') + c.text.count('!') + c.text.count('?') for c in chunks) / len(chunks)
        
        print(f"  📊 Average words per chunk: {avg_words:.1f}")
        print(f"  📊 Average sentences per chunk: {avg_sentences:.1f}")
        
        print(f"\n{'=' * 80}\n")
        
        # ==================== SUMMARY ====================
        print_separator("PIPELINE SUMMARY", "=")
        print(f"✓ Document loaded: {loader_result.total_pages} pages")
        print(f"✓ Preprocessed: {len(preprocess_result.segments)} segments "
              f"({preprocess_result.metadata.get('heading_count', 0)} sections)")
        print(f"✓ Chunked: {len(chunks)} chunks")
        
        if chunks:
            valid_chunks = [c for c in chunks if c.token_count >= config.min_chunk_size]
            print(f"  • Valid chunks (>={config.min_chunk_size} tokens): {len(valid_chunks)}/{len(chunks)}")
            print(f"  • Average chunk size: {sum(c.token_count for c in chunks)/len(chunks):.1f} tokens")
            print(f"  • Total content: {sum(c.token_count for c in chunks)} tokens")
        
        print(f"\nPipeline completed successfully!")
        print(f"Note: No data was saved to database (test mode)")
        print(f"\n{'=' * 80}\n")
        
        # ==================== WRITE DETAILED LOG ====================
        if log_file:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write("\n\n" + "=" * 100 + "\n")
                f.write("DETAILED CHUNK INFORMATION FOR DEBUGGING\n")
                f.write("=" * 100 + "\n\n")
                
                for i, chunk in enumerate(chunks, 1):
                    f.write(f"\n{'─' * 100}\n")
                    f.write(f"CHUNK #{i} of {len(chunks)}\n")
                    f.write(f"{'─' * 100}\n")
                    f.write(f"Chunk Index: {chunk.chunk_index}\n")
                    f.write(f"Page Number: {chunk.page_num}\n")
                    f.write(f"Token Count: {chunk.token_count} tokens\n")
                    f.write(f"Character Length: {len(chunk.text)} chars\n")
                    f.write(f"Character Position: {chunk.char_start} → {chunk.char_end}\n")
                    f.write(f"Section Title: {chunk.section_title if chunk.section_title else '[No section title]'}\n")
                    
                    if chunk.metadata:
                        f.write(f"Metadata: {chunk.metadata}\n")
                    
                    # Quality checks
                    word_count = len(chunk.text.split())
                    has_multiple_spaces = '  ' in chunk.text
                    newline_count = chunk.text.count('\n')
                    
                    f.write(f"\nQuality Checks:\n")
                    f.write(f"  - Token count: {'✓ OK' if chunk.token_count >= config.min_chunk_size else f'⚠ WARNING: {chunk.token_count} < {config.min_chunk_size}'}\n")
                    f.write(f"  - Word count: {word_count} words {'✓' if word_count >= 10 else '⚠ Very few words'}\n")
                    f.write(f"  - Multiple spaces: {'⚠ YES' if has_multiple_spaces else '✓ NO'}\n")
                    f.write(f"  - Newlines: {newline_count}\n")
                    
                    f.write(f"\nFULL CHUNK TEXT:\n")
                    f.write("┌" + "─" * 98 + "┐\n")
                    for line in chunk.text.split('\n'):
                        f.write(f"│ {line}\n")
                    f.write("└" + "─" * 98 + "┘\n")
                    f.write("\n" + "=" * 100 + "\n")
                
                # Write segment details
                f.write("\n\n" + "=" * 100 + "\n")
                f.write("DETAILED SEGMENT INFORMATION\n")
                f.write("=" * 100 + "\n\n")
                
                for i, seg in enumerate(preprocess_result.segments, 1):
                    f.write(f"\n{'─' * 100}\n")
                    f.write(f"SEGMENT #{i} of {len(preprocess_result.segments)}\n")
                    f.write(f"{'─' * 100}\n")
                    f.write(f"Type: {seg.segment_type.upper()}\n")
                    f.write(f"Page: {seg.page_num}\n")
                    f.write(f"Title: {seg.section_title if seg.section_title else '[No title]'}\n")
                    f.write(f"Length: {len(seg.text)} chars (~{len(seg.text.split())} words)\n")
                    f.write(f"Font Size: {seg.font_size:.1f}pt\n")
                    f.write(f"Heading Level: {seg.heading_level}\n")
                    f.write(f"Position: chars {seg.char_start} → {seg.char_end}\n")
                    f.write(f"\nFULL SEGMENT TEXT:\n")
                    f.write("┌" + "─" * 98 + "┐\n")
                    for line in seg.text.split('\n'):
                        f.write(f"│ {line}\n")
                    f.write("└" + "─" * 98 + "┘\n")
                    f.write("\n" + "=" * 100 + "\n")
            
            print(f"✓ Detailed log saved to: {log_file.absolute()}\n")
        
        return {
            "loader_result": loader_result,
            "preprocess_result": preprocess_result,
            "chunks": chunks
        }
        
    except Exception as e:
        logger.exception(f"Pipeline test failed: {e}")
        print(f"\n❌ Pipeline test failed: {e}\n")
        raise


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test PyMuPDF-based document processing pipeline")
    parser.add_argument("pdf_path", help="Path to PDF file to test")
    parser.add_argument("--no-log", action="store_true", help="Don't save log file")
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"❌ Error: File not found: {pdf_path}")
        sys.exit(1)
    
    if not pdf_path.suffix.lower() == '.pdf':
        print(f"❌ Error: File must be a PDF: {pdf_path}")
        sys.exit(1)
    
    test_pipeline_fitz(str(pdf_path), output_log=not args.no_log)


if __name__ == "__main__":
    main()
