"""
OpenAI LLM Provider Implementation
"""

import json
import logging
from typing import Dict, Any, Optional

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI
    LANGCHAIN_OPENAI_AVAILABLE = True
except ImportError:
    LANGCHAIN_OPENAI_AVAILABLE = False

from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider implementation."""
    
    def __init__(self, api_key: str, model: str, **kwargs):
        """
        Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key
            model: OpenAI model name (e.g., 'gpt-4o-mini', 'gpt-4o')
            **kwargs: Additional configuration (temperature, max_tokens, etc.)
        """
        if not OPENAI_AVAILABLE:
            raise ImportError(
                "OpenAI package not installed. "
                "Install it with: pip install openai"
            )
        
        super().__init__(api_key, model, **kwargs)
        
        # Create OpenAI client for generate() and generate_json()
        self.client = OpenAI(api_key=self.api_key)
        
        # Create LangChain chat model for advanced features (structured output)
        if LANGCHAIN_OPENAI_AVAILABLE:
            self.chat_model = ChatOpenAI(
                model=self.model,
                api_key=self.api_key,
                temperature=kwargs.get('temperature', 0)
            )
        else:
            self.chat_model = None
            logger.warning("langchain-openai not installed. Structured output features unavailable.")
        
        logger.info(f"Initialized OpenAI provider with model: {self.model}")
    
    def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate text using OpenAI.
        
        Args:
            prompt: Input prompt
            **kwargs: Additional parameters (temperature, max_tokens, etc.)
            
        Returns:
            Generated text
        """
        try:
            params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                **self.config,
                **kwargs
            }
            response = self.client.chat.completions.create(**params)
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise

    def generate_with_usage(self, prompt: str, **kwargs) -> tuple[str, dict]:
        """
        Generate text and return (content, usage_dict).
        usage_dict keys: prompt_tokens, completion_tokens, total_tokens
        """
        try:
            params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                **self.config,
                **kwargs
            }
            response = self.client.chat.completions.create(**params)
            content = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }
            return content, usage
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    def generate_json(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        Generate JSON output using OpenAI.
        Uses response_format for structured output when available.
        
        Args:
            prompt: Input prompt (should request JSON output)
            **kwargs: Additional parameters
            
        Returns:
            Parsed JSON dictionary
        """
        try:
            # Use JSON mode if supported by model
            if "gpt-4" in self.model or "gpt-3.5" in self.model:
                kwargs["response_format"] = {"type": "json_object"}
            
            # Generate text
            response_text = self.generate(prompt, **kwargs)
            
            # Clean and parse JSON
            cleaned_text = self._clean_json_response(response_text)
            parsed_json = json.loads(cleaned_text)
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI JSON response: {e}")
            logger.error(f"Raw response: {response_text[:500]}...")
            raise ValueError(f"Invalid JSON response from OpenAI: {e}")
        except Exception as e:
            logger.error(f"OpenAI JSON generation failed: {e}")
            raise
    
    def get_langchain_model(self) -> ChatOpenAI:
        """
        Return the underlying LangChain ChatOpenAI model.
        
        This enables advanced LangChain features like structured output
        via with_structured_output().
        
        Returns:
            ChatOpenAI instance
            
        Raises:
            RuntimeError: If langchain-openai is not installed
            
        Example:
            >>> llm = OpenAIProvider(api_key="...", model="gpt-4")
            >>> langchain_model = llm.get_langchain_model()
            >>> structured_llm = langchain_model.with_structured_output(MySchema)
            >>> result = structured_llm.invoke("prompt")
        """
        if self.chat_model is None:
            raise RuntimeError(
                "LangChain OpenAI model not available. "
                "Install langchain-openai: pip install langchain-openai"
            )
        return self.chat_model
