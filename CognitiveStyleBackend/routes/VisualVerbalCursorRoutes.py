from fastapi import APIRouter
from models.VisualVerbalCursorModel import SimpleEventCreate, SimpleSessionComplete
from services.VisualVerbalCursorService import (
    create_simple_event,
    get_simple_events,
    get_simple_events_by_session,
    complete_simple_session,
    get_simple_sessions,
)

router = APIRouter(prefix="/simple", tags=["Simple Metrics"])


@router.post("/cursor-summary")
async def add_simple_event(event: SimpleEventCreate):
    return await create_simple_event(event.model_dump())


@router.get("/events")
async def list_simple_events():
    return await get_simple_events()


@router.get("/events/{session_id}")
async def list_simple_events_by_session(session_id: str):
    return await get_simple_events_by_session(session_id)


@router.post("/complete")
async def complete_session(session: SimpleSessionComplete):
    return await complete_simple_session(session.model_dump())


@router.get("/sessions")
async def list_simple_sessions():
    return await get_simple_sessions()