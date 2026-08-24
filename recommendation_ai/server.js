const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5003;
const API_GATEWAY_URL = (process.env.API_GATEWAY_URL || 'http://localhost:4000')
  .replace(/\/+$/, '');
const configuredCognitiveDatabase = process.env.COGNITIVE_DB_NAME || 'lime-data';
const COGNITIVE_DB_NAME = /^[a-zA-Z0-9_-]+$/.test(configuredCognitiveDatabase)
  ? configuredCognitiveDatabase
  : 'lime-data';
const COGNITIVE_SUMMARY_TABLE = `\`${COGNITIVE_DB_NAME}\`.\`student-lesson-summary\``;
const TOP_SIGNALS_TABLE = `\`${COGNITIVE_DB_NAME}\`.\`student-lesson-top-signals\``;
const configuredStyleDatabase = process.env.COGNITIVE_STYLE_DB_NAME || 'cognitive-style-explanations';
const COGNITIVE_STYLE_DB_NAME = /^[a-zA-Z0-9_-]+$/.test(configuredStyleDatabase)
  ? configuredStyleDatabase
  : 'cognitive-style-explanations';
const COGNITIVE_STYLE_TABLE = `\`${COGNITIVE_STYLE_DB_NAME}\`.\`cognitive-style-analysis\``;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const RECOMMENDATION_PROMPT_VERSION = 'evidence-next-lesson-v1';

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  // Recommendation results are stored only in the class database.
  database: process.env.DB_NAME || 'class',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const LOAD_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

function normalizeLoadLabel(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  const labels = {
    'very low': 'Very Low',
    low: 'Low',
    law: 'Low',
    medium: 'Medium',
    moderate: 'Medium',
    high: 'High',
    'very high': 'Very High',
  };
  return labels[normalized] || 'Unknown';
}

function createCounts(rows) {
  const counts = Object.fromEntries(LOAD_LEVELS.map((level) => [level, 0]));
  counts.Unknown = 0;

  for (const row of rows) {
    const level = normalizeLoadLabel(row.load_level);
    counts[level] += Number(row.load_count || 0);
  }
  return counts;
}

function calculateBoxPlotStats(values) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;

  const percentile = (position) => {
    const index = (sorted.length - 1) * position;
    const lowerIndex = Math.floor(index);
    const fraction = index - lowerIndex;
    const lower = sorted[lowerIndex];
    const upper = sorted[lowerIndex + 1] ?? lower;
    return lower + fraction * (upper - lower);
  };

  return [sorted[0], percentile(0.25), percentile(0.5), percentile(0.75), sorted.at(-1)]
    .map((value) => Number(value.toFixed(2)));
}

function dominantLoad(counts) {
  const classifiedTotal = LOAD_LEVELS.reduce((sum, level) => sum + counts[level], 0);
  if (classifiedTotal === 0) return 'Unknown';

  // In a tie, prefer the higher-load category so the advice remains cautious.
  return LOAD_LEVELS.reduce((winner, level) => {
    if (counts[level] >= counts[winner]) return level;
    return winner;
  }, LOAD_LEVELS[0]);
}

function recommendationFor(load, courseName) {
  const subject = courseName ? ` for ${courseName}` : '';
  const recommendations = {
    'Very High': `The dominant cognitive load${subject} is very high. Begin the next lesson with a short recap, divide new material into smaller steps, use worked examples, and add frequent understanding checks and brief pauses before introducing another concept.`,
    High: `The dominant cognitive load${subject} is high. Slow the next lesson slightly, review the most important prerequisite, scaffold difficult tasks with an example, and check understanding before independent practice.`,
    Medium: `The dominant cognitive load${subject} is medium. Keep a similar pace and complexity in the next lesson, while using short retrieval questions and one guided example to confirm that students remain on track.`,
    Low: `The dominant cognitive load${subject} is low. Increase the challenge in the next lesson with application-based problems, less step-by-step support, and opportunities for students to explain or compare solutions.`,
    'Very Low': `The dominant cognitive load${subject} is very low. Move through review material quickly and use extension tasks, unfamiliar examples, and higher-order problem solving to make the next lesson more demanding.`,
  };
  return recommendations[load] || `There is not enough classified cognitive-load data${subject} to adjust the next lesson reliably.`;
}

