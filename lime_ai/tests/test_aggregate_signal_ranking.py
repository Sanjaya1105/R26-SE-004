import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.database import Base
from models.student_lesson_top_signals import StudentLessonTopSignals
from schemas.prediction import AggregateExplanationRequest
from services.prediction_service import (
    _save_top_aggregate_signals,
    _top_aggregate_signals,
    get_cached_student_lesson_analysis,
)


class AggregateSignalRankingTests(unittest.TestCase):
    def test_normalizes_aggregates_and_ranks_unique_positive_features(self):
        signals = _top_aggregate_signals(
            lime_factors=[
                {"rule": "pause_frequency > 5", "weight": 0.5},
                {"rule": "time_on_content <= 10", "weight": -0.4},
                {"rule": "rewatch_segments > 2", "weight": 0.25},
            ],
            shap_values=[
                {"feature": "pause_frequency", "shap_value": 0.8},
                {"feature": "time_on_content", "shap_value": -0.9},
                {"feature": "playback_rate_change", "shap_value": 0.4},
            ],
            limit=3,
        )

        self.assertEqual(
            [item["signal"] for item in signals],
            ["pause_frequency", "playback_rate_change", "rewatch_segments"],
        )
        self.assertEqual(signals[0]["source"], "combined")
        self.assertAlmostEqual(signals[0]["raw_value"], 2.0)
        self.assertAlmostEqual(signals[0]["normalized_strength"], 1.0)
        self.assertAlmostEqual(signals[1]["normalized_strength"], 0.25)
        self.assertAlmostEqual(signals[2]["normalized_strength"], 0.25)
        self.assertTrue(all(item["raw_value"] > 0 for item in signals))
        self.assertTrue(all(item["impact"] == "positive" for item in signals))

    def test_removes_zero_and_negative_values(self):
        signals = _top_aggregate_signals(
            lime_factors=[{"rule": "pause_frequency <= 1", "weight": 0.0}],
            shap_values=[
                {"feature": "pause_frequency", "shap_value": 0.5},
                {"feature": "time_on_content", "shap_value": -0.8},
            ],
            limit=3,
        )

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0]["signal"], "pause_frequency")
        self.assertEqual(signals[0]["normalized_value"], 1.0)

    def test_returns_no_top_signals_when_all_values_are_non_positive(self):
        signals = _top_aggregate_signals(
            lime_factors=[{"rule": "pause_frequency > 5", "weight": -0.2}],
            shap_values=[{"feature": "time_on_content", "shap_value": 0.0}],
        )

        self.assertEqual(signals, [])

    def test_tied_features_are_deterministic_when_input_order_changes(self):
        lime_factors = [
            {"rule": "rewatch_segments > 2", "weight": 0.5},
            {"rule": "pause_frequency > 5", "weight": 0.5},
        ]
        shap_values = [
            {"feature": "time_on_content", "shap_value": 0.4},
            {"feature": "playback_rate_change", "shap_value": 0.4},
        ]

        first = _top_aggregate_signals(lime_factors=lime_factors, shap_values=shap_values)
        second = _top_aggregate_signals(
            lime_factors=list(reversed(lime_factors)),
            shap_values=list(reversed(shap_values)),
        )

        self.assertEqual(first, second)


class AggregateSignalPersistenceTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.payload = AggregateExplanationRequest(
            lesson_id="lesson-7",
            prediction_id=42,
            student_id="student-9",
            predicted_cognitive_load="High",
            predicted_score=4,
            confidence=0.91,
            lime_factors=[],
            shap_values=[],
        )

    def tearDown(self):
        self.db.close()

    def test_saves_top_three_and_updates_same_student_lesson(self):
        initial = [
            {"signal": "pause_frequency", "raw_value": 2.0, "normalized_value": 1.0},
            {"signal": "rewatch_segments", "raw_value": 1.2, "normalized_value": 0.6},
            {"signal": "time_on_content", "raw_value": 0.8, "normalized_value": 0.4},
        ]
        first = _save_top_aggregate_signals(self.db, self.payload, initial)

        self.assertEqual(first.student_id, "student-9")
        self.assertEqual(first.lesson_id, "lesson-7")
        self.assertEqual(first.predicted_cognitive_load, "High")
        self.assertEqual(first.top_1_signal, "pause_frequency")
        self.assertEqual(first.top_3_value, 0.8)

        self.payload.prediction_id = 43
        self.payload.predicted_cognitive_load = "Very High"
        updated = _save_top_aggregate_signals(
            self.db,
            self.payload,
            [{"signal": "idle_duration_video", "raw_value": 1.0, "normalized_value": 1.0}],
        )

        self.assertEqual(updated.id, first.id)
        self.assertEqual(updated.prediction_id, 43)
        self.assertEqual(updated.predicted_cognitive_load, "Very High")
        self.assertEqual(updated.top_1_signal, "idle_duration_video")
        self.assertIsNone(updated.top_2_signal)
        self.assertIsNone(updated.top_3_value)
        self.assertEqual(self.db.query(StudentLessonTopSignals).count(), 1)

    def test_complete_analysis_can_be_loaded_without_regeneration(self):
        self.payload.lime_explanation = {
            "prediction_id": 42,
            "intercept": 2.5,
            "factors": [{"rule": "pause_frequency > 5", "weight": 0.4}],
        }
        self.payload.shap_explanation = {
            "prediction_id": 42,
            "expected_value": 2.1,
            "shap_values": [{"feature": "pause_frequency", "shap_value": 0.7}],
        }
        _save_top_aggregate_signals(
            self.db,
            self.payload,
            [{"signal": "pause_frequency", "raw_value": 2.0, "normalized_value": 1.0}],
            human_explanation="The student paused frequently while working through the lesson.",
            explanation_source="ollama",
            study_technique={"techniques": [{"technique": "Pomodoro"}], "source": "ollama"},
            lecture_support={"strategies": "1. Pause after each concept.", "source": "ollama"},
        )

        result = get_cached_student_lesson_analysis(self.db, "lesson-7", "student-9")

        self.assertTrue(result["data"]["cached"])
        self.assertEqual(result["data"]["lime_explanation"]["intercept"], 2.5)
        self.assertEqual(result["data"]["shap_explanation"]["expected_value"], 2.1)
        self.assertEqual(
            result["data"]["aggregate_explanation"]["study_technique"]["source"],
            "ollama",
        )
        self.assertEqual(
            result["data"]["aggregate_explanation"]["top_signals"][0]["signal"],
            "pause_frequency",
        )

    def test_top_signals_only_is_not_treated_as_complete_cache(self):
        _save_top_aggregate_signals(
            self.db,
            self.payload,
            [{"signal": "pause_frequency", "raw_value": 2.0, "normalized_value": 1.0}],
        )

        result = get_cached_student_lesson_analysis(self.db, "lesson-7", "student-9")

        self.assertIsNone(result["data"])


if __name__ == "__main__":
    unittest.main()
