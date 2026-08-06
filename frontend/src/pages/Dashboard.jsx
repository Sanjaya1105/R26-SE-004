import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const gatewayBaseUrl = getGatewayBaseUrl();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get(`${gatewayBaseUrl}/api/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setData(response.data);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        } else {
          setError('Failed to fetch dashboard data. Make sure backend is running.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [gatewayBaseUrl, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const quickActions = [
    { label: 'Upload Lesson', path: '/upload-lesson' },
    { label: 'Teacher Analyze', path: '/teacher-analysis' },
    { label: 'Student Analyse', path: '/student-analyse' },
    { label: 'Chat Assistant', path: '/gpt' },
    { label: 'Lesson Summary', path: '/lesson-summary' },
    { label: 'Upload Lecture PDF for Exam', path: '/exam-materials' },
    { label: 'Get Exam', path: '/get-exam' }
  ];

  if (loading) {
    return (
      <div className="auth-container">
        <h2 className="gradient-text">Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', background: 'linear-gradient(180deg, #f0f7ff 0%, #f8fbff 30%, #f8fafc 100%)' }}>
      <nav
        className="navbar glass-panel"
        style={{
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 10px 20px -18px rgba(37, 99, 235, 0.65)'
        }}
      >
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>EduPortal</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ color: 'var(--text-muted)' }}>Hello, {user.name}</span>
          {quickActions.map((action) => (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                color: '#1e3a8a',
                border: '1px solid #93c5fd'
              }}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="btn"
            style={{ backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' }}
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="container">
        <div
          className="glass-panel"
          style={{
            marginBottom: '2rem',
            padding: '2rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
            border: '1px solid #dbeafe'
          }}
        >
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#0f172a' }}>Overview</h2>
          <p style={{ color: '#334155' }}>Welcome to your personalized teacher dashboard.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {data && (
          <div className="stats-grid">
            <div className="stat-card glass-panel" style={{ border: '1px solid #dbeafe' }}>
              <span className="stat-title">Active Courses</span>
              <span className="stat-value" style={{ color: '#1d4ed8' }}>{data.dashboardData.activeCourses}</span>
            </div>

            <div className="stat-card glass-panel" style={{ border: '1px solid #dbeafe' }}>
              <span className="stat-title">Total Students</span>
              <span className="stat-value" style={{ color: '#2563eb' }}>{data.dashboardData.totalStudents}</span>
            </div>

            <div
              className="stat-card glass-panel"
              style={{
                border: '1px solid #bfdbfe',
                borderTop: '4px solid #3b82f6',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
              }}
            >
              <span className="stat-title">Upcoming Classes</span>
              <span className="stat-value" style={{ color: '#1e40af' }}>{data.dashboardData.upcomingClasses}</span>
            </div>
          </div>
        )}

        <div
          className="glass-panel"
          style={{
            marginTop: '2rem',
            padding: '2rem',
            border: '1px solid #dbeafe',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
          }}
        >
          <h3 style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            Recent Activity
          </h3>
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Database connection status: {data?.dashboardData.dbConfirmed ? '🟢 Connected' : '🔴 Disconnected'}
          </p>
          <ul style={{ marginTop: '1rem', color: 'var(--text-muted)', listStylePosition: 'inside', lineHeight: '2' }}>
            <li>You successfully authenticated via JWT.</li>
            <li>Dashboard layout fetched at {new Date().toLocaleTimeString()}</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
