const { hfChatCompletion } = require("./hfChat");
const { analyzeLesson } = require("./lessonAnalysisService");
const { parseJsonFromLlm } = require("../lib/parseJsonFromLlm");
const {
  extractLearningSignals,
} = require("../lib/visualDecision");
const {
  generateImage,
  generateImageFromPrompt,
  isImageApiConfigured,
} = require("../lib/hfTextToImage");
const {
  extractTimelineRows,
  buildMermaidTimeline,
} = require("../lib/timelineExtract");
const {
  buildGoogleMapsUrls,
  resolveMapsQuery,
} = require("../lib/googleMapsUrls");

function styleModifier(style) {
  const s = String(style || "textbook").toLowerCase();
  const map = {
    textbook:
      "clean textbook diagram aesthetic, accurate proportions, soft classroom lighting",
    "simple cartoon":
      "simple friendly cartoon style for children, clear shapes, limited palette",
    realistic:
      "realistic educational illustration, accurate details, natural lighting",
    minimal:
      "minimal flat vector style, simple shapes, plenty of white space",
    "classroom poster":
      "bold classroom poster style, high contrast blocks of color, readable at a distance",
  };
  return map[s] || map.textbook;
}

/** Style bullets for structured illustration prompts (matches UI image style). */
/** First Style bullet: maps UI control to textbook / cartoon / minimal (+ poster). */
function styleLineForIllustrationTemplate(uiStyle) {
  const s = String(uiStyle || "textbook").toLowerCase();
  if (s.includes("cartoon")) {
    return "- friendly cartoon style with simple rounded shapes (no text in image)";
  }
  if (s === "minimal") {
    return "- minimal flat design with simple shapes and generous white space";
  }
  if (s === "classroom poster" || s.includes("poster")) {
    return "- clean poster-style composition with clear silhouettes and readable forms";
  }
  if (s === "realistic") {
    return "- realistic but simple educational illustration, natural proportions, soft lighting";
  }
  return "- realistic but simple textbook-style illustration, clear shapes, soft lighting";
}

function ensureIllustrationImportantBlock(prompt) {
  const p = String(prompt || "").trim();
  const low = p.toLowerCase();
  if (
    low.includes("no text") &&
    low.includes("no labels") &&
    low.includes("no numbers")
  ) {
    return p;
  }
  return `${p}\n\nIMPORTANT:\n- no text\n- no labels\n- no letters\n- no numbers\n- no watermark`;
}

function buildFallbackIllustrationPrompt(analysis, payload) {
  const topic =
    String(analysis.main_topic || "").trim() ||
    String(payload.subject || "").trim() ||
    "the lesson topic";
  const concepts = Array.isArray(analysis.key_concepts)
    ? analysis.key_concepts.map((c) => String(c).trim()).filter(Boolean)
    : [];

  let showLines;
  if (concepts.length >= 3) {
    showLines = [
      `- main scene: ${concepts[0]}`,
      `- key idea: ${concepts[1]}`,
      `- result or goal: ${concepts[2]}`,
    ].join("\n");
  } else if (concepts.length === 2) {
    showLines = [
      `- main scene: ${concepts[0]}`,
      `- key idea: ${concepts[1]}`,
      `- simple takeaway: one clear visual metaphor for the topic (no writing)`,
    ].join("\n");
  } else if (concepts.length === 1) {
    showLines = [
      `- main scene tied to: ${concepts[0]}`,
      `- one supporting symbol or object learners can recognize`,
      `- calm layout showing the main takeaway (no text in the picture)`,
    ].join("\n");
  } else {
    showLines = [
      `- a clear central scene for ${topic}`,
      `- one or two simple supporting visuals (no writing)`,
      `- uncluttered layout emphasizing the main idea`,
    ].join("\n");
  }

  return [
    `Create a simple educational illustration of ${topic}.`,
    "",
    "Show:",
    showLines,
    "",
    "Style:",
    styleLineForIllustrationTemplate(payload.imageStyle),
    "- clean composition",
    "- student-friendly",
    "- simple shapes",
    "- soft colors",
    "",
    "Background:",
    "- plain white or light background",
    "",
    "IMPORTANT:",
    "- no text",
    "- no labels",
    "- no letters",
    "- no numbers",
    "- no watermark",
  ].join("\n");
}

/** Ensure LLM output matches the mandatory illustration template or replace with fallback. */
function normalizeIllustrationPrompt(raw, analysis, payload) {
  const p = String(raw || "").trim();
  const low = p.toLowerCase();
  const hasSections =
    low.includes("create a simple educational illustration") &&
    low.includes("show:") &&
    low.includes("style:") &&
    low.includes("background:") &&
    low.includes("important:");
  if (!hasSections || p.length < 100) {
    return buildFallbackIllustrationPrompt(analysis, payload);
  }
  return ensureIllustrationImportantBlock(p);
}

