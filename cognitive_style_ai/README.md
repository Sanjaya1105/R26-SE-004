# Cognitive Style Explainability Service

This FastAPI service automatically synchronizes model-ready visual/verbal inputs from CognitiveStyleBackend's MongoDB into MySQL. When Analyse Style is requested, it predicts the cognitive style from the saved input, runs LIME and SHAP concurrently, normalizes and combines their contributions, and updates the same row with the prediction and top three features.

The MongoDB `userId` becomes both `student_id` and `session_id`. CognitiveStyleBackend does not store a lesson ID, so `lesson_id` remains `NULL` until a lesson is selected for analysis.

## Setup

1. Start MongoDB and MySQL.
2. Copy `.env.example` to `.env` and update database credentials if needed.
3. Start the unchanged `CognitiveStyleBackend` on port `8003`.
4. Install this service's dependencies and start it on port `8112`:

   ```powershell
   python -m pip install -r requirements.txt
   python -m uvicorn main:app --host 127.0.0.1 --port 8112 --reload
   ```

5. Set `COGNITIVE_STYLE_AI_URL=http://localhost:8112` in `api-gateway/.env` and start the gateway.

The service creates the `cognitive-style-explanations` database and `cognitive-style-analysis` table automatically. The equivalent SQL is in `db/init.sql`.

## Data lifecycle

1. CognitiveStyleBackend saves cursor and gaze summaries to MongoDB.
2. The background synchronizer checks MongoDB every two seconds and creates or refreshes a pending MySQL row containing the four model inputs.
3. `POST .../analyse` finds that student's latest pending row and assigns the selected lesson.
4. The saved values are passed to the Visual/Verbal model.
5. The top three are converted into a teacher-facing prompt and sent to the configured Gemini model.
6. Prediction, confidence, LIME output, SHAP output, top three, prompt, and human-readable explanation are written to that same row with status `completed`.

A completed row is never overwritten. New MongoDB source documents produce a new pending row.

If Gemini is unavailable, the request returns HTTP 503 and the row remains `pending`, allowing the teacher to retry without losing the synchronized model input.

The default Gemini model is `gemini-3.5-flash-lite`. The exact model that generated each explanation is stored in `explanation_model`.

## API

- `POST /api/v1/lessons/{lesson_id}/students/{student_id}/analyse`
- `GET /api/v1/lessons/{lesson_id}/students/{student_id}/latest`
- `GET /api/v1/health`

Optional analysis query parameters are `lime_samples` (default `200`) and `shap_samples` (default `100`).

The model is `CognitiveStyleBackend/aiModel2/cognitive_style_rf_model.pkl`, with its `label_encoder.pkl`. It predicts `Visual` or `Verbal` from `imageCursorRatio`, `imageScrollRatio`, `ImageGazeRatio`, and `FirstInteractionPreference_VISUAL`. The new service reads these files without modifying CognitiveStyleBackend. Set `COGNITIVE_STYLE_MODEL_PATH` and `COGNITIVE_STYLE_LABEL_ENCODER_PATH` to override their locations.
