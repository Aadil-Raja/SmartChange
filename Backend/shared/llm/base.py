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
    
    @abstractmethod
    def get_langchain_model(self):
        """
        Return the underlying LangChain chat model for advanced features.
        
        This method exposes the native LangChain chat model (ChatOpenAI or
        ChatGoogleGenerativeAI) to enable advanced features like structured
        output via with_structured_output().
        
        Returns:
            The underlying LangChain chat model instance
            
        Example:
            >>> llm = create_llm_provider("openai", "gpt-4", ...)
            >>> langchain_model = llm.get_langchain_model()
            >>> structured_llm = langchain_model.with_structured_output(MySchema)
            >>> result = structured_llm.invoke("prompt")
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
