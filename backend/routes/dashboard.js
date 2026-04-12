const express = require('express');
const jwt = require('jsonwebtoken');

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
    // In a real application, you might fetch specific data from the database here
    // e.g., students assigned to this teacher, classes, etc.
    const db = req.db;
    
    // We can fetch something from DB as a test or just return mock data
    const [stats] = await db.query('SELECT COUNT(*) as courseCount FROM teachers WHERE id = ?', [req.user.id]);
    
    res.json({
      message: `Welcome to the Teacher Dashboard, ${req.user.name}!`,
      user: req.user,
      dashboardData: {
        activeCourses: 5,
        totalStudents: 120,
        upcomingClasses: 2,
        dbConfirmed: stats.length > 0
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = router;
