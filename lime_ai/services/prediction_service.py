from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
import httpx
import numpy as np
import re
from lime.lime_tabular import LimeTabularExplainer
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.settings import settings
from models.prediction import CognitiveLoadPrediction
from schemas.prediction import AggregateExplanationRequest, CognitiveLoadInput
from services.model_client import ModelClientError, request_prediction


RAW_FEATURE_FIELDS = [
    "pause_frequency",
    "navigation_count_video",
    "rewatch_segments",
    "playback_rate_change",
    "idle_duration_video",
    "time_on_content",
    "navigation_count_adaptation",
    "revisit_frequency",
    "idle_duration_adaptation",
    "quiz_response_time",
    "error_rate",
]

INT_FEATURE_FIELDS = {
    "pause_frequency",
    "navigation_count_video",
    "rewatch_segments",
    "playback_rate_change",
    "idle_duration_video",
    "time_on_content",
    "navigation_count_adaptation",
    "revisit_frequency",
    "idle_duration_adaptation",
    "quiz_response_time",
}


AGGREGATE_SYSTEM_PROMPT = (
    "You are an educational analytics assistant. Create concise, practical, student-friendly "
    "explanations from combined LIME and SHAP signals."
)

AGGREGATE_USER_PROMPT_TEMPLATE = (
    "Write one short, natural paragraph addressed to the student using combined LIME and SHAP evidence.\n"
    "Student ID: {student_id}\n"
    "Lesson ID: {lesson_id}\n"
    "Predicted cognitive load: {predicted_label}\n"
    "Top combined classroom signals (LIME+SHAP):\n"
    "{signals_text}\n\n"
    "Rules:\n"
    "1) Explain the likely reason for high cognitive load in a natural sentence.\n"
    "2) Mention the strongest signals and what they mean for the student.\n"
    "3) Include practical advice the student should follow directly.\n"
    "4) If cognitive load is High or Very High, give clear support steps the student can follow now.\n"
    "5) Do not include numbers, percentages, formulas, or feature names.\n"
    "6) Avoid bullet points and keep under 120 words.\n"
    "7) Use wording like: 'You may be feeling high cognitive load because you paused the video often, spent a long time on the lesson, and revisited parts repeatedly. Try focusing on one section at a time and taking short breaks before moving forward.'"
)

LECTURE_SUPPORT_SYSTEM_PROMPT = (
    "You are an experienced educational support advisor. Provide personalized, actionable lecture support "
    "strategies for students based on their cognitive load level and behavioral patterns."
)

LECTURE_SUPPORT_USER_PROMPT_TEMPLATE = (
    "Generate specific lecture support strategies for this student:\n"
    "Student ID: {student_id}\n"
    "Lesson ID: {lesson_id}\n"
    "Cognitive Load Level: {predicted_label}\n"
    "Behavioral Signals: {signals_text}\n\n"
    "Rules:\n"
    "0) Do NOT include greetings or salutations (for example 'Hello', 'Good afternoon'). Start directly with the numbered strategies.\n"
    "1) Create 3-5 specific, actionable strategies tailored to their cognitive load level.\n"
    "2) Start with the most urgent/important strategy first.\n"
    "3) Each strategy should be something the student can do immediately or in the next study session.\n"
    "4) Use simple, direct language (no jargon).\n"
    "5) Format as a numbered list.\n"
    "6) Keep total length under 150 words.\n"
    "7) If cognitive load is Very High, emphasize immediate relief strategies.\n"
    "8) If cognitive load is Low/Medium, emphasize mastery and deeper engagement.\n"
    "Example format:\n"
    "1) [Specific action] - This will help you [benefit]\n"
    "2) [Specific action] - This will help you [benefit]\n"
    "Do not include generic advice. Make it specific to their signals."
)

STUDY_TECHNIQUE_SYSTEM_PROMPT = (
    "You are a learning advisor. Recommend 1-2 study techniques for students."
)

