import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const gatewayBaseUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';

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

  if (loading) {
    return (
      <div className="auth-container">
        <h2 className="gradient-text">Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>EduPortal</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Hello, {user.name}</span>
          <button onClick={handleLogout} className="btn" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            Logout
          </button>
        </div>
      </nav>

      <main className="container">
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Overview</h2>
          <p style={{ color: 'var(--text-muted)' }}>Welcome to your personalized teacher dashboard.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {data && (
          <div className="stats-grid">
            <div className="stat-card glass-panel">
              <span className="stat-title">Active Courses</span>
              <span className="stat-value">{data.dashboardData.activeCourses}</span>
            </div>
            
            <div className="stat-card glass-panel">
              <span className="stat-title">Total Students</span>
              <span className="stat-value">{data.dashboardData.totalStudents}</span>
            </div>
            
            <div className="stat-card glass-panel" style={{ borderTop: '4px solid var(--secondary)' }}>
              <span className="stat-title">Upcoming Classes</span>
              <span className="stat-value">{data.dashboardData.upcomingClasses}</span>
            </div>
          </div>
        )}

        <div className="glass-panel" style={{ marginTop: '2rem', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
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
