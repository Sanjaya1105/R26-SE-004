import unittest

from services.human_explanation_service import build_explanation_prompt


class HumanExplanationPromptTests(unittest.TestCase):
    def test_prompt_uses_top_three_and_translates_raw_feature_names(self):
        top_features = [
            {"feature": "ImageGazeRatio", "direction": "positive"},
            {"feature": "imageCursorRatio", "direction": "positive"},
            {"feature": "imageScrollRatio", "direction": "negative"},
        ]

        prompt = build_explanation_prompt(
            student_id="1002",
            lesson_id="2001",
            cognitive_style="Visual",
            confidence=0.71,
            top_features=top_features,
        )

        self.assertIn("1. how much viewing time", prompt)
        self.assertIn("2. how strongly cursor activity", prompt)
        self.assertIn("3. how strongly scrolling activity", prompt)
        self.assertIn("supports the Visual result", prompt)
        self.assertIn("slightly opposes the Visual result", prompt)
        self.assertNotIn("ImageGazeRatio", prompt)


if __name__ == "__main__":
    unittest.main()
