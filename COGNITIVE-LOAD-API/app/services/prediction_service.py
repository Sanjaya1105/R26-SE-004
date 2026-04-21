from datetime import datetime, timezone
import csv
import os

import pandas as pd

from app.core.model_loader import model
from app.services.feature_extraction_service import extract_feature_window_from_raw
from app.services.db_service import save_feature_window, save_prediction_log


CSV_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "cognitive_load_predictions.csv")
FALLBACK_CSV_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "cognitive_load_predictions_fallback.csv"
)

CSV_FIELDS = [
    "student_id",
    "lesson_id",
    "minute_index",
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
    "predicted_cognitive_load",
    "predicted_score",
    "predicted_label",
    "confidence",
    "created_at",
]

DEFAULT_QUIZ_RESPONSE_TIME = 20
DEFAULT_ERROR_RATE = 0.22


def get_label(score: int):
    labels = {
        1: "Very Low",
        2: "Low",
        3: "Medium",
        4: "High",
        5: "Very High",
    }
    return labels.get(score, "Unknown")


def save_to_csv(row_data: dict):
    target_file = CSV_FILE

    try:
        _write_csv_row(target_file, row_data)
    except PermissionError:
        # If the main CSV is locked by another app such as Excel, keep the API alive
        # and persist the prediction to a fallback file instead of failing the request.
        target_file = FALLBACK_CSV_FILE
        _write_csv_row(target_file, row_data)


def _write_csv_row(file_path: str, row_data: dict):
    file_exists = os.path.isfile(file_path)

    with open(file_path, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)

        if not file_exists:
            writer.writeheader()

        writer.writerow(row_data)


