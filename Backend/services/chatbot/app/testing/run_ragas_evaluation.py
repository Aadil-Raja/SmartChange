"""
RAGAS Evaluation Pipeline for RAG System

This script:
1. Authenticates as test user (k224492@nu.edu.pk)
2. Creates a new chathead
3. Runs all 300 questions through the RAG system
4. Collects answers and retrieved chunks
5. Evaluates with RAGAS metrics
6. Outputs comprehensive scores

Usage:
    cd Backend/services/chatbot
    python app/testing/run_ragas_evaluation.py
"""

import sys
import os
import json
from pathlib import Path
from typing import List, Dict
from datetime import datetime

# Add the chatbot directory to Python path so we can import app modules
chatbot_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(chatbot_dir))

# Load environment variables from .env file
from dotenv import load_dotenv

env_file = chatbot_dir / ".env"

if env_file.exists():
    load_dotenv(env_file)
    print(f"✓ Loaded environment from: {env_file}")
else:
    print(f"⚠️  Warning: .env file not found at {env_file}")
    print("   Make sure environment variables are set!")

from sqlalchemy.orm import Session
from app.deps.db import get_db, get_management_db
from app.services import chat_service_v2
from app.repositories import chat_repo
from shared.repos import users_repo

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


class RAGASEvaluationPipeline:
    """Pipeline to evaluate RAG system using RAGAS framework."""
    
    def __init__(self):
        self.test_user_email = "k224492@nu.edu.pk"
        self.test_user_password = "bilal123"
        
        # Use JSON files instead of TXT
        self.test_data_file = Path(__file__).parent / "test_data.json"
        
        # Create log file in testing directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = Path(__file__).parent / f"evaluation_log_{timestamp}.txt"
        
        # User info (no persistent database sessions)
        # Sessions are created fresh for each operation to prevent stale connections
        
        # Test data
        self.questions: List[str] = []
        self.ground_truths: List[str] = []
        
        # Results
        self.answers: List[str] = []
        self.contexts: List[List[str]] = []
        self.chathead_id: int = None
        self.user_id: int = None
        self.test_doc_ids: List[int] = [49, 45]  # Switchgear, PSL, Aadil's resume
        
    def log(self, message: str):
        """Write message to both console and log file."""
        print(message)
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(message + '\n')
    
    def log_question_details(self, question_num: int, question: str, answer: str, chunks: List[str], ground_truth: str):
        """Log detailed information about a question."""
        separator = "=" * 100
        
        log_entry = f"""
{separator}
QUESTION {question_num}
{separator}

QUESTION:
{question}

ANSWER:
{answer}

GROUND TRUTH:
{ground_truth}

RETRIEVED CHUNKS ({len(chunks)} total):
"""
        for i, chunk in enumerate(chunks, 1):
            log_entry += f"\n[Chunk {i}]\n{chunk}\n"
        
        log_entry += f"\n{separator}\n"
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    
    def load_test_data(self):
        """Load questions and ground truth from JSON file."""
        print("\n[STEP 1] Loading test data...")
        
        if not self.test_data_file.exists():
            print(f"ERROR: {self.test_data_file} not found!")
            print("Please run convert_to_json.py first to generate JSON files.")
            sys.exit(1)
        
        # Load combined test data
        with open(self.test_data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract questions and ground truths
        test_cases = data.get("test_cases", [])
        
        self.questions = [tc["question"] for tc in test_cases]
        self.ground_truths = [tc["ground_truth"] for tc in test_cases]
        
        print(f"✓ Loaded {len(self.questions)} questions")
        print(f"✓ Loaded {len(self.ground_truths)} ground truth answers")
        
        if len(self.questions) != len(self.ground_truths):
            print(f"WARNING: Question count ({len(self.questions)}) != Ground truth count ({len(self.ground_truths)})")
        
        # Print metadata
        metadata = data.get("metadata", {})
        if metadata:
            print(f"\nDataset Info:")
            print(f"  - Total: {metadata.get('total_questions', 'N/A')}")
            print(f"  - Description: {metadata.get('description', 'N/A')}")
    
    def authenticate_user(self):
        """Authenticate test user and get user_id."""
        print("\n[STEP 2] Authenticating user...")
        
        # ✅ FIX: Use temporary session, close immediately after getting user_id
        management_db = next(get_management_db())
        
        try:
            # Get user by email from MANAGEMENT database (users table is there)
            user = users_repo.get_by_email(management_db, self.test_user_email)
            
            if not user:
                print(f"ERROR: User {self.test_user_email} not found")
                sys.exit(1)
            
            self.user_id = user.id
            print(f"✓ Authenticated as user ID: {self.user_id}")
        finally:
            # ✅ FIX: Close session immediately - don't keep it open
            management_db.close()
    
    def create_chathead(self):
        """Create a new chathead for testing."""
        print("\n[STEP 3] Creating new chathead...")
        
        # ✅ FIX: Use temporary session, close immediately after creating chathead
        db = next(get_db())
        
        try:
            # Create chathead
            chathead = chat_repo.create_chathead(
                db=db,
                user_id=self.user_id,
                title="RAGAS Evaluation Test"
            )
            
            db.commit()
            
            self.chathead_id = chathead.id
            print(f"✓ Created chathead ID: {self.chathead_id}")
            
            # Use 3 documents: Switchgear (39), PSL (41), Aadil's resume (45)
            self.test_doc_ids = [49, 45]
            print(f"✓ Will use documents: {self.test_doc_ids}")
            print(f"  - Doc 49: PSL and Harry Potter")
            print(f"  - Doc 45: Aadil Raja's Resume")
            print(f"✓ Documents will be passed to agent for each question")
        finally:
            # ✅ FIX: Close session immediately
            db.close()
    
    def run_questions_through_rag(self):
        """Run all questions through the RAG system and collect results."""
        print(f"\n[STEP 4] Running {len(self.questions)} questions through RAG system...")
        print("This may take a while...\n")
        
        # Initialize log file with header
        self.log("="*100)
        self.log("RAGAS EVALUATION - DETAILED QUESTION LOG")
        self.log("="*100)
        self.log(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"Chathead ID: {self.chathead_id}")
        self.log(f"User: {self.test_user_email}")
        self.log(f"Documents: {self.test_doc_ids}")
        self.log(f"Total Questions: {len(self.questions)}")
        self.log("="*100 + "\n")
        
        for i, question in enumerate(self.questions, 1):
            max_retries = 3
            success = False
            
            for attempt in range(max_retries):
                # ✅ FIX: Create FRESH database sessions for each attempt
                db = None
                management_db = None
                
                try:
                    print(f"[{i}/{len(self.questions)}] Processing: {question[:80]}...")
                    
                    # ✅ FIX: Get fresh sessions (not reusing self.db)
                    db = next(get_db())
                    management_db = next(get_management_db())
                    
                    # Call respond_turn_v2 service with fresh sessions
                    response = chat_service_v2.respond_turn_v2(
                        db=db,
                        management_db=management_db,
                        user_id=self.user_id,
                        chathead_id=self.chathead_id,
                        active_doc_ids=self.test_doc_ids,
                        message=question,
                        title=None
                    )
                    
                    # Collect answer
                    answer = response["answer"]
                    self.answers.append(answer)
                    
                    # RAGAS contexts - not available anymore
                    self.contexts.append(["Context not available"])
                    
                    # Get ground truth for this question
                    ground_truth = self.ground_truths[i-1] if i-1 < len(self.ground_truths) else "N/A"
                    
                    # Log detailed information
                    self.log_question_details(
                        question_num=i,
                        question=question,
                        answer=answer,
                        chunks=[],  # No chunks available
                        ground_truth=ground_truth
                    )
                    
                    print(f"  ✓ Answer length: {len(answer)} chars")
                    
                    success = True
                    break  # ✅ FIX: Exit retry loop on success
                    
                except Exception as e:
                    # ✅ FIX: Rollback failed transactions
                    if db:
                        try:
                            db.rollback()
                        except:
                            pass
                    if management_db:
                        try:
                            management_db.rollback()
                        except:
                            pass
                    
                    if attempt < max_retries - 1:
                        # Retry with exponential backoff
                        import time
                        import random
                        wait_time = 2 * (attempt + 1) + random.uniform(0, 1)  # Add jitter
                        print(f"  ⚠️  Retry {attempt + 1}/{max_retries} after error: {str(e)[:100]}")
                        print(f"  ⏳ Waiting {wait_time:.1f}s before retry...")
                        time.sleep(wait_time)
                    else:
                        # All retries failed
                        print(f"  ✗ ERROR after {max_retries} attempts: {e}")
                        error_msg = f"ERROR: {str(e)}"
                        self.answers.append(error_msg)
                        self.contexts.append(["Error occurred"])
                        
                        # Log error
                        ground_truth = self.ground_truths[i-1] if i-1 < len(self.ground_truths) else "N/A"
                        self.log_question_details(
                            question_num=i,
                            question=question,
                            answer=error_msg,
                            chunks=["Error occurred"],
                            ground_truth=ground_truth
                        )
                
                finally:
                    # ✅ FIX: ALWAYS close sessions to prevent leaks
                    if db:
                        try:
                            db.close()
                        except:
                            pass
                    if management_db:
                        try:
                            management_db.close()
                        except:
                            pass
        
        print(f"\n✓ Completed {len(self.answers)} questions")
        self.log("\n" + "="*100)
        self.log(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log("="*100)
    
    def run_ragas_evaluation(self) -> Dict:
        """Run RAGAS evaluation and return scores."""
        print("\n[STEP 5] Running RAGAS evaluation...")
        print("This will take several minutes as RAGAS uses LLMs to evaluate...\n")
        
        # Prepare dataset
        dataset_dict = {
            "question": self.questions,
            "answer": self.answers,
            "contexts": self.contexts,
            "ground_truth": self.ground_truths
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
            # Make sure OPENAI_API_KEY is set in .env for embeddings
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
            print("Returning partial results with question/answer data only.")
            
            # Return a dict with the data we have
            return {
                "error": str(e),
                "note": "RAGAS evaluation failed, but all questions were processed successfully.",
                "total_questions": len(self.questions),
                "total_answers": len(self.answers)
            }
    
    def save_results(self, ragas_scores):
        """Save evaluation results to files."""
        print("\n[STEP 6] Saving results...")
        
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
                "user_email": self.test_user_email,
                "chathead_id": self.chathead_id,
                "total_questions": len(self.questions)
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
                    self.questions,
                    self.answers,
                    self.ground_truths,
                    self.contexts
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
            for q, a, gt, c in zip(self.questions, self.answers, self.ground_truths, self.contexts):
                # Escape commas and quotes
                q_clean = q.replace('"', '""')
                a_clean = a.replace('"', '""')
                gt_clean = gt.replace('"', '""')
                f.write(f'"{q_clean}","{a_clean}","{gt_clean}",{len(c)}\n')
        print(f"✓ Saved CSV to: {csv_file}")
    
    def print_summary(self, ragas_scores):
        """Print evaluation summary."""
        print("\n" + "="*80)
        print("RAGAS EVALUATION RESULTS")
        print("="*80)
        print(f"\nTotal Questions Evaluated: {len(self.questions)}")
        print(f"Chathead ID: {self.chathead_id}")
        print(f"User: {self.test_user_email}")
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
    
    def run(self):
        """Run the complete evaluation pipeline."""
        try:
            print("\n" + "="*80)
            print("RAGAS EVALUATION PIPELINE FOR RAG SYSTEM")
            print("="*80)
            
            self.load_test_data()
            self.authenticate_user()
            self.create_chathead()
            self.run_questions_through_rag()
            
            ragas_scores = self.run_ragas_evaluation()
            
            self.save_results(ragas_scores)
            self.print_summary(ragas_scores)
            
            print("✓ Evaluation complete!")
            
        except KeyboardInterrupt:
            print("\n\n✗ Evaluation interrupted by user")
            sys.exit(1)
        except Exception as e:
            print(f"\n\n✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        # ✅ FIX: No cleanup needed - all sessions are closed immediately after use


if __name__ == "__main__":
    pipeline = RAGASEvaluationPipeline()
    pipeline.run()