function buildContextBlock(payload, analysis) {
  const language = String(payload.language || "English").trim();
  return [
    `Learner language: ${language}.`,
    payload.subject && `Subject: ${payload.subject}.`,
    payload.gradeLevel && `Grade level: ${payload.gradeLevel}.`,
    payload.studentAge && `Student age: ${payload.studentAge}.`,
    payload.learningObjective && `Learning objective: ${payload.learningObjective}.`,
    `Main topic: ${analysis.main_topic || ""}.`,
    `Key concepts: ${(analysis.key_concepts || []).join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const MERMAID_TYPES = new Set([
  "flowchart",
  "process_diagram",
  "cause_effect_diagram",
  "hierarchy_tree",
  "concept_map",
]);

function normalizeCauseEffectMermaid(raw) {
  let t = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^\s*```(?:mermaid)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  if (!t) return t;
  if (/^flowchart\s+TD\b/i.test(t)) return t;
  t = t.replace(/^\s*graph\s+TD\s*\n/i, "flowchart TD\n");
  t = t.replace(/^\s*flowchart\s+(LR|RL|TB|BT)\s*\n/i, "flowchart TD\n");
  t = t.replace(/^\s*graph\s+(LR|RL|TB|BT)\s*\n/i, "flowchart TD\n");
  if (!/^flowchart\s+TD\b/im.test(t)) {
    t = `flowchart TD\n${t}`;
  }
  return t;
}

function mermaidSystemPrompt(visualType) {
  const base = `Return ONLY valid JSON:
{
  "mermaid": string,
  "student_caption": string,
  "verification_notes": string[]
}
The mermaid field must be valid Mermaid code only (no markdown fence). Use short node labels faithful to the lesson.`;

  const v = {
    flowchart: `${base}
Use flowchart LR or TD. Show ordered steps, pathways, or stages (e.g. digestive path, steps in a method).`,

    process_diagram: `${base}
Use flowchart LR. Emphasize inputs and outputs, transformations, and where the process happens (e.g. photosynthesis: Sunlight, CO2, Water → Leaf → Photosynthesis → Glucose, O2).
If the lesson describes a cycle/repeating stages, the mermaid MUST include a loop by connecting the final stage back to the starting stage.`,

    cause_effect_diagram: `${base}
Use ONLY "flowchart TD" (top-down). Teach one clear teaching chain: Cause → Immediate effect → Secondary effects → Final outcome.
Strict rules:
- First line must be: flowchart TD
- Use simple arrows --> only. Labels: A[Short phrase] with letters A,B,C,...
- Do NOT use graph LR, mindmap, subgraph clutter, circular arrows, or curved/network diagrams.
- Branching allowed only when one step splits into parallel effects that later merge (e.g. B --> C; B --> D; C --> E; D --> E).
- No loops; never link back to an earlier node.
- Keep 4–10 nodes; 2–5 words per label.`,

    hierarchy_tree: `${base}
Use ONLY "flowchart TD" (top-down). This visual is for CLASSIFICATION / taxonomy: parent → child groups → subgroups.
Strict rules:
- First line must be: flowchart TD
- One root node for the domain (e.g. Animals), arrows down to major branches (e.g. Vertebrates, Invertebrates), then further arrows to sub-types (Mammals, Birds, …).
- Nodes: A[Short label] with letter IDs; arrows --> only.
- Do NOT use mindmap, graph LR as primary, circular links, or dense cross-links (that is concept-map style, wrong here).`,

    concept_map: `${base}
Use ONLY for NON-hierarchical networks: many ideas influencing each other (web-like relationships), not taxonomy or parent→child classification.
You may use graph or flowchart TB/LR with cross-links when the lesson describes interconnected influences—not strict grouping.`,

    timeline: `${base}
Prefer timeline or gantt if dates exist; otherwise flowchart LR with ordered events.`,
  };
  return (
    v[visualType] ||
    `${base}\nChoose diagram syntax appropriate for the lesson.`
  );
}

/**
 * Timeline: prefer deterministic extraction + Mermaid timeline syntax; no image prompt.
 * Falls back to LLM Mermaid when fewer than 2 extracted points.
 */
async function generateTimelineVisual(ctx, analysis, payload) {
  const lesson = String(payload.lessonText || "");
  const topic = analysis.main_topic || "";
  const rows = extractTimelineRows(lesson);

  if (rows.length >= 2) {
    const mermaid = buildMermaidTimeline(topic, rows);
    return {
      topic,
      diagram_data: {
        format: "mermaid",
        mermaid,
        timeline: rows,
      },
      mermaid,
      image_prompt: "",
      labels: [],
      alt_text: String(analysis.alt_text || "").trim(),
      student_caption: `Chronological overview of ${topic || "the topic"} (${rows.length} periods from the lesson).`,
      verification_notes: [
        `Structured timeline: ${rows.length} ordered points extracted from the text; Mermaid timeline diagram (no illustration prompt).`,
      ],
      generated_image: null,
    };
  }

  const llm = await generateMermaidVisual(ctx, analysis, payload, "timeline");
  const extracted = extractTimelineRows(lesson);
  const mStr = String(
    llm.mermaid || llm.diagram_data?.mermaid || ""
  ).trim();
  return {
    ...llm,
    image_prompt: "",
    diagram_data: {
      format: "mermaid",
      mermaid: mStr,
      timeline: extracted.length ? extracted : [],
    },
    mermaid: mStr,
  };
}

async function generateMermaidVisual(ctx, analysis, payload, visualType) {
  const system = mermaidSystemPrompt(visualType);
  const user = `${ctx}\n\nLesson:\n${String(payload.lessonText || "").slice(0, 12000)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    visualType === "cause_effect_diagram" || visualType === "hierarchy_tree"
      ? { max_tokens: 2000, temperature: 0.08 }
      : { max_tokens: 2000, temperature: 0.12 }
  );

  const parsed = parseJsonFromLlm(text);
  let m = String(
    parsed.mermaid || parsed.diagram_data?.mermaid || ""
  ).trim();
  if (
    (visualType === "cause_effect_diagram" || visualType === "hierarchy_tree") &&
    m
  ) {
    m = normalizeCauseEffectMermaid(m);
  }
  const extraNotes =
    visualType === "cause_effect_diagram"
      ? [
          "Cause-effect structure is top-down and easy to follow.",
          "No loops or confusing network-style arrows are used.",
          "Mermaid rendering includes fallback handling.",
        ]
      : visualType === "hierarchy_tree"
        ? [
            "Hierarchy uses top-down flowchart TD for parent → child groups.",
            "Classification content avoids concept-map network layouts.",
          ]
        : [];
  return {
    topic: analysis.main_topic || "",
    diagram_data: { format: "mermaid", mermaid: m },
    mermaid: m,
    image_prompt: "",
    labels: [],
    alt_text: String(analysis.alt_text || "").trim(),
    student_caption: String(parsed.student_caption || "").trim(),
    verification_notes: [
      ...(Array.isArray(parsed.verification_notes)
        ? parsed.verification_notes
        : []),
      `Structured ${visualType.replace(/_/g, " ")} (Mermaid); no raster image used.`,
      ...extraNotes,
    ],
    generated_image: null,
  };
}

async function generateChart(ctx, analysis, payload) {
  const system = `You convert lesson content into a simple chart specification for a web chart library (Recharts-style).
Return ONLY valid JSON:
{
  "diagram_data": {
    "format": "chart",
    "chart": {
      "chart_type": "bar"|"line"|"pie",
      "title": string,
      "x_key": string,
      "series": [{"name": string, "data_key": string}],
      "rows": [object]
    }
  },
  "student_caption": string,
  "verification_notes": string[]
}
rows: array of objects with keys matching x_key and each series data_key. Only include numbers explicitly supported by the lesson; if data is missing, use verification_notes to explain.`;

  const user = `${ctx}\n\nLesson:\n${String(payload.lessonText || "").slice(0, 12000)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 2000, temperature: 0.1 }
  );

  const parsed = parseJsonFromLlm(text);
  return {
    topic: analysis.main_topic || "",
    diagram_data: parsed.diagram_data || {},
    mermaid: "",
    image_prompt: "",
    labels: [],
    alt_text: String(analysis.alt_text || "").trim(),
    student_caption: String(parsed.student_caption || "").trim(),
    verification_notes: [
      ...(Array.isArray(parsed.verification_notes)
        ? parsed.verification_notes
        : []),
      "Chart uses structured data so axis labels stay accurate.",
    ],
    generated_image: null,
  };
}

