# LIME AI Service

This service receives cognitive-load feature payloads, calls the model API, and automatically saves the prediction to MySQL.

## What it stores

- `student_id`
- `lesson_id`
- `session_id`
- `minute_index`
- the six model feature values: `pause_frequency`, `navigation_count_video`,
  `rewatch_segments`, `playback_rate_change`, `idle_duration_video`, and
  `time_on_content`
- predicted cognitive load label
- predicted score
- confidence
- timestamp

## Database

The service is configured to use a MySQL database named `lime-data` and a table named `cognitive-load`.

## Run

1. Install Ollama and download the Gemma 3 12B model:

```bash
ollama pull gemma3:12b
```

2. Copy `.env.example` to `.env`, then set the model API and Ollama URLs if
   they differ from the defaults. `OLLAMA_MODEL` defaults to `gemma3:12b`.

3. Make sure Ollama is running:

```bash
ollama serve
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. Start the service:

```bash
uvicorn main:app --host 0.0.0.0 --port 8110
```

On startup, the service creates the `lime-data` database if it does not exist and then creates the `cognitive-load` table automatically.

Successful aggregate analysis also creates or updates one
`student-lesson-top-signals` row per student and lesson. The row stores the
three strongest combined LIME/SHAP signal names, their raw values, normalized
values, and the summary prediction ID that produced them.

If you prefer manual setup, you can still run [db/init.sql](db/init.sql).

## API

- `POST /api/v1/predict` - predicts cognitive load and saves the record automatically
- `GET /api/v1/predictions` - returns saved rows
- `GET /api/v1/health` - health check
- `POST /api/v1/aggregate-explanation` - uses Gemma 3 12B through Ollama to
  generate a human explanation, lecture support, and personalized study-technique suggestions
