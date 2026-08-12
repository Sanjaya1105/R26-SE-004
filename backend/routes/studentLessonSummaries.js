const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
const limeServiceUrl = (process.env.LIME_AI_SERVICE_URL || 'http://localhost:8110').replace(/\/$/, '');

function upstreamError(res, error) {
  if (error.response) return res.status(error.response.status).json(error.response.data);
  console.error('Student lesson guidance request failed:', error.message);
  return res.status(502).json({ message: 'LIME AI service is unavailable.' });
}

router.post('/share', verifyToken, async (req, res) => {
  if (req.user?.role === 'Student') {
    return res.status(403).json({ message: 'Teacher access only.' });
  }
  const studentId = String(req.body?.studentId || '').trim();
  const lessonId = String(req.body?.lessonId || '').trim();
  if (!studentId || !lessonId) {
    return res.status(400).json({ message: 'Student and lesson are required.' });
  }

  try {
    const upstream = await axios.post(
      `${limeServiceUrl}/api/v1/lessons/${encodeURIComponent(lessonId)}` +
        `/students/${encodeURIComponent(studentId)}/share-guidance`
    );
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

router.get('/me', verifyToken, async (req, res) => {
  if (req.user?.role !== 'Student') {
    return res.status(403).json({ message: 'Student access only.' });
  }
  try {
    const upstream = await axios.get(
      `${limeServiceUrl}/api/v1/students/${encodeURIComponent(String(req.user.id))}/shared-guidance`
    );
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

module.exports = router;
