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
const COGNITIVE_LOAD_TABLE = `\`${COGNITIVE_DB_NAME}\`.\`cognitive-load\``;

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
       FROM ${COGNITIVE_LOAD_TABLE}
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
       FROM ${COGNITIVE_LOAD_TABLE}
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

function responseRecord(row) {
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
    dominantCognitiveLoad: row.dominant_cognitive_load,
    recommendation: row.recommendation_text,
    boxPlotData: JSON.parse(row.box_plot_data || '[]'),
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
    const [counts, boxPlotData] = await Promise.all([
      loadCounts(lessonIds),
      loadBoxPlotData(lessonIds),
    ]);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return res.status(404).json({
        message: 'No cognitive-load records were found for this course or its uploaded lessons.',
        courseId,
        matchedLessonIds: lessonIds,
        counts,
      });
    }

    const dominant = dominantLoad(counts);
    const recommendation = recommendationFor(dominant, course.courseName);
    const teacherId = String(course.educatorId);

    await pool.query(
      `INSERT INTO next_lesson_recommendations
        (teacher_id, course_id, course_name, matched_lesson_ids,
         very_low_count, low_count, medium_count, high_count, very_high_count,
         unknown_count, total_observations, dominant_cognitive_load, recommendation_text,
         box_plot_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         box_plot_data = VALUES(box_plot_data),
         updated_at = CURRENT_TIMESTAMP`,
      [
        teacherId, courseId, course.courseName, JSON.stringify(lessonIds),
        counts['Very Low'], counts.Low, counts.Medium, counts.High,
        counts['Very High'], counts.Unknown, total, dominant, recommendation,
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
  recommendationFor,
};
