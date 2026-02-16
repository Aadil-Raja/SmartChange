"""
Base abstract class for LLM providers.
All providers must implement this interface.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    def __init__(self, api_key: str, model: str, **kwargs):
        """
        Initialize the LLM provider.
        
        Args:
            api_key: API key for the provider
            model: Model name/identifier
            **kwargs: Additional provider-specific configuration
        """
        self.api_key = api_key
        self.model = model
        self.config = kwargs
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate text from a prompt.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters (temperature, max_tokens, etc.)
            
        Returns:
            Generated text as string
            
        Raises:
            Exception: If generation fails
        """
        pass
    
    @abstractmethod
    def generate_json(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        Generate JSON output from a prompt.
        Automatically handles JSON parsing and cleanup.
        
        Args:
            prompt: The input prompt (should request JSON output)
            **kwargs: Additional generation parameters
            
        Returns:
            Parsed JSON as dictionary
            
        Raises:
            Exception: If generation or JSON parsing fails
        """
        pass
    
    def _clean_json_response(self, text: str) -> str:
        """
        Clean up JSON response by removing markdown code blocks.
        
        Args:
            text: Raw response text
            
        Returns:
            Cleaned text ready for JSON parsing
        """
        text = text.strip()
        
        # Remove markdown code blocks
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        
        if text.endswith("```"):
            text = text[:-3]
        
        return text.strip()
