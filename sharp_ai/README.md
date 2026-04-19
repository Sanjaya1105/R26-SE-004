# SHAP AI Service

This service generates SHAP explanations for saved cognitive-load predictions.

## Endpoints
- `GET /api/v1/health`
- `GET /api/v1/lessons`
- `GET /api/v1/lessons/{lesson_id}/students`
- `GET /api/v1/lessons/{lesson_id}/predictions`
- `GET /api/v1/lessons/{lesson_id}/predictions/{prediction_id}/shap`

## Environment
Use the same prediction database as `lime_ai` by default:
- `DB_NAME=lime-data`
- `MODEL_API_URL=http://127.0.0.1:8021`
