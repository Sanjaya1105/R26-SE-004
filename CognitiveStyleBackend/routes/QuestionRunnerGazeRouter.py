# routes/QuestionRunnerGazeRouter.py

from fastapi import APIRouter
from models.QuestionRunnerGazeModel import (
    QuestionRunnerGazeEventCreate,
    QuestionRunnerGazeSessionComplete,
)
from services.QuestionRunnerGazeService import (
    create_question_runner_gaze_event,
    get_question_runner_gaze_events,
    get_question_runner_gaze_events_by_session,
    complete_question_runner_gaze_session,
    get_question_runner_gaze_sessions,
)

router = APIRouter(prefix="/question-runner", tags=["QuestionRunner Gaze"])


@router.post("/gaze")
async def add_question_runner_gaze_event(event: QuestionRunnerGazeEventCreate):
    return await create_question_runner_gaze_event(event.model_dump())


@router.get("/gaze")
async def list_question_runner_gaze_events():
    return await get_question_runner_gaze_events()


@router.get("/gaze/{session_id}")
async def list_question_runner_gaze_events_by_session(session_id: str):
    return await get_question_runner_gaze_events_by_session(session_id)


@router.post("/gaze/complete")
async def complete_question_runner_gaze(session: QuestionRunnerGazeSessionComplete):
    return await complete_question_runner_gaze_session(session.model_dump())


@router.get("/gaze/sessions")
async def list_question_runner_gaze_sessions():
    return await get_question_runner_gaze_sessions()