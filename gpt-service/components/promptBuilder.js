const { filterWhisperNoise } = require("../lib/whisperNoise");

const COGNITIVE_STYLES = new Set([
  "Visual",
  "Intermediate",
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

function normalizeCognitiveStyle(value) {
  const raw = clean(value);
  if (COGNITIVE_STYLES.has(raw)) return raw;
  const key = raw.toLowerCase();
  if (key === "intermediary" || key === "intermediatory" || key === "moderate") {
    return "Intermediate";
  }
  if (key === "verbal") return "Read/Write";
  return "Visual";
}

function wantsMermaidDiagrams(style) {
  return style === "Visual" || style === "Intermediate";
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
  const provided = filterWhisperNoise(clean(input.knowledgeChunk));
  if (provided) return provided;
  return [
    clean(input.dedupedPptText || input.pptText),
    clean(input.dedupedPdfText || input.pdfText),
    filterWhisperNoise(clean(input.dedupedTranscriptText || input.transcriptText)),
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
 * @param {string} [input.cognitiveStyle] - Visual | Intermediate | Auditory | Read/Write | Kinesthetic
 * @param {{ level?: string, frustration?: string }} [input.cognitiveLoad]
 */
function buildPedagogicalPrompt(input = {}) {
  const major = clean(input.studentProfile?.major) || "[Major]";
  const year = clean(input.studentProfile?.year) || "[Year]";
  const interests =
    clean(input.studentProfile?.interests) || "[Interests]";

  const style = normalizeCognitiveStyle(input.cognitiveStyle);

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
    12000
  );

  const knowledgeChunk = [
    `Course: ${courseName}`,
    `Subsection: ${subsectionTitle}`,
    "",
    uniqueText || "(none)",
  ].join("\n");

  const mermaidInstructions = wantsMermaidDiagrams(style)
    ? `
Diagram rule: If a process, cycle, comparison, or concept map would help this Visual/Intermediate learner, include one fenced Mermaid block the app will draw. Pick the matching type:
- flowchart LR or flowchart TB for a process
- mindmap for a concept tree
- sequenceDiagram for an interaction
- timeline for ordered events
Quote every label, ASCII only, for example:

\`\`\`mermaid
flowchart LR
  A["Sunlight"] --> B["Chlorophyll"]
  B --> C["Glucose"]
\`\`\`
`
    : "";

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
Cognitive Style: {Style: ${style} (Visual, Intermediate, Auditory, Read/Write, or Kinesthetic)}
Current Cognitive Load: {Level: ${loadLevel} (1 of 5: Very Low, Low, Medium, High, Very High), Frustration: ${frustration} (Low, Moderate, High)}
Knowledge Chunk: {Unique extractive lesson knowledge. Do not invent facts.}

${knowledgeChunk}

Instructions:
Assess Need: Analyze the knowledge chunk. If it is purely transitional or too simple, output it in its original form.
Transformation Goal: If adaptation is needed, rewrite the knowledge chunk to reduce cognitive load and match the student's cognitive style while preserving the original meaning.

Visual layout rules:
- Prefer Markdown headings, short paragraphs, and bullet lists over dense prose.${mermaidInstructions}${mathInstructions}`;
}

module.exports = {
  buildPedagogicalPrompt,
  uniqueKnowledgeText,
  COGNITIVE_STYLES: Array.from(COGNITIVE_STYLES),
  LOAD_LEVELS: Array.from(LOAD_LEVELS),
  FRUSTRATION_LEVELS: Array.from(FRUSTRATION_LEVELS),
};