STUDY_TECHNIQUE_USER_PROMPT_TEMPLATE = (
    "Student cognitive load: {predicted_label}\n"
    "Behavioral signals: {signals_text}\n\n"
    "Recommend 1-2 techniques from: Mind Map, Short Notes, Concept Map, Flowchart, Cornell Notes\n"
    "Return ONLY technique names, one per line. No explanation needed.\n"
    "Example:\nMind Map\nShort Notes"
)


def _has_gpt_api_key() -> bool:
    return bool(settings.GPT_API_KEY and settings.GPT_API_KEY.strip())


def _selected_llm_provider() -> str:
    provider = settings.LLM_PROVIDER.strip().lower()
    return provider or "ollama"


def _has_ollama_config() -> bool:
    return bool(settings.OLLAMA_BASE_URL.strip() and settings.OLLAMA_MODEL.strip())


def _signal_to_teacher_phrase(signal: str) -> str:
    normalized = signal.lower()

    phrase_map = {
        "pause_frequency": "the student paused the video frequently",
        "navigation_count_video": "the student jumped around the video often",
        "rewatch_segments": "the student rewatched video sections",
        "playback_rate_change": "the student changed playback speed a lot",
        "idle_duration_video": "the student stayed inactive during the video for long periods",
        "time_on_content": "the student spent a long time on the lesson content",
        "navigation_count_adaptation": "the student moved around the adaptation content often",
        "revisit_frequency": "the student returned to earlier parts several times",
        "idle_duration_adaptation": "the student paused during the adaptation content for long periods",
        "quiz_response_time": "the student took a long time to answer quiz items",
        "error_rate": "the student made more quiz errors",
    }

    for feature_name, phrase in phrase_map.items():
        if feature_name in normalized:
            return phrase

    if any(token in normalized for token in ["pause", "idle", "wait"]):
        return "the student showed signs of delay or waiting"
    if any(token in normalized for token in ["error", "quiz"]):
        return "the quiz activity suggests the student needed more support"
    if any(token in normalized for token in ["rewatch", "revisit"]):
        return "the student went back over the material repeatedly"

    return "the signal points to higher cognitive load"


def _is_high_load(predicted_label: str) -> bool:
     return predicted_label.strip().lower() in {"high", "very high"}


def _teacher_recommendation(predicted_label: str) -> str:
    if _is_high_load(predicted_label):
        return (
            "Student advice: slow your pace, study in smaller steps, and ask for short feedback after each step."
        )
    return (
        "Student advice: keep your pace, but use short checkpoints and clarify difficult points early."
    )


def _top_human_reasons_from_factors(factors: list[dict[str, Any]], limit: int = 3) -> list[str]:
    positive_factors = [factor for factor in factors if factor.get("impact") == "positive"]
    ranked = sorted(
        positive_factors or factors,
        key=lambda item: abs(float(item.get("weight", 0.0))),
        reverse=True,
    )

    reasons: list[str] = []
    for factor in ranked:
        phrase = _signal_to_teacher_phrase(str(factor.get("rule", "")))
        if phrase not in reasons:
            reasons.append(phrase)
        if len(reasons) >= max(1, limit):
            break

    return reasons


def _why_cognitive_load_high_text(predicted_label: str, reasons: list[str]) -> str:
    if reasons:
        return f"This student likely has {predicted_label.lower()} cognitive load because {', '.join(reasons)}."
    return (
        f"This student is showing {predicted_label.lower()} cognitive load, but no strong behavior reason was detected "
        "from the current explanation signals."
    )


