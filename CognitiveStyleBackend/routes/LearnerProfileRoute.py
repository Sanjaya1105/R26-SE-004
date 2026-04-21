from fastapi import APIRouter, HTTPException
from services.LearnerProfileService import generate_learner_profile

router = APIRouter(prefix="/learner-profile", tags=["Learner Profile"])

@router.get("/{user_id}")
async def get_learner_profile(user_id: str):
    result = await generate_learner_profile(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="No answers found for this user")
    return result