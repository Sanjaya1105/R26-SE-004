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

function truncate(text, maxLen) {
  const t = clean(text);
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}\n\n[…truncated for length…]`;
}

/**
 * @param {object} input
 * @param {string} [input.courseName]
 * @param {string} [input.subsectionTitle]
 * @param {string} [input.transcriptText] - video transcript
 * @param {string} [input.pptText]
 * @param {string} [input.pdfText]
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

  const video = truncate(input.transcriptText, 12000);
  const ppt = truncate(input.pptText, 8000);
  const pdf = truncate(input.pdfText, 8000);

  const courseName = clean(input.courseName) || "(course)";
  const subsectionTitle = clean(input.subsectionTitle) || "(subsection)";

  const knowledgeParts = [];
  knowledgeParts.push(`Course: ${courseName}`);
  knowledgeParts.push(`Subsection: ${subsectionTitle}`);
  knowledgeParts.push("");
  knowledgeParts.push("--- Video transcript ---");
  knowledgeParts.push(video || "(none)");
  knowledgeParts.push("");
  knowledgeParts.push("--- PPT extracted text ---");
  knowledgeParts.push(ppt || "(none)");
  knowledgeParts.push("");
  knowledgeParts.push("--- PDF extracted text ---");
  knowledgeParts.push(pdf || "(none)");

  const knowledgeChunk = knowledgeParts.join("\n");

  return `System Role: You are a pedagogical expert specializing in instructional content transformation. Your goal is to adapt a specific knowledge chunk for a student to maximize engagement and minimize cognitive fatigue.

Inputs:
Student Profile: {Major: ${major}, Year: ${year}, Interests: ${interests}}
Cognitive Style: {Style: ${style} (1 of 4: Visual, Auditory, Read/Write, Kinesthetic)}
Current Cognitive Load: {Level: ${loadLevel} (1 of 5: Very Low, Low, Medium, High, Very High), Frustration: ${frustration} (Low, Moderate, High)}
Knowledge Chunk: {Original Text/Transcript from Educator}

${knowledgeChunk}

Instructions:
Assess Need: Analyze the knowledge chunk. If it is purely transitional or too simple, output it in its original form.
`;
}

module.exports = {
  buildPedagogicalPrompt,
  COGNITIVE_STYLES: Array.from(COGNITIVE_STYLES),
  LOAD_LEVELS: Array.from(LOAD_LEVELS),
  FRUSTRATION_LEVELS: Array.from(FRUSTRATION_LEVELS),
};
