/**
 * Learning-relationship–based visual selection (not keyword stuffing).
 * Priority when multiple signals match (first wins after hard rules):
 * [strong numeric chart] > [timeline / history] > chart > map > comparison_table > cause_effect_diagram > [hierarchy / classification] >
 * flowchart > process_diagram > labeled_diagram > concept_map (network only) > illustration
 *
 * Timeline (forced from text): years/decades, sequence + historical language, 2+ time references, or
 * classic temporal/chronology cues. Overrides illustration, concept_map, and labeled_diagram unless
 * strong numeric chart / data visualization intent wins first.
 */

const PRIORITY = [
  "chart",
  "timeline",
  "map",
  "comparison_table",
  "cause_effect_diagram",
  "hierarchy_tree",
  "flowchart",
  "process_diagram",
  "labeled_diagram",
  "concept_map",
  "illustration",
];

const ALL_TYPES = new Set(PRIORITY);

const UI_ALIASES = {
  auto: "auto",
  labeled_diagram: "labeled_diagram",
  labeled: "labeled_diagram",
  diagram: "labeled_diagram",
  "labeled diagram": "labeled_diagram",
  flowchart: "flowchart",
  timeline: "timeline",
  chart: "chart",
  comparison_table: "comparison_table",
  "comparison table": "comparison_table",
  table: "comparison_table",
  comparison: "comparison_table",
  illustration: "illustration",
  map: "map",
  process_diagram: "process_diagram",
  "process diagram": "process_diagram",
  cause_effect_diagram: "cause_effect_diagram",
  "cause effect": "cause_effect_diagram",
  hierarchy_tree: "hierarchy_tree",
  hierarchy: "hierarchy_tree",
  concept_map: "concept_map",
  "concept map": "concept_map",
};

/**
 * Maps UI / API values to canonical visual_type strings.
 */
function normalizeVisualTypeInput(input) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, "_");
  if (s === "auto") return "auto";
  const mapped = UI_ALIASES[s] || UI_ALIASES[s.replace(/_/g, " ")];
  if (mapped) return mapped;
  const underscored = s.replace(/\s+/g, "_");
  if (ALL_TYPES.has(underscored)) return underscored;
  return "illustration";
}

/**
 * Chart beats timeline only when the lesson clearly centers on numeric / data visualization.
 * @param {string} hay lowercased haystack
 */
function computeStrongNumericChart(hay) {
  const explicitDataviz =
    /\b(bar chart|line chart|pie chart|scatter|histogram|data (table|set)|x-?axis|y-?axis|plot the|chart shows|graph shows|recharts|rechart)\b/i.test(
      hay
    );
  const numTokens = hay.match(/\b\d+(\.\d+)?\b/g) || [];
  const manyNumbers = numTokens.length >= 4;
  const hasPercent = /\d+\s*%/.test(hay);
  const statsContext =
    /\b(mean|median|mode|average|standard deviation|frequency|survey|sample size|n\s*=\s*\d+|correlation|regression|dataset)\b/i.test(
      hay
    );
  return (
    explicitDataviz ||
    (hasPercent && manyNumbers) ||
    (statsContext && numTokens.length >= 3) ||
    /\b(quarterly|annual|per year|growth rate|percentage point)\b/i.test(hay)
  );
}

/**
 * @returns {{ detected_features: object, timelinePreferred: boolean }}
 */
