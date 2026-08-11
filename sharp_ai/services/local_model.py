from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from config.settings import settings


FEATURE_NAMES = [
    "pause_frequency",
    "navigation_count_video",
    "rewatch_segments",
    "playback_rate_change",
    "idle_duration_video",
    "time_on_content",
]

SERVICE_DIR = Path(__file__).resolve().parents[1]
_model = None


class LocalModelError(RuntimeError):
    pass


def load_local_model():
    global _model
    if _model is None:
        model_path = (SERVICE_DIR / settings.LOCAL_MODEL_PATH).resolve()
        if not model_path.is_file():
            raise LocalModelError(f"Cognitive-load model not found at {model_path}.")
        try:
            _model = joblib.load(model_path)
        except Exception as exc:
            raise LocalModelError(f"Could not load cognitive-load model at {model_path}: {exc}") from exc

        model_features = [str(name) for name in getattr(_model, "feature_names_in_", [])]
        if model_features != FEATURE_NAMES:
            raise LocalModelError(
                f"Cognitive-load model features do not match. Expected {FEATURE_NAMES}, got {model_features}."
            )
    return _model


def predict_scores(feature_matrix) -> np.ndarray:
    values = np.atleast_2d(np.asarray(feature_matrix, dtype=float))
    values = np.maximum(0.0, np.rint(values))
    frame = pd.DataFrame(values, columns=FEATURE_NAMES)
    return np.asarray(load_local_model().predict(frame), dtype=float)
