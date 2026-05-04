const { hfChatCompletion } = require("./hfChat");
const { parseJsonFromLlm } = require("../lib/parseJsonFromLlm");

const VALID_SUGGESTED = new Set([
  "labeled_diagram",
  "flowchart",
  "timeline",
  "chart",
  "comparison_table",
  "illustration",
]);

/**
 * Never return a half-parsed object — downstream code expects these fields to exist.
 */
function normalizeLessonAnalysis(parsed, { lessonText, language }) {
  const lesson = String(lessonText || "").trim();
  const firstLine =
    lesson.split(/\n/).find((l) => String(l).trim()) || lesson || "Lesson topic";
  const topic =
    String(parsed.main_topic || "").trim() ||
    String(firstLine).slice(0, 160).trim();

  let keyConcepts = Array.isArray(parsed.key_concepts)
    ? parsed.key_concepts.map((c) => String(c).trim()).filter(Boolean)
    : [];
  if (keyConcepts.length === 0) {
    keyConcepts = [topic.slice(0, 100)];
  }

  const suggested = String(parsed.suggested_visual_type || "").trim().toLowerCase();
  const suggested_visual_type = VALID_SUGGESTED.has(suggested)
    ? suggested
    : "illustration";

  return {
    main_topic: topic || "Lesson topic",
    key_concepts: keyConcepts.slice(0, 8),
    concept_relationships: Array.isArray(parsed.concept_relationships)
      ? parsed.concept_relationships
      : [],
    suggested_visual_type,
    labels_if_needed: Array.isArray(parsed.labels_if_needed)
      ? parsed.labels_if_needed
      : [],
    alt_text:
      String(parsed.alt_text || "").trim() ||
      `Educational visual related to ${topic}, suitable for learners using ${language}.`,
    analysis_notes: Array.isArray(parsed.analysis_notes)
      ? parsed.analysis_notes
      : [],
  };
}

/**
 * Analyzes lesson text and returns structured pedagogy-oriented signals for visual design.
 */
async function analyzeLesson(payload) {
  const lessonText = String(payload.lessonText || "").trim();
  const subject = String(payload.subject || "").trim();
  const gradeLevel = String(payload.gradeLevel || "").trim();
  const studentAge = String(payload.studentAge || "").trim();
  const learningObjective = String(payload.learningObjective || "").trim();
  const language = String(payload.language || "English").trim();

  if (!lessonText) {
    throw new Error("Lesson text is required.");
  }

  const system = `You are an expert instructional designer. Analyze lesson content for visual learning aids.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "main_topic": string,
  "key_concepts": string[],
  "concept_relationships": [{"from": string, "to": string, "relation": string}],
  "suggested_visual_type": "labeled_diagram"|"flowchart"|"timeline"|"chart"|"comparison_table"|"illustration",
  "labels_if_needed": [{"text": string, "target": string, "position_hint": string}],
  "alt_text": string,
  "analysis_notes": string[]
}
Rules:
- key_concepts: 3–8 short phrases.
- concept_relationships: optional; empty array if none.
- suggested_visual_type: your best single choice for this lesson (not "auto").
- labels_if_needed: only if a labeled diagram would help; otherwise [].
- alt_text: one concise sentence suitable for screen readers.`;

  const user = [
    `Language for learner-facing strings: ${language}.`,
    subject && `Subject: ${subject}.`,
    gradeLevel && `Grade level: ${gradeLevel}.`,
    studentAge && `Typical student age: ${studentAge}.`,
    learningObjective && `Learning objective: ${learningObjective}.`,
    "",
    "Lesson / extracted content:",
    lessonText,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 1200, temperature: 0.15 }
  );

  const raw = parseJsonFromLlm(text);
  return normalizeLessonAnalysis(raw, { lessonText, language });
}

module.exports = { analyzeLesson };