function computeTimelineDetection(hay) {
  const has_years =
    /\b(19|20)\d{2}s?\b|\b\d{4}\b|\b\d{3,4}\s*(ce|bce|ad|bc)\b/i.test(hay);

  const sequenceWords =
    /\b(before|after|later|then|next|finally|today|initially)\b/gi;
  const seqMatches = hay.match(sequenceWords) || [];
  const has_sequence_words = seqMatches.length > 0;

  const histRe =
    /\b(began|started|developed|evolved|expanded|introduced|transformed)\b/gi;
  const has_historical_progression = histRe.test(hay);

  const yearMatches = hay.match(/\b(19|20)\d{2}s?\b|\b\d{4}\b/g) || [];
  const narrativeTime =
    /\b(today|now|present[- ]day|currently|modern era|contemporary|initially|finally)\b/gi;
  const narrativeHits = hay.match(narrativeTime) || [];
  const timeMarkers = new Set();
  yearMatches.forEach((y) => timeMarkers.add(`y:${y}`));
  narrativeHits.forEach((n) => timeMarkers.add(`n:${String(n).toLowerCase()}`));
  const time_reference_count = Math.min(32, timeMarkers.size || yearMatches.length);

  const legacyTemporal =
    /\b\d{3,4}\s*(ce|bce|ad|bc)\b|\bcentury\b|\bdecade\b|\btimeline\b|\bchronolog|\bhistorical order\b|\bhistorical development\b|\bover time\b|\breign\b|\bwar of\b|\bbefore christ\b/i.test(
      hay
    );

  const force_timeline = time_reference_count >= 2;

  const timelinePreferred =
    force_timeline ||
    has_years ||
    legacyTemporal ||
    (has_historical_progression && has_sequence_words) ||
    /\b(timeline|chronolog)\b/i.test(hay);

  const detected_features = {
    has_years,
    has_sequence_words,
    has_historical_progression,
    time_reference_count,
    force_timeline,
  };

  return { detected_features, timelinePreferred };
}

/**
 * Distinguish taxonomy / parent→child (hierarchy_tree) from non-hierarchical concept networks (concept_map).
 */
function computeHierarchyConceptFeatures(hay, analysis) {
  const has_classification_keywords =
    /\bclassified into\b/i.test(hay) ||
    /\btypes of\b/i.test(hay) ||
    /\bcategories\b/i.test(hay) ||
    /\bgroups\b/i.test(hay) ||
    /\bbelongs to\b/i.test(hay) ||
    /\b(includes?|including)\b/i.test(hay) ||
    /\bdivided into\b/i.test(hay) ||
    /\bconsists of groups\b/i.test(hay);

  const has_parent_child_structure =
    /[→>➜]/.test(hay) ||
    /\b(subgroup|subgroups|sub-?categor(?:y|ies)?|branches under|child (group|class|category))\b/i.test(
      hay
    );

  const taxonomyStrong =
    /\b(classification|taxonomy|classify|classified|kingdom|phylum|genus|species|vertebrate|invertebrate)\b/i.test(
      hay
    );

  const rels = Array.isArray(analysis?.concept_relationships)
    ? analysis.concept_relationships
    : [];
  const keyCount = Array.isArray(analysis?.key_concepts)
    ? analysis.key_concepts.length
    : 0;
  const manyConnected = rels.length >= 5 || keyCount >= 7;

  const networkCue =
    /\b(interconnected|influence each|network of|web of ideas|mutual(ly)? (effect|influence)|feedback between|ideas that link)\b/i.test(
      hay
    );

  const hierarchyPreferred =
    has_classification_keywords ||
    (has_parent_child_structure && taxonomyStrong) ||
    (taxonomyStrong && /\b(groups|types|categories|classes)\b/i.test(hay));

  const is_network =
    Boolean(manyConnected) &&
    Boolean(networkCue || rels.length >= 8) &&
    !hierarchyPreferred;

  return {
    has_classification_keywords,
    has_parent_child_structure,
    is_network,
    hierarchyPreferred,
  };
}

/**
 * @returns {object} learning signals derived from lesson + objective + analysis
 */
