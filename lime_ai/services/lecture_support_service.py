import re
from typing import Any

from services.ollama_client import OllamaServiceError, generate_ollama_text


SYSTEM_PROMPT = (
    "You are a supportive learning advisor speaking directly to the student. Give kind, practical "
    "actions the student can follow during the current or next lesson. Always use 'you' and 'your'. "
    "Never refer to the learner as 'the student', 'they', or 'them'."
)
USER_PROMPT_TEMPLATE = (
    "Student ID: {student_id}\n"
    "Lesson ID: {lesson_id}\n"
    "Predicted cognitive load: {predicted_label}\n"
    "Behavioral signals:\n{signals_text}\n\n"
    "Write exactly four short recommendations directly to the student. Tailor every recommendation "
    "to the observed behaviors and cognitive-load level. Each item must begin with a direct action "
    "verb and explain briefly how it helps. Do not explain model results or mention LIME, SHAP, "
    "features, drivers, signals, pressure, or relief. Use encouraging, simple language and return "
    "only a numbered list with no heading or introduction. Keep each item to one sentence and the "
    "complete response under 120 words."
)


def generate_lecture_support(
    *, student_id: str, lesson_id: str, predicted_label: str, signals: list[str]
) -> dict[str, Any]:
    prompt = USER_PROMPT_TEMPLATE.format(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        signals_text="\n".join(f"- {signal}" for signal in signals) or "- none detected",
    )
    response = generate_ollama_text(SYSTEM_PROMPT, prompt)

    strategies: list[str] = []
    pattern = re.compile(r"^\s*\d+\s*[).:-]\s*(.+)$")
    for line in response.splitlines():
        match = pattern.match(line)
        if match and len(match.group(1).strip()) >= 8:
            strategies.append(match.group(1).strip())

    # TinyLlama may ignore numbering. Preserve its generated advice and normalize the format.
    if not strategies:
        for line in response.splitlines():
            candidate = re.sub(r"^\s*[-*]\s*", "", line).strip()
            if len(candidate) >= 8 and not candidate.endswith(":"):
                strategies.append(candidate)

    if not strategies:
        strategies = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", response.strip())
            if len(sentence.strip()) >= 8
        ]

    if not strategies:
        raise OllamaServiceError("Ollama did not return usable lecture-support recommendations.")

    text = "\n".join(f"{index + 1}) {item}" for index, item in enumerate(strategies[:5]))
    return {"strategies": text, "source": "ollama"}
