const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
const examServiceUrl = (process.env.EXAM_SERVICE_URL || 'http://localhost:8120').replace(/\/$/, '');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function teacherHeaders(req) {
  return { 'x-teacher-id': String(req.user.id) };
}

function upstreamError(res, error) {
  if (error.response) return res.status(error.response.status).json(error.response.data);
  console.error('Exam service request failed:', error.message);
  return res.status(502).json({ message: 'Exam service is unavailable.' });
}

router.get('/materials', verifyToken, async (req, res) => {
  try {
    const upstream = await axios.get(`${examServiceUrl}/materials`, { headers: teacherHeaders(req) });
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

router.post('/materials', verifyToken, (req, res, next) => {
  upload.single('document')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'The document exceeds the 25 MB limit.' });
    }
    return res.status(400).json({ message: error.message || 'Invalid document upload.' });
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a document to upload.' });

  const form = new FormData();
  form.append('lessonName', req.body.lessonName || '');
  form.append('unitNo', req.body.unitNo || '');
  form.append('document', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    const upstream = await axios.post(`${examServiceUrl}/materials`, form, {
      headers: { ...form.getHeaders(), ...teacherHeaders(req) },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

router.get('/materials/:id/file', verifyToken, async (req, res) => {
  try {
    const upstream = await axios.get(`${examServiceUrl}/materials/${req.params.id}/file`, {
      headers: teacherHeaders(req),
      responseType: 'arraybuffer',
    });
    if (upstream.headers['content-type']) res.set('Content-Type', upstream.headers['content-type']);
    if (upstream.headers['content-disposition']) res.set('Content-Disposition', upstream.headers['content-disposition']);
    return res.status(upstream.status).send(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

router.get('/materials/:id/content', verifyToken, async (req, res) => {
  try {
    const upstream = await axios.get(`${examServiceUrl}/materials/${req.params.id}/content`, {
      headers: teacherHeaders(req),
    });
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

router.get('/materials/:id/images/:imageId', verifyToken, async (req, res) => {
  try {
    const upstream = await axios.get(
      `${examServiceUrl}/materials/${req.params.id}/images/${req.params.imageId}`,
      { headers: teacherHeaders(req), responseType: 'arraybuffer' }
    );
    if (upstream.headers['content-type']) res.set('Content-Type', upstream.headers['content-type']);
    if (upstream.headers['cache-control']) res.set('Cache-Control', upstream.headers['cache-control']);
    return res.status(upstream.status).send(upstream.data);
  } catch (error) {
    return upstreamError(res, error);
  }
});

module.exports = router;