def _generate_gpt_text(system_prompt: str, user_prompt: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=settings.GPT_API_KEY, timeout=settings.GPT_TIMEOUT_SECONDS)
    response = client.chat.completions.create(
        model=settings.GPT_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content if response.choices else ""
    return (content or "").strip()


def _generate_ollama_text(system_prompt: str, user_prompt: str) -> str:
    base_url = settings.OLLAMA_BASE_URL.strip().rstrip("/")
    if not base_url:
        raise ValueError("OLLAMA_BASE_URL is not configured.")

    url = f"{base_url}/api/chat"
    timeout = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS)
    payload = {
        "model": settings.OLLAMA_MODEL.strip(),
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload)
    except httpx.TimeoutException as exc:
        raise RuntimeError(f"Ollama request timed out for {url}.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"Could not connect to Ollama at {url}.") from exc

    if response.status_code >= 400:
        raise RuntimeError(f"Ollama returned HTTP {response.status_code}: {response.text.strip()}")

    try:
        response_json = response.json()
    except ValueError as exc:
        raise RuntimeError("Ollama response was not valid JSON.") from exc

    content = ""
    if isinstance(response_json, dict):
        message = response_json.get("message")
        if isinstance(message, dict):
            content = str(message.get("content", ""))
        elif isinstance(response_json.get("response"), str):
            content = str(response_json.get("response", ""))

    return content.strip()


def _generate_llm_text(system_prompt: str, user_prompt: str) -> tuple[str, str]:
    provider = _selected_llm_provider()

    if provider == "gpt":
        if not _has_gpt_api_key():
            return "", "gpt"
        try:
            generated = _generate_gpt_text(system_prompt, user_prompt)
            if generated:
                return generated, "gpt"
        except Exception:
            return "", "gpt"
        return "", "gpt"

    if provider == "ollama":
        if not _has_ollama_config():
            return "", "ollama"
        try:
            generated = _generate_ollama_text(system_prompt, user_prompt)
            if generated:
                return generated, "ollama"
        except Exception:
            return "", "ollama"
        return "", "ollama"

    return "", provider


def _fallback_human_explanation(
    *,
    predicted_label: str,
    factors: list[dict[str, Any]],
) -> str:
    reasons = _top_human_reasons_from_factors(factors, limit=3)
    recommendation = _teacher_recommendation(predicted_label)

    if reasons:
        joined = ", ".join(reasons)
        return f"This student likely has {predicted_label.lower()} cognitive load because {joined}. {recommendation}"

    return (
        f"This student is showing {predicted_label.lower()} cognitive load, but no clear behavior reason was detected. "
        f"{recommendation}"
    )


def _build_aggregate_prompt(
    *,
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> str:
    signals_text = "\n".join(
        f"- {_signal_to_teacher_phrase(item['signal'])}"
        for item in top_signals
    ) if top_signals else "- no strong combined signal detected"

    return AGGREGATE_USER_PROMPT_TEMPLATE.format(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        signals_text=signals_text,
    )


def _top_aggregate_signals(
    *,
    lime_factors: list[dict[str, Any]],
    shap_values: list[dict[str, Any]],
    limit: int = 3,
) -> list[dict[str, Any]]:
    combined: list[dict[str, Any]] = []

    for factor in lime_factors:
        weight = float(factor.get("weight", 0.0))
        combined.append(
            {
                "source": "lime",
                "signal": str(factor.get("rule", "unknown")),
                "raw_value": weight,
                "strength": abs(weight),
                "impact": "positive" if weight > 0 else "negative" if weight < 0 else "neutral",
            }
        )

    for item in shap_values:
        shap_value = float(item.get("shap_value", 0.0))
        combined.append(
            {
                "source": "shap",
                "signal": str(item.get("feature", "unknown")),
                "raw_value": shap_value,
                "strength": abs(shap_value),
                "impact": "positive" if shap_value > 0 else "negative" if shap_value < 0 else "neutral",
            }
        )

    positive_only = [entry for entry in combined if entry["impact"] == "positive"]
    ranked = positive_only or combined
    ranked.sort(key=lambda entry: entry["strength"], reverse=True)
    return ranked[: max(1, limit)]


def _fallback_aggregate_explanation(
    *,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> str:
    recommendation = _teacher_recommendation(predicted_label)

    if not top_signals:
        return (
            f"This student is showing {predicted_label.lower()} cognitive load, but no strong combined behavior reason was detected. "
            f"{recommendation}"
        )

    highlights = ", ".join(_signal_to_teacher_phrase(item["signal"]) for item in top_signals[:3])
    return (
        f"This student likely has {predicted_label.lower()} cognitive load because {highlights}. "
        f"{recommendation}"
    )


def _get_all_study_technique_links() -> dict[str, dict[str, Any]]:
    """Return available study techniques with minimal info."""
    return {
        "mind map": {
            "title": "Mind Map",
            "emoji": "🧠",
            "link": "https://mindmeister.com/app/map/new",
            "link_text": "Create Mind Map",
        },
        "short notes": {
            "title": "Short Notes",
            "emoji": "📝",
            "link": "https://www.notion.so/",
            "link_text": "Start Taking Notes",
        },
        "concept map": {
            "title": "Concept Map",
            "emoji": "🔗",
            "link": "https://app.creately.com/",
            "link_text": "Create Concept Map",
        },
        "flowchart": {
            "title": "Flowchart",
            "emoji": "📊",
            "link": "https://www.lucidchart.com/",
            "link_text": "Create Flowchart",
        },
        "cornell notes": {
            "title": "Cornell Notes",
            "emoji": "📄",
            "link": "https://www.evernote.com/",
            "link_text": "Start Cornell Notes",
        }
    }


def _parse_ollama_technique_response(response_text: str) -> list[str]:
    """Parse Ollama's response to extract technique names."""
    technique_names = []
    all_techniques = set(_get_all_study_technique_links().keys())
    
    lines = response_text.strip().split("\n")
    
    for line in lines:
        line_lower = line.lower().strip()
        for technique in all_techniques:
            if technique in line_lower:
                if technique not in technique_names:
                    technique_names.append(technique)
                break
    
    return technique_names


def _build_study_technique_prompt(
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> str:
    """Build the study technique recommendation prompt for Ollama."""
    signals_text = "\n".join(
        f"- {_signal_to_teacher_phrase(item['signal'])}"
        for item in top_signals
    ) if top_signals else "- no strong signals detected"
    
    return STUDY_TECHNIQUE_USER_PROMPT_TEMPLATE.format(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        signals_text=signals_text,
    )


def _get_study_technique_recommendation(
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate study technique recommendations using Ollama."""
    user_prompt = _build_study_technique_prompt(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        top_signals=top_signals,
    )
    
    recommendation_text, source = _generate_llm_text(STUDY_TECHNIQUE_SYSTEM_PROMPT, user_prompt)
    
    # Parse recommended techniques from response
    recommended_techniques = _parse_ollama_technique_response(recommendation_text)
    
    # Build techniques array with links
    techniques_with_links = []
    all_links = _get_all_study_technique_links()
    
    for technique_name in recommended_techniques:
        if technique_name in all_links:
            technique_data = all_links[technique_name]
            techniques_with_links.append({
                "technique": technique_name,
                "title": technique_data["title"],
                "emoji": technique_data["emoji"],
                "link": technique_data["link"],
                "link_text": technique_data["link_text"],
            })
    
    # Fallback to Mind Map if nothing recommended
    if not techniques_with_links:
        mind_map = all_links["mind map"]
        techniques_with_links.append({
            "technique": "mind map",
            "title": mind_map["title"],
            "emoji": mind_map["emoji"],
            "link": mind_map["link"],
            "link_text": mind_map["link_text"],
        })
    
    return {
        "techniques": techniques_with_links,
        "source": source,
    }


def _build_lecture_support_prompt(
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> str:
    """Build the lecture support prompt for Ollama."""
    signals_text = "\n".join(
        f"- {_signal_to_teacher_phrase(item['signal'])}"
        for item in top_signals
    ) if top_signals else "- no strong signals detected"
    
    return LECTURE_SUPPORT_USER_PROMPT_TEMPLATE.format(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        signals_text=signals_text,
    )


def _generate_lecture_support(
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    top_signals: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate lecture support recommendations using Ollama."""
    user_prompt = _build_lecture_support_prompt(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        top_signals=top_signals,
    )
    
    support_text, source = _generate_llm_text(LECTURE_SUPPORT_SYSTEM_PROMPT, user_prompt)
    
    # Remove prompt details if Ollama echoed them back
    if support_text:
        # Find where the actual strategies start (after the input section)
        lines = support_text.split('\n')
        start_index = 0
        for i, line in enumerate(lines):
            # Look for numbered strategies (1), 2), 3), etc.)
            if line.strip() and line.strip()[0].isdigit() and ')' in line.strip()[:3]:
                start_index = i
                break
        
        # Keep only the actual strategies
        if start_index > 0:
            support_text = '\n'.join(lines[start_index:]).strip()
        # Strip common greetings/salutations at the start (e.g., "Good afternoon, student!")
        support_text = re.sub(r'^(?:\s*(?:hello|hi|dear student|dear learner|greetings|good (?:morning|afternoon|evening)|dear)[^\n]*\n)+', '', support_text, flags=re.I).strip()
        # Also remove a short leading sentence that is just a salutation followed by punctuation
        support_text = re.sub(r'^(?:\s*(?:hello|hi|dear student|dear learner|greetings|good (?:morning|afternoon|evening))[\.!,-:;]*\s*)+', '', support_text, flags=re.I).strip()
    
    return {
        "strategies": support_text if support_text else "Unable to generate strategies at this time.",
        "source": source,
    }


def generate_aggregate_explanation(payload: AggregateExplanationRequest) -> dict[str, Any]:
    lime_factors = [factor.model_dump(mode="json") for factor in payload.lime_factors]
    shap_values = [item.model_dump(mode="json") for item in payload.shap_values]
    top_signals = _top_aggregate_signals(
        lime_factors=lime_factors,
        shap_values=shap_values,
        limit=3,
    )

    fallback = _fallback_aggregate_explanation(
        predicted_label=payload.predicted_cognitive_load,
        top_signals=top_signals,
    )

    system_prompt = AGGREGATE_SYSTEM_PROMPT
    user_prompt = _build_aggregate_prompt(
        student_id=payload.student_id,
        lesson_id=payload.lesson_id,
        predicted_label=payload.predicted_cognitive_load,
        top_signals=top_signals,
    )

    explanation_text, source = _generate_llm_text(system_prompt, user_prompt)
    if not explanation_text:
        explanation_text = fallback
        source = "fallback"

    aggregate_reasons = [_signal_to_teacher_phrase(item["signal"]) for item in top_signals[:3]]
    why_cognitive_load_high = _why_cognitive_load_high_text(
        payload.predicted_cognitive_load,
        aggregate_reasons,
    )

    # Generate study technique recommendations via Ollama
    study_technique = _get_study_technique_recommendation(
        student_id=payload.student_id,
        lesson_id=payload.lesson_id,
        predicted_label=payload.predicted_cognitive_load,
        top_signals=top_signals,
    )

    # Generate lecture support via Ollama
    lecture_support = _generate_lecture_support(
        student_id=payload.student_id,
        lesson_id=payload.lesson_id,
        predicted_label=payload.predicted_cognitive_load,
        top_signals=top_signals,
    )

    return {
        "success": True,
        "message": "Aggregate explanation generated successfully.",
        "data": {
            "lesson_id": payload.lesson_id,
            "prediction_id": payload.prediction_id,
            "student_id": payload.student_id,
            "predicted_cognitive_load": payload.predicted_cognitive_load,
            "predicted_score": payload.predicted_score,
            "confidence": payload.confidence,
            "top_signals": top_signals,
            "why_cognitive_load_high": why_cognitive_load_high,
            "human_explanation": explanation_text,
            "explanation_source": source,
            "study_technique": study_technique,
            "lecture_support": lecture_support,
        },
        "errors": [],
    }


def _prediction_label(payload: dict[str, Any]) -> str:
    for key in ("predicted_cognitive_load", "predicted_label", "final_cognitive_load", "cognitive_load"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Medium"


def _prediction_score(payload: dict[str, Any]) -> int:
    for key in ("predicted_score", "score", "label_score", "cognitive_load_score"):
        value = payload.get(key)
        if value is None:
            continue
        try:
            return int(float(value))
        except (TypeError, ValueError):
            continue
    labels = {"Very Low": 1, "Low": 2, "Medium": 3, "High": 4, "Very High": 5}
    return labels.get(_prediction_label(payload), 3)


def _confidence(payload: dict[str, Any]) -> float:
    for key in ("confidence", "probability", "probability_score"):
        value = payload.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return 0.0


def save_prediction(db: Session, data: CognitiveLoadInput, prediction_payload: dict[str, Any]) -> CognitiveLoadPrediction:
    row = CognitiveLoadPrediction(
        student_id=data.student_id,
        lesson_id=data.lesson_id,
        session_id=data.session_id,
        minute_index=data.minute_index,
        window_start=data.window_start,
        window_end=data.window_end,
        pause_frequency=data.pause_frequency,
        navigation_count_video=data.navigation_count_video,
        rewatch_segments=data.rewatch_segments,
        playback_rate_change=data.playback_rate_change,
        idle_duration_video=data.idle_duration_video,
        time_on_content=data.time_on_content,
        navigation_count_adaptation=data.navigation_count_adaptation,
        revisit_frequency=data.revisit_frequency,
        idle_duration_adaptation=data.idle_duration_adaptation,
        quiz_response_time=data.quiz_response_time,
        error_rate=data.error_rate,
        predicted_cognitive_load=_prediction_label(prediction_payload),
        predicted_score=_prediction_score(prediction_payload),
        confidence=_confidence(prediction_payload),
        created_at=datetime.now(timezone.utc),
    )

    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def predict_and_store(db: Session, data: CognitiveLoadInput) -> dict[str, Any]:
    try:
        prediction_payload = request_prediction(data.model_dump(mode="json"))
    except ModelClientError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "message": str(exc),
                "data": None,
                "errors": ["Model service is unavailable or misconfigured."],
            },
        ) from exc

    saved_row = save_prediction(db, data, prediction_payload)

    return {
        "success": True,
        "message": "Prediction stored successfully.",
        "data": {
            "id": saved_row.id,
            "student_id": saved_row.student_id,
            "lesson_id": saved_row.lesson_id,
            "session_id": saved_row.session_id,
            "minute_index": saved_row.minute_index,
            "window_start": saved_row.window_start.isoformat() if saved_row.window_start else None,
            "window_end": saved_row.window_end.isoformat() if saved_row.window_end else None,
            "pause_frequency": saved_row.pause_frequency,
            "navigation_count_video": saved_row.navigation_count_video,
            "rewatch_segments": saved_row.rewatch_segments,
            "playback_rate_change": saved_row.playback_rate_change,
            "idle_duration_video": saved_row.idle_duration_video,
            "time_on_content": saved_row.time_on_content,
            "navigation_count_adaptation": saved_row.navigation_count_adaptation,
            "revisit_frequency": saved_row.revisit_frequency,
            "idle_duration_adaptation": saved_row.idle_duration_adaptation,
            "quiz_response_time": saved_row.quiz_response_time,
            "error_rate": saved_row.error_rate,
            "predicted_cognitive_load": saved_row.predicted_cognitive_load,
            "predicted_score": saved_row.predicted_score,
            "confidence": saved_row.confidence,
            "created_at": saved_row.created_at.isoformat() if saved_row.created_at else None,
            "model_response": prediction_payload,
        },
        "errors": [],
    }


def list_predictions(db: Session, limit: int = 50) -> dict[str, Any]:
    rows = (
        db.query(CognitiveLoadPrediction)
        .order_by(CognitiveLoadPrediction.created_at.desc(), CognitiveLoadPrediction.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "success": True,
        "message": "Predictions retrieved successfully.",
        "data": [
            {
                "id": row.id,
                "student_id": row.student_id,
                "lesson_id": row.lesson_id,
                "session_id": row.session_id,
                "minute_index": row.minute_index,
                "window_start": row.window_start.isoformat() if row.window_start else None,
                "window_end": row.window_end.isoformat() if row.window_end else None,
                "pause_frequency": row.pause_frequency,
                "navigation_count_video": row.navigation_count_video,
                "rewatch_segments": row.rewatch_segments,
                "playback_rate_change": row.playback_rate_change,
                "idle_duration_video": row.idle_duration_video,
                "time_on_content": row.time_on_content,
                "navigation_count_adaptation": row.navigation_count_adaptation,
                "revisit_frequency": row.revisit_frequency,
                "idle_duration_adaptation": row.idle_duration_adaptation,
                "quiz_response_time": row.quiz_response_time,
                "error_rate": row.error_rate,
                "predicted_cognitive_load": row.predicted_cognitive_load,
                "predicted_score": row.predicted_score,
                "confidence": row.confidence,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "errors": [],
    }


def list_lessons(db: Session) -> dict[str, Any]:
    rows = (
        db.query(
            CognitiveLoadPrediction.lesson_id,
            func.count(CognitiveLoadPrediction.id).label("prediction_count"),
        )
        .group_by(CognitiveLoadPrediction.lesson_id)
        .order_by(CognitiveLoadPrediction.lesson_id.asc())
        .all()
    )

    return {
        "success": True,
        "message": "Lessons retrieved successfully.",
        "data": [
            {
                "lesson_id": row.lesson_id,
                "prediction_count": int(row.prediction_count),
            }
            for row in rows
        ],
        "errors": [],
    }


def list_students_for_lesson(db: Session, lesson_id: str) -> dict[str, Any]:
    rows = (
        db.query(
            CognitiveLoadPrediction.student_id,
            func.count(CognitiveLoadPrediction.id).label("prediction_count"),
        )
        .filter(CognitiveLoadPrediction.lesson_id == lesson_id)
        .group_by(CognitiveLoadPrediction.student_id)
        .order_by(CognitiveLoadPrediction.student_id.asc())
        .all()
    )

    return {
        "success": True,
        "message": "Students retrieved successfully.",
        "data": [
            {
                "student_id": row.student_id,
                "prediction_count": int(row.prediction_count),
            }
            for row in rows
        ],
        "errors": [],
    }


def list_predictions_filtered(
    db: Session,
    lesson_id: str,
    student_id: str | None = None,
    high_only: bool = False,
    include_medium: bool = False,
    limit: int = 200,
) -> dict[str, Any]:
    query = db.query(CognitiveLoadPrediction).filter(CognitiveLoadPrediction.lesson_id == lesson_id)

    if student_id:
        query = query.filter(CognitiveLoadPrediction.student_id == student_id)

    if high_only:
        if include_medium:
            query = query.filter(CognitiveLoadPrediction.predicted_cognitive_load.in_(["Medium", "High", "Very High"]))
        else:
            query = query.filter(CognitiveLoadPrediction.predicted_cognitive_load.in_(["High", "Very High"]))

    rows = (
        query
        .order_by(CognitiveLoadPrediction.created_at.desc(), CognitiveLoadPrediction.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "success": True,
        "message": "Predictions retrieved successfully.",
        "data": [
            {
                "id": row.id,
                "student_id": row.student_id,
                "lesson_id": row.lesson_id,
                "session_id": row.session_id,
                "minute_index": row.minute_index,
                "window_start": row.window_start.isoformat() if row.window_start else None,
                "window_end": row.window_end.isoformat() if row.window_end else None,
                "pause_frequency": row.pause_frequency,
                "navigation_count_video": row.navigation_count_video,
                "rewatch_segments": row.rewatch_segments,
                "playback_rate_change": row.playback_rate_change,
                "idle_duration_video": row.idle_duration_video,
                "time_on_content": row.time_on_content,
                "navigation_count_adaptation": row.navigation_count_adaptation,
                "revisit_frequency": row.revisit_frequency,
                "idle_duration_adaptation": row.idle_duration_adaptation,
                "quiz_response_time": row.quiz_response_time,
                "error_rate": row.error_rate,
                "predicted_cognitive_load": row.predicted_cognitive_load,
                "predicted_score": row.predicted_score,
                "confidence": row.confidence,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "errors": [],
    }


def _row_to_model_payload(row: CognitiveLoadPrediction, feature_values: dict[str, float] | None = None) -> dict[str, Any]:
    values = feature_values or {
        name: float(getattr(row, name))
        for name in RAW_FEATURE_FIELDS
    }

    normalized_values: dict[str, Any] = {}
    for name in RAW_FEATURE_FIELDS:
        value = float(values[name])
        if name in INT_FEATURE_FIELDS:
            normalized_values[name] = max(0, int(round(value)))
        else:
            normalized_values[name] = value

    return {
        "student_id": row.student_id,
        "lesson_id": row.lesson_id,
        "session_id": row.session_id,
        "minute_index": row.minute_index,
        "window_start": row.window_start.isoformat() if row.window_start else None,
        "window_end": row.window_end.isoformat() if row.window_end else None,
        **normalized_values,
    }


def _predict_scores_for_matrix(feature_matrix: np.ndarray, base_row: CognitiveLoadPrediction) -> np.ndarray:
    scores: list[float] = []

    for vector in feature_matrix:
        feature_values = {
            RAW_FEATURE_FIELDS[index]: float(vector[index])
            for index in range(len(RAW_FEATURE_FIELDS))
        }
        payload = _row_to_model_payload(base_row, feature_values)
        prediction_payload = request_prediction(payload)
        scores.append(float(_prediction_score(prediction_payload)))

    return np.asarray(scores, dtype=float)


def get_lime_explanation_for_prediction(
    db: Session,
    lesson_id: str,
    prediction_id: int,
    num_features: int = 6,
    num_samples: int = 200,
) -> dict[str, Any]:
    target_row = (
        db.query(CognitiveLoadPrediction)
        .filter(
            CognitiveLoadPrediction.id == prediction_id,
            CognitiveLoadPrediction.lesson_id == lesson_id,
        )
        .first()
    )

    if target_row is None:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "Prediction record not found for the selected lesson.",
                "data": None,
                "errors": [],
            },
        )

    lesson_rows = (
        db.query(CognitiveLoadPrediction)
        .filter(CognitiveLoadPrediction.lesson_id == lesson_id)
        .order_by(CognitiveLoadPrediction.created_at.desc(), CognitiveLoadPrediction.id.desc())
        .limit(50)
        .all()
    )

    if not lesson_rows:
        lesson_rows = [target_row]

    training_data = np.asarray(
        [
            [float(getattr(row, name)) for name in RAW_FEATURE_FIELDS]
            for row in lesson_rows
        ],
        dtype=float,
    )

    target_vector = np.asarray(
        [float(getattr(target_row, name)) for name in RAW_FEATURE_FIELDS],
        dtype=float,
    )

    explainer = LimeTabularExplainer(
        training_data=training_data,
        feature_names=RAW_FEATURE_FIELDS,
        mode="regression",
        discretize_continuous=True,
        random_state=42,
    )

    try:
        explanation = explainer.explain_instance(
            data_row=target_vector,
            predict_fn=lambda matrix: _predict_scores_for_matrix(matrix, target_row),
            num_features=max(1, min(num_features, len(RAW_FEATURE_FIELDS))),
            num_samples=max(50, num_samples),
        )
    except ModelClientError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "message": str(exc),
                "data": None,
                "errors": ["Model service is unavailable while generating LIME explanation."],
            },
        ) from exc

    factors = [
        {
            "rule": rule,
            "weight": float(weight),
            "impact": "positive" if weight > 0 else "negative" if weight < 0 else "neutral",
        }
        for rule, weight in explanation.as_list()
    ]

    human_explanation = _fallback_human_explanation(
        predicted_label=target_row.predicted_cognitive_load,
        factors=factors,
    )
    explanation_source = "fallback"

    lime_reasons = _top_human_reasons_from_factors(factors, limit=3)
    why_cognitive_load_high = _why_cognitive_load_high_text(
        target_row.predicted_cognitive_load,
        lime_reasons,
    )

    return {
        "success": True,
        "message": "LIME explanation generated successfully.",
        "data": {
            "prediction_id": target_row.id,
            "lesson_id": target_row.lesson_id,
            "student_id": target_row.student_id,
            "predicted_cognitive_load": target_row.predicted_cognitive_load,
            "predicted_score": target_row.predicted_score,
            "confidence": target_row.confidence,
            "intercept": float(explanation.intercept[0]) if explanation.intercept else 0.0,
            "factors": factors,
            "why_cognitive_load_high": why_cognitive_load_high,
            "human_explanation": human_explanation,
            "explanation_source": explanation_source,
        },
        "errors": [],
    }
