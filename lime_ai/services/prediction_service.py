from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
import numpy as np
from lime.lime_tabular import LimeTabularExplainer
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.settings import settings
from models.prediction import CognitiveLoadPrediction
from schemas.prediction import CognitiveLoadInput
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


def _has_gpt_api_key() -> bool:
    return bool(settings.GPT_API_KEY and settings.GPT_API_KEY.strip())


def _build_human_prompt(
    *,
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    predicted_score: int,
    confidence: float,
    factors: list[dict[str, Any]],
) -> str:
    factors_text = "\n".join(
        f"- rule: {factor['rule']}, weight: {factor['weight']:.6f}, impact: {factor['impact']}"
        for factor in factors
    )

    return (
        "Write a short human-readable classroom explanation for a teacher.\n"
        f"Student ID: {student_id}\n"
        f"Lesson ID: {lesson_id}\n"
        f"Predicted cognitive load: {predicted_label} (score {predicted_score})\n"
        f"Confidence: {confidence:.2f}\n"
        "LIME factors:\n"
        f"{factors_text}\n\n"
        "Rules:\n"
        "1) Use plain language.\n"
        "2) Mention top contributing factors.\n"
        "3) Give one practical teacher action.\n"
        "4) Keep it under 120 words."
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


def _fallback_human_explanation(
    *,
    predicted_label: str,
    confidence: float,
    factors: list[dict[str, Any]],
) -> str:
    positive = [factor for factor in factors if factor["impact"] == "positive"]
    strongest_positive = sorted(positive, key=lambda item: abs(item["weight"]), reverse=True)[:3]

    if strongest_positive:
        joined = ", ".join(f"{item['rule']}" for item in strongest_positive)
        return (
            f"This learner is predicted as {predicted_label} (confidence {confidence:.2f}). "
            f"The strongest factors increasing cognitive load are: {joined}. "
            "Consider slowing the pace and adding short guidance checkpoints for this student."
        )

    strongest = sorted(factors, key=lambda item: abs(item["weight"]), reverse=True)[:3]
    joined = ", ".join(f"{item['rule']}" for item in strongest) if strongest else "no strong factors detected"
    return (
        f"This learner is predicted as {predicted_label} (confidence {confidence:.2f}). "
        f"Top LIME signals are: {joined}. "
        "Use this as a quick indicator and combine with teacher observation before intervention."
    )


def _generate_human_explanation(
    *,
    student_id: str,
    lesson_id: str,
    predicted_label: str,
    predicted_score: int,
    confidence: float,
    factors: list[dict[str, Any]],
) -> tuple[str, str]:
    fallback = _fallback_human_explanation(
        predicted_label=predicted_label,
        confidence=confidence,
        factors=factors,
    )

    if not _has_gpt_api_key():
        return fallback, "fallback"

    system_prompt = (
        "You are an educational analytics assistant. Provide concise, practical,"
        " teacher-friendly explanations from model factors."
    )
    user_prompt = _build_human_prompt(
        student_id=student_id,
        lesson_id=lesson_id,
        predicted_label=predicted_label,
        predicted_score=predicted_score,
        confidence=confidence,
        factors=factors,
    )

    try:
        generated = _generate_gpt_text(system_prompt, user_prompt)
        if generated:
            return generated, "gpt"
    except Exception:
        pass

    return fallback, "fallback"


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
    limit: int = 200,
) -> dict[str, Any]:
    query = db.query(CognitiveLoadPrediction).filter(CognitiveLoadPrediction.lesson_id == lesson_id)

    if student_id:
        query = query.filter(CognitiveLoadPrediction.student_id == student_id)

    if high_only:
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
    num_samples: int = 400,
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
        .limit(300)
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
            num_samples=max(100, num_samples),
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

    human_explanation, explanation_source = _generate_human_explanation(
        student_id=target_row.student_id,
        lesson_id=target_row.lesson_id,
        predicted_label=target_row.predicted_cognitive_load,
        predicted_score=target_row.predicted_score,
        confidence=target_row.confidence,
        factors=factors,
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
            "human_explanation": human_explanation,
            "explanation_source": explanation_source,
        },
        "errors": [],
    }
