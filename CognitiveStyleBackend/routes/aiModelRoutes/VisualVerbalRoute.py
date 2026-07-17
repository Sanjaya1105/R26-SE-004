from fastapi import APIRouter, HTTPException
from services.aiModelServices.VisualVerbalModelService import predict_user_style_ml

# Import your MongoDB collections directly
from database.connection import visual_verbal_cursor_collection, visual_verbal_gaze_collection

router = APIRouter()

@router.get("/predict/{user_id}")
async def get_user_prediction(user_id: str):
    try:
        # Pass the two imported collection objects directly to the service
        result = await predict_user_style_ml(
            cursor_collection=visual_verbal_cursor_collection,
            gaze_collection=visual_verbal_gaze_collection,
            user_id=user_id
        )
        return {"status": "success", "data": result}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction Failed: {str(e)}")