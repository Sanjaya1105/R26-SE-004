import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactApexChart from 'react-apexcharts';
import { getGatewayBaseUrl } from '../config/gateway';
import '../styles/nextLessonRecommendation.css';

const LOAD_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

export default function NextLessonRecommendation() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    let active = true;

    axios
      .get(`${getGatewayBaseUrl()}/api/courses/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        if (!active) return;
        const rows = response.data?.data || [];
        setCourses(rows);
        if (rows.length) setSelectedCourseId(String(rows[0].id));
      })
      .catch((requestError) => {
        if (!active) return;
        if ([401, 403].includes(requestError.response?.status)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        setError(requestError.response?.data?.message || 'Could not load your uploaded courses.');
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, token]);

  const generateRecommendation = async (event) => {
    event.preventDefault();
    if (!selectedCourseId) {
      setError('Select a course first.');
      return;
    }

    setGenerating(true);
    setError('');
    setRecommendation(null);
    try {
      const response = await axios.post(
        `${getGatewayBaseUrl()}/api/next-lesson-recommendation/recommendations`,
        { courseId: selectedCourseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecommendation(response.data.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Could not create the next lesson recommendation.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="next-recommendation-page">
      <nav className="navbar glass-panel next-recommendation-nav">
        <button className="brand-button gradient-text" type="button" onClick={() => navigate('/dashboard')}>
          EduPortal
        </button>
        <div className="next-recommendation-nav-actions">
          <span>Hello, {user.name}</span>
          <button className="btn dashboard-button" type="button" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="btn logout-button" type="button" onClick={logout}>Logout</button>
        </div>
      </nav>

      <main className="container next-recommendation-content">
        <section className="glass-panel next-recommendation-hero">
          <p className="eyebrow">Teacher planning assistant</p>
          <h1>Next Lesson Recommendation</h1>
          <p>
            Select one of your uploaded courses. The service checks its lesson IDs against LIME
            cognitive-load data, finds the most common load level, and saves tailored guidance.
          </p>
        </section>

        <form className="glass-panel course-selector" onSubmit={generateRecommendation}>
          <label className="form-label" htmlFor="recommendation-course">Your uploaded course</label>
          <div className="selector-row">
            <select
              id="recommendation-course"
              className="form-input"
              value={selectedCourseId}
              disabled={loadingCourses || generating || courses.length === 0}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setRecommendation(null);
                setError('');
              }}
            >
              {loadingCourses && <option value="">Loading courses...</option>}
              {!loadingCourses && courses.length === 0 && <option value="">No uploaded courses found</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.courseName}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={generating || loadingCourses || !selectedCourseId}
            >
              {generating ? 'Analyzing...' : 'Create Recommendation'}
            </button>
          </div>
        </form>

        {error && <div className="error-message recommendation-error">{error}</div>}

        {recommendation && (
          <section className="recommendation-results" aria-live="polite">
            <div className="glass-panel result-summary">
              <div>
                <p className="eyebrow">Selected course</p>
                <h2>{recommendation.courseName}</h2>
              </div>
              <div className="dominant-load">
                <span>Maximum cognitive-load count</span>
                <strong>{recommendation.dominantCognitiveLoad}</strong>
              </div>
            </div>

            <div className="load-count-grid">
              {LOAD_LEVELS.map((level) => (
                <article
                  className={`glass-panel load-count-card ${level === recommendation.dominantCognitiveLoad ? 'is-dominant' : ''}`}
                  key={level}
                >
                  <span>{level}</span>
                  <strong>{recommendation.counts[level] || 0}</strong>
                </article>
              ))}
            </div>

            {recommendation.boxPlotData?.length > 0 && (
              <article className="glass-panel recommendation-chart">
                <div className="chart-heading">
                  <div>
                    <p className="eyebrow">Cognitive-load distribution</p>
                    <h2>Box Plot: Pause Frequency by Cognitive Load Level</h2>
                  </div>
                  <p>Each box shows minimum, Q1, median, Q3, and maximum.</p>
                </div>
                <ReactApexChart
                  options={{
                    chart: { type: 'boxPlot', height: 360, toolbar: { show: false } },
                    colors: ['#2563eb', '#60a5fa'],
                    plotOptions: {
                      boxPlot: { colors: { upper: '#3b82f6', lower: '#93c5fd' } },
                    },
                    xaxis: {
                      type: 'category',
                      title: { text: 'Cognitive Load Level' },
                    },
                    yaxis: {
                      title: { text: 'Pause Frequency' },
                      min: 0,
                    },
                    grid: { borderColor: '#e2e8f0' },
                    tooltip: {
                      custom: ({ seriesIndex, dataPointIndex, w }) => {
                        const point = w.config.series[seriesIndex].data[dataPointIndex];
                        const source = recommendation.boxPlotData[dataPointIndex];
                        return `<div class="boxplot-tooltip"><strong>${point.x}</strong><span>${source.observations} observations</span></div>`;
                      },
                    },
                  }}
                  series={[{ type: 'boxPlot', data: recommendation.boxPlotData }]}
                  type="boxPlot"
                  height={360}
                />
              </article>
            )}

            <article className="glass-panel recommendation-copy">
              <p className="eyebrow">Recommended next lesson approach</p>
              <h2>Plan from the class cognitive-load pattern</h2>
              <p>{recommendation.recommendation}</p>
              <footer>
                {recommendation.totalObservations} cognitive-load observations across{' '}
                {recommendation.matchedLessonIds.length} matched course/lesson IDs. Saved to the
                database {new Date(recommendation.updatedAt).toLocaleString()}.
              </footer>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
