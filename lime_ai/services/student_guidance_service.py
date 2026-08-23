import json
import re
from typing import Any

from services.gemini_client import GeminiServiceError, generate_gemini_text
from services.study_technique_service import TECHNIQUES


GUIDANCE_VERSION = "teacher-friendly-load-v2"


SYSTEM_PROMPT = (
    "You are an expert educational assistant. Produce teacher-facing cognitive-load reasoning and "
    "student-facing learning guidance from only the supplied result and observed behaviors. Never "
    "mention LIME, SHAP, algorithms, models, features, drivers, signals, weights, scores, confidence, "
    "formulas, IDs, raw field names, pressure, relief, or analysis terminology. The teacher explanation "
    "must be understandable without technical or data-science knowledge and must explain only why the "
    "reported cognitive-load level was selected. Keep advice exclusively in the separate student-guidance "
    "fields. Return only valid JSON matching the requested structure."
)

USER_PROMPT_TEMPLATE = """Student ID: {student_id}
Lesson ID: {lesson_id}
Predicted cognitive load: {predicted_label}
Behaviors for the teacher explanation:
{human_signals_text}

Behaviors for student guidance:
{signals_text}

Return this JSON object:
{{
  "teacher_explanation": "one paragraph",
  "study_techniques": ["technique name"],
  "lecture_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]
}}

Requirements:
- teacher_explanation must start exactly with "This student has {predicted_label} cognitive load because",
  use clear everyday third-person language, connect the observed lesson actions into a simple reason for
  the selected load level without inventing facts, and contain 65-100 words. It must contain no advice,
  recommendations, study strategies, IDs, raw behavior names, numbers, percentages, or technical terms.
  Use cautious wording such as "suggests" or "may indicate" and describe only this lesson, not a permanent
  condition or diagnosis. End by restating why the combined behaviour supports the reported load level.
- Select one or two study_techniques only from: Mind Map, Short Notes, Concept Map, Flowchart, Cornell Notes.
- Provide exactly four short lecture_recommendations addressed directly to the student using "you" or
  "your". Each must start with a direct action verb, explain briefly how it helps, and be one sentence.
- Include actions for staying engaged, handling difficult content, and checking understanding.
- Use "Write down" instead of "Jot down".
- Do not add Markdown, headings, or text outside the JSON object.
"""


def _parse_json_object(response: str) -> dict[str, Any]:
    text = response.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiServiceError("Gemini returned malformed student-guidance JSON.") from exc
    if not isinstance(payload, dict):
        raise GeminiServiceError("Gemini returned invalid student-guidance JSON.")
    return payload


def _clean_text(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise GeminiServiceError(f"Gemini returned an invalid {field_name}.")
    return re.sub(r"\s+", " ", value).strip()


def _parse_techniques(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise GeminiServiceError("Gemini returned invalid study techniques.")

    selected: list[dict[str, str]] = []
    for item in value:
        normalized = str(item).strip().lower()
        for name, details in TECHNIQUES.items():
            if normalized == name and not any(row["technique"] == name for row in selected):
                selected.append({"technique": name, **details})
                break
    if not selected:
        raise GeminiServiceError("Gemini did not return a recognized study technique.")
    return selected[:2]


def _parse_recommendations(value: Any) -> list[str]:
    if not isinstance(value, list) or len(value) != 4:
        raise GeminiServiceError("Gemini must return exactly four lecture recommendations.")

    recommendations = []
    for item in value:
        cleaned = _clean_text(item, "lecture recommendation")
        cleaned = re.sub(r"^[\s\d).:-]+", "", cleaned)
        cleaned = re.sub(r"^jot down\b", "Write down", cleaned, flags=re.IGNORECASE)
        if len(cleaned) < 8:
            raise GeminiServiceError("Gemini returned an invalid lecture recommendation.")
        recommendations.append(cleaned)
    return recommendations


def generate_student_guidance(
    *,
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    signals: list[str],
    human_signals: list[str],
) -> dict[str, Any]:
    prompt = USER_PROMPT_TEMPLATE.format(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        signals_text="\n".join(f"- {signal}" for signal in signals) or "- none detected",
        human_signals_text=(
            "\n".join(f"- {signal}" for signal in human_signals)
            or "- no strong behavioral signal was detected"
        ),
    )
    response = generate_gemini_text(
        SYSTEM_PROMPT,
        prompt,
        response_mime_type="application/json",
    )
    payload = _parse_json_object(response)
    explanation = _clean_text(payload.get("teacher_explanation"), "teacher explanation")
    techniques = _parse_techniques(payload.get("study_techniques"))
    recommendations = _parse_recommendations(payload.get("lecture_recommendations"))

    return {
        "human_explanation": explanation,
        "study_technique": {
            "techniques": techniques,
            "source": "gemini",
            "guidance_version": GUIDANCE_VERSION,
        },
        "lecture_support": {
            "strategies": "\n".join(
                f"{index + 1}) {recommendation}"
                for index, recommendation in enumerate(recommendations)
            ),
            "source": "gemini",
            "guidance_version": GUIDANCE_VERSION,
        },
    }