async function generateComparisonTable(ctx, analysis, payload) {
  const system = `You build an accessible comparison table for learners.
Return ONLY valid JSON:
{
  "diagram_data": {
    "format": "html_table",
    "html": string
  },
  "student_caption": string,
  "verification_notes": string[]
}
The html must be a single <table>...</table> fragment only (no scripts/styles). Use <th> and <td>.`;

  const user = `${ctx}\n\nLesson:\n${String(payload.lessonText || "").slice(0, 12000)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 2000, temperature: 0.15 }
  );

  const parsed = parseJsonFromLlm(text);
  return {
    topic: analysis.main_topic || "",
    diagram_data: parsed.diagram_data || {},
    mermaid: "",
    image_prompt: "",
    labels: [],
    alt_text: String(analysis.alt_text || "").trim(),
    student_caption: String(parsed.student_caption || "").trim(),
    verification_notes: [
      ...(Array.isArray(parsed.verification_notes)
        ? parsed.verification_notes
        : []),
      "Comparison shown as HTML table for exact wording.",
    ],
    generated_image: null,
  };
}

/**
 * Geographic "where" content — structured map card + unlabeled base map prompt + overlay labels.
 * Not Mermaid (maps are not flowcharts).
 */
async function generateMapCard(ctx, analysis, payload) {
  const system = `You extract geographic teaching content for a MAP CARD used in the lesson UI (not a flowchart or Mermaid diagram).
Return ONLY valid JSON:
{
  "diagram_data": {
    "format": "map_card",
    "location": string,
    "region": string,
    "countries": string[],
    "context": string,
    "marker": string
  },
  "image_prompt": string,
  "labels": [{"text": string, "target": string, "position_hint": string}],
  "student_caption": string,
  "verification_notes": string[]
}
Rules:
- diagram_data: location = main place or feature; region = mountain range, river basin, city area, etc.; countries = array of country names; context = continent/world region; marker = one clear sentence on WHERE (borders, relative position).
- image_prompt: for an UNLABELED educational reference map — simple regions, textbook map style, soft colors, clear shapes. NO text, letters, labels, or writing inside the image.
- labels: for HTML/SVG overlays only; not drawn into the generated image.
The API adds Google Maps map_url and embed_url automatically from location (fallback: region, countries, context).`;

  const user = `${ctx}\n\nLesson:\n${String(payload.lessonText || "").slice(0, 12000)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 1800, temperature: 0.15 }
  );

  const parsed = parseJsonFromLlm(text);
  const style = styleModifier(payload.imageStyle);
  const rawDd = parsed.diagram_data && typeof parsed.diagram_data === "object"
    ? parsed.diagram_data
    : {};
  const diagram_data = {
    format: "map_card",
    location: String(rawDd.location || "").trim(),
    region: String(rawDd.region || "").trim(),
    countries: Array.isArray(rawDd.countries)
      ? rawDd.countries.map((c) => String(c).trim()).filter(Boolean)
      : [],
    context: String(rawDd.context || "").trim(),
    marker: String(rawDd.marker || "").trim(),
    map_url: "",
    embed_url: "",
  };

  const queryForMaps = resolveMapsQuery(diagram_data);
  const urls = buildGoogleMapsUrls(queryForMaps);
  diagram_data.map_url = urls.map_url;
  diagram_data.embed_url = urls.embed_url;

  const basePrompt = String(parsed.image_prompt || "").trim();
  const image_prompt = basePrompt
    ? `${basePrompt}\n\nStyle: ${style}. No text, letters, labels, or writing in the image.`
    : `Create a simple unlabeled educational map relevant to the lesson. ${style}. No text or labels in the image.`;

  let generated_image = null;
  try {
    generated_image = await generateImageFromPrompt(image_prompt);
  } catch {
    generated_image = null;
  }

  const notes = [
    ...(Array.isArray(parsed.verification_notes) ? parsed.verification_notes : []),
    "Map visual uses a structured map card (not Mermaid). Labels are overlays only.",
  ];
  if (!generated_image) {
    notes.push(
      "Optional: configure HF_IMAGE_API_URL to preview an unlabeled base map from the prompt above."
    );
  }

  return {
    topic: analysis.main_topic || "",
    diagram_data,
    mermaid: "",
    image_prompt,
    labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    alt_text: String(analysis.alt_text || "").trim(),
    student_caption: String(parsed.student_caption || "").trim(),
    verification_notes: notes,
    generated_image,
  };
}

