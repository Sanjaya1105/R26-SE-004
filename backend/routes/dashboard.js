const express = require('express');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Expect format "Bearer TOKEN"
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(403).json({ message: 'No token provided. Access denied.' });
  }

  const secret = process.env.JWT_SECRET || 'fallback_secret_key';
  
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized. Invalid token.' });
    }
    req.user = decoded;
    next();
  });
};

// Protected Dashboard route
router.get('/', verifyToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).lean();
    
    res.json({
      message: `Welcome to the Teacher Dashboard, ${req.user.name}!`,
      user: req.user,
      dashboardData: {
        activeCourses: 5,
        totalStudents: 120,
        upcomingClasses: 2,
        dbConfirmed: Boolean(teacher)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = router;