def get_prediction_logs(student_id: str | None = None, lesson_id: str | None = None, minute_index: int | None = None):
    records = []

    for file_path in (CSV_FILE, FALLBACK_CSV_FILE):
        if not os.path.isfile(file_path):
            continue

        with open(file_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for row in reader:
                normalized_row = _normalize_csv_row(row)

                if student_id and normalized_row["student_id"] != student_id:
                    continue

                if lesson_id and normalized_row["lesson_id"] != lesson_id:
                    continue

                if minute_index is not None and normalized_row["minute_index"] != minute_index:
                    continue

                records.append(normalized_row)

    records.sort(key=lambda item: item["created_at"], reverse=True)
    return records


def _normalize_csv_row(row: dict):
    int_fields = {
        "minute_index",
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
        "predicted_score",
    }
    float_fields = {"error_rate", "confidence"}

    normalized = {}

    for field in CSV_FIELDS:
        value = row.get(field)

        if field in int_fields and value not in (None, ""):
            normalized[field] = int(value)
        elif field in float_fields and value not in (None, ""):
            normalized[field] = float(value)
        else:
            normalized[field] = value

    return normalized


def predict_cognitive_load(data):
    normalized_quiz_response_time, normalized_error_rate = _normalize_quiz_inputs(
        data.quiz_response_time,
        data.error_rate,
    )

    # This is the feature snapshot we persist for downstream modules such as logs and XAI.
    feature_window_data = {
        "student_id": data.student_id,
        "lesson_id": data.lesson_id,
        "session_id": data.session_id,
        "minute_index": data.minute_index,
        "window_start": data.window_start,
        "window_end": data.window_end,
        "pause_frequency": data.pause_frequency,
        "navigation_count_video": data.navigation_count_video,
        "rewatch_segments": data.rewatch_segments,
        "playback_rate_change": data.playback_rate_change,
        "idle_duration_video": data.idle_duration_video,
        "time_on_content": data.time_on_content,
        "navigation_count_adaptation": data.navigation_count_adaptation,
        "revisit_frequency": data.revisit_frequency,
        "idle_duration_adaptation": data.idle_duration_adaptation,
        "quiz_response_time": normalized_quiz_response_time,
        "error_rate": normalized_error_rate,
    }

    input_df = pd.DataFrame(
        [
            {
                "pause_frequency": data.pause_frequency,
                "navigation_count_video": data.navigation_count_video,
                "rewatch_segments": data.rewatch_segments,
                "playback_rate_change": data.playback_rate_change,
                "idle_duration_video": data.idle_duration_video,
                "time_on_content": data.time_on_content,
                "navigation_count_adaptation": data.navigation_count_adaptation,
                "revisit_frequency": data.revisit_frequency,
                "idle_duration_adaptation": data.idle_duration_adaptation,
                "quiz_response_time": normalized_quiz_response_time,
                "error_rate": normalized_error_rate,
            }
        ]
    )

    prediction = model.predict(input_df)[0]
    proba = model.predict_proba(input_df)[0]
    confidence = max(proba)
    label = get_label(int(prediction))

    response_data = {
        "student_id": data.student_id,
        "lesson_id": data.lesson_id,
        "minute_index": data.minute_index,
        "pause_frequency": data.pause_frequency,
        "navigation_count_video": data.navigation_count_video,
        "rewatch_segments": data.rewatch_segments,
        "playback_rate_change": data.playback_rate_change,
        "idle_duration_video": data.idle_duration_video,
        "time_on_content": data.time_on_content,
        "navigation_count_adaptation": data.navigation_count_adaptation,
        "revisit_frequency": data.revisit_frequency,
        "idle_duration_adaptation": data.idle_duration_adaptation,
        "quiz_response_time": normalized_quiz_response_time,
        "error_rate": normalized_error_rate,
        "predicted_cognitive_load": label,
        "predicted_score": int(prediction),
        "predicted_label": label,
        "confidence": round(float(confidence), 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    feature_window_id = save_feature_window(feature_window_data)
    save_prediction_log(
        {
            "feature_window_id": feature_window_id,
            "student_id": data.student_id,
            "lesson_id": data.lesson_id,
            "session_id": data.session_id,
            "predicted_cognitive_load": label,
            "predicted_score": int(prediction),
            "confidence": round(float(confidence), 2),
        }
    )
    save_to_csv(response_data)
    return response_data


def predict_cognitive_load_from_raw(data):
    # The raw-event flow first rebuilds the model features, then reuses the normal prediction path.
    feature_window_data = extract_feature_window_from_raw(data.model_dump())
    prediction_result = predict_cognitive_load(_build_prediction_input(feature_window_data))

    return {
        "raw_event_count": feature_window_data["raw_event_count"],
        "feature_window": {
            key: value
            for key, value in feature_window_data.items()
            if key != "raw_event_count"
        },
        "prediction": prediction_result,
    }


def _build_prediction_input(feature_window_data: dict):
    class PredictionInput:
        pass

    payload = PredictionInput()

    for key, value in feature_window_data.items():
        if key == "raw_event_count":
            continue
        setattr(payload, key, value)

    return payload


def _normalize_quiz_inputs(quiz_response_time: int | None, error_rate: float | None):
    quiz_response_time = 0 if quiz_response_time is None else int(quiz_response_time)
    error_rate = 0.0 if error_rate is None else float(error_rate)

    # The frontend sends zeros before a learner reaches any quiz activity.
    # The model was trained on real quiz metrics, so replace the "no quiz yet"
    # shape with neutral defaults instead of letting it look like perfect quiz performance.
    if quiz_response_time <= 0 and error_rate <= 0:
        return DEFAULT_QUIZ_RESPONSE_TIME, DEFAULT_ERROR_RATE

    normalized_quiz_response_time = (
        quiz_response_time if quiz_response_time > 0 else DEFAULT_QUIZ_RESPONSE_TIME
    )
    normalized_error_rate = error_rate if error_rate >= 0 else DEFAULT_ERROR_RATE
    return normalized_quiz_response_time, round(normalized_error_rate, 2)
