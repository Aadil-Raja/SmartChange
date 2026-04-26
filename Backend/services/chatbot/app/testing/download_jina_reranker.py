"""
Download the Jina reranker v3 model separately to avoid slow first-time loading.

Usage:
    cd Backend/services/chatbot
    python app/testing/download_jina_reranker.py
"""
import os
from transformers import AutoModel

print("\n" + "="*80)
print("DOWNLOADING JINA RERANKER V3 MODEL")
print("="*80)
print("\nModel: jinaai/jina-reranker-v3")
print("Size: ~1.19 GB")
print("This is a one-time download. Future runs will use the cached model.\n")

try:
    print("Downloading model (this may take several minutes)...")
    model = AutoModel.from_pretrained(
        'jinaai/jina-reranker-v3',
        torch_dtype="auto",
        trust_remote_code=True  # Required for Jina's custom architecture
    )
    model.eval()
    
    print("\n✓ Model downloaded successfully!")
    print(f"✓ Cached at: C:\\Users\\{os.environ.get('USERNAME', 'user')}\\.cache\\huggingface\\hub\\")
    print("\nYou can now use the deep reranker without waiting for downloads.")
    print("\nNote: trust_remote_code=True loads Jina's custom JinaForRanking class.")
    print("This eliminates the 'UNEXPECTED' and 'MISSING' warnings you saw before.")
    print("="*80 + "\n")
    
except Exception as e:
    print(f"\n✗ Error downloading model: {e}")
    print("Please check your internet connection and try again.")
    print("\nIf you get trust_remote_code errors, the model requires custom code.")
    print("This is normal for Jina models - they use custom architectures.")
