"""
Convert dataset.txt and groundtruth.txt to structured JSON format.

This script parses the text files and creates clean JSON files with:
- questions: List of all 100 compound questions
- ground_truths: List of corresponding answers

Usage:
    python convert_to_json.py
"""

import json
import re
from pathlib import Path


def parse_dataset(file_path: Path) -> list:
    """Parse dataset.txt and extract questions."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    questions = []
    
    # Pattern to match numbered questions (1. Question text)
    pattern = r'^\d+\.\s+(.+)$'
    
    for line in content.split('\n'):
        line = line.strip()
        match = re.match(pattern, line)
        if match:
            question = match.group(1)
            questions.append(question)
    
    return questions


def parse_groundtruth(file_path: Path) -> list:
    """Parse groundtruth.txt and extract answers."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    ground_truths = []
    
    # Pattern to match numbered answers (1. Answer text)
    pattern = r'^\d+\.\s+(.+)$'
    
    for line in content.split('\n'):
        line = line.strip()
        match = re.match(pattern, line)
        if match:
            answer = match.group(1)
            ground_truths.append(answer)
    
    return ground_truths


def main():
    """Convert text files to JSON."""
    script_dir = Path(__file__).parent
    
    # Input files
    dataset_txt = script_dir / "dataset.txt"
    groundtruth_txt = script_dir / "groundtruth.txt"
    
    # Output files
    dataset_json = script_dir / "dataset.json"
    groundtruth_json = script_dir / "groundtruth.json"
    combined_json = script_dir / "test_data.json"
    
    print("Converting text files to JSON...")
    print("-" * 60)
    
    # Parse dataset
    print(f"\n1. Parsing {dataset_txt.name}...")
    questions = parse_dataset(dataset_txt)
    print(f"   ✓ Extracted {len(questions)} questions")
    
    # Parse ground truth
    print(f"\n2. Parsing {groundtruth_txt.name}...")
    ground_truths = parse_groundtruth(groundtruth_txt)
    print(f"   ✓ Extracted {len(ground_truths)} ground truth answers")
    
    # Validate counts match
    if len(questions) != len(ground_truths):
        print(f"\n⚠️  WARNING: Question count ({len(questions)}) != Ground truth count ({len(ground_truths)})")
        print("   Some questions may not have corresponding answers!")
    else:
        print(f"\n✓ Counts match: {len(questions)} questions and answers")
    
    # Save individual JSON files
    print(f"\n3. Saving JSON files...")
    
    # Save questions
    with open(dataset_json, 'w', encoding='utf-8') as f:
        json.dump({"questions": questions}, f, indent=2, ensure_ascii=False)
    print(f"   ✓ Saved {dataset_json.name}")
    
    # Save ground truths
    with open(groundtruth_json, 'w', encoding='utf-8') as f:
        json.dump({"ground_truths": ground_truths}, f, indent=2, ensure_ascii=False)
    print(f"   ✓ Saved {groundtruth_json.name}")
    
    # Save combined file
    combined_data = {
        "metadata": {
            "total_questions": len(questions),
            "description": "Test dataset for RAG system evaluation with RAGAS",
            "format": "Each question is a compound question containing 3 sub-questions"
        },
        "test_cases": [
            {
                "id": i + 1,
                "question": q,
                "ground_truth": gt
            }
            for i, (q, gt) in enumerate(zip(questions, ground_truths))
        ]
    }
    
    with open(combined_json, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False)
    print(f"   ✓ Saved {combined_json.name}")
    
    # Print sample
    print("\n" + "=" * 60)
    print("SAMPLE DATA (First 3 questions)")
    print("=" * 60)
    
    for i in range(min(3, len(questions))):
        print(f"\n[Question {i+1}]")
        print(f"Q: {questions[i][:100]}...")
        print(f"A: {ground_truths[i][:100]}...")
    
    print("\n" + "=" * 60)
    print("✓ Conversion complete!")
    print("=" * 60)
    print(f"\nGenerated files:")
    print(f"  - {dataset_json.name} (questions only)")
    print(f"  - {groundtruth_json.name} (answers only)")
    print(f"  - {combined_json.name} (combined with metadata)")
    print()


if __name__ == "__main__":
    main()
