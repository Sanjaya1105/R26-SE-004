import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.database import Base
from models.analysis import CognitiveStyleAnalysis
from routers.api import analyse_student_style
from services.human_explanation_service import EXPLANATION_PROMPT_VERSION


class CachedCognitiveStyleAnalysisTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.saved = CognitiveStyleAnalysis(
            lesson_id="lesson-1",
            student_id="student-1",
            session_id="session-1",
            analysis_status="completed",
            cognitive_style="Visual",
            confidence=0.82,
            feature_values={"ImageGazeRatio": 0.8},
            lime_output=[{"feature": "ImageGazeRatio", "weight": 0.5}],
            shap_output=[{"feature": "ImageGazeRatio", "shap_value": 0.4}],
            top_features=[{"feature": "ImageGazeRatio", "importance": 1.0}],
            explanation_prompt=f"Prompt version: {EXPLANATION_PROMPT_VERSION}",
            human_explanation="The learner benefits from visual presentation.",
            explanation_model="test-model",
        )
        self.db.add(self.saved)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_completed_student_lesson_returns_saved_outputs(self):
        saved = self.saved

        response = analyse_student_style("lesson-1", "student-1", db=self.db)

        self.assertTrue(response["data"]["cached"])
        self.assertEqual(response["data"]["cognitive_style"], "Visual")
        self.assertEqual(response["data"]["lime_output"], saved.lime_output)
        self.assertEqual(response["data"]["shap_output"], saved.shap_output)
        self.assertEqual(response["data"]["human_explanation"], saved.human_explanation)
        self.assertFalse(response["data"]["explanation_refreshed"])

    @patch("routers.api.generate_human_explanation")
    def test_refreshes_only_old_human_explanation_without_rerunning_analysis(self, generate):
        saved = self.saved
        saved.explanation_prompt = "old prompt"
        self.db.commit()
        generate.return_value = (
            f"Prompt version: {EXPLANATION_PROMPT_VERSION}",
            "This student shows a predominantly visual cognitive style because the observed lesson "
            "behaviour suggests visual material supported understanding.",
            "gemini-test",
        )

        response = analyse_student_style("lesson-1", "student-1", db=self.db)

        generate.assert_called_once()
        self.assertTrue(response["data"]["cached"])
        self.assertTrue(response["data"]["explanation_refreshed"])
        self.assertEqual(response["data"]["explanation_model"], "gemini-test")


if __name__ == "__main__":
    unittest.main()
