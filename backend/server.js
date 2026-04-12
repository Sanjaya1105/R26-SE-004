require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'teacher_dashboard',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Pass DB pool to routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
