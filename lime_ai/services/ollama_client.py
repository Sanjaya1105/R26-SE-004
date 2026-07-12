from typing import Any

import httpx

from config.settings import settings


class OllamaServiceError(RuntimeError):
    """Raised when Ollama cannot produce a usable response."""


def generate_ollama_text(system_prompt: str, user_prompt: str) -> str:
    base_url = settings.OLLAMA_BASE_URL.strip().rstrip("/")
    model = settings.OLLAMA_MODEL.strip()
    if not base_url or not model:
        raise OllamaServiceError("Ollama base URL and model must be configured.")

    url = f"{base_url}/api/chat"
    payload: dict[str, Any] = {
        "model": model,
        "stream": False,
        "options": {"temperature": 0.2, "num_predict": 180},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS)) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise OllamaServiceError(f"Ollama request timed out for {url}.") from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip()
        raise OllamaServiceError(
            f"Ollama returned HTTP {exc.response.status_code}: {detail}"
        ) from exc
    except httpx.RequestError as exc:
        raise OllamaServiceError(f"Could not connect to Ollama at {url}.") from exc

    try:
        response_json = response.json()
    except ValueError as exc:
        raise OllamaServiceError("Ollama response was not valid JSON.") from exc

    message = response_json.get("message") if isinstance(response_json, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise OllamaServiceError("Ollama returned an empty response.")

    return content.strip()
