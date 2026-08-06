from fastapi import APIRouter, HTTPException
from models.OSVQuestionnaireModel import OSIVQResponse,OSIVQCreate
from services.OSVQuestionnaireService import create_osivq_record

# ==========================================
# 3. ROUTER ENDPOINT
# ==========================================

router = APIRouter(prefix="/osv-questions", tags=["Assist Questions"])

@router.post("/create", response_model=OSIVQResponse)
async def submit_osivq_questions(payload: OSIVQCreate):
    try:
        # Assuming you have a MongoDB collection named `osivq_collection`
        return await create_osivq_record(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))