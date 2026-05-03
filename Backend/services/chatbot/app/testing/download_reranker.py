"""
Download the reranker model separately to avoid slow first-time loading.

Usage:
    cd Backend/services/chatbot
    python app/testing/download_reranker.py
"""
import os
from sentence_transformers import CrossEncoder

print("\n" + "="*80)
print("DOWNLOADING RERANKER MODEL")
print("="*80)
print("\nModel: cross-encoder/ms-marco-MiniLM-L-6-v2")
print("Size: ~91 MB")
print("This is a one-time download. Future runs will use the cached model.\n")

try:
    print("Downloading...")
    model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    
    print("\n✓ Model downloaded successfully!")
    print(f"✓ Cached at: C:\\Users\\{os.environ.get('USERNAME', 'user')}\\.cache\\huggingface\\hub\\")
    print("\nYou can now run hybrid retrieval tests without waiting for downloads.")
    print("="*80 + "\n")
    
except Exception as e:
    print(f"\n✗ Error downloading model: {e}")
    print("Please check your internet connection and try again.")
