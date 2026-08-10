from typing import Any

import httpx

from config.settings import settings


class OllamaServiceError(RuntimeError):
    pass


def generate_ollama_text(system_prompt: str, user_prompt: str) -> tuple[str, str]:
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    candidates = [settings.OLLAMA_MODEL]
    candidates.extend(model.strip() for model in settings.OLLAMA_MODEL_FALLBACKS.split(",") if model.strip())
    candidates = list(dict.fromkeys(candidates))
    failures = []

    for model in candidates:
        payload: dict[str, Any] = {
            "model": model,
            "stream": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
            "options": {
                "temperature": settings.OLLAMA_TEMPERATURE,
                "num_predict": settings.OLLAMA_NUM_PREDICT,
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        try:
            response = httpx.post(url, json=payload, timeout=settings.OLLAMA_TIMEOUT_SECONDS)
            response.raise_for_status()
            content = response.json().get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                raise OllamaServiceError("Ollama returned an empty explanation.")
            return content.strip(), model
        except (httpx.HTTPError, ValueError, OllamaServiceError) as exc:
            failures.append(f"{model}: {exc}")

    raise OllamaServiceError("All configured Ollama models failed. " + " | ".join(failures))
