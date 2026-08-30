const { filterWhisperNoise } = require("../lib/whisperNoise");

const VISUAL_VERBAL_STYLES = new Set(["Visual", "Verbal", "Intermediate"]);
const ANALYTIC_HOLISTIC_STYLES = new Set(["Analytic", "Holistic"]);
const COGNITIVE_STYLES = VISUAL_VERBAL_STYLES;

const LOAD_LEVELS = new Set([
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
]);

const FRUSTRATION_LEVELS = new Set(["Low", "Moderate", "High", "Very High"]);

function clean(str) {
  return String(str ?? "").trim();
}

function normalizeKnownAlias(value, aliases) {
  const raw = clean(value);
  if (!raw) return "";
  if (aliases.has(raw)) return raw;
  const key = raw.toLowerCase().replace(/-/g, "/");
  return aliases.get(key) || raw;
}

function normalizeVisualVerbalStyle(value) {
  const normalized = normalizeKnownAlias(
    value,
    new Map([
      ["visual", "Visual"],
      ["verbal", "Verbal"],
      ["intermediate", "Intermediate"],
      ["intermediary", "Intermediate"],
      ["intermediatory", "Intermediate"],
      ["moderate", "Intermediate"],
      ["moderate/intermediate", "Intermediate"],
      ["moderate/intermediatory", "Intermediate"],
    ])
  );
  return normalized || "Visual";
}

function normalizeAnalyticHolisticStyle(value) {
  const normalized = normalizeKnownAlias(
    value,
    new Map([
      ["analytic", "Analytic"],
      ["analytical", "Analytic"],
      ["holistic", "Holistic"],
      ["wholistic", "Holistic"],
    ])
  );
  return normalized || "Analytic";
}

function normalizeFrustration(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (FRUSTRATION_LEVELS.has(raw)) return raw;
  const key = raw.toLowerCase().replace(/[_-]+/g, " ");
  const map = {
    low: "Low",
    moderate: "Moderate",
    medium: "Moderate",
    high: "High",
    "very high": "Very High",
  };
  return map[key] || "";
}

function frustrationFromLoad(loadLevel) {
  if (loadLevel === "High" || loadLevel === "Very High") return "High";
  if (loadLevel === "Low" || loadLevel === "Very Low") return "Low";
  return "Moderate";
}

