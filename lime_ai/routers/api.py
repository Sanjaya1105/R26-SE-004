from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from schemas.prediction import AggregateExplanationRequest, CognitiveLoadInput
from services.prediction_service import (
    generate_aggregate_explanation,
    get_lime_explanation_for_prediction,
    list_lessons,
    list_predictions,
    list_predictions_filtered,
    list_students_for_lesson,
    predict_and_store,
)


router = APIRouter(tags=["lime-ai"])


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "success": True,
        "message": "LIME AI Service is running.",
        "data": None,
        "errors": [],
    }


@router.post("/predict")
def predict(data: CognitiveLoadInput, db: Session = Depends(get_db)):
    return predict_and_store(db, data)


@router.get("/predictions")
def get_predictions(limit: int = 50, db: Session = Depends(get_db)):
    return list_predictions(db, limit=limit)


@router.get("/lessons")
def get_lessons(db: Session = Depends(get_db)):
    return list_lessons(db)


@router.get("/lessons/{lesson_id}/students")
def get_lesson_students(lesson_id: str, db: Session = Depends(get_db)):
    return list_students_for_lesson(db, lesson_id)


@router.get("/lessons/{lesson_id}/predictions")
def get_lesson_predictions(
    lesson_id: str,
    student_id: str | None = None,
    high_only: bool = False,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    return list_predictions_filtered(
        db,
        lesson_id=lesson_id,
        student_id=student_id,
        high_only=high_only,
        limit=limit,
    )


@router.get("/lessons/{lesson_id}/predictions/{prediction_id}/lime")
def get_prediction_lime_explanation(
    lesson_id: str,
    prediction_id: int,
    num_features: int = 6,
    num_samples: int = 200,
    db: Session = Depends(get_db),
):
    return get_lime_explanation_for_prediction(
        db,
        lesson_id=lesson_id,
        prediction_id=prediction_id,
        num_features=num_features,
        num_samples=num_samples,
    )


@router.post("/aggregate-explanation")
def create_aggregate_explanation(payload: AggregateExplanationRequest):
    return generate_aggregate_explanation(payload)
