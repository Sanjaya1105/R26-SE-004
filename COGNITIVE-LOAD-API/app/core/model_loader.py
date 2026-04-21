import os

import joblib


# Build an absolute path to the trained model file.
model_path = os.path.join(os.path.dirname(__file__), "..", "..", "model", "cognitive_load_model.pkl")

# Load the model once at startup so other modules can import and reuse it.
try:
    model = joblib.load(model_path)
except Exception as exc:
    raise RuntimeError(f"Failed to load cognitive load model from {model_path}: {exc}") from exc


def get_model_metadata():
    return {
        "model_path": model_path,
        "model_type": type(model).__name__,
        "n_features_in": getattr(model, "n_features_in_", None),
        "feature_names_in": list(getattr(model, "feature_names_in_", [])),
        "classes": [
            cls.item() if hasattr(cls, "item") else cls
            for cls in getattr(model, "classes_", [])
        ],
    }

# Simple startup log to confirm the model is ready.
print(f"New Model loaded successfully from {model_path}")