function extractLearningSignals(lessonText, learningObjective, analysis) {
  const lesson = String(lessonText || "").toLowerCase();
  const objective = String(learningObjective || "").toLowerCase();
  const text = `${lesson}\n${objective}`;
  const concepts = Array.isArray(analysis?.key_concepts)
    ? analysis.key_concepts.map((c) => String(c).toLowerCase()).join(" ")
    : "";
  const hay = `${text} ${concepts}`;
  const rels = Array.isArray(analysis?.concept_relationships)
    ? analysis.concept_relationships
    : [];

  const strongNumericChart = computeStrongNumericChart(hay);
  const { detected_features: timelineFeatures, timelinePreferred: timelineFromRules } =
    computeTimelineDetection(hay);
  const hierarchyConcept = computeHierarchyConceptFeatures(hay, analysis);
  const detected_features = {
    ...timelineFeatures,
    has_classification_keywords: hierarchyConcept.has_classification_keywords,
    has_parent_child_structure: hierarchyConcept.has_parent_child_structure,
    is_network: hierarchyConcept.is_network,
  };

  const quantitative =
    /\d+\s*%|\bpercent|\bpercentage|\bmean\b|\bmedian\b|\btrend\b|\bgraph\b|\bdataset\b|\bfrequency\b|\bmeasurement\b|\bratio\b|\bstatistic|\bsurvey\b|\bplot\b|\bchart\b|\bincrease(d|s)?\b|\bdecrease(d|s)?\b/i.test(
      hay
    ) || /\d+\.\d+/.test(hay);

  const temporal =
    timelineFromRules ||
    /\b\d{3,4}\s*(ce|bce|ad|bc)\b|\b\d{4}\b.*\b(year|century|era)\b|\bcentury\b|\bdecade\b|\btimeline\b|\bchronolog|\bhistorical order\b|\breign\b|\bwar of\b|\bbefore christ\b/i.test(
      hay
    );

  const geographic =
    /\b(map|mapping|geograph|region|country|countries|border|river|mountain|latitude|longitude|ocean|continent|equator|hemisphere|located in|north of|south of|east of|west of|terrain)\b/i.test(
      hay
    );

  const compareContrast =
    /\b(compare|contrast|versus|vs\.?|similarit|differen|alike|unlike|both .{1,40} and |whereas|although|on the other hand)\b/i.test(
      hay
    );

  const sequenceProcedure =
    /\b(step\s*\d|first\b.{0,80}\bthen\b|\bnext\b.{0,40}\bthen\b|\bprocedure\b|\bworkflow\b|\balgorithm\b|\blifecycle\b|\bsequence of\b|\border of events\b|\bpass(es|ed)? through\b|\btravels?\s+(from|through|into)\b|\bmovement of\b|\bblood flow\b|\bdigestive\b)/i.test(
      hay
    ) || /\b(and then|followed by|leading to the)\b/i.test(hay);

  const organPathway =
    /\b(mouth|esophagus|stomach|intestine|atrium|ventricle|artery|vein|bronchi|trachea)\b/i.test(
      hay
    ) && /\b(into|through|from|toward|down to|up to)\b/i.test(hay);

  const ioProcess =
    /\b(convert|produces?|releases?|absorbs?|reactants?|products?|takes in|gives off|inputs? and outputs?|photosynthesis|respiration|combustion)\b/i.test(
      hay
    );

  const partsStructure =
    /\b(parts?\s+of|structure of|anatomy|components?|layers?|organelle|organ system|cross-?section|cell parts|dissect)\b/i.test(
      hay
    );

  const causeEffect =
    /\b(because|therefore|causes?|caused|causing|leads? to|lead to|as a result|effect of|effects?|due to|resulting in|results in|consequence|consequences?|damages?|damaged|creates?|created|create|forcing|forces?|forced|affects?|affected|affect|so that)\b/i.test(
      hay
    );

  const hierarchy =
    /\b(categories|classification|types of|groups? of|taxonomy|subdivide|subcategory|genus|species|branch)\b/i.test(
      hay
    );

  const abstractSocial =
    /\b(democracy|justice|feelings?|community|society|culture|emotion|ethical|values?|citizenship|identity)\b/i.test(
      hay
    );

  const manyConnected =
    rels.length >= 5 || (Array.isArray(analysis?.key_concepts) && analysis.key_concepts.length >= 7);

  const partsAndSequence =
    (partsStructure || /\b(organs?|tissues?)\b/i.test(hay)) &&
    (sequenceProcedure || organPathway);

  const physicalPartsEmphasis =
    partsStructure ||
    /\b(consists of|made up of|each part|components? including|cell wall|cell membrane|plasma membrane|nucleus|cytoplasm|chloroplast|mitochondri|organelle|vacuole|ribosome|tissue|layers?|structure of (the )?(cell|plant|animal|organ))\b/i.test(
      hay
    );

  return {
    quantitative,
    temporal,
    geographic,
    compareContrast,
    sequenceProcedure,
    organPathway,
    ioProcess,
    partsStructure,
    causeEffect,
    hierarchy,
    abstractSocial,
    manyConnected,
    partsAndSequence,
    physicalPartsEmphasis,
    hay,
    strongNumericChart,
    timelinePreferred: timelineFromRules,
    hierarchyPreferred: hierarchyConcept.hierarchyPreferred,
    is_network: hierarchyConcept.is_network,
    detected_features,
  };
}

