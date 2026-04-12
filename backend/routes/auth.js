const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Helper for sending generic error responses
const handleServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

// Register endpoint
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const db = req.db;
    
    // Check if user exists
    const [existing] = await db.query('SELECT id FROM teachers WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await db.query(
      'INSERT INTO teachers (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: 'Teacher registered successfully' });
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
    const db = req.db;
    
    // Find user
    const [users] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, secret, {
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

module.exports = router;
