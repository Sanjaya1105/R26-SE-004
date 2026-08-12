const express = require('express');
const Enrollment = require('../models/Enrollment');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const requireStudent = (req, res, next) => {
  if (req.user?.role !== 'Student') {
    return res.status(403).json({ message: 'Student access only.' });
  }
  next();
};

const handleServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

// POST /api/enrollments — enroll current student in a course
router.post('/', verifyToken, requireStudent, async (req, res) => {
  const courseId = String(req.body?.courseId || '').trim();
  const courseName = String(req.body?.courseName || '').trim();
  const educatorName = String(req.body?.educatorName || '').trim();

  if (!courseId) {
    return res.status(400).json({ message: 'courseId is required' });
  }

  try {
    const existing = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    }).lean();

    if (existing) {
      return res.status(200).json({
        message: 'Already enrolled',
        enrollment: existing,
        alreadyEnrolled: true,
      });
    }

    const enrollment = await Enrollment.create({
      studentId: req.user.id,
      courseId,
      courseName,
      educatorName,
    });

    return res.status(201).json({
      message: 'Enrolled successfully',
      enrollment,
      alreadyEnrolled: false,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId,
      }).lean();
      return res.status(200).json({
        message: 'Already enrolled',
        enrollment,
        alreadyEnrolled: true,
      });
    }
    return handleServerError(res, err);
  }
});

// GET /api/enrollments/me — list enrollments for current student
router.get('/me', verifyToken, requireStudent, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      message: 'Enrollments loaded',
      data: enrollments,
      courseIds: enrollments.map((e) => String(e.courseId)),
    });
  } catch (err) {
    return handleServerError(res, err);
  }
});

module.exports = router;
