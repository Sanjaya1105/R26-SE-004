from fastapi import FastAPI
from routes.UserRoutes import router as user_router
from fastapi.middleware.cors import CORSMiddleware
from routes.VisualVerbalCursorRoutes import router as simple_router
from routes.VisualVerbalGazeRoutes import router as gaze_router
from routes.VisualVerbalAnalysisRoutes import router as visual_verbal_analysis_router
from routes.QuestionRunnerGazeRouter import router as question_runner_gaze_router
from routes.QuestionRunnerCursorRouter import router as question_runner_cursor_router
from routes.QuestionRunnerCognitiveStyleRouter import router as question_runner_cognitivestyle_router
from routes.QuestionRunnerAnswerRouter import router as question_runner_answer_router
from routes.QuestionRunnerMLRouter import router as question_runner_ml_router
from routes.VisualVerbalMLRouter import router as visual_verbal_ml_router
from routes.AssistQuestionRoute import router as assist_question_runner_gaze_router
from routes.LearnerProfileRoute import router as learner_profile_router
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)

app.include_router(simple_router)

app.include_router(gaze_router)

app.include_router(visual_verbal_analysis_router)

app.include_router(question_runner_gaze_router)

app.include_router(question_runner_cursor_router)

app.include_router(question_runner_cognitivestyle_router)

app.include_router(question_runner_answer_router)

app.include_router(question_runner_ml_router)

app.include_router(visual_verbal_ml_router)

app.include_router(assist_question_runner_gaze_router)

app.include_router(learner_profile_router)