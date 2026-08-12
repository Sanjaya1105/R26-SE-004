import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.database import Base
from models.analysis import CognitiveStyleAnalysis
from routers.api import analyse_student_style


class CachedCognitiveStyleAnalysisTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()

    def tearDown(self):
        self.db.close()

    def test_completed_student_lesson_returns_saved_outputs(self):
        saved = CognitiveStyleAnalysis(
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
            human_explanation="The learner benefits from visual presentation.",
            explanation_model="test-model",
        )
        self.db.add(saved)
        self.db.commit()

        response = analyse_student_style("lesson-1", "student-1", db=self.db)

        self.assertTrue(response["data"]["cached"])
        self.assertEqual(response["data"]["cognitive_style"], "Visual")
        self.assertEqual(response["data"]["lime_output"], saved.lime_output)
        self.assertEqual(response["data"]["shap_output"], saved.shap_output)
        self.assertEqual(response["data"]["human_explanation"], saved.human_explanation)


if __name__ == "__main__":
    unittest.main()
