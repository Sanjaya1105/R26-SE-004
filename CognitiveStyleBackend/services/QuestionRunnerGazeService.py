# services/QuestionRunnerGazeService.py

from database.connection import (
    question_runner_gaze_event_collection,
    question_runner_gaze_session_collection,
)


async def create_question_runner_gaze_event(event_data: dict):
    result = await question_runner_gaze_event_collection.insert_one(event_data)
    new_event = await question_runner_gaze_event_collection.find_one(
        {"_id": result.inserted_id}
    )

    if new_event:
        new_event["_id"] = str(new_event["_id"])

    return new_event


async def get_question_runner_gaze_events():
    events = []
    async for event in question_runner_gaze_event_collection.find():
        event["_id"] = str(event["_id"])
        events.append(event)
    return events


async def get_question_runner_gaze_events_by_session(session_id: str):
    events = []
    async for event in question_runner_gaze_event_collection.find(
        {"sessionId": session_id}
    ):
        event["_id"] = str(event["_id"])
        events.append(event)
    return events


async def complete_question_runner_gaze_session(session_data: dict):
    session_id = session_data["sessionId"]

    events = []
    async for event in question_runner_gaze_event_collection.find(
        {"sessionId": session_id}
    ):
        events.append(event)

    if not events:
        return {"error": "No QuestionRunner gaze events found for this session"}

    total_windows = len(events)

    def avg(field: str):
        return sum(event.get(field, 0) for event in events) / total_windows if total_windows else 0

    session_summary = {
        "sessionId": session_id,
        "userId": session_data.get("userId"),
        "moduleName": session_data.get("moduleName", "QuestionRunner"),
        "totalWindows": total_windows,

        "facePresentRatio": round(avg("facePresentRatio"), 4),
        "centerRatio": round(avg("centerRatio"), 4),
        "eyesOpenRatio": round(avg("eyesOpenRatio"), 4),

        "yawMean": round(avg("yawMean"), 4),
        "yawStd": round(avg("yawStd"), 4),

        "pitchMean": round(avg("pitchMean"), 4),
        "pitchStd": round(avg("pitchStd"), 4),

        "eyeOffsetXMean": round(avg("eyeOffsetXMean"), 4),
        "eyeOffsetXStd": round(avg("eyeOffsetXStd"), 4),

        "eyeOffsetYMean": round(avg("eyeOffsetYMean"), 4),
        "eyeOffsetYStd": round(avg("eyeOffsetYStd"), 4),

        "avgEyeOpennessMean": round(avg("avgEyeOpennessMean"), 4),
        "avgEyeOpennessStd": round(avg("avgEyeOpennessStd"), 4),

        "gazeConfidenceMean": round(avg("gazeConfidenceMean"), 4),

        "eyeMovementMagnitudeMean": round(avg("eyeMovementMagnitudeMean"), 4),
        "eyeMovementMagnitudeStd": round(avg("eyeMovementMagnitudeStd"), 4),

        "blinkCount": sum(event.get("blinkCount", 0) for event in events),
        "blinkRatePerMin": round(avg("blinkRatePerMin"), 4),
        "directionChangeCount": sum(event.get("directionChangeCount", 0) for event in events),
        "attentionScore": round(avg("attentionScore"), 4),
    }

    result = await question_runner_gaze_session_collection.insert_one(session_summary)
    saved_summary = await question_runner_gaze_session_collection.find_one(
        {"_id": result.inserted_id}
    )

    if saved_summary:
        saved_summary["_id"] = str(saved_summary["_id"])

    return saved_summary


async def get_question_runner_gaze_sessions():
    sessions = []
    async for session in question_runner_gaze_session_collection.find():
        session["_id"] = str(session["_id"])
        sessions.append(session)
    return sessions


async def aggregate_question_runner_gaze(session_id: str):
    events = []

    async for event in question_runner_gaze_event_collection.find(
        {"sessionId": session_id}
    ):
        events.append(event)

    if not events:
        return None

    total = len(events)

    def avg(field: str):
        return sum(e.get(field, 0) for e in events) / total if total else 0

    return {
        "facePresentRatio": round(avg("facePresentRatio"), 4),
        "centerRatio": round(avg("centerRatio"), 4),
        "eyesOpenRatio": round(avg("eyesOpenRatio"), 4),

        "yawMean": round(avg("yawMean"), 4),
        "yawStd": round(avg("yawStd"), 4),

        "pitchMean": round(avg("pitchMean"), 4),
        "pitchStd": round(avg("pitchStd"), 4),

        "eyeOffsetXMean": round(avg("eyeOffsetXMean"), 4),
        "eyeOffsetXStd": round(avg("eyeOffsetXStd"), 4),

        "eyeOffsetYMean": round(avg("eyeOffsetYMean"), 4),
        "eyeOffsetYStd": round(avg("eyeOffsetYStd"), 4),

        "avgEyeOpennessMean": round(avg("avgEyeOpennessMean"), 4),
        "avgEyeOpennessStd": round(avg("avgEyeOpennessStd"), 4),

        "gazeConfidenceMean": round(avg("gazeConfidenceMean"), 4),
        "eyeMovementMagnitudeMean": round(avg("eyeMovementMagnitudeMean"), 4),
        "eyeMovementMagnitudeStd": round(avg("eyeMovementMagnitudeStd"), 4),

        "blinkCount": sum(e.get("blinkCount", 0) for e in events),
        "blinkRatePerMin": round(avg("blinkRatePerMin"), 4),
        "directionChangeCount": sum(e.get("directionChangeCount", 0) for e in events),
        "attentionScore": round(avg("attentionScore"), 4),
    }