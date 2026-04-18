import os

import joblib


# Build an absolute path to the trained model file.
model_path = os.path.join(os.path.dirname(__file__), "..", "..", "model", "cognitive_load_model.pkl")

# Load the model once at startup so other modules can import and reuse it.
model = joblib.load(model_path)

# Simple startup log to confirm the model is ready.
print("New Model loaded successfully")
