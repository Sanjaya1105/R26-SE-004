const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Helper for sending generic error responses
const handleServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

// Resolve cognitive-load student IDs to display names for authenticated
// teachers. Only names are returned; private student fields remain hidden.
router.get('/student-names', verifyToken, async (req, res) => {
  if (req.user?.role === 'Student') {
    return res.status(403).json({ message: 'Teacher access only.' });
  }

  const requestedIds = String(req.query?.ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id, index, values) => id && values.indexOf(id) === index)
    .slice(0, 200);
  const validIds = requestedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (!validIds.length) {
    return res.json({ data: [] });
  }

  try {
    const students = await Student.find({ _id: { $in: validIds } })
      .select('name')
      .lean();
    return res.json({
      data: students.map((student) => ({
        student_id: String(student._id),
        student_name: student.name,
      })),
    });
  } catch (err) {
    return handleServerError(res, err);
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if user exists
    const existing = await Teacher.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await Teacher.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    res.status(201).json({ message: 'Teacher registered successfully' });
  } catch (err) {
    handleServerError(res, err);
  }
});

//Student registration endpoint
router.post('/student/register', async (req, res) => {
  const { name, email, mobileNumber, password, confirmPassword } = req.body;

  // Validate required fields
  if (!name || !email || !mobileNumber || !password || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    // Check if student already exists
    const existing = await Student.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert student
    await Student.create({
      name: name.trim(),
      email: email.toLowerCase(),
      mobileNumber: mobileNumber.trim(),
      role: 'Student',
      password: hashedPassword,
    });

    res.status(201).json({ message: 'Student registered successfully' });
  } catch (err) {
    handleServerError(res, err);
  }
});


// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find user
    const user = await Teacher.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, secret, {
      expiresIn: '1d'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    handleServerError(res, err);
  }
});



// Student login endpoint
router.post('/student/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find student
    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role,
      },
      secret,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Student login successful',
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        mobileNumber: student.mobileNumber,
        role: student.role,
      },
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

module.exports = router;