function wantsMermaidDiagrams(visualVerbalStyle) {
  return visualVerbalStyle === "Visual" || visualVerbalStyle === "Intermediate";
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
 * @param {{ year?: string, learnerProfile?: string }} [input.studentProfile]
 * @param {string} [input.learnerProfile] - stored ASSIST learner profile; empty if unset
 * @param {string} [input.visualVerbalCognitiveStyle] - Visual | Verbal | Intermediate
 * @param {string} [input.analyticWholisticCognitiveStyle] - Analytic | Holistic
 * @param {string} [input.cognitiveStyle] - legacy alias for visual-verbal style
 * @param {{ level?: string, frustration?: string }} [input.cognitiveLoad]
 */
function buildPedagogicalPrompt(input = {}) {
  const year = clean(input.studentProfile?.year) || "[Year]";
  const learnerProfile = clean(
    input.studentProfile?.learnerProfile ?? input.learnerProfile
  );

  const visualVerbalStyle = normalizeVisualVerbalStyle(
    input.visualVerbalCognitiveStyle ?? input.cognitiveStyle
  );
  const analyticHolisticStyle = normalizeAnalyticHolisticStyle(
    input.analyticWholisticCognitiveStyle
  );

  let loadLevel = clean(input.cognitiveLoad?.level) || "Medium";
  if (!LOAD_LEVELS.has(loadLevel)) {
    loadLevel = "Medium";
  }

  const frustration =
    normalizeFrustration(input.cognitiveLoad?.frustration) ||
    frustrationFromLoad(loadLevel);

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

  const mermaidInstructions = wantsMermaidDiagrams(visualVerbalStyle)
    ? `
Diagram rule (mandatory for Visual/Intermediate): include exactly one fenced Mermaid flowchart of the same steps. Use flowchart TB, quoted ASCII labels only, no subgraphs, no HTML, no markdown inside labels.

\`\`\`mermaid
flowchart TB
  S1["Step 1: Name"] --> S2["Step 2: Name"]
  S2 --> S3["Step 3: Name"]
\`\`\`
`
    : "";

  const analyticLayout =
    analyticHolisticStyle === "Analytic"
      ? `
Analytic layout (mandatory):
- Start with one short overview paragraph.
- Then write the lesson as numbered steps, each as its own heading:

### Step 1 — Short title
- One or two short bullets. No walls of prose.

### Step 2 — Short title
- ...

- Keep steps in order. Do not interleave later steps with earlier ones.
- Do not use ASCII art, +--+ boxes, or a single numbered paragraph for all steps.
`
      : `
Holistic layout: give the big picture first, then 3-6 connected points as short headings and bullets.
`;

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

  const learnerProfileInstruction = learnerProfile
    ? `
- Learner Profile (${learnerProfile}): Match this stored study approach from the student profile. Do not invent, infer, or replace a learner profile.`
    : "";

  return `System Role: You are a pedagogical expert specializing in instructional content transformation. Your goal is to adapt a specific knowledge chunk for a student to maximize engagement and minimize cognitive fatigue.

Inputs:
Student Profile: {Year: ${year}, Learner Profile: ${learnerProfile}}
Cognitive Style: {Visual-Verbal: ${visualVerbalStyle} (Visual, Verbal, or Intermediate), Analytic-Holistic: ${analyticHolisticStyle} (Analytic or Holistic)}
Current Cognitive Load: {Level: ${loadLevel} (1 of 5: Very Low, Low, Medium, High, Very High), Frustration: ${frustration} (Low, Moderate, High, Very High)}
Knowledge Chunk: {Unique extractive lesson knowledge. Do not invent facts.}

${knowledgeChunk}

Instructions:
Assess Need: Analyze the knowledge chunk. If it is purely transitional or too simple, output it in its original form.
Transformation Goal: If adaptation is needed, rewrite the knowledge chunk to reduce cognitive load and match both cognitive styles while preserving the original meaning.
- Visual-Verbal (${visualVerbalStyle}): Visual learners need spatial layouts and diagrams. Verbal learners need prose, definitions, and spoken-style explanation. Intermediate learners need a mix of both.
- Analytic-Holistic (${analyticHolisticStyle}): Analytic learners need sequential steps and parts-before-whole. Holistic learners need the big picture first, then how the parts connect.${learnerProfileInstruction}

Visual layout rules:
- Prefer Markdown headings, short paragraphs, and bullet lists over dense prose.
- Do not dump every step in one paragraph.${analyticLayout}${mermaidInstructions}${mathInstructions}`;
}

/**
 * Separate optional supplement for extra learners. Do not reuse or mix with
 * buildPedagogicalPrompt — this is not a style-matched rewrite of the lesson.
 */
function buildFurtherReadingPrompt(input = {}) {
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

  return `System Role: You are a subject-matter tutor writing an OPTIONAL advanced supplement for a student who already finished the adapted lesson. This is not a rewrite of the original lesson and must not copy the pedagogical transformation prompt.

Knowledge Chunk (the only source of lesson facts):
${knowledgeChunk}

Write Markdown with these three headings, in this order, and nothing else before them:

## Further details
Expand only ideas that already appear in the knowledge chunk. Give more precise explanation of those same facts. Do not invent new lesson claims.

## Advanced concepts
Add one or two deeper ideas that naturally follow from this knowledge chunk. Label them as advanced. If the chunk cannot support a deeper idea, say so in one sentence.

## Recommended readings
List 4 to 8 further-reading items tied to named concepts from the knowledge chunk: textbooks, standard references, or reputable educational pages. Include a full public URL when the resource is well known (for example Wikipedia, Khan Academy, a university course page, or a classic textbook). Mark these as suggested extra reading, not as sources that were in the original lesson.

Rules:
- Do not repeat the original adapted lesson.
- Do not apply Visual/Verbal or Analytic/Holistic rewriting.
- Do not invent formulas, names, or results that are absent from the knowledge chunk.
- Keep sections clearly separated.`;
}

module.exports = {
  buildPedagogicalPrompt,
  buildFurtherReadingPrompt,
  uniqueKnowledgeText,
  COGNITIVE_STYLES: Array.from(COGNITIVE_STYLES),
  VISUAL_VERBAL_STYLES: Array.from(VISUAL_VERBAL_STYLES),
  ANALYTIC_HOLISTIC_STYLES: Array.from(ANALYTIC_HOLISTIC_STYLES),
  LOAD_LEVELS: Array.from(LOAD_LEVELS),
  FRUSTRATION_LEVELS: Array.from(FRUSTRATION_LEVELS),
};
