# app/services/tools/token_tracker.py
"""
Simple thread-safe global token tracker.
Bypasses LangChain's intermediate_steps serialization issue.
"""
import threading
from typing import Dict

# Global storage: {request_id: {'input': int, 'output': int}}
_request_tokens: Dict[str, Dict[str, int]] = {}
_lock = threading.Lock()


def add_tokens(request_id: str, input_tokens: int, output_tokens: int):
    """
    Add tokens to a request (thread-safe for parallel calls).
    
    Args:
        request_id: Unique identifier for the request
        input_tokens: Input tokens to add
        output_tokens: Output tokens to add
    """
    with _lock:
        if request_id not in _request_tokens:
            _request_tokens[request_id] = {'input': 0, 'output': 0}
        _request_tokens[request_id]['input'] += input_tokens
        _request_tokens[request_id]['output'] += output_tokens


def get_tokens(request_id: str) -> Dict[str, int]:
    """
    Get total tokens for a request.
    
    Args:
        request_id: Unique identifier for the request
        
    Returns:
        Dict with 'input' and 'output' token counts
    """
    with _lock:
        return _request_tokens.get(request_id, {'input': 0, 'output': 0}).copy()


def cleanup(request_id: str):
    """
    Clean up tokens for a completed request.
    
    Args:
        request_id: Unique identifier for the request
    """
    with _lock:
        _request_tokens.pop(request_id, None)


def reset_all():
    """Reset all tracked tokens (for testing/debugging)"""
    with _lock:
        _request_tokens.clear()