function safeJsonParse(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback);
  } catch {
    return fallback;
  }
}

function normalizeStyleLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['moderate/intermediatory', 'moderate/intermediate', 'intermediatory', 'moderate', 'intermediate'].includes(normalized)) {
    return 'Intermediate';
  }
  if (normalized === 'visual') return 'Visual';
  if (normalized === 'verbal') return 'Verbal';
  return 'Unknown';
}

function summarizeTopSignals(rows, limit = 3) {
  const aggregate = new Map();
  for (const row of rows) {
    for (let rank = 1; rank <= 3; rank += 1) {
      const signal = String(row[`top_${rank}_signal`] || '').trim();
      if (!signal) continue;
      const key = signal.toLowerCase();
      const current = aggregate.get(key) || { signal, occurrences: 0, importanceTotal: 0, importanceCount: 0 };
      current.occurrences += 1;
      const importance = Number(row[`top_${rank}_normalized_value`]);
      if (Number.isFinite(importance)) {
        current.importanceTotal += importance;
        current.importanceCount += 1;
      }
      aggregate.set(key, current);
    }
  }
  return [...aggregate.values()]
    .map((item) => ({
      signal: item.signal,
      occurrences: item.occurrences,
      averageImportance: item.importanceCount
        ? Number((item.importanceTotal / item.importanceCount).toFixed(4))
        : null,
    }))
    .sort((left, right) => (
      right.occurrences - left.occurrences
      || (right.averageImportance || 0) - (left.averageImportance || 0)
    ))
    .slice(0, limit);
}

function createStyleCounts(rows) {
  const latestPerStudent = new Map();
  for (const row of rows) {
    const key = String(row.student_id);
    if (!latestPerStudent.has(key)) latestPerStudent.set(key, row);
  }
  const counts = { Visual: 0, Verbal: 0, Intermediate: 0, Unknown: 0 };
  for (const row of latestPerStudent.values()) {
    counts[normalizeStyleLabel(row.cognitive_style)] += 1;
  }
  return counts;
}

function percentage(value, total) {
  return total > 0 ? Number(((Number(value) / total) * 100).toFixed(1)) : 0;
}