/** Process / sequence / pathway — not ideal as primary labeled diagram. */
function isStrongProcessContent(signals) {
  const s = signals;
  const h = s.hay || "";
  return Boolean(
    s.sequenceProcedure ||
      s.organPathway ||
      (s.ioProcess &&
        /\b(photosynthesis|digestion|respiration|fermentation|hydrolysis|combustion)\b/i.test(h)) ||
      /\b(lifecycle|life cycle|food movement|blood flow|pathway through)\b/i.test(h)
  );
}

function priorityPick(signals) {
  const s = signals;
  if (s.strongNumericChart) {
    return "chart";
  }
  if (s.timelinePreferred) {
    return "timeline";
  }
  if (s.hierarchyPreferred) {
    return "hierarchy_tree";
  }
  const checks = {
    chart: () => s.quantitative,
    timeline: () => s.temporal && !s.timelinePreferred,
    map: () => s.geographic,
    comparison_table: () => s.compareContrast,
    flowchart: () =>
      s.sequenceProcedure || s.organPathway || (s.partsAndSequence && s.sequenceProcedure),
    process_diagram: () =>
      s.ioProcess &&
      !s.sequenceProcedure &&
      !s.organPathway &&
      !s.compareContrast,
    labeled_diagram: () =>
      s.physicalPartsEmphasis &&
      !s.sequenceProcedure &&
      !s.organPathway &&
      !s.ioProcess &&
      !s.compareContrast &&
      !s.timelinePreferred &&
      !s.hierarchyPreferred,
    cause_effect_diagram: () =>
      s.causeEffect && !s.quantitative && !s.temporal && !s.timelinePreferred,
    hierarchy_tree: () =>
      s.hierarchy && !s.timelinePreferred && !s.hierarchyPreferred,
    concept_map: () =>
      s.manyConnected &&
      Boolean(s.is_network) &&
      !s.compareContrast &&
      !s.timelinePreferred &&
      !s.hierarchyPreferred,
    illustration: () =>
      s.abstractSocial && !s.timelinePreferred && !s.is_network,
  };

  for (const type of PRIORITY) {
    if (checks[type] && checks[type]()) {
      return type;
    }
  }
  return "illustration";
}

function recommendSecondary(primary, signals) {
  if (
    primary === "flowchart" &&
    (signals.partsStructure ||
      signals.physicalPartsEmphasis ||
      signals.partsAndSequence ||
      signals.organPathway)
  ) {
    return "labeled_diagram";
  }
  if (primary === "process_diagram" && signals.partsStructure) {
    return "";
  }
  return "";
}

function summarizeSignals(signals) {
  const on = [];
  if (signals.quantitative) on.push("quantitative data");
  if (signals.timelinePreferred || signals.temporal) on.push("time/history or chronology");
  if (signals.geographic) on.push("places/spatial");
  if (signals.compareContrast) on.push("compare/contrast");
  if (signals.sequenceProcedure || signals.organPathway) on.push("sequence/pathway");
  if (signals.ioProcess) on.push("inputs–outputs/transformation");
  if (signals.partsStructure) on.push("parts/structure");
  if (signals.causeEffect) on.push("cause and effect");
  if (signals.hierarchyPreferred || signals.hierarchy) on.push("classification or hierarchy");
  if (signals.manyConnected) on.push("many linked ideas");
  if (signals.abstractSocial) on.push("abstract/social theme");
  return on.length ? on.join(", ") : "general lesson content";
}

