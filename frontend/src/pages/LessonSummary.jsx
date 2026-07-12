import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactApexChart from 'react-apexcharts';

// Helper to calculate BoxPlot stats: [min, q1, median, q3, max]
const calculateBoxPlotStats = (dataArray) => {
  if (!dataArray || dataArray.length === 0) return [0, 0, 0, 0, 0];
  const sorted = [...dataArray].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  const getPercentile = (arr, p) => {
    const index = (arr.length - 1) * p;
    const lower = Math.floor(index);
    const fraction = index - lower;
    if (lower + 1 < arr.length) {
      return arr[lower] + fraction * (arr[lower + 1] - arr[lower]);
    }
    return arr[lower];
  };

  const q1 = getPercentile(sorted, 0.25);
  const median = getPercentile(sorted, 0.5);
  const q3 = getPercentile(sorted, 0.75);

  return [Math.min(min, q1), q1, median, q3, Math.max(max, q3)].map(v => Number(v.toFixed(2)));
};

const LessonSummary = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const gatewayBaseUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';

  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [chartData, setChartData] = useState([]);
  const [countChartData, setCountChartData] = useState([]);
  const [recommendationData, setRecommendationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const response = await axios.get(`${gatewayBaseUrl}/api/recommendation/lessons`);
        setLessons(response.data);
      } catch (err) {
        console.error('Failed to fetch lessons:', err);
        setError('Failed to fetch lessons from recommendation service.');
      }
    };
    fetchLessons();
  }, [gatewayBaseUrl]);

  const handleAnalyze = async () => {
    if (!selectedLesson) {
      setError('Please select a lesson first.');
      return;
    }
    setLoading(true);
    setError('');
    setRecommendationData(null);
    setChartData([]);
    setCountChartData([]);
    
    try {
      // 1. Trigger analysis and generate chart data
      const response = await axios.post(`${gatewayBaseUrl}/api/recommendation/analyze/${selectedLesson}`);
      const rawData = response.data;
      
      // Group data by cognitive load for boxplot (using avg_pause_frequency)
      const groups = { 'Very High': [], High: [], Medium: [], Low: [], 'Very Low': [], Unknown: [] };
      rawData.forEach(item => {
        const load = item.overall_cognitive_load || 'Unknown';
        if (!groups[load]) groups[load] = [];
        groups[load].push(item.avg_pause_frequency || 0);
      });
      
      const newChartData = [];
      for (const [key, values] of Object.entries(groups)) {
        if (values.length > 0) {
          newChartData.push({
            x: key,
            y: calculateBoxPlotStats(values)
          });
        }
      }

      const countData = Object.entries(groups)
        .filter(([, values]) => values.length > 0)
        .map(([key, values]) => ({ x: key, y: values.length }));
      
      setChartData([{
        type: 'boxPlot',
        data: newChartData
      }]);
      setCountChartData([{ name: 'Student Count', data: countData }]);

      // 2. Fetch the recommendation for the next lesson
      const recResponse = await axios.get(`${gatewayBaseUrl}/api/recommendation/recommend/${selectedLesson}`);
      setRecommendationData(recResponse.data);

    } catch (err) {
      console.error(err);
      setError('Analysis failed. Be sure cognitive_load_logs contains data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', background: 'linear-gradient(180deg, #eff6ff 0%, #f8fbff 28%, #f8fafc 100%)' }}>
      <nav
        className="navbar glass-panel"
        style={{
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 10px 22px -18px rgba(37, 99, 235, 0.7)'
        }}
      >
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>EduPortal</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Hello, {user.name}</span>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn"
            style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', color: '#1e3a8a', border: '1px solid #93c5fd' }}
          >
            Dashboard
          </button>
          <button onClick={handleLogout} className="btn" style={{ backgroundColor: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
            Logout
          </button>
        </div>
      </nav>

      <main className="container">
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.8rem', border: '1px solid #dbeafe', background: 'linear-gradient(135deg, #ffffff, #eff6ff)' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Lesson Summary (Recommendation AI)</h2>
          <p style={{ color: '#334155' }}>Select a lesson to analyze student cognitive loads and generate a box plot.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid #dbeafe', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Lesson</label>
              <select 
                value={selectedLesson} 
                onChange={(e) => setSelectedLesson(e.target.value)} 
                className="input-field" 
                style={{ width: '100%', backgroundColor: '#ffffff', color: 'var(--text)', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.7rem 0.8rem' }}
              >
                <option value="">-- Dropdown List --</option>
                {lessons.map((lesson, idx) => (
                  <option key={idx} value={lesson}>{lesson}</option>
                ))}
              </select>
            </div>
            <div style={{ paddingTop: '1.5rem' }}>
              <button 
                onClick={handleAnalyze} 
                disabled={loading} 
                className="btn" 
                style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', border: '1px solid #1d4ed8' }}
              >
                {loading ? 'Analyzing...' : 'Analyze & Show Boxplot'}
              </button>
            </div>
          </div>
        </div>

        {chartData.length > 0 && chartData[0].data.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px', marginBottom: '2rem', border: '1px solid #dbeafe', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Box Plot: Avg Pause Frequency by Cognitive Load Level</h3>
            <ReactApexChart 
              options={{
                chart: { type: 'boxPlot', height: 350, toolbar: { show: false } },
                colors: ['#2563eb', '#60a5fa'],
                title: { text: 'Distribution within Load Categories', align: 'left', style: { color: 'var(--text-muted)' } },
                xaxis: { 
                  type: 'category',
                  tooltip: { enabled: false },
                  labels: { style: { colors: 'var(--text-muted)' } }
                },
                yaxis: {
                  title: { text: 'Pause Frequency', style: { color: 'var(--text-muted)' } },
                  labels: { style: { colors: 'var(--text-muted)' } }
                },
                plotOptions: {
                  boxPlot: { colors: { upper: '#3b82f6', lower: '#93c5fd' } }
                },
                grid: { borderColor: '#e2e8f0' }
              }} 
              series={chartData} 
              type="boxPlot" 
              height={350} 
            />
          </div>
        )}

        {countChartData.length > 0 && countChartData[0].data.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem', minHeight: '380px', marginBottom: '2rem', border: '1px solid #dbeafe', background: 'linear-gradient(180deg, #ffffff, #f8fbff)' }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Count Distribution Chart: Cognitive Load vs Student Count</h3>
            <ReactApexChart
              options={{
                chart: { type: 'bar', height: 320, toolbar: { show: false } },
                colors: ['#1d4ed8'],
                plotOptions: {
                  bar: {
                    borderRadius: 6,
                    distributed: true,
                    columnWidth: '45%'
                  }
                },
                dataLabels: { enabled: true },
                xaxis: {
                  type: 'category',
                  title: { text: 'Cognitive Load', style: { color: 'var(--text-muted)' } },
                  labels: { style: { colors: 'var(--text-muted)' } }
                },
                yaxis: {
                  title: { text: 'Student Count', style: { color: 'var(--text-muted)' } },
                  labels: { style: { colors: 'var(--text-muted)' } },
                  min: 0,
                  forceNiceScale: true
                },
                grid: { borderColor: '#e2e8f0' },
                tooltip: {
                  y: {
                    formatter: (val) => `${val} students`
                  }
                }
              }}
              series={countChartData}
              type="bar"
              height={320}
            />
          </div>
        )}

        {recommendationData && (
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(180deg, #ffffff, #eff6ff)', border: '1px solid #bfdbfe' }}>
            <h3 style={{ marginBottom: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💡</span> Next Lesson Recommendation
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-card" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #dbeafe', boxShadow: 'none' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Majority Cognitive Load</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1d4ed8' }}>{recommendationData.majorityLoad}</div>
              </div>
              <div className="stat-card" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #dbeafe', boxShadow: 'none' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Pause Frequency</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>{recommendationData.stats.pause}</div>
              </div>
              <div className="stat-card" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #dbeafe', boxShadow: 'none' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Error Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>{recommendationData.stats.error}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6' }}>
              <p style={{ lineHeight: '1.6', fontSize: '1.1rem' }}>
                {recommendationData.recommendation}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LessonSummary;
