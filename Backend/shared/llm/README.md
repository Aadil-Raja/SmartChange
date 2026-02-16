# Shared LLM Provider Abstraction

A unified interface for switching between different LLM providers (Gemini, OpenAI, etc.) without changing application code.

## Architecture

```
Backend/shared/llm/
├── __init__.py           # Public exports
├── base.py              # Abstract base class
├── gemini_provider.py   # Google Gemini implementation
├── openai_provider.py   # OpenAI implementation
├── factory.py           # Provider factory function
└── README.md           # This file
```

## Usage

### Basic Example

```python
from shared.llm import get_llm_provider

# Create provider (Gemini)
llm = get_llm_provider(
    provider="gemini",
    api_key="your-google-api-key",
    model="gemini-2.5-flash"
)

# Generate text
response = llm.generate("What is artificial intelligence?")
print(response)

# Generate JSON
json_response = llm.generate_json(
    "Generate a JSON object with keys: name, age, city"
)
print(json_response)  # {'name': '...', 'age': ..., 'city': '...'}
```

### Switching Providers

```python
# Use OpenAI instead
llm = get_llm_provider(
    provider="openai",
    api_key="your-openai-api-key",
    model="gpt-4o-mini"
)

# Same interface works!
response = llm.generate("What is artificial intelligence?")
```

### Integration with Service Config

```python
from app.core.config import get_settings
from shared.llm import get_llm_provider, get_api_key_for_provider

settings = get_settings()

# Get the right API key based on provider
api_key = get_api_key_for_provider(
    provider=settings.llm_provider,
    google_api_key=settings.google_api_key,
    openai_api_key=settings.openai_api_key
)

# Create provider
llm = get_llm_provider(
    provider=settings.llm_provider,
    api_key=api_key,
    model=settings.llm_model
)

# Use it
response = llm.generate(prompt)
```

## Supported Providers

### Gemini (Google)
- **Provider name:** `"gemini"`
- **Models:** `gemini-2.5-flash`, `gemini-2.0-flash-exp`, etc.
- **API Key:** Google API key
- **Dependencies:** `google-generativeai`

### OpenAI
- **Provider name:** `"openai"`
- **Models:** `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`, etc.
- **API Key:** OpenAI API key
- **Dependencies:** `openai` (install with `pip install openai`)

## Configuration

### Environment Variables

Each service should define these in their `.env` file:

```bash
# LLM Provider Configuration
LLM_PROVIDER=gemini          # or "openai"
LLM_MODEL=gemini-2.5-flash   # or "gpt-4o-mini"

# API Keys
GOOGLE_API_KEY=your-google-key
OPENAI_API_KEY=your-openai-key  # Optional, only if using OpenAI
```

### Service Config

Update your service's `config.py`:

```python
class Settings(BaseSettings):
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    google_api_key: str | None = None
    openai_api_key: str | None = None
```

## API Reference

### `get_llm_provider(provider, api_key, model, **kwargs)`

Factory function to create an LLM provider.

**Parameters:**
- `provider` (str): Provider name ('gemini' or 'openai')
- `api_key` (str): API key for the provider
- `model` (str): Model name/identifier
- `**kwargs`: Additional provider-specific configuration

**Returns:** `BaseLLMProvider` instance

**Raises:** `ValueError` if provider is unknown or configuration is invalid

### `BaseLLMProvider.generate(prompt, **kwargs)`

Generate text from a prompt.

**Parameters:**
- `prompt` (str): Input prompt
- `**kwargs`: Additional parameters (temperature, max_tokens, etc.)

**Returns:** Generated text as string

### `BaseLLMProvider.generate_json(prompt, **kwargs)`

Generate JSON output from a prompt.

**Parameters:**
- `prompt` (str): Input prompt (should request JSON output)
- `**kwargs`: Additional parameters

**Returns:** Parsed JSON as dictionary

## Error Handling

```python
try:
    llm = get_llm_provider(
        provider="gemini",
        api_key="invalid-key",
        model="gemini-2.5-flash"
    )
    response = llm.generate("Hello")
except ValueError as e:
    print(f"Configuration error: {e}")
except Exception as e:
    print(f"Generation error: {e}")
```

## Adding New Providers

To add a new provider (e.g., Anthropic Claude):

1. Create `Backend/shared/llm/anthropic_provider.py`
2. Implement `BaseLLMProvider` interface
3. Add to factory in `factory.py`:
   ```python
   elif provider == "anthropic":
       return AnthropicProvider(api_key=api_key, model=model, **kwargs)
   ```

## Migration Guide

See the main project documentation for step-by-step migration guide from direct provider usage to this wrapper.

## Testing

```python
# Test Gemini
llm = get_llm_provider("gemini", "your-key", "gemini-2.5-flash")
assert llm.generate("Say hello") is not None

# Test OpenAI
llm = get_llm_provider("openai", "your-key", "gpt-4o-mini")
assert llm.generate("Say hello") is not None
```

## Notes

- The wrapper is stateless - create a new instance for each request or reuse as needed
- JSON parsing automatically handles markdown code blocks (```json)
- All providers use the same interface for consistency
- Provider-specific features can be passed via `**kwargs`
