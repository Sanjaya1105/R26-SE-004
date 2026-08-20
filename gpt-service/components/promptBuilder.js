/**
 * Builds the pedagogical prompt template from subsection extracted materials
 * and learner profile fields supplied by the client.
 */

const COGNITIVE_STYLES = new Set([
  "Visual",
  "Auditory",
  "Read/Write",
  "Kinesthetic",
]);

const LOAD_LEVELS = new Set([
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
]);

const FRUSTRATION_LEVELS = new Set(["Low", "Moderate", "High"]);

function clean(str) {
  return String(str ?? "").trim();
}

function isTruthyFlag(value) {
  if (value === true) return true;
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function truncate(text, maxLen) {
  const t = clean(text);
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}\n\n[…truncated for length…]`;
}

function truncatePreservingMath(text, maxLen) {
  const t = clean(text);
  if (!t) return "";
  if (t.length <= maxLen) return t;
  let cut = t.slice(0, maxLen);
  const markers = cut.match(/\$\$/g) || [];
  if (markers.length % 2 === 1) {
    const next = t.indexOf("$$", maxLen);
    if (next !== -1 && next < maxLen + 2500) {
      cut = t.slice(0, next + 2);
    }
  }
  return `${cut}\n\n[…truncated for length…]`;
}

function uniqueKnowledgeText(input = {}) {
  const provided = clean(input.knowledgeChunk);
  if (provided) return provided;
  return [
    clean(input.dedupedPptText || input.pptText),
    clean(input.dedupedPdfText || input.pdfText),
    clean(input.dedupedTranscriptText || input.transcriptText),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {object} input
 * @param {string} [input.courseName]
 * @param {string} [input.subsectionTitle]
 * @param {string} [input.knowledgeChunk] - single MiniLM-deduped knowledge text
 * @param {string} [input.transcriptText] - video transcript
 * @param {string} [input.pptText]
 * @param {string} [input.pdfText]
 * @param {boolean} [input.containsMath]
 * @param {{ major?: string, year?: string, interests?: string }} [input.studentProfile]
 * @param {string} [input.cognitiveStyle] - one of Visual | Auditory | Read/Write | Kinesthetic
 * @param {{ level?: string, frustration?: string }} [input.cognitiveLoad]
 */
function buildPedagogicalPrompt(input = {}) {
  const major = clean(input.studentProfile?.major) || "[Major]";
  const year = clean(input.studentProfile?.year) || "[Year]";
  const interests =
    clean(input.studentProfile?.interests) || "[Interests]";

  let style = clean(input.cognitiveStyle) || "Visual";
  if (!COGNITIVE_STYLES.has(style)) {
    style = "Visual";
  }

  let loadLevel = clean(input.cognitiveLoad?.level) || "Medium";
  if (!LOAD_LEVELS.has(loadLevel)) {
    loadLevel = "Medium";
  }

  let frustration = clean(input.cognitiveLoad?.frustration) || "Low";
  if (!FRUSTRATION_LEVELS.has(frustration)) {
    frustration = "Low";
  }

  const courseName = clean(input.courseName) || "(course)";
  const subsectionTitle = clean(input.subsectionTitle) || "(subsection)";
  const containsMath = isTruthyFlag(input.containsMath);
  const uniqueText = (containsMath ? truncatePreservingMath : truncate)(
    uniqueKnowledgeText(input),
    18000
  );

  const knowledgeChunk = [
    `Course: ${courseName}`,
    `Subsection: ${subsectionTitle}`,
    "",
    uniqueText || "(none)",
  ].join("\n");

  const mathInstructions = containsMath
    ? `
Equation output rules (mandatory):
- Every educator formula must be a standalone LaTeX display block, on its own lines:

$$
<exact educator latex>
$$

- Copy each CANONICAL EQUATIONS entry verbatim. Do not simplify, rename symbols, insert \\cdot placeholders, or "fix" the formula.
- Do not write raw dollar signs as decoration in sentences. Use $inline$ only for short symbols like $\\alpha$.
- Explain around the formula in prose. The LaTeX itself must stay exactly as given.
`
    : "";

  return `System Role: You are a pedagogical expert specializing in instructional content transformation. Your goal is to adapt a specific knowledge chunk for a student to maximize engagement and minimize cognitive fatigue.

Inputs:
Student Profile: {Major: ${major}, Year: ${year}, Interests: ${interests}}
Cognitive Style: {Style: ${style} (1 of 4: Visual, Auditory, Read/Write, Kinesthetic)}
Current Cognitive Load: {Level: ${loadLevel} (1 of 5: Very Low, Low, Medium, High, Very High), Frustration: ${frustration} (Low, Moderate, High)}
Knowledge Chunk: {Original Text/Transcript from Educator}

${knowledgeChunk}

Instructions:
Assess Need: Analyze the knowledge chunk. If it is purely transitional or too simple, output it in its original form.
Transformation Goal: If adaptation is needed, rewrite the knowledge chunk to reduce cognitive load and match the student's cognitive style while preserving the original meaning.${mathInstructions}`;
}

module.exports = {
  buildPedagogicalPrompt,
  uniqueKnowledgeText,
  COGNITIVE_STYLES: Array.from(COGNITIVE_STYLES),
  LOAD_LEVELS: Array.from(LOAD_LEVELS),
  FRUSTRATION_LEVELS: Array.from(FRUSTRATION_LEVELS),
};
