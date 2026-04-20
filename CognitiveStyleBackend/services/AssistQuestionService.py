from datetime import datetime
from bson import ObjectId
from database.connection import assist_question_collection


async def create_assist_question(data: dict):
    data["created_at"] = datetime.utcnow()

    result = await assist_question_collection.insert_one(data)
    new_doc = await assist_question_collection.find_one({"_id": result.inserted_id})

    if new_doc:
        new_doc["_id"] = str(new_doc["_id"])

    return new_doc


async def get_all_assist_questions():
    responses = []
    async for doc in assist_question_collection.find():
        doc["_id"] = str(doc["_id"])
        responses.append(doc)
    return responses


async def get_assist_questions_by_user(user_id: str):
    responses = []
    async for doc in assist_question_collection.find({"user_id": user_id}):
        doc["_id"] = str(doc["_id"])
        responses.append(doc)
    return responses


async def get_single_response(response_id: str):
    doc = await assist_question_collection.find_one({"_id": ObjectId(response_id)})
    if not doc:
        return None

    doc["_id"] = str(doc["_id"])
    return doc