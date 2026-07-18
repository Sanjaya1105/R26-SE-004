import pandas as pd
import joblib
from pathlib import Path
from fastapi import HTTPException

# ---------------------------------------------------------
# 1. Configuration & Model Loading
# ---------------------------------------------------------
# Navigate up 3 levels: aiModelServices (1) -> services (2) -> CognitiveStyleBackend root (3)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# Point directly to the aiModel2 folder where your files are located
MODEL_PATH = ROOT_DIR / "aiModel2" / "cognitive_style_rf_model.pkl"
ENCODER_PATH = ROOT_DIR / "aiModel2" / "label_encoder.pkl"
_model = None
_label_encoder = None


def load_ml_assets():
    """Loads the model and encoder into memory once to avoid disk I/O on every request."""
    global _model, _label_encoder
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    if _label_encoder is None:
        _label_encoder = joblib.load(ENCODER_PATH)
    return _model, _label_encoder


# ---------------------------------------------------------
# Database Fetching Logic
# ---------------------------------------------------------
async def fetch_user_data_from_db(cursor_collection, gaze_collection, user_id: str):
    """
    Queries the provided MongoDB collections for the user's cursor and gaze data.
    """
    # Fetch from the specific collections passed in from the route
    cursor_data = await cursor_collection.find_one(
        {"userId": user_id},
        sort=[("_id", -1)]
    )

    gaze_data = await gaze_collection.find_one(
        {"userId": user_id},
        sort=[("_id", -1)]
    )

    return cursor_data, gaze_data

# ---------------------------------------------------------
# 3. Main Prediction Service
# ---------------------------------------------------------
async def predict_user_style_ml(cursor_collection, gaze_collection, user_id: str):
    """
    Orchestrates fetching the DB data, formatting it for the ML model,
    making the prediction, and returning the result.
    """
    # 1. Load Model & Encoder
    model, le = load_ml_assets()

    # 2. Fetch data from DB using the provided collections
    cursor_data, gaze_data = await fetch_user_data_from_db(
        cursor_collection,
        gaze_collection,
        user_id
    )

    # 3. Handle missing data gracefully
    if not cursor_data:
         raise HTTPException(status_code=404, detail=f"No cursor data found for user: {user_id}")
    if not gaze_data:
         raise HTTPException(status_code=404, detail=f"No gaze/session data found for user: {user_id}")

    # 4. Prepare the feature row exactly as the Random Forest expects it
    # We convert the text preference to binary (1 for VISUAL, 0 for TEXT)
    interaction_pref = gaze_data.get("FirstInteractionPreference", "TEXT").upper()
    is_visual_first = 1 if interaction_pref == "VISUAL" else 0

    # Ensure these keys exactly match the column names in your Pandas DataFrame used for training
    feature_row = {
        "imageCursorRatio": cursor_data.get("imageCursorRatio", 0.0),
        "imageScrollRatio": cursor_data.get("imageScrollRatio", 0.0),
        "ImageGazeRatio": gaze_data.get("ImageGazeRatio", 0.0),
        "FirstInteractionPreference_VISUAL": is_visual_first
    }

    # 5. Convert to Pandas DataFrame for the model
    df = pd.DataFrame([feature_row])

    # 6. Make Prediction
    prediction_array = model.predict(df)

    # 7. Decode the prediction (Convert 0/1 back to 'Verbal'/'Visual')
    predicted_label = le.inverse_transform(prediction_array)[0]

    # 8. (Optional) Extract prediction probabilities
    probabilities = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(df)[0]
        probabilities = {
            cls: float(prob)
            for cls, prob in zip(le.classes_, proba)
        }

    # 9. Return the structured response
    return {
        "userId": user_id,
        "prediction": predicted_label,
        "probabilities": probabilities,
        "featuresUsed": feature_row
    }