async function generateLabeledDiagram(ctx, analysis, payload, options = {}) {
  const secondaryOnly = Boolean(options.secondaryOnly);
  const validPrimaryLabeled = Boolean(options.validPrimaryLabeled);
  const system = `You design visuals for education. For LABELED DIAGRAMS, the image model must NOT render readable text.
Return ONLY valid JSON:
{
  "image_prompt": string,
  "labels": [{"text": string, "target": string, "position_hint": string}],
  "student_caption": string,
  "verification_notes": string[]
}
Rules:
- image_prompt: a detailed prompt for an UNLABELED educational diagram (e.g. "Create a simple diagram of a plant cell. Show outer cell wall, membrane, cytoplasm, nucleus, chloroplasts as small ovals. Style: flat textbook, simple shapes, light background. No text, no labels, no letters, no numbers.").
- image_prompt must forbid any readable text, letters, numbers, or arrows with text in the image.
- labels: accurate labels as separate metadata only.
- position_hint: where each label applies (e.g. "outer boundary", "near center").`;

  const user = `${ctx}

Lesson excerpt:
${String(payload.lessonText || "").slice(0, 12000)}

Structured analysis:
${JSON.stringify(
  {
    concept_relationships: analysis.concept_relationships || [],
    labels_seed: analysis.labels_if_needed || [],
  },
  null,
  2
)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 1400, temperature: 0.2 }
  );

  const parsed = parseJsonFromLlm(text);
  const style = styleModifier(payload.imageStyle);
  const image_prompt = `${parsed.image_prompt}\n\nStyle: ${style}. No text, letters, labels, or writing in the image.`;

  let generated_image = null;
  if (!secondaryOnly) {
    try {
      generated_image = await generateImageFromPrompt(image_prompt);
    } catch {
      generated_image = null;
    }
  }

  const notes = [
    ...(Array.isArray(parsed.verification_notes) ? parsed.verification_notes : []),
    "Labels are returned as structured data; the base image must remain text-free.",
  ];
  if (!secondaryOnly && !generated_image && !validPrimaryLabeled) {
    notes.push(
      "Optional: configure HF_IMAGE_API_URL to preview an unlabeled base image generated from the prompt above."
    );
  }

  return {
    topic: analysis.main_topic || "",
    diagram_data: {},
    mermaid: "",
    image_prompt,
    labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    alt_text: String(analysis.alt_text || "").trim(),
    student_caption: String(parsed.student_caption || "").trim(),
    verification_notes: notes,
    generated_image,
  };
}

async function generateIllustration(ctx, analysis, payload) {
  const system = `You write a COMPLETE image generation prompt for an educational illustration (text only—no image).
Return ONLY valid JSON:
{
  "image_prompt": string,
  "student_caption": string,
  "verification_notes": string[]
}

MANDATORY: image_prompt must never be empty. It must be ready for Hugging Face image generation.

image_prompt MUST follow this EXACT section order and labels:

Create a simple educational illustration of [topic].

Show:
- [main scene]
- [key idea 1]
- [key idea 2]
(Use exactly 2–3 bullets total under Show: — keep the scene uncluttered.)

Style:
- [first line must match the selected UI style: textbook = realistic but simple textbook look; simple cartoon = friendly cartoon; minimal = flat minimal; classroom poster = clean poster-style]
- clean composition
- student-friendly
- simple shapes
- soft colors

Background:
- plain white or light background

IMPORTANT:
- no text
- no labels
- no letters
- no numbers
- no watermark

Rules:
- Never omit Show:, Style:, Background:, or IMPORTANT: sections.
- Do not put readable words, letters, or numbers in the image—only describe drawable visuals.`;

  const user = `${ctx}

Selected UI image style (must inform the FIRST bullet under Style:): ${styleModifier(payload.imageStyle)}

Lesson:\n${String(payload.lessonText || "").slice(0, 12000)}`;

  const { text } = await hfChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { max_tokens: 1600, temperature: 0.28 }
  );

  const parsed = parseJsonFromLlm(text);
  let image_prompt = normalizeIllustrationPrompt(
    String(parsed.image_prompt || "").trim(),
    analysis,
    payload
  );
  image_prompt = ensureIllustrationImportantBlock(image_prompt);

  let generated_image = null;
  let illustration_image_status = "not_configured";
  /** Safe subset for UI / debugging (no tokens or raw HF bodies). */
  let illustration_image_error = null;
  if (isImageApiConfigured()) {
    illustration_image_status = "failed";
    try {
      const dataUrl = await generateImage(image_prompt);
      const m =
        typeof dataUrl === "string" &&
        dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        generated_image = { mime_type: m[1], base64: m[2] };
        illustration_image_status = "success";
      }
    } catch (e) {
      console.error(
        "[generateIllustration] HF image:",
        e?.code,
        e?.status,
        e?.message
      );
      generated_image = null;
      illustration_image_status = "failed";
      illustration_image_error = {
        code: e?.code || "UNKNOWN",
        httpStatus:
          typeof e?.status === "number" ? e.status : undefined,
      };
    }
  }

  const baseNotes = [
    "Illustration is appropriate for abstract concept.",
    "Image prompt includes clear visual elements.",
    "No text is requested inside the image.",
  ];
  const parsedNotes = Array.isArray(parsed.verification_notes) ? parsed.verification_notes : [];
  const verification_notes = [...parsedNotes, ...baseNotes];
  if (illustration_image_status === "not_configured") {
    verification_notes.push(
      "Image generation is not configured (set HF_IMAGE_API_URL and HF_API_TOKEN or HF_API_KEY)."
    );
  } else if (illustration_image_status === "failed") {
    verification_notes.push("Image generation did not return an image; you can try again or check the API.");
  }

  const topic = String(analysis.main_topic || "").trim();
  const student_caption =
    String(parsed.student_caption || "").trim() ||
    (topic ? `Visual overview of ${topic} for learners.` : "Educational illustration supporting the lesson.");
  const alt_text =
    String(analysis.alt_text || "").trim() ||
    (topic ? `Illustration related to ${topic}, no text in image.` : "Educational illustration, no text in image.");

  return {
    topic: analysis.main_topic || "",
    diagram_data: {},
    mermaid: "",
    image_prompt,
    labels: [],
    alt_text,
    student_caption,
    verification_notes,
    generated_image,
    illustration_image_status,
    illustration_image_error,
  };
}

async function generateForPrimary(primaryVisual, ctx, analysis, payload) {
  if (primaryVisual === "timeline") {
    return generateTimelineVisual(ctx, analysis, payload);
  }
  if (primaryVisual === "map") {
    return generateMapCard(ctx, analysis, payload);
  }
  if (MERMAID_TYPES.has(primaryVisual)) {
    return generateMermaidVisual(ctx, analysis, payload, primaryVisual);
  }
  switch (primaryVisual) {
    case "chart":
      return generateChart(ctx, analysis, payload);
    case "comparison_table":
      return generateComparisonTable(ctx, analysis, payload);
    case "labeled_diagram":
      return generateLabeledDiagram(ctx, analysis, payload, {
        secondaryOnly: false,
        validPrimaryLabeled: Boolean(payload.__validPrimaryLabeled),
      });
    case "illustration":
      return generateIllustration(ctx, analysis, payload);
    default:
      return generateIllustration(ctx, analysis, payload);
  }
}

function diagramFormatFrom(result, primaryVisual) {
  if (primaryVisual === "labeled_diagram") {
    return "image_prompt_with_label_metadata";
  }
  if (primaryVisual === "map") {
    return "map_card";
  }
  if (primaryVisual === "timeline") {
    return "timeline";
  }
  const d = result.diagram_data;
  if (d && d.format) return d.format;
  if (result.mermaid) return "mermaid";
  return "";
}

const LABELED_HELPER_NOTE =
  "Labeled diagram: This visual shows the key parts of the system. Labels are provided separately for clarity and can be overlaid on the diagram or used as a study guide.";

const VISUAL_PRIORITY = [
  "chart",
  "timeline",
  "map",
  "comparison_table",
  "process_diagram",
  "flowchart",
  "hierarchy_tree",
  "cause_effect_diagram",
  "labeled_diagram",
  "concept_map",
  "illustration",
];

function inferLearnerLevelFromAge(studentAgeRaw) {
  const n = Number(String(studentAgeRaw || "").match(/\d+/)?.[0]);
  if (!Number.isFinite(n)) return "mixed / unspecified";
  if (n >= 5 && n <= 7) return "early elementary";
  if (n >= 8 && n <= 10) return "elementary";
  if (n >= 11 && n <= 13) return "middle school";
  if (n >= 14 && n <= 16) return "high school";
  return "advanced / college-ready";
}

function inferSubjectFromText(lessonText = "") {
  const t = String(lessonText).toLowerCase();
  const checks = [
    ["Biology", /\b(cells?|digestion|animals?|plants?|organs?|organ system|chloroplast|mitochondria)\b/],
    ["Physics", /\b(force|energy|motion|electricity|current|voltage|magnet)\b/],
    ["Chemistry", /\b(matter|atoms?|reactions?|acids?|bases?|molecules?|compound)\b/],
    ["Earth Science", /\b(water cycle|weather|climate|rocks?|erosion|soil|atmosphere)\b/],
    ["Geography", /\b(countries?|maps?|regions?|rivers?|mountains?|continents?|locations?|directions?)\b/],
    ["History", /\b(dates?|wars?|empires?|revolutions?|centur(y|ies)|historical order)\b/],
    ["Mathematics", /\b(numbers?|data|graph|percentage|percent|ratio|statistics)\b/],
    ["English", /\b(reading|grammar|writing|vocabulary|literature|sentence)\b/],
    ["Social Studies", /\b(democracy|teamwork|responsibility|culture|society|citizenship)\b/],
  ];
  for (const [subject, re] of checks) {
    if (re.test(t)) return subject;
  }
  return "General Studies";
}

function summarizeLessonText(lessonText = "") {
  const clean = String(lessonText).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 3).join(" ").slice(0, 420);
}

function chunkLessonText(lessonText = "", maxChars = 3500) {
  const clean = String(lessonText || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    const out = [];
    let i = 0;
    while (i < clean.length) {
      out.push(clean.slice(i, i + maxChars));
      i += maxChars;
    }
    return out;
  }
  const chunks = [];
  let current = "";
  for (const p of paras) {
    if (!current) {
      current = p;
      continue;
    }
    if ((current + "\n\n" + p).length <= maxChars) {
      current += `\n\n${p}`;
    } else {
      chunks.push(current);
      current = p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function detectVisualTypesFromSignals(signals) {
  const detected = [];
  const push = (type, evidence, confidence = "medium") => {
    if (!detected.find((x) => x.type === type)) {
      detected.push({ type, evidence, confidence, recommended_visual: type });
    }
  };
  if (signals.quantitative || signals.strongNumericChart) {
    push("chart", "numbers, measurements, percentages, or trends detected", "high");
  }
  if (signals.temporal || signals.timelinePreferred) {
    push("timeline", "time references, dates, or historical order detected", "high");
  }
  if (signals.geographic) {
    push("map", "locations/regions/rivers/mountains/directions detected", "high");
  }
  if (signals.compareContrast) {
    push("comparison_table", "compare/contrast/similarity-difference language detected", "high");
  }
  const cycleLike = /\b(cycle|cyclical|repeating stages?|loop)\b/i.test(
    String(signals.hay || "")
  );
  if (signals.ioProcess && cycleLike) {
    push("process_diagram", "cycle with repeating process stages detected", "high");
  } else if (signals.sequenceProcedure || signals.organPathway) {
    push("flowchart", "steps/order/movement/procedure detected", "high");
  }
  if (signals.ioProcess && !signals.sequenceProcedure && !signals.organPathway) {
    push("process_diagram", "input-output conversion/transformation detected", "high");
  }
  if (signals.partsAndSequence) {
    push("process_diagram", "parts + sequence indicates process first", "high");
    push("labeled_diagram", "secondary support for parts/components", "medium");
  } else if (signals.partsStructure || signals.physicalPartsEmphasis) {
    push("labeled_diagram", "parts/components/structure detected", "high");
  }
  if (signals.causeEffect && !cycleLike) {
    push("cause_effect_diagram", "cause→effect language detected", "high");
  }
  if (signals.hierarchy || signals.hierarchyPreferred) {
    push("hierarchy_tree", "classification/types/categories/groups detected", "high");
  }
  if (signals.is_network || signals.manyConnected) {
    push("concept_map", "many connected non-hierarchical ideas detected", "medium");
  }
  if (signals.abstractSocial) {
    push("illustration", "abstract/social/general concept detected", "medium");
  }
  if (!detected.length) {
    push("illustration", "no strong structured relationship detected", "low");
  }
  return detected;
}

function sortTypesByPriority(types) {
  return [...types].sort((a, b) => {
    const ia = VISUAL_PRIORITY.indexOf(a);
    const ib = VISUAL_PRIORITY.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

function dedupeRelationships(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.type}::${String(r.topic || "").toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { ...r, evidence: [r.evidence], confidence: [r.confidence || "medium"] });
    } else {
      const curr = map.get(key);
      if (r.evidence && !curr.evidence.includes(r.evidence)) {
        curr.evidence.push(r.evidence);
      }
      if (r.confidence && !curr.confidence.includes(r.confidence)) {
        curr.confidence.push(r.confidence);
      }
    }
  }
  return [...map.values()].map((x) => ({
    type: x.type,
    evidence: x.evidence.join("; "),
    confidence: x.confidence.includes("high")
      ? "high"
      : x.confidence.includes("medium")
        ? "medium"
        : "low",
    recommended_visual: x.recommended_visual || x.type,
    topic: x.topic,
  }));
}

function generateLearningObjectives({ topic, learnerLevel, relationships, keyConcepts }) {
  const relTypes = new Set(relationships.map((r) => r.type));
  const out = [];
  const add = (v) => {
    if (v && !out.includes(v)) out.push(v);
  };
  add(`Identify the main ideas in ${topic || "the lesson topic"} at a ${learnerLevel} level.`);
  if (relTypes.has("timeline")) add(`Sequence important events related to ${topic || "the topic"} in chronological order.`);
  if (relTypes.has("comparison_table")) add(`Compare key similarities and differences using evidence from the lesson.`);
  if (relTypes.has("flowchart") || relTypes.has("process_diagram")) add(`Explain how the process works step by step.`);
  if (relTypes.has("chart")) add(`Interpret trends and measurements shown in the lesson data.`);
  if (relTypes.has("map")) add(`Describe where key places are located and why location matters.`);
  if (relTypes.has("labeled_diagram")) add(`Describe the main parts and their roles in the system.`);
  if (relTypes.has("cause_effect_diagram")) add(`Evaluate how causes lead to short- and long-term effects.`);
  if (!out.length && keyConcepts[0]) add(`Explain ${keyConcepts[0]} in your own words.`);
  return out.slice(0, 5);
}

function buildVisualCard(result, visualType, idx, reason) {
  const img = result.generated_image?.base64
    ? {
        mime: result.generated_image.mime_type || "image/png",
        base64: result.generated_image.base64,
      }
    : null;
  const image_url = img ? `data:${img.mime};base64,${img.base64}` : "";
  return {
    id: `visual_${idx + 1}`,
    title: `${String(visualType || "visual").replace(/_/g, " ")} visual`,
    visual_reason: reason || "",
    visual_type: visualType,
    diagram_format: diagramFormatFrom(result, visualType),
    diagram_data: result.diagram_data || {},
    mermaid: result.diagram_data?.mermaid || result.mermaid || "",
    image_prompt: result.image_prompt || "",
    image_url,
    labels: Array.isArray(result.labels) ? result.labels : [],
    alt_text: result.alt_text || "",
    student_caption: result.student_caption || "",
    verification_notes: result.verification_notes || [],
    generated_image: result.generated_image || undefined,
    illustration_image_status: result.illustration_image_status || null,
    illustration_image_error: result.illustration_image_error || null,
  };
}

/**
 * End-to-end: analyze lesson, resolve primary/secondary visuals, merge structured outputs.
 */
async function buildEducationalVisual(payload) {
  const analysis = await analyzeLesson(payload);
  const lessonText = String(payload.lessonText || "");
  const chunks = chunkLessonText(lessonText);
  const relationshipRows = [];
  let mergedSignals = { detected_features: {} };

  for (const chunk of chunks.length ? chunks : [lessonText]) {
    const chunkSignals = extractLearningSignals(chunk, "", analysis);
    mergedSignals = chunkSignals;
    const found = detectVisualTypesFromSignals(chunkSignals);
    for (const f of found) {
      relationshipRows.push({
        ...f,
        topic: analysis.main_topic || "",
      });
    }
  }

  const deduped = dedupeRelationships(relationshipRows);
  let orderedTypes = sortTypesByPriority(deduped.map((d) => d.type));
  if (!orderedTypes.length) {
    orderedTypes = ["illustration"];
  }
  const relationshipByType = new Map(
    deduped.map((d) => [d.type, d])
  );

  const visuals = [];
  for (const vt of orderedTypes) {
    const ctx = buildContextBlock(
      {
        ...payload,
        subject: payload.subject || inferSubjectFromText(lessonText),
        learningObjective: payload.learningObjective || "",
        gradeLevel: payload.gradeLevel || inferLearnerLevelFromAge(payload.studentAge),
      },
      analysis
    );
    const generated = await generateForPrimary(vt, ctx, analysis, {
      ...payload,
      __validPrimaryLabeled: vt === "labeled_diagram",
    });
    visuals.push(
      buildVisualCard(
        generated,
        vt,
        visuals.length,
        relationshipByType.get(vt)?.evidence || ""
      )
    );
  }

  const first = visuals[0] || null;
  const second = visuals[1] || null;
  const learner_level = inferLearnerLevelFromAge(payload.studentAge);
  const subject = String(payload.subject || "").trim() || inferSubjectFromText(lessonText);
  const topic = analysis.main_topic || "Lesson topic";
  const summary = summarizeLessonText(lessonText);
  const key_concepts = Array.isArray(analysis.key_concepts)
    ? analysis.key_concepts.slice(0, 12)
    : [];
  const learning_objectives = generateLearningObjectives({
    topic,
    learnerLevel: learner_level,
    relationships: deduped,
    keyConcepts: key_concepts,
  });

  const fallback_used =
    orderedTypes.length === 1 && orderedTypes[0] === "illustration";

  // New schema (multi-visual automatic generator)
  const out = {
    topic,
    subject,
    learner_level,
    student_age: String(payload.studentAge || "").trim(),
    summary,
    learning_objectives,
    key_concepts,
    detected_relationships: deduped.map((r) => ({
      type: r.type,
      evidence: r.evidence,
      recommended_visual: r.recommended_visual,
      confidence: r.confidence || "medium",
    })),
    visuals,
    fallback_used,
  };

  if (!Array.isArray(out.visuals) || out.visuals.length === 0) {
    const ctx = buildContextBlock(
      {
        ...payload,
        subject,
        learningObjective: "",
        gradeLevel: learner_level,
      },
      analysis
    );
    const generated = await generateForPrimary("illustration", ctx, analysis, {
      ...payload,
      __validPrimaryLabeled: false,
    });
    out.visuals = [
      buildVisualCard(
        generated,
        "illustration",
        0,
        "Fallback: no strong structured relationship detected."
      ),
    ];
    out.fallback_used = true;
  }

  out.visuals = out.visuals.map((v, i) => ({
    ...v,
    id: `visual_${i + 1}`,
    image_prompt:
      v.visual_type === "illustration" && !String(v.image_prompt || "").trim()
        ? buildFallbackIllustrationPrompt(analysis, payload)
        : v.image_prompt,
  }));

  // Backward compatibility fields (existing frontend dependencies)
  if (first) {
    out.primary_visual = first.visual_type;
    out.secondary_visual = second?.visual_type || "";
    out.visual_reason = first.visual_reason || `Auto: selected from learning relationships.`;
    out.contentMismatch = false;
    out.detected_features = mergedSignals.detected_features || {};
    out.helper_note =
      first.visual_type === "labeled_diagram" ? LABELED_HELPER_NOTE : "";
    out.diagram_format = first.diagram_format || "";
    out.diagram_data = first.diagram_data || {};
    out.mermaid = first.mermaid || "";
    out.image_prompt = first.image_prompt || "";
    out.illustration_image_status = first.illustration_image_status || null;
    out.illustration_image_error = first.illustration_image_error || null;
    out.labels = Array.isArray(first.labels) ? first.labels : [];
    out.alt_text = first.alt_text || analysis.alt_text || "";
    out.student_caption = first.student_caption || "";
    out.verification_notes = first.verification_notes || [];
    out.image_url = first.image_url || "";
    if (first.generated_image?.base64) {
      out.generated_image = first.generated_image;
    }
  }

  return out;
}

module.exports = { buildEducationalVisual, styleModifier };
