from datetime import datetime
from bson import ObjectId
from database.connection import assist_question_collection
import numpy as np
from sklearn.cluster import KMeans

# Map the question numbers to their respective scales based on the research paper[cite: 1]
DEEP_QUESTIONS = {2, 6, 10, 12, 15, 17}
STRATEGIC_QUESTIONS = {3, 5, 7, 9, 11, 13}
SURFACE_QUESTIONS = {1, 4, 8, 14, 16, 18}


async def create_assist_question(data: dict):
    # 1. Calculate the Raw Scores
    deep_score = 0
    strategic_score = 0
    surface_score = 0

    for answer in data.get("answers", []):
        q_num = answer["questionNumber"]
        val = answer["value"]

        if q_num in DEEP_QUESTIONS:
            deep_score += val
        elif q_num in STRATEGIC_QUESTIONS:
            strategic_score += val
        elif q_num in SURFACE_QUESTIONS:
            surface_score += val

    data["deep_score"] = deep_score
    data["strategic_score"] = strategic_score
    data["surface_score"] = surface_score

    # 2. Determine Dominant Profile (Fallback/Direct Categorization)
    scores = {
        "Deep Approach": deep_score,
        "Strategic Approach": strategic_score,
        "Surface Approach": surface_score
    }
    data["dominant_profile"] = max(scores, key=scores.get)

    # 3. Apply K-Means Clustering on the fly
    # Fetch historical score data to build the mathematical space
    cursor = assist_question_collection.find(
        {},
        {"deep_score": 1, "strategic_score": 1, "surface_score": 1}
    )
    historical_docs = await cursor.to_list(length=None)

    cluster_group = -1  # Default value if there is not enough historical data

    # We need at least 3 total data points to confidently form 3 clusters
    if len(historical_docs) >= 2:
        data_points = []
        for doc in historical_docs:
            if "deep_score" in doc:
                data_points.append([
                    doc["deep_score"],
                    doc["strategic_score"],
                    doc["surface_score"]
                ])

        # Append the new user's scores to the dataset
        data_points.append([deep_score, strategic_score, surface_score])
        X = np.array(data_points)

        # Form up to 3 clusters
        num_clusters = min(3, len(X))

        kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
        kmeans.fit(X)

        # The algorithm tags every data point; we only need the label of the newest one (the last item)
        cluster_group = int(kmeans.labels_[-1])

    data["cluster_group"] = cluster_group
    data["created_at"] = datetime.utcnow()

    # 4. Save to Database
    result = await assist_question_collection.insert_one(data)

    # Fetch and format the newly created document for the API response
    new_doc = await assist_question_collection.find_one({"_id": result.inserted_id})

    if new_doc:
        new_doc["id"] = str(new_doc["_id"])
        del new_doc["_id"]

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