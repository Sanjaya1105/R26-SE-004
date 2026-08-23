from typing import Any

from services.gemini_client import GeminiServiceError, generate_gemini_text


SYSTEM_PROMPT = (
    "You are an expert learning advisor selecting practical, evidence-informed study techniques. "
    "Match the technique to the student's cognitive-load level and observed learning behaviors. "
    "Do not invent information about the student."
)
USER_PROMPT_TEMPLATE = (
    "Predicted cognitive load: {predicted_label}\n"
    "Behavioral signals:\n{signals_text}\n\n"
    "Select the one or two most suitable techniques this student can use to manage the observed "
    "behaviors and cognitive-load level. Prefer a technique that reduces unnecessary mental effort "
    "when load is high and one that improves organization or recall when appropriate. "
    "Choose only from this exact list: Mind Map, Short Notes, "
    "Concept Map, Flowchart, Cornell Notes. Return only the technique names, one per line."
)

TECHNIQUES: dict[str, dict[str, str]] = {
    "mind map": {
        "title": "Mind Map",
        "emoji": "\U0001f9e0",
        "link": "https://mindmeister.com/app/map/new",
        "link_text": "Create Mind Map",
    },
    "short notes": {
        "title": "Short Notes",
        "emoji": "\U0001f4dd",
        "link": "https://www.notion.so/",
        "link_text": "Start Taking Notes",
    },
    "concept map": {
        "title": "Concept Map",
        "emoji": "\U0001f517",
        "link": "https://app.creately.com/",
        "link_text": "Create Concept Map",
    },
    "flowchart": {
        "title": "Flowchart",
        "emoji": "\U0001f4ca",
        "link": "https://www.lucidchart.com/",
        "link_text": "Create Flowchart",
    },
    "cornell notes": {
        "title": "Cornell Notes",
        "emoji": "\U0001f4c4",
        "link": "https://www.evernote.com/",
        "link_text": "Start Cornell Notes",
    },
}


def generate_study_techniques(*, predicted_label: str, signals: list[str]) -> dict[str, Any]:
    prompt = USER_PROMPT_TEMPLATE.format(
        predicted_label=predicted_label,
        signals_text="\n".join(f"- {signal}" for signal in signals) or "- none detected",
    )
    response = generate_gemini_text(SYSTEM_PROMPT, prompt)

    selected: list[dict[str, str]] = []
    for line in response.splitlines():
        normalized = line.strip().lower()
        for name, details in TECHNIQUES.items():
            if name in normalized and not any(item["technique"] == name for item in selected):
                selected.append({"technique": name, **details})
                break

    if not selected:
        raise GeminiServiceError("Gemini did not return a recognized study technique.")

    return {"techniques": selected[:2], "source": "gemini"}
