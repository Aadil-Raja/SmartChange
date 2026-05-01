"""
Google Gemini LLM Provider Implementation
"""

import json
import logging
from typing import Dict, Any, Optional
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI

from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    """Google Gemini LLM provider implementation."""
    
    def __init__(self, api_key: str, model: str, **kwargs):
        """
        Initialize Gemini provider.
        
        Args:
            api_key: Google API key
            model: Gemini model name (e.g., 'gemini-2.5-flash')
            **kwargs: Additional configuration (temperature, etc.)
        """
        super().__init__(api_key, model, **kwargs)
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        
        # Create model instance for generate() and generate_json()
        self.client = genai.GenerativeModel(self.model)
        
        # Create LangChain chat model for advanced features (structured output)
        self.chat_model = ChatGoogleGenerativeAI(
            model=self.model,
            google_api_key=self.api_key,
            temperature=kwargs.get('temperature', 0)
        )
        
        logger.info(f"Initialized Gemini provider with model: {self.model}")
    
    def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate text using Gemini.
        
        Args:
            prompt: Input prompt
            **kwargs: Additional parameters (temperature, max_output_tokens, etc.)
            
        Returns:
            Generated text
        """
        try:
            # Merge default config with kwargs
            generation_config = {**self.config, **kwargs}
            
            # Generate content
            response = self.client.generate_content(
                prompt,
                generation_config=generation_config if generation_config else None
            )
            
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise
    
    def generate_json(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        Generate JSON output using Gemini.
        
        Args:
            prompt: Input prompt (should request JSON output)
            **kwargs: Additional parameters
            
        Returns:
            Parsed JSON dictionary
        """
        try:
            # Generate text
            response_text = self.generate(prompt, **kwargs)
            
            # Clean and parse JSON
            cleaned_text = self._clean_json_response(response_text)
            parsed_json = json.loads(cleaned_text)
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            logger.error(f"Raw response: {response_text[:500]}...")
            raise ValueError(f"Invalid JSON response from Gemini: {e}")
        except Exception as e:
            logger.error(f"Gemini JSON generation failed: {e}")
            raise
    
    def get_langchain_model(self) -> ChatGoogleGenerativeAI:
        """
        Return the underlying LangChain ChatGoogleGenerativeAI model.
        
        This enables advanced LangChain features like structured output
        via with_structured_output().
        
        Returns:
            ChatGoogleGenerativeAI instance
            
        Example:
            >>> llm = GeminiProvider(api_key="...", model="gemini-1.5-pro")
            >>> langchain_model = llm.get_langchain_model()
            >>> structured_llm = langchain_model.with_structured_output(MySchema)
            >>> result = structured_llm.invoke("prompt")
        """
        return self.chat_model
