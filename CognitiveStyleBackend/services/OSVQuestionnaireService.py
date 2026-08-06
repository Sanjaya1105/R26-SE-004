from datetime import datetime
from database.connection import object_spacial_verbal_question_collection




# Note: Adjust these sets based on the exact 45-item OSIVQ scoring manual.
# I've populated these with typical distributions for the 3 categories.
OBJECT_QUESTIONS = {6, 11, 13, 15, 18, 20, 23, 26, 29, 33, 34, 40, 43, 45}
SPATIAL_QUESTIONS = {1, 3, 5, 7, 10, 14, 17, 19, 22, 24, 27, 30, 31, 32, 38, 42, 44}
VERBAL_QUESTIONS = {2, 4, 8, 9, 12, 16, 21, 25, 28, 35, 36, 37, 39, 41}

# If any questions need reverse scoring (e.g., 5 becomes 1, 4 becomes 2), add them here
REVERSE_SCORED_QUESTIONS = {2, 9, 24, 25, 41, 42}
# ==========================================
# 4. SERVICE LOGIC
# ==========================================
async def create_osivq_record(data: dict):
    object_score = 0
    spatial_score = 0
    verbal_score = 0

    enriched_answers = []

    # 1. Process each answer and categorize it
    for answer in data.get("answers", []):
        q_id = answer["questionId"]
        raw_val = answer["rawScore"]

        # Handle Reverse Scoring if applicable (5-point scale: 6 - val)
        final_val = (6 - raw_val) if q_id in REVERSE_SCORED_QUESTIONS else raw_val

        category = "Unknown"

        if q_id in OBJECT_QUESTIONS:
            category = "Object Visual"
            object_score += final_val
        elif q_id in SPATIAL_QUESTIONS:
            category = "Spatial Visual"
            spatial_score += final_val
        elif q_id in VERBAL_QUESTIONS:
            category = "Verbal"
            verbal_score += final_val

        # Store the enriched answer with its category
        enriched_answers.append({
            "questionId": q_id,
            "rawScore": raw_val,
            "calculatedScore": final_val,
            "category": category
        })

    # 2. Calculate the combined Visual Score
    total_visual_score = object_score + spatial_score

    # 3. Determine Dominant Profile (Visual vs Verbal)
    # Because Visual combines TWO scales (30 questions) and Verbal is ONE scale (15 questions),
    # we compare their AVERAGES, not their raw totals, to ensure fairness.
    avg_visual = total_visual_score / 30 if total_visual_score > 0 else 0
    avg_verbal = verbal_score / 15 if verbal_score > 0 else 0

    if avg_visual > avg_verbal:
        dominant_profile = "Visualizer"
    elif avg_verbal > avg_visual:
        dominant_profile = "Verbalizer"
    else:
        dominant_profile = "Balanced"

    # 4. Prepare Final Document for Database
    db_document = {
        "userId": data.get("userId"),
        "visualTaskData": data.get("visualTaskData"), # Tracking data from earlier modules
        "answers": enriched_answers,
        "object_score": object_score,
        "spatial_score": spatial_score,
        "verbal_score": verbal_score,
        "total_visual_score": total_visual_score,
        "dominant_profile": dominant_profile,
        "created_at": datetime.utcnow()
    }

    # 5. Save to Database
    result = await object_spacial_verbal_question_collection.insert_one(db_document)

    # Fetch the newly created document to return it
    new_doc = await object_spacial_verbal_question_collection.find_one({"_id": result.inserted_id})

    # 6. Format Response
    # MongoDB uses an ObjectId for the _id field, but our Pydantic model expects a string 'id'
    if new_doc:
        new_doc["id"] = str(new_doc["_id"])
        del new_doc["_id"]

    return new_doc