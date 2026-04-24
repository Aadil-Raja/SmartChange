"""
Parse evaluation log and run RAGAS evaluation

This script parses an existing evaluation_log_*.txt file to extract:
- Questions
- Answers
- Retrieved chunks
- Ground truths

Then runs RAGAS evaluation on the extracted data.

Usage:
    cd Backend/services/chatbot
    python app/testing/parse_log_and_evaluate.py evaluation_log_20260420_003117.txt
"""

import sys
import os
import json
import re
from pathlib import Path
from typing import List, Dict
from datetime import datetime

# Add the chatbot directory to Python path
chatbot_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(chatbot_dir))

# Load environment variables
from dotenv import load_dotenv
env_file = chatbot_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"✓ Loaded environment from: {env_file}")

# RAGAS imports
try:
    from ragas import evaluate
    from ragas.metrics import (
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
        answer_correctness
    )
    from datasets import Dataset
except ImportError:
    print("ERROR: RAGAS not installed. Run: pip install ragas")
    sys.exit(1)


def parse_evaluation_log(log_file_path: Path, limit: int = None) -> Dict:
    """
    Parse evaluation log file to extract questions, answers, chunks, and ground truths.
    
    Args:
        log_file_path: Path to the log file
        limit: Optional limit on number of questions to parse (for testing)
    
    Returns:
        Dict with keys: questions, answers, contexts, ground_truths
    """
    print(f"\n[STEP 1] Parsing log file: {log_file_path.name}")
    if limit:
        print(f"  (Limited to first {limit} questions for testing)")
    
    if not log_file_path.exists():
        print(f"ERROR: Log file not found: {log_file_path}")
        sys.exit(1)
    
    with open(log_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by question separators
    question_blocks = re.split(r'={100}\nQUESTION \d+\n={100}', content)
    
    # Remove header (first block)
    question_blocks = question_blocks[1:]
    
    # Apply limit if specified
    if limit:
        question_blocks = question_blocks[:limit]
    
    questions = []
    answers = []
    contexts = []
    ground_truths = []
    
    for block in question_blocks:
        # Extract question
        question_match = re.search(r'QUESTION:\n(.*?)\n\nANSWER:', block, re.DOTALL)
        if question_match:
            question = question_match.group(1).strip()
            questions.append(question)
        else:
            continue
        
        # Extract answer
        answer_match = re.search(r'ANSWER:\n(.*?)\n\nGROUND TRUTH:', block, re.DOTALL)
        if answer_match:
            answer = answer_match.group(1).strip()
            answers.append(answer)
        else:
            answers.append("")
        
        # Extract ground truth
        gt_match = re.search(r'GROUND TRUTH:\n(.*?)\n\nRETRIEVED CHUNKS', block, re.DOTALL)
        if gt_match:
            ground_truth = gt_match.group(1).strip()
            ground_truths.append(ground_truth)
        else:
            ground_truths.append("")
        
        # Extract chunks
        chunks_match = re.search(r'RETRIEVED CHUNKS \((\d+) total\):(.*?)(?:={100}|$)', block, re.DOTALL)
        if chunks_match:
            chunks_text = chunks_match.group(2).strip()
            # Split by [Chunk N] markers
            chunk_list = re.split(r'\[Chunk \d+\]', chunks_text)
            chunk_list = [c.strip() for c in chunk_list if c.strip()]
            contexts.append(chunk_list if chunk_list else ["No context retrieved"])
        else:
            contexts.append(["No context retrieved"])
    
    print(f"✓ Parsed {len(questions)} questions")
    print(f"✓ Parsed {len(answers)} answers")
    print(f"✓ Parsed {len(ground_truths)} ground truths")
    print(f"✓ Parsed {len(contexts)} context lists")
    
    # Verify alignment
    if not (len(questions) == len(answers) == len(ground_truths) == len(contexts)):
        print(f"⚠️  WARNING: Data misalignment!")
        print(f"   Questions: {len(questions)}")
        print(f"   Answers: {len(answers)}")
        print(f"   Ground Truths: {len(ground_truths)}")
        print(f"   Contexts: {len(contexts)}")
    
    return {
        "questions": questions,
        "answers": answers,
        "ground_truths": ground_truths,
        "contexts": contexts
    }


def run_ragas_evaluation(data: Dict) -> Dict:
    """Run RAGAS evaluation on parsed data."""
    print("\n[STEP 2] Running RAGAS evaluation...")
    print("This will take several minutes as RAGAS uses LLMs to evaluate...\n")
    
    # Prepare dataset
    dataset_dict = {
        "question": data["questions"],
        "answer": data["answers"],
        "contexts": data["contexts"],
        "ground_truth": data["ground_truths"]
    }
    
    dataset = Dataset.from_dict(dataset_dict)
    
    # Configure RAGAS to use our LLM settings
    from app.core.config import get_settings
    settings = get_settings()
    
    # Import LangChain models for RAGAS
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    # Set up LLM for RAGAS evaluation
    if settings.llm_provider.lower() == "openai":
        llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0,
            api_key=settings.openai_api_key
        )
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key
        )
    elif settings.llm_provider.lower() == "gemini":
        llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=0,
            google_api_key=settings.google_api_key
        )
        # For Gemini, we need to use OpenAI embeddings as RAGAS doesn't support Gemini embeddings
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
    
    # Run evaluation
    print("Evaluating with metrics:")
    print("  - Faithfulness (no hallucinations)")
    print("  - Answer Relevancy (answers the question)")
    print("  - Context Precision (retrieved chunks are relevant)")
    print("  - Context Recall (retrieved all needed info)")
    print("  - Answer Correctness (factually correct)")
    print()
    
    try:
        results = evaluate(
            dataset,
            metrics=[
                faithfulness,
                answer_relevancy,
                context_precision,
                context_recall,
                answer_correctness
            ],
            llm=llm,
            embeddings=embeddings
        )
        
        return results
    except Exception as e:
        print(f"\n⚠️  RAGAS evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "error": str(e),
            "note": "RAGAS evaluation failed"
        }


def save_results(ragas_scores, data: Dict, log_file_name: str):
    """Save evaluation results to files."""
    print("\n[STEP 3] Saving results...")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    
    # Convert RAGAS result to dict if needed
    if hasattr(ragas_scores, 'to_pandas'):
        # It's a RAGAS EvaluationResult object
        scores_dict = ragas_scores.to_pandas().to_dict()
    elif hasattr(ragas_scores, '__dict__'):
        # Try to convert to dict
        scores_dict = {k: v for k, v in ragas_scores.__dict__.items() if not k.startswith('_')}
    else:
        scores_dict = ragas_scores
    
    # Save aggregate scores
    scores_file = results_dir / f"ragas_scores_{timestamp}.json"
    with open(scores_file, 'w', encoding='utf-8') as f:
        json.dump(scores_dict, f, indent=2, default=str)
    print(f"✓ Saved aggregate scores to: {scores_file}")
    
    # Save detailed results
    detailed_file = results_dir / f"detailed_results_{timestamp}.json"
    detailed_data = {
        "metadata": {
            "timestamp": timestamp,
            "source_log": log_file_name,
            "total_questions": len(data["questions"])
        },
        "ragas_scores": scores_dict,
        "questions_and_answers": [
            {
                "question": q,
                "answer": a,
                "ground_truth": gt,
                "contexts": c
            }
            for q, a, gt, c in zip(
                data["questions"],
                data["answers"],
                data["ground_truths"],
                data["contexts"]
            )
        ]
    }
    
    with open(detailed_file, 'w', encoding='utf-8') as f:
        json.dump(detailed_data, f, indent=2, default=str)
    print(f"✓ Saved detailed results to: {detailed_file}")
    
    # Save CSV for easy analysis
    csv_file = results_dir / f"results_{timestamp}.csv"
    with open(csv_file, 'w', encoding='utf-8') as f:
        f.write("Question,Answer,Ground Truth,Context Count\n")
        for q, a, gt, c in zip(
            data["questions"],
            data["answers"],
            data["ground_truths"],
            data["contexts"]
        ):
            # Escape commas and quotes
            q_clean = q.replace('"', '""')
            a_clean = a.replace('"', '""')
            gt_clean = gt.replace('"', '""')
            f.write(f'"{q_clean}","{a_clean}","{gt_clean}",{len(c)}\n')
    print(f"✓ Saved CSV to: {csv_file}")


def print_summary(ragas_scores, data: Dict):
    """Print evaluation summary."""
    print("\n" + "="*80)
    print("RAGAS EVALUATION RESULTS")
    print("="*80)
    print(f"\nTotal Questions Evaluated: {len(data['questions'])}")
    print("\n" + "-"*80)
    print("AGGREGATE SCORES (0.0 - 1.0, higher is better)")
    print("-"*80)
    
    # Convert RAGAS result to dict if needed
    if hasattr(ragas_scores, 'to_pandas'):
        # Get mean scores from pandas DataFrame
        df = ragas_scores.to_pandas()
        # Only calculate mean for numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns
        scores_dict = df[numeric_cols].mean().to_dict()
    elif hasattr(ragas_scores, '__dict__'):
        scores_dict = {k: v for k, v in ragas_scores.__dict__.items() if not k.startswith('_')}
    else:
        scores_dict = ragas_scores
    
    for metric, score in scores_dict.items():
        if isinstance(score, (int, float)):
            percentage = score * 100
            bar_length = int(score * 50) if score <= 1.0 else 50
            bar = "█" * bar_length + "░" * (50 - bar_length)
            print(f"{metric:25s}: {score:.4f} ({percentage:5.1f}%) {bar}")
    
    print("="*80 + "\n")


def main():
    """Main execution function."""
    try:
        print("\n" + "="*80)
        print("RAGAS EVALUATION FROM LOG FILE")
        print("="*80)
        
        # Check for --limit argument
        limit = None
        log_file_name = None
        
        for i, arg in enumerate(sys.argv[1:]):
            if arg == "--limit" and i + 1 < len(sys.argv) - 1:
                limit = int(sys.argv[i + 2])
            elif not arg.startswith("--") and arg.isdigit() == False:
                log_file_name = arg
        
        # Get log file path from command line or use default
        if not log_file_name:
            # Find the most recent evaluation log
            testing_dir = Path(__file__).parent
            log_files = list(testing_dir.glob("evaluation_log_*.txt"))
            if not log_files:
                print("ERROR: No evaluation log files found!")
                print("Usage: python parse_log_and_evaluate.py [log_file_name] [--limit N]")
                print("Example: python parse_log_and_evaluate.py --limit 2")
                sys.exit(1)
            log_file_name = max(log_files, key=lambda p: p.stat().st_mtime).name
            print(f"Using most recent log file: {log_file_name}")
        
        log_file_path = Path(__file__).parent / log_file_name
        
        # Parse log file with optional limit
        data = parse_evaluation_log(log_file_path, limit=limit)
        
        # Run RAGAS evaluation
        ragas_scores = run_ragas_evaluation(data)
        
        # Save results
        save_results(ragas_scores, data, log_file_name)
        
        # Print summary
        print_summary(ragas_scores, data)
        
        print("✓ Evaluation complete!")
        
    except KeyboardInterrupt:
        print("\n\n✗ Evaluation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
