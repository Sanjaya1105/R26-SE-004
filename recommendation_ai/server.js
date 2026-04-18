const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// MySQL connection pool setup
let pool;
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'class',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Create summary_lesson table if it doesn't exist
  pool.query(`
    CREATE TABLE IF NOT EXISTS summary_lesson (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lesson_id VARCHAR(50),
      student_id VARCHAR(50),
      avg_pause_frequency FLOAT,
      avg_quiz_response_time FLOAT,
      avg_error_rate FLOAT,
      overall_cognitive_load VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_lesson_student (lesson_id, student_id)
    )
  `).then(() => {
    console.log('summary_lesson table ready');
  }).catch(err => {
    console.error('Error creating table:', err);
  });

  console.log('Database connection pool created successfully');
} catch (error) {
  console.error('Failed to create database pool:', error);
}

// Get distinct lessons
app.get('/lessons', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT lesson_id FROM cognitive_load_logs WHERE lesson_id IS NOT NULL');
    res.json(rows.map(row => row.lesson_id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Analyze data, save to summary_lesson, and return data
app.post('/analyze/:lesson_id', async (req, res) => {
  const { lesson_id } = req.params;
  try {
    // 1. Get averages from cognitive_load_logs for the lesson
    const [avgData] = await pool.query(`
      SELECT 
        student_id, 
        AVG(pause_frequency) as avg_pause, 
        AVG(quiz_response_time) as avg_quiz, 
        AVG(error_rate) as avg_error
      FROM cognitive_load_logs
      WHERE lesson_id = ?
      GROUP BY student_id
    `, [lesson_id]);

    // 2. Get the mode cognitive load for each student in the lesson
    const [loadData] = await pool.query(`
      SELECT student_id, predicted_cognitive_load, COUNT(*) as count 
      FROM cognitive_load_logs 
      WHERE lesson_id = ? 
      GROUP BY student_id, predicted_cognitive_load
    `, [lesson_id]);

    // Calculate mode
    const modeMap = {};
    loadData.forEach(row => {
      const student = row.student_id;
      if (!modeMap[student]) {
        modeMap[student] = { load: row.predicted_cognitive_load, count: row.count };
      } else if (row.count > modeMap[student].count) {
        modeMap[student] = { load: row.predicted_cognitive_load, count: row.count };
      }
    });

    // 3. Save combined data to summary_lesson
    for (const data of avgData) {
      const modeLoad = modeMap[data.student_id] ? modeMap[data.student_id].load : 'Unknown';
      await pool.query(`
        INSERT INTO summary_lesson 
          (lesson_id, student_id, avg_pause_frequency, avg_quiz_response_time, avg_error_rate, overall_cognitive_load)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          avg_pause_frequency = VALUES(avg_pause_frequency),
          avg_quiz_response_time = VALUES(avg_quiz_response_time),
          avg_error_rate = VALUES(avg_error_rate),
          overall_cognitive_load = VALUES(overall_cognitive_load)
      `, [
        lesson_id, 
        data.student_id, 
        data.avg_pause || 0, 
        data.avg_quiz || 0, 
        data.avg_error || 0, 
        modeLoad
      ]);
    }

    // 4. Fetch the final data back from summary_lesson to return
    const [summaryData] = await pool.query('SELECT * FROM summary_lesson WHERE lesson_id = ?', [lesson_id]);
    res.json(summaryData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'recommendation_ai' });
});

const { OpenAI } = require('openai');

app.get('/recommend/:lesson_id', async (req, res) => {
  const { lesson_id } = req.params;
  try {
    // 1. Get class averages from summary_lesson
    const [avgRows] = await pool.query(`
      SELECT 
        AVG(avg_pause_frequency) as class_pause,
        AVG(avg_quiz_response_time) as class_quiz,
        AVG(avg_error_rate) as class_error
      FROM summary_lesson
      WHERE lesson_id = ?
    `, [lesson_id]);
    
    if (avgRows.length === 0 || avgRows[0].class_pause === null) {
      return res.status(404).json({ error: 'No summary data found for this lesson.' });
    }
    
    const stats = {
      pause: Number(avgRows[0].class_pause || 0).toFixed(2),
      quiz: Number(avgRows[0].class_quiz || 0).toFixed(2),
      error: Number(avgRows[0].class_error || 0).toFixed(2)
    };

    // 2. Get the majority cognitive load for the lesson
    const [loadCounts] = await pool.query(`
      SELECT overall_cognitive_load, COUNT(*) as count
      FROM summary_lesson
      WHERE lesson_id = ?
      GROUP BY overall_cognitive_load
      ORDER BY count DESC
      LIMIT 1
    `, [lesson_id]);

    const majorityLoad = loadCounts.length > 0 ? loadCounts[0].overall_cognitive_load : 'Unknown';

    // 3. Try to use OpenAI for recommendation
    let recommendationText = "";
    try {
      if (!process.env.OPENAI_API_KEY) throw new Error('No API key');
      
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `The students just completed a lesson. 
The class average metrics are: 
- Pause Frequency: ${stats.pause}
- Quiz Response Time: ${stats.quiz} seconds
- Error Rate: ${stats.error}
The overall cognitive load of the majority of the class for this lesson was '${majorityLoad}'.
Based on this, write a concise, 2-to-3 sentence recommendation for the teacher on how to adjust the complexity or approach for the NEXT lesson.`;

      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
      });
      
      recommendationText = completion.choices[0].message.content;
    } catch (gptErr) {
      let basicAdvice = "";
      const loadLower = majorityLoad.toLowerCase();
      if (loadLower === 'very high') {
        basicAdvice = "Since the class cognitive load is VERY HIGH, you should heavily simplify the next lesson, reduce the pace significantly, and review foundational topics.";
      } else if (loadLower === 'high') {
        basicAdvice = "Since the cognitive load is HIGH, you should make the next lesson simpler, slower, or review previous topics.";
      } else if (loadLower === 'low') {
        basicAdvice = "Since the cognitive load is LOW, the students are finding it easy. You can make the next lesson more advanced or introduce new concepts faster.";
      } else if (loadLower === 'very low') {
        basicAdvice = "Since the cognitive load is VERY LOW, the material is far too easy for the students. Consider significantly increasing the challenge level or introducing complex advanced topics.";
      } else {
        basicAdvice = "The cognitive load is MEDIUM. The current complexity seems appropriate, so continue with the planned curriculum.";
      }
      recommendationText = basicAdvice;
    }

    res.json({
      stats,
      majorityLoad,
      recommendation: recommendationText
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Recommendation AI Service running on port ${PORT}`);
});