function buildEvidenceSnapshot({ course, lessonIds, counts, boxPlotData, commonSignals, styleCounts }) {
  const classifiedTotal = LOAD_LEVELS.reduce((sum, level) => sum + Number(counts[level] || 0), 0);
  const styleTotal = Object.values(styleCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const lessonTitles = (course.sections || []).flatMap((section) =>
    (section.subsections || []).map((lesson) => lesson.title || lesson.name).filter(Boolean)
  );
  return {
    promptVersion: RECOMMENDATION_PROMPT_VERSION,
    course: {
      name: course.courseName,
      lessonCount: lessonIds.length,
      lessonTitles: lessonTitles.slice(0, 20),
    },
    cognitiveLoad: {
      counts,
      classifiedTotal,
      aggregationUnit: 'one final result per student per lesson',
      highOrVeryHighPercentage: percentage(
        Number(counts.High || 0) + Number(counts['Very High'] || 0),
        classifiedTotal,
      ),
      dominant: dominantLoad(counts),
    },
    commonSignals,
    cognitiveStyles: {
      counts: styleCounts,
      total: styleTotal,
      percentages: Object.fromEntries(
        Object.entries(styleCounts).map(([style, count]) => [style, percentage(count, styleTotal)])
      ),
    },
    pauseFrequencyBoxPlot: boxPlotData.map((item) => ({
      loadLevel: item.x,
      observations: item.observations,
      minimum: item.y[0],
      firstQuartile: item.y[1],
      median: item.y[2],
      thirdQuartile: item.y[3],
      maximum: item.y[4],
    })),
  };
}

function buildRecommendationPrompt(evidence) {
  return [
    `Prompt version: ${RECOMMENDATION_PROMPT_VERSION}.`,
    'Create an evidence-based plan for the teacher\'s next lesson.',
    'Use only the supplied evidence. Never invent student behaviour, lesson content, or causes.',
    'Treat cognitive style as an observed lesson preference, not a permanent learner trait.',
    'Write 130-190 words in plain teacher-friendly English.',
    'Start with one short class insight, followed by exactly three numbered actions.',
    'Connect every action to a supplied load pattern, common signal, style distribution, or course detail.',
    'If an evidence category has no observations, omit it rather than guessing.',
    'Do not mention Gemini, prompts, databases, LIME, SHAP, algorithms, or confidence scores.',
    `Evidence:\n${JSON.stringify(evidence, null, 2)}`,
  ].join('\n');
}

async function generateGeminiRecommendation(evidence) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: 'You are a cautious educational planning assistant. Produce actionable next-lesson guidance grounded only in supplied class evidence.' }],
          },
          contents: [{ role: 'user', parts: [{ text: buildRecommendationPrompt(evidence) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 450 },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text || text.length < 80) throw new Error('Gemini returned an incomplete recommendation.');
    return { text, model: GEMINI_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS next_lesson_recommendations (
      id BIGINT NOT NULL AUTO_INCREMENT,
      teacher_id VARCHAR(50) NOT NULL,
      course_id VARCHAR(50) NOT NULL,
      course_name VARCHAR(255) NOT NULL,
      matched_lesson_ids TEXT NOT NULL,
      very_low_count INT NOT NULL DEFAULT 0,
      low_count INT NOT NULL DEFAULT 0,
      medium_count INT NOT NULL DEFAULT 0,
      high_count INT NOT NULL DEFAULT 0,
      very_high_count INT NOT NULL DEFAULT 0,
      unknown_count INT NOT NULL DEFAULT 0,
      total_observations INT NOT NULL DEFAULT 0,
      dominant_cognitive_load VARCHAR(20) NOT NULL,
      recommendation_text TEXT NOT NULL,
      generated_recommendation_text TEXT NULL,
      baseline_recommendation_text TEXT NULL,
      recommendation_source VARCHAR(40) NOT NULL DEFAULT 'fixed-template',
      generation_model VARCHAR(100) NULL,
      evidence_snapshot LONGTEXT NULL,
      fallback_reason TEXT NULL,
      teacher_review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      teacher_review_reason TEXT NULL,
      box_plot_data LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_next_recommendation_teacher_course (teacher_id, course_id),
      INDEX idx_next_recommendation_course (course_id)
    )
  `);

  const [boxPlotColumns] = await pool.query(
    `SELECT COUNT(*) AS column_count
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'next_lesson_recommendations'
        AND COLUMN_NAME = 'box_plot_data'`
  );
  if (Number(boxPlotColumns[0].column_count) === 0) {
    await pool.query(
      'ALTER TABLE next_lesson_recommendations ADD COLUMN box_plot_data LONGTEXT NULL AFTER recommendation_text'
    );
  }

  const requiredColumns = {
    generated_recommendation_text: 'TEXT NULL AFTER recommendation_text',
    baseline_recommendation_text: 'TEXT NULL AFTER generated_recommendation_text',
    recommendation_source: "VARCHAR(40) NOT NULL DEFAULT 'fixed-template' AFTER baseline_recommendation_text",
    generation_model: 'VARCHAR(100) NULL AFTER recommendation_source',
    evidence_snapshot: 'LONGTEXT NULL AFTER generation_model',
    fallback_reason: 'TEXT NULL AFTER evidence_snapshot',
    teacher_review_status: "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER fallback_reason",
    teacher_review_reason: 'TEXT NULL AFTER teacher_review_status',
  };
  for (const [column, definition] of Object.entries(requiredColumns)) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS column_count
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'next_lesson_recommendations'
          AND COLUMN_NAME = ?`,
      [column],
    );
    if (Number(rows[0].column_count) === 0) {
      await pool.query(`ALTER TABLE next_lesson_recommendations ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS next_lesson_recommendation_reviews (
      id BIGINT NOT NULL AUTO_INCREMENT,
      recommendation_id BIGINT NOT NULL,
      teacher_id VARCHAR(50) NOT NULL,
      course_id VARCHAR(50) NOT NULL,
      action VARCHAR(20) NOT NULL,
      reason TEXT NULL,
      recommendation_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_review_recommendation (recommendation_id),
      INDEX idx_review_teacher_course (teacher_id, course_id)
    )
  `);
}

function authorizationHeader(req) {
  const value = req.headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value : '';
}

async function loadOwnedCourse(req, courseId) {
  const authorization = authorizationHeader(req);
  if (!authorization) {
    const error = new Error('No token provided. Access denied.');
    error.status = 403;
    throw error;
  }

  let response;
  try {
    response = await fetch(
      `${API_GATEWAY_URL}/api/courses/${encodeURIComponent(courseId)}/for-edit`,
      {
        headers: {
          Authorization: authorization,
        },
      }
    );
  } catch (cause) {
    const error = new Error('Course service is unavailable.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Could not verify the selected course.');
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function courseLessonIds(course) {
  const ids = new Set([String(course.id)]);
  for (const section of course.sections || []) {
    for (const subsection of section.subsections || []) {
      if (subsection.id) ids.add(String(subsection.id));
    }
  }
  return [...ids];
}

async function loadCounts(lessonIds) {
  const placeholders = lessonIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT predicted_cognitive_load AS load_level, COUNT(*) AS load_count
       FROM ${COGNITIVE_SUMMARY_TABLE}
      WHERE lesson_id IN (${placeholders})
      GROUP BY predicted_cognitive_load`,
    lessonIds
  );
  return createCounts(rows);
}

async function loadBoxPlotData(lessonIds) {
  const placeholders = lessonIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT predicted_cognitive_load AS load_level,
            pause_frequency AS pause_frequency
       FROM ${COGNITIVE_SUMMARY_TABLE}
      WHERE lesson_id IN (${placeholders})`,
    lessonIds
  );

  const groupedValues = Object.fromEntries(LOAD_LEVELS.map((level) => [level, []]));
  for (const row of rows) {
    const level = normalizeLoadLabel(row.load_level);
    const value = Number(row.pause_frequency);
    if (groupedValues[level] && Number.isFinite(value)) {
      groupedValues[level].push(value);
    }
  }

  return LOAD_LEVELS.map((level) => ({
    x: level,
    y: calculateBoxPlotStats(groupedValues[level]),
    observations: groupedValues[level].length,
  })).filter((item) => item.y);
}

async function loadCourseStudentIds(lessonIds) {
  const placeholders = lessonIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT DISTINCT student_id
       FROM ${COGNITIVE_SUMMARY_TABLE}
      WHERE lesson_id IN (${placeholders})`,
    lessonIds,
  );
  return rows.map((row) => String(row.student_id)).filter(Boolean);
}

async function loadCommonSignals(lessonIds) {
  const placeholders = lessonIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT top_1_signal, top_1_normalized_value,
            top_2_signal, top_2_normalized_value,
            top_3_signal, top_3_normalized_value
       FROM ${TOP_SIGNALS_TABLE}
      WHERE lesson_id IN (${placeholders})`,
    lessonIds,
  );
  return summarizeTopSignals(rows);
}

async function loadCognitiveStyleCounts(studentIds) {
  if (!studentIds.length) return { Visual: 0, Verbal: 0, Intermediate: 0, Unknown: 0 };
  const placeholders = studentIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT student_id, lesson_id, cognitive_style
       FROM ${COGNITIVE_STYLE_TABLE}
      WHERE student_id IN (${placeholders})
        AND analysis_status = 'completed'
        AND cognitive_style IS NOT NULL
      ORDER BY updated_at DESC, id DESC`,
    studentIds,
  );
  return createStyleCounts(rows);
}

async function optionalEvidence(loader, fallback, label) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`Optional ${label} evidence is unavailable:`, error.message);
    return fallback;
  }
}

function responseRecord(row) {
  const evidence = safeJsonParse(row.evidence_snapshot, null);
  return {
    id: row.id,
    teacherId: row.teacher_id,
    courseId: row.course_id,
    courseName: row.course_name,
    matchedLessonIds: JSON.parse(row.matched_lesson_ids || '[]'),
    counts: {
      'Very Low': row.very_low_count,
      Low: row.low_count,
      Medium: row.medium_count,
      High: row.high_count,
      'Very High': row.very_high_count,
      Unknown: row.unknown_count,
    },
    totalObservations: row.total_observations,
    totalStudentLessonResults: row.total_observations,
    aggregationUnit: 'student-lesson-summary',
    dominantCognitiveLoad: row.dominant_cognitive_load,
    recommendation: row.recommendation_text,
    generatedRecommendation: row.generated_recommendation_text || row.recommendation_text,
    baselineRecommendation: row.baseline_recommendation_text,
    recommendationSource: row.recommendation_source || 'fixed-template',
    generationModel: row.generation_model,
    evidence,
    fallbackReason: row.fallback_reason,
    teacherReview: {
      status: row.teacher_review_status || 'pending',
      reason: row.teacher_review_reason || '',
    },
    boxPlotData: safeJsonParse(row.box_plot_data, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', service: 'nextlessonrecormandation', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'ERROR', service: 'nextlessonrecormandation', database: 'disconnected' });
  }
});

app.post('/recommendations', async (req, res) => {
  const courseId = String(req.body?.courseId || '').trim();
  if (!/^[a-f\d]{24}$/i.test(courseId)) {
    return res.status(400).json({ message: 'A valid courseId is required.' });
  }

  try {
    const course = await loadOwnedCourse(req, courseId);
    const lessonIds = courseLessonIds(course);
    const [counts, boxPlotData, commonSignals, courseStudentIds] = await Promise.all([
      loadCounts(lessonIds),
      loadBoxPlotData(lessonIds),
      optionalEvidence(() => loadCommonSignals(lessonIds), [], 'common-signal'),
      loadCourseStudentIds(lessonIds),
    ]);
    const styleCounts = await optionalEvidence(
      () => loadCognitiveStyleCounts(courseStudentIds),
      { Visual: 0, Verbal: 0, Intermediate: 0, Unknown: 0 },
      'cognitive-style',
    );
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return res.status(404).json({
        message: 'No completed student-lesson cognitive-load summaries were found for this course.',
        courseId,
        matchedLessonIds: lessonIds,
        counts,
      });
    }

    const dominant = dominantLoad(counts);
    const baselineRecommendation = recommendationFor(dominant, course.courseName);
    const evidence = buildEvidenceSnapshot({
      course,
      lessonIds,
      counts,
      boxPlotData,
      commonSignals,
      styleCounts,
    });
    let recommendation = baselineRecommendation;
    let recommendationSource = 'fixed-template';
    let generationModel = null;
    let fallbackReason = null;
    try {
      const generated = await generateGeminiRecommendation(evidence);
      recommendation = generated.text;
      recommendationSource = 'gemini-evidence';
      generationModel = generated.model;
    } catch (generationError) {
      fallbackReason = generationError.message;
      console.warn('Using fixed next-lesson fallback:', fallbackReason);
    }
    const teacherId = String(course.educatorId);

    const [existingRows] = await pool.query(
      'SELECT * FROM next_lesson_recommendations WHERE teacher_id = ? AND course_id = ?',
      [teacherId, courseId],
    );
    if (existingRows.length) {
      await pool.query(
        `INSERT INTO next_lesson_recommendation_reviews
          (recommendation_id, teacher_id, course_id, action, reason, recommendation_text)
         VALUES (?, ?, ?, 'regenerated', NULL, ?)`,
        [existingRows[0].id, teacherId, courseId, existingRows[0].recommendation_text],
      );
    }

    await pool.query(
      `INSERT INTO next_lesson_recommendations
        (teacher_id, course_id, course_name, matched_lesson_ids,
         very_low_count, low_count, medium_count, high_count, very_high_count,
         unknown_count, total_observations, dominant_cognitive_load, recommendation_text,
         generated_recommendation_text, baseline_recommendation_text, recommendation_source, generation_model,
         evidence_snapshot, fallback_reason, teacher_review_status, teacher_review_reason,
         box_plot_data)
       VALUES (?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?,
               ?, ?, ?,
               ?, ?, ?, ?,
               ?, ?,
               'pending', NULL, ?)
       ON DUPLICATE KEY UPDATE
         course_name = VALUES(course_name),
         matched_lesson_ids = VALUES(matched_lesson_ids),
         very_low_count = VALUES(very_low_count),
         low_count = VALUES(low_count),
         medium_count = VALUES(medium_count),
         high_count = VALUES(high_count),
         very_high_count = VALUES(very_high_count),
         unknown_count = VALUES(unknown_count),
         total_observations = VALUES(total_observations),
         dominant_cognitive_load = VALUES(dominant_cognitive_load),
         recommendation_text = VALUES(recommendation_text),
         generated_recommendation_text = VALUES(generated_recommendation_text),
         baseline_recommendation_text = VALUES(baseline_recommendation_text),
         recommendation_source = VALUES(recommendation_source),
         generation_model = VALUES(generation_model),
         evidence_snapshot = VALUES(evidence_snapshot),
         fallback_reason = VALUES(fallback_reason),
         teacher_review_status = 'pending',
         teacher_review_reason = NULL,
         box_plot_data = VALUES(box_plot_data),
         updated_at = CURRENT_TIMESTAMP`,
      [
        teacherId, courseId, course.courseName, JSON.stringify(lessonIds),
        counts['Very Low'], counts.Low, counts.Medium, counts.High,
        counts['Very High'], counts.Unknown, total, dominant, recommendation,
        recommendation, baselineRecommendation, recommendationSource, generationModel,
        JSON.stringify(evidence), fallbackReason,
        JSON.stringify(boxPlotData),
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM next_lesson_recommendations WHERE teacher_id = ? AND course_id = ?',
      [teacherId, courseId]
    );
    return res.status(201).json({
      success: true,
      data: responseRecord(rows[0]),
    });
  } catch (error) {
    console.error('Next lesson recommendation failed:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Failed to create the next lesson recommendation.',
    });
  }
});

app.patch('/recommendations/:courseId/review', async (req, res) => {
  const courseId = String(req.params.courseId || '').trim();
  const action = String(req.body?.action || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  const editedRecommendation = String(req.body?.recommendation || '').trim();
  if (!/^[a-f\d]{24}$/i.test(courseId)) {
    return res.status(400).json({ message: 'A valid courseId is required.' });
  }
  if (!['approved', 'edited', 'rejected'].includes(action)) {
    return res.status(400).json({ message: 'Action must be approved, edited, or rejected.' });
  }
  if (action === 'edited' && editedRecommendation.length < 20) {
    return res.status(400).json({ message: 'Enter the revised recommendation before saving.' });
  }
  if (action === 'rejected' && reason.length < 3) {
    return res.status(400).json({ message: 'Add a short reason for rejecting the recommendation.' });
  }

  try {
    const course = await loadOwnedCourse(req, courseId);
    const teacherId = String(course.educatorId);
    const [rows] = await pool.query(
      'SELECT * FROM next_lesson_recommendations WHERE teacher_id = ? AND course_id = ?',
      [teacherId, courseId],
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Generate a recommendation before reviewing it.' });
    }

    const current = rows[0];
    const reviewedText = action === 'edited' ? editedRecommendation : current.recommendation_text;
    await pool.query(
      `UPDATE next_lesson_recommendations
          SET recommendation_text = ?, teacher_review_status = ?, teacher_review_reason = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [reviewedText, action, reason || null, current.id],
    );
    await pool.query(
      `INSERT INTO next_lesson_recommendation_reviews
        (recommendation_id, teacher_id, course_id, action, reason, recommendation_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [current.id, teacherId, courseId, action, reason || null, reviewedText],
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM next_lesson_recommendations WHERE id = ?',
      [current.id],
    );
    return res.json({ success: true, data: responseRecord(updatedRows[0]) });
  } catch (error) {
    console.error('Recommendation review failed:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Failed to save the teacher review.',
    });
  }
});

app.get('/recommendations/:courseId', async (req, res) => {
  const courseId = String(req.params.courseId || '').trim();
  if (!/^[a-f\d]{24}$/i.test(courseId)) {
    return res.status(400).json({ message: 'A valid courseId is required.' });
  }

  try {
    const course = await loadOwnedCourse(req, courseId);
    const [rows] = await pool.query(
      'SELECT * FROM next_lesson_recommendations WHERE teacher_id = ? AND course_id = ?',
      [String(course.educatorId), courseId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'No saved recommendation exists for this course.' });
    }
    return res.json({ success: true, data: responseRecord(rows[0]) });
  } catch (error) {
    console.error('Loading recommendation failed:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Failed to load the saved recommendation.',
    });
  }
});

async function start() {
  await ensureTables();
  app.listen(PORT, () => {
    console.log(`Next Lesson Recommendation service running on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start Next Lesson Recommendation service:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  app,
  calculateBoxPlotStats,
  createCounts,
  dominantLoad,
  normalizeLoadLabel,
  normalizeStyleLabel,
  summarizeTopSignals,
  createStyleCounts,
  buildEvidenceSnapshot,
  buildRecommendationPrompt,
  recommendationFor,
};
