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
      
      setChartData([{
        type: 'boxPlot',
        data: newChartData
      }]);

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
    <div style={{ width: '100%' }}>
      <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>EduPortal</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Hello, {user.name}</span>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
          >
            Dashboard
          </button>
          <button onClick={handleLogout} className="btn" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            Logout
          </button>
        </div>
      </nav>

      <main className="container">
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Lesson Summary (Recommendation AI)</h2>
          <p style={{ color: 'var(--text-muted)' }}>Select a lesson to analyze student cognitive loads and generate a box plot.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Lesson</label>
              <select 
                value={selectedLesson} 
                onChange={(e) => setSelectedLesson(e.target.value)} 
                className="input-field" 
                style={{ width: '100%' }}
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
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {loading ? 'Analyzing...' : 'Analyze & Show Boxplot'}
              </button>
            </div>
          </div>
        </div>

        {chartData.length > 0 && chartData[0].data.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Box Plot: Avg Pause Frequency by Cognitive Load Level</h3>
            <ReactApexChart 
              options={{
                chart: { type: 'boxPlot', height: 350, toolbar: { show: false } },
                colors: ['#008FFB', '#FEB019'],
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
                  boxPlot: { colors: { upper: '#5C4742', lower: '#A5978B' } }
                },
                grid: { borderColor: 'rgba(255,255,255,0.1)' }
              }} 
              series={chartData} 
              type="boxPlot" 
              height={350} 
            />
          </div>
        )}

        {recommendationData && (
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', backgroundColor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <h3 style={{ marginBottom: '1rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💡</span> Next Lesson Recommendation
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Majority Cognitive Load</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{recommendationData.majorityLoad}</div>
              </div>
              <div className="stat-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Pause Frequency</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{recommendationData.stats.pause}</div>
              </div>
              <div className="stat-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Error Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{recommendationData.stats.error}</div>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #86efac' }}>
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
