from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
import numpy as np
from lime.lime_tabular import LimeTabularExplainer
from sqlalchemy import func
from sqlalchemy.orm import Session

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
        },
        "errors": [],
    }
