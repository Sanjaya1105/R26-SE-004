# LIME AI Service

This service receives cognitive-load feature payloads, calls the model API, and automatically saves the prediction to MySQL.

## What it stores

- `student_id`
- `lesson_id`
- `session_id`
- `minute_index`
- all input feature values
- predicted cognitive load label
- predicted score
- confidence
- timestamp

## Database

The service is configured to use a MySQL database named `lime-data` and a table named `cognitive-load`.

## Run

1. Copy `.env.example` to `.env` and set the model API URL.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start the service:

```bash
uvicorn main:app --host 0.0.0.0 --port 8010
```

On startup, the service creates the `lime-data` database if it does not exist and then creates the `cognitive-load` table automatically.

If you prefer manual setup, you can still run [db/init.sql](db/init.sql).

## API

- `POST /api/v1/predict` - predicts cognitive load and saves the record automatically
- `GET /api/v1/predictions` - returns saved rows
- `GET /api/v1/health` - health check
