import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getGatewayBaseUrl } from '../../config/gateway';
import { fetchMySharedLessonGuidance } from '../../lessonSummary/apiClient';
import '../../styles/studentAnalyse.css';

function recommendationItems(text) {
  const normalized = String(text || '').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const items = [];
  const pattern = /(?:^|\s)\d+[).:-]\s*(.*?)(?=\s+\d+[).:-]\s*|$)/g;
  for (const match of normalized.matchAll(pattern)) {
    const value = match[1].replace(/^jot down\b/i, 'Write down').trim();
    if (value && !items.includes(value)) items.push(value);
  }
  return items.length ? items : [normalized.replace(/^jot down\b/i, 'Write down')];
}

export default function PreviousLessonSummary() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState([]);
  const [lessonNames, setLessonNames] = useState(new Map());
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [sharedRows, courseResponse] = await Promise.all([
          fetchMySharedLessonGuidance(),
          fetch(`${getGatewayBaseUrl()}/api/public/courses`),
        ]);
        const coursePayload = await courseResponse.json().catch(() => null);
        if (!courseResponse.ok) throw new Error(coursePayload?.message || 'Could not load lesson names.');
        if (cancelled) return;
        const rows = Array.isArray(sharedRows) ? sharedRows : [];
        setSummaries(rows);
        setLessonNames(new Map(
          (coursePayload?.data ?? []).map((course) => [String(course.id), course.courseName]),
        ));
        setSelectedLessonId(rows.length ? String(rows[0].lesson_id) : '');
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedSummary = useMemo(
    () => summaries.find((row) => String(row.lesson_id) === selectedLessonId),
    [selectedLessonId, summaries],
  );
  const strategies = recommendationItems(selectedSummary?.lecture_support?.strategies);

  return (
    <div className="student-analyse-shell">
      <header className="student-analyse-header">
        <button type="button" className="back-button" onClick={() => navigate('/course')}>
          Back to courses
        </button>
        <div>
          <p className="eyebrow">Student support</p>
          <h1>Previous Lesson Summary</h1>
          <p className="hero-copy">Review recommendations and study techniques shared by your teacher.</p>
        </div>
      </header>

      {error ? <div className="alert error">{error}</div> : null}
      {loading ? <section className="student-analyse-results glass-panel"><p>Loading summaries...</p></section> : null}

      {!loading && !error ? (
        <section className="student-analyse-toolbar glass-panel">
          <label>
            Subject / lesson
            <select value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)}>
              <option value="">Select a lesson</option>
              {summaries.map((summary) => (
                <option key={summary.lesson_id} value={summary.lesson_id}>
                  {lessonNames.get(String(summary.lesson_id)) || `Lesson ${summary.lesson_id}`}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {!loading && !error && summaries.length === 0 ? (
        <section className="student-analyse-results glass-panel">
          <p className="empty-state">Your teacher has not shared any previous-lesson guidance yet.</p>
        </section>
      ) : null}

      {selectedSummary ? (
        <section className="student-analyse-results glass-panel">
          <h2>{lessonNames.get(String(selectedSummary.lesson_id)) || `Lesson ${selectedSummary.lesson_id}`}</h2>
          <p><strong>Cognitive load:</strong> {selectedSummary.predicted_cognitive_load}</p>

          <div className="student-support-card lecture-support-card">
            <p className="support-card-title">Teacher-shared Recommendations</p>
            <div className="recommendation-list">
              {strategies.map((strategy, index) => (
                <div className="recommendation-item" key={`${index}-${strategy}`}>
                  <span className="recommendation-item-number">{index + 1}</span>
                  <p className="recommendation-item-text">{strategy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="student-support-card study-technique-card">
            <p className="support-card-title">Recommended Study Techniques</p>
            <div className="techniques-list">
              {(selectedSummary.study_technique?.techniques ?? []).map((technique, index) => (
                <div className="technique-item" key={`${technique.technique}-${index}`}>
                  <span className="technique-emoji-title">
                    {technique.emoji} {technique.title || technique.technique}
                  </span>
                  {technique.link ? (
                    <a className="technique-link-btn" href={technique.link} target="_blank" rel="noreferrer">
                      {technique.link_text || 'Learn more'}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