/**
 * Resolves user choice vs recommended primary/secondary with override messaging.
 */
function resolveVisualSelection(userRaw, signals, _analysis) {
  const recPrimary = priorityPick(signals);
  let recSecondary = recommendSecondary(recPrimary, signals);
  const user = normalizeVisualTypeInput(userRaw);
  const processLike = isStrongProcessContent(signals);

  if (
    user === "labeled_diagram" &&
    processLike &&
    recPrimary !== "labeled_diagram"
  ) {
    if (!recSecondary && signals.physicalPartsEmphasis) {
      recSecondary = "labeled_diagram";
    }
    return {
      primary_visual: recPrimary,
      secondary_visual: recSecondary || "",
      visual_reason: `This lesson is mainly about a process, sequence, pathway, or input–output system—not parts alone. Using "${recPrimary}" as the primary visual${recSecondary === "labeled_diagram" ? "; a labeled diagram is included as secondary support for naming parts" : ""}.`,
      overridden: true,
      user_requested: user,
      contentMismatch: true,
    };
  }

  if (user === "auto") {
    let visual_reason = `Auto: selected from learning relationships (${summarizeSignals(signals)}).`;
    if (recPrimary === "timeline") {
      visual_reason = `The lesson is ordered in time or describes historical change (${summarizeSignals(signals)}).`;
    } else if (recPrimary === "cause_effect_diagram") {
      visual_reason = `The lesson explains how one thing leads to another (${summarizeSignals(signals)}).`;
    } else if (recPrimary === "hierarchy_tree") {
      visual_reason = `The lesson organizes ideas into groups, types, or levels (${summarizeSignals(signals)}).`;
    } else if (recPrimary === "labeled_diagram") {
      visual_reason = `The lesson describes physical parts and structure without a strong sequence or process (${summarizeSignals(signals)}).`;
    }
    return {
      primary_visual: recPrimary,
      secondary_visual: recSecondary || "",
      visual_reason,
      overridden: false,
      user_requested: "auto",
      contentMismatch: false,
    };
  }

  if (user === recPrimary) {
    let visual_reason = `Using your selection "${userRaw}" — it matches the recommended primary visual for this lesson.`;
    if (recPrimary === "labeled_diagram") {
      visual_reason = `Your selection matches this lesson: it focuses on parts and components, not a sequence or procedure.`;
    }
    return {
      primary_visual: recPrimary,
      secondary_visual: recSecondary || "",
      visual_reason,
      overridden: false,
      user_requested: user,
      contentMismatch: false,
    };
  }

  const compatible =
    (user === "flowchart" && recPrimary === "process_diagram") ||
    (user === "process_diagram" && recPrimary === "flowchart");

  if (compatible) {
    const primary = recPrimary;
    return {
      primary_visual: primary,
      secondary_visual: recSecondary || "",
      visual_reason: `Your choice aligns with a process-style diagram; using "${primary}" as the best match.`,
      overridden: false,
      user_requested: user,
      contentMismatch: false,
    };
  }

  return {
    primary_visual: recPrimary,
    secondary_visual: recSecondary || "",
    visual_reason: `Your selection "${String(userRaw).trim()}" does not match the main learning relationships detected (${summarizeSignals(signals)}). Using "${recPrimary}" instead for clarity.`,
    overridden: true,
    user_requested: user,
    contentMismatch: false,
  };
}

module.exports = {
  PRIORITY,
  ALL_TYPES,
  normalizeVisualTypeInput,
  extractLearningSignals,
  priorityPick,
  recommendSecondary,
  resolveVisualSelection,
  summarizeSignals,
  isStrongProcessContent,
  computeStrongNumericChart,
  computeTimelineDetection,
  computeHierarchyConceptFeatures,
};
