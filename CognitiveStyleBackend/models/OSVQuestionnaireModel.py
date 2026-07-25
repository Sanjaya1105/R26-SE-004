from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
# ==========================================
# 2. PYDANTIC MODELS
# ==========================================
class OSIVQAnswer(BaseModel):
    questionId: int
    rawScore: int = Field(..., ge=1, le=5)

class OSIVQCreate(BaseModel):
    userId: str
    answers: List[OSIVQAnswer]
    visualTaskData: Optional[Dict[str, Any]] = None # Captures the payload passed from Module 2

class OSIVQResponse(BaseModel):
    id: str
    userId: str
    answers: List[Dict[str, Any]]  # Will contain the score + category
    object_score: int
    spatial_score: int
    verbal_score: int
    total_visual_score: int
    dominant_profile: str
    created_at: datetime