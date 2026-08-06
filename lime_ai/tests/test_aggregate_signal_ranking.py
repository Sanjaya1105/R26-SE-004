import unittest

from services.prediction_service import _top_aggregate_signals


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


if __name__ == "__main__":
    unittest.main()
