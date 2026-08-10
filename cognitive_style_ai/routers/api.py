from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from models.analysis import CognitiveStyleAnalysis
from services.explanation_service import explain_in_parallel
from services.human_explanation_service import generate_human_explanation
from services.model_client import BatchPredictor, ModelClientError, get_model_metadata
from services.mongo_sync_service import sync_mongo_inputs_once
from services.ollama_client import OllamaServiceError


router = APIRouter()


def _serialize(row: CognitiveStyleAnalysis) -> dict:
    return {
        "id": row.id,
        "lesson_id": row.lesson_id,
        "student_id": row.student_id,
        "session_id": row.session_id,
        "analysis_status": row.analysis_status,
        "cognitive_style": row.cognitive_style,
        "confidence": row.confidence,
        "feature_values": row.feature_values,
        "lime_output": row.lime_output,
        "shap_output": row.shap_output,
        "top_features": row.top_features,
        "explanation_prompt": row.explanation_prompt,
        "human_explanation": row.human_explanation,
        "explanation_model": row.explanation_model,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/health")
def health():
    return {"success": True, "message": "Cognitive-style explainability service is running."}


@router.post("/lessons/{lesson_id}/students/{student_id}/analyse")
def analyse_student_style(
    lesson_id: str,
    student_id: str,
    lime_samples: int = Query(200, ge=50, le=5000),
    shap_samples: int = Query(100, ge=25, le=2000),
    db: Session = Depends(get_db),
):
    def find_pending():
        return (
            db.query(CognitiveStyleAnalysis)
            .filter(
                CognitiveStyleAnalysis.student_id == student_id,
                CognitiveStyleAnalysis.analysis_status == "pending",
            )
            .order_by(CognitiveStyleAnalysis.created_at.desc(), CognitiveStyleAnalysis.id.desc())
            .first()
        )

    record = find_pending()
    if record is None:
        try:
            sync_mongo_inputs_once()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Could not synchronize MongoDB model inputs: {exc}") from exc
        db.rollback()
        db.expire_all()
        record = find_pending()
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"No pending cognitive-style model inputs were found for student {student_id}.",
        )

    features = record.feature_values or {}
    try:
        feature_names, classes = get_model_metadata()
        predictor = BatchPredictor(feature_names, classes)
    except ModelClientError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not features:
        raise HTTPException(status_code=422, detail="The pending row does not contain model input values.")
    missing_features = [name for name in feature_names if name not in features]
    if missing_features:
        raise HTTPException(
            status_code=422,
            detail=f"CognitiveStyleBackend omitted visual/verbal model features: {', '.join(missing_features)}",
        )

    target_vector = [[float(features[name]) for name in feature_names]]
    probabilities = predictor.probabilities(target_vector)[0]
    predicted_index = int(probabilities.argmax())
    style = predictor.classes[predicted_index]
    probability = float(probabilities[predicted_index])
    record.lesson_id = lesson_id

    history_rows = (
        db.query(CognitiveStyleAnalysis)
        .filter(
            CognitiveStyleAnalysis.student_id == student_id,
            CognitiveStyleAnalysis.analysis_status == "completed",
        )
        .order_by(CognitiveStyleAnalysis.created_at.desc())
        .limit(100)
        .all()
    )
    try:
        lime_output, shap_output, top_features = explain_in_parallel(
            features,
            feature_names,
            classes,
            style,
            [row.feature_values for row in history_rows],
            lime_samples,
            shap_samples,
        )
    except ModelClientError as exc:
        raise HTTPException(status_code=503, detail=f"Explanation generation failed: {exc}") from exc
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=f"Explanation generation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Explanation generation failed: {exc}") from exc

    try:
        explanation_prompt, human_explanation, explanation_model = generate_human_explanation(
            student_id=student_id,
            lesson_id=lesson_id,
            cognitive_style=style,
            confidence=probability,
            top_features=top_features,
        )
    except OllamaServiceError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Human explanation generation failed: {exc}") from exc

    record.cognitive_style = style
    record.confidence = probability
    record.lime_output = lime_output
    record.shap_output = shap_output
    record.top_features = top_features
    record.explanation_prompt = explanation_prompt
    record.human_explanation = human_explanation
    record.explanation_model = explanation_model
    record.analysis_status = "completed"
    db.commit()
    db.refresh(record)
    return {
        "success": True,
        "message": "LIME, SHAP, top-three aggregation, and Ollama explanation completed.",
        "data": _serialize(record),
        "errors": [],
    }


@router.get("/lessons/{lesson_id}/students/{student_id}/latest")
def latest_student_style(lesson_id: str, student_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(CognitiveStyleAnalysis)
        .filter(
            CognitiveStyleAnalysis.lesson_id == lesson_id,
            CognitiveStyleAnalysis.student_id == student_id,
        )
        .order_by(CognitiveStyleAnalysis.created_at.desc(), CognitiveStyleAnalysis.id.desc())
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="No cognitive-style analysis was found.")
    return {"success": True, "message": "Latest analysis loaded.", "data": _serialize(row), "errors": []}
