from services.ollama_client import generate_ollama_text


FEATURE_DESCRIPTIONS = {
    "imageCursorRatio": "how strongly cursor activity was concentrated on images and visual content",
    "imageScrollRatio": "how strongly scrolling activity was concentrated on images and visual content",
    "ImageGazeRatio": "how much viewing time was directed toward images and visual content",
    "FirstInteractionPreference_VISUAL": "whether the learner interacted with visual content before text",
}

SYSTEM_PROMPT = (
    "You are an educational analytics assistant explaining a learner's Visual or Verbal cognitive "
    "style to a teacher. Write accurate, cautious, plain-language prose based only on the supplied "
    "observations. Do not mention LIME, SHAP, algorithms, models, features, signals, weights, "
    "importance scores, formulas, IDs, or raw field names. Do not diagnose the learner and do not "
    "give recommendations."
)


def build_explanation_prompt(
    *, student_id: str, lesson_id: str, cognitive_style: str, confidence: float, top_features: list[dict]
) -> str:
    observations = []
    for rank, feature in enumerate(top_features, start=1):
        description = FEATURE_DESCRIPTIONS.get(feature["feature"], feature["feature"])
        effect = (
            f"supports the {cognitive_style} result"
            if feature.get("direction") == "positive"
            else f"slightly opposes the {cognitive_style} result"
            if feature.get("direction") == "negative"
            else "has no clear directional effect"
        )
        observations.append(f"{rank}. {description}; this observation {effect}.")

    return (
        "Write one coherent paragraph of 55-90 words for a teacher.\n"
        f"Student ID (context only; do not repeat): {student_id}\n"
        f"Lesson ID (context only; do not repeat): {lesson_id}\n"
        f"Predicted cognitive style: {cognitive_style}\n"
        f"Prediction confidence: {confidence:.4f}\n"
        "Most influential observed behaviors:\n"
        + "\n".join(observations)
        + f"\nStart exactly with: This student shows a predominantly {cognitive_style.lower()} cognitive style because\n"
        "Explain how the observations collectively support the result. Do not include numerical values."
    )


def generate_human_explanation(
    *, student_id: str, lesson_id: str, cognitive_style: str, confidence: float, top_features: list[dict]
) -> tuple[str, str, str]:
    prompt = build_explanation_prompt(
        student_id=student_id,
        lesson_id=lesson_id,
        cognitive_style=cognitive_style,
        confidence=confidence,
        top_features=top_features,
    )
    explanation, model = generate_ollama_text(SYSTEM_PROMPT, prompt)
    return prompt, explanation, model
