import json
import unittest
from unittest.mock import patch

from services.gemini_client import GeminiServiceError
from services.student_guidance_service import generate_student_guidance


class StudentGuidanceServiceTests(unittest.TestCase):
    @patch("services.student_guidance_service.generate_gemini_text")
    def test_generates_all_guidance_with_one_gemini_call(self, generate_text):
        generate_text.return_value = json.dumps(
            {
                "teacher_explanation": (
                    "This student has High cognitive load because frequent pauses and repeated viewing "
                    "suggest that several ideas required extra processing. Longer inactive periods also "
                    "indicate that maintaining attention was difficult, so understanding the lesson likely "
                    "required more mental effort than usual."
                ),
                "study_techniques": ["Short Notes", "Concept Map"],
                "lecture_recommendations": [
                    "Pause briefly after each key idea so you can process it.",
                    "Write down unfamiliar terms to review after the lecture.",
                    "Break difficult sections into smaller steps before continuing.",
                    "Check your understanding by summarizing each section in your own words.",
                ],
            }
        )

        result = generate_student_guidance(
            student_id="student-9",
            lesson_id="lesson-7",
            predicted_label="High",
            signals=["frequent pauses"],
            human_signals=["behavior associated with increased cognitive load: frequent pauses"],
        )

        generate_text.assert_called_once()
        self.assertEqual(
            generate_text.call_args.kwargs["response_mime_type"],
            "application/json",
        )
        self.assertEqual(result["study_technique"]["source"], "gemini")
        self.assertEqual(len(result["study_technique"]["techniques"]), 2)
        self.assertEqual(result["lecture_support"]["strategies"].count("\n"), 3)
        self.assertTrue(result["human_explanation"].startswith("This student has High"))

    @patch("services.student_guidance_service.generate_gemini_text")
    def test_rejects_malformed_json(self, generate_text):
        generate_text.return_value = "not json"

        with self.assertRaisesRegex(GeminiServiceError, "malformed"):
            generate_student_guidance(
                student_id="student-9",
                lesson_id="lesson-7",
                predicted_label="High",
                signals=[],
                human_signals=[],
            )


if __name__ == "__main__":
    unittest.main()
