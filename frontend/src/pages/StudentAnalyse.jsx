import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  fetchAggregateExplanation,
  fetchLimeExplanation,
  fetchLimeLessons,
  fetchLimePredictions,
  fetchLimeStudentsByLesson,
} from '../lime/apiClient';
import { fetchShapExplanation } from '../shap/apiClient';
import '../styles/studentAnalyse.css';

function formatRecommendationItems(text) {
  if (!text) return [];

  const normalized = String(text).replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const numberedText = normalized.replace(/\s+(?=\d+[).]\s+)/g, '\n');
  const numberedItems = numberedText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\s*(?:-|\d+[).:-])\s*/, '').trim())
    .filter(Boolean);

  if (numberedItems.length > 1) {
    return numberedItems;
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function StudentAnalyse() {
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisLoadingId, setAnalysisLoadingId] = useState(null);
  const [selectedAnalysisRowId, setSelectedAnalysisRowId] = useState(null);
  const [limeExplanation, setLimeExplanation] = useState(null);
  const [shapExplanation, setShapExplanation] = useState(null);
  const [aggregateExplanation, setAggregateExplanation] = useState(null);
  const [aggregateError, setAggregateError] = useState('');
  const [shapError, setShapError] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const recommendationItems = formatRecommendationItems(
    aggregateExplanation?.human_explanation || limeExplanation?.human_explanation || '',
  );

  const navigate = useNavigate();

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (!selectedLessonId) {
      setStudents([]);
      setSelectedStudentId('');
      setPredictions([]);
      return;
    }

    loadStudents(selectedLessonId);
    setPredictions([]);
    setLimeExplanation(null);
    setShapExplanation(null);
    setAggregateExplanation(null);
    setAggregateError('');
    setShapError('');
    setSelectedAnalysisRowId(null);
    setStatusMessage('Select a student and click "Show High Cognitive Load".');
  }, [selectedLessonId]);

  async function loadLessons() {
    try {
      setError('');
      const lessonRows = await fetchLimeLessons();
      setLessons(lessonRows ?? []);

      if (lessonRows?.length) {
        setSelectedLessonId(String(lessonRows[0].lesson_id));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadStudents(lessonId) {
    try {
      setError('');
      const studentRows = await fetchLimeStudentsByLesson(lessonId);
      setStudents(studentRows ?? []);
      setSelectedStudentId('');
    } catch (err) {
      setError(err.message);
      setStudents([]);
      setSelectedStudentId('');
    }
  }

  async function handleShowHighLoad() {
    if (!selectedLessonId) return;

    try {
      setLoading(true);
      setError('');
      const rows = await fetchLimePredictions(selectedLessonId, {
        studentId: selectedStudentId,
        highOnly: true,
        includeMedium: true,
        limit: 500,
      });
      setPredictions(rows ?? []);
      setLimeExplanation(null);
      setShapExplanation(null);
      setAggregateExplanation(null);
      setAggregateError('');
      setShapError('');
      setSelectedAnalysisRowId(null);

      if (!rows?.length) {
        setStatusMessage('No Medium, High, or Very High cognitive load records found for this selection.');
      } else {
        setStatusMessage(`Loaded ${rows.length} medium, high, and very high-load records.`);
      }
    } catch (err) {
      setError(err.message);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRawAnalyse(row) {
    if (!selectedLessonId || !row?.id) return;

    try {
      setAnalysisLoadingId(row.id);
      setError('');
      setAggregateError('');
      setShapError('');

      // Fixed sample sizes for all cognitive load levels
      const limeSamples = 50;   // LIME: 50 samples
      const shapSamples = 25;   // SHAP: 25 samples

      const [limeResult, shapResult] = await Promise.allSettled([
        fetchLimeExplanation(selectedLessonId, row.id, {
          numFeatures: 8,
          numSamples: limeSamples,
        }),
        fetchShapExplanation(selectedLessonId, row.id, {
          numFeatures: 8,
          numSamples: shapSamples,
        }),
      ]);

      if (limeResult.status === 'fulfilled') {
        setLimeExplanation(limeResult.value);
      } else {
        setLimeExplanation(null);
        setError(limeResult.reason?.message || 'LIME analysis failed.');
      }

      if (shapResult.status === 'fulfilled') {
        setShapExplanation(shapResult.value);
      } else {
        setShapExplanation(null);
        setShapError(shapResult.reason?.message || 'SHAP analysis failed.');
      }

      if (limeResult.status === 'fulfilled' && shapResult.status === 'fulfilled') {
        try {
          const aggregate = await fetchAggregateExplanation({
            lesson_id: String(selectedLessonId),
            prediction_id: Number(row.id),
            student_id: String(row.student_id),
            predicted_cognitive_load: String(row.predicted_cognitive_load),
            predicted_score: Number(row.predicted_score),
            confidence: Number(row.confidence),
            lime_factors: limeResult.value.factors ?? [],
            shap_values: shapResult.value.shap_values ?? [],
          });
          setAggregateExplanation(aggregate);
        } catch (aggregateErr) {
          setAggregateExplanation(null);
          setAggregateError(aggregateErr.message || 'Aggregate explanation generation failed.');
        }
      } else {
        setAggregateExplanation(null);
      }

      setSelectedAnalysisRowId(row.id);
      if (limeResult.status === 'fulfilled' && shapResult.status === 'fulfilled') {
        setStatusMessage(`LIME and SHAP explanations generated for record #${row.id}.`);
      } else if (limeResult.status === 'fulfilled') {
        setStatusMessage(`LIME explanation generated for record #${row.id}. SHAP is unavailable.`);
      } else if (shapResult.status === 'fulfilled') {
        setStatusMessage(`SHAP explanation generated for record #${row.id}. LIME is unavailable.`);
      }
    } catch (err) {
      setError(err.message);
      setLimeExplanation(null);
      setShapExplanation(null);
      setAggregateExplanation(null);
      setSelectedAnalysisRowId(null);
    } finally {
      setAnalysisLoadingId(null);
    }
  }

  return (
    <div className="student-analyse-shell">
      <header className="student-analyse-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </button>
        <div>
          <p className="eyebrow">Student Analyse</p>
          <h1>Student Cognitive Load Monitor</h1>
          <p className="hero-copy">
            Select lesson and student from Database, then display High , Very High and medium cognitive-load results.
          </p>
        </div>
      </header>

      <section className="student-analyse-toolbar glass-panel">
        <label>
          Lesson
          <select value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)}>
            <option value="">Select a lesson</option>
            {lessons.map((lesson) => (
              <option key={lesson.lesson_id} value={lesson.lesson_id}>
                Lesson {lesson.lesson_id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Student
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
            disabled={!students.length}
          >
            <option value="">All students in lesson</option>
            {students.map((student) => (
              <option key={student.student_id} value={student.student_id}>
                Student {student.student_id}
              </option>
            ))}
          </select>
        </label>

        <button onClick={handleShowHighLoad} disabled={!selectedLessonId || loading}>
          {loading ? 'Loading...' : 'Show Medium, High & Very High Cognitive Load'}
        </button>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {statusMessage ? <div className="alert success">{statusMessage}</div> : null}

      <section className="student-analyse-results glass-panel">
        <h2>Medium, High and Very High Results</h2>

        {!predictions.length ? (
          <p className="empty-state">No results loaded yet.</p>
        ) : (
          <div className="results-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Student</th>
                  <th>Minute</th>
                  <th>Cognitive Load</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.lesson_id}</td>
                    <td>{row.student_id}</td>
                    <td>{row.minute_index}</td>
                    <td>
                      <span className={`load-badge ${row.predicted_cognitive_load === 'Very High' ? 'very-high' : row.predicted_cognitive_load === 'High' ? 'high' : 'medium'}`}>
                        {row.predicted_cognitive_load}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`raw-analyse-btn ${selectedAnalysisRowId === row.id ? 'active' : ''}`}
                        onClick={() => handleRawAnalyse(row)}
                        disabled={Boolean(analysisLoadingId)}
                      >
                        {analysisLoadingId === row.id ? 'Analysing...' : 'Raw Analyse'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="student-analyse-results glass-panel lime-panel">
        <h2>Raw LIME Explanation</h2>
        {!limeExplanation ? (
          <p className="empty-state">Click Raw Analyse on a row to generate real LIME output.</p>
        ) : (
          <div className="lime-content">
            <p>
              <strong>Record:</strong> #{limeExplanation.prediction_id} | <strong>Student:</strong> {limeExplanation.student_id} |{' '}
              <strong>Cognitive Load:</strong> {limeExplanation.predicted_cognitive_load}
            </p>
            <p>
              <strong>Intercept:</strong> {Number(limeExplanation.intercept).toFixed(4)}
            </p>

            <div className="human-explanation-card">
              <p className="human-explanation-title">Combined Human-Readable Explanation (LIME + SHAP)</p>
              <p className="human-explanation-source">
                Source: {(aggregateExplanation?.explanation_source || limeExplanation.explanation_source || 'fallback').toUpperCase()}
              </p>

              <div className="explanation-split-block">
                <p className="split-block-title">Explanation Output</p>
                <p className="human-explanation-text">
                  {aggregateExplanation?.why_cognitive_load_high ||
                    limeExplanation.why_cognitive_load_high ||
                    shapExplanation?.summary ||
                    'No explanation text returned.'}
                </p>
              </div>

              <div className="explanation-split-block">
                <p className="split-block-title">Recommendation Part</p>
                {recommendationItems.length ? (
                  <div>
                    <div className="recommendation-header">
                      <span className="rec-meta">Student: {aggregateExplanation?.student_id || limeExplanation?.student_id || 'N/A'}</span>
                      <span className="rec-meta">Cognitive Load: {aggregateExplanation?.predicted_cognitive_load || limeExplanation?.predicted_cognitive_load || 'N/A'}</span>
                    </div>
                    <div className="recommendation-list">
                      {recommendationItems.map((item, index) => (
                        <div key={`${index}-${item}`} className="recommendation-item">
                          <span className="recommendation-item-number">{index + 1}</span>
                          <p className="recommendation-item-text">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="human-explanation-text">No recommendation text returned.</p>
                )}
              </div>

              {aggregateError ? <p className="aggregate-error-text">{aggregateError}</p> : null}
              {aggregateExplanation?.top_signals?.length ? (
                <div className="aggregate-top-signals">
                  <p className="aggregate-top-signals-title">Top 3 Combined Signals</p>
                  <ul>
                    {aggregateExplanation.top_signals.map((signal, index) => (
                      <li key={`${signal.source}-${signal.signal}-${index}`}>
                        {signal.source.toUpperCase()}: {signal.signal} ({Number(signal.raw_value).toFixed(6)})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {aggregateExplanation?.study_technique ? (
              <div className="student-support-card study-technique-card">
                <div className="support-card-header">
                  <p className="support-card-title">📚 Recommended Techniques</p>
                  <p className="support-source">AI (Source: {aggregateExplanation.study_technique.source?.toUpperCase() || 'AI'})</p>
                </div>

                {aggregateExplanation.study_technique.techniques?.length ? (
                  <div className="techniques-list">
                    {aggregateExplanation.study_technique.techniques.map((tech, index) => (
                      <div key={`${tech.technique}-${index}`} className="technique-item">
                        <span className="technique-emoji-title">
                          {tech.emoji} {tech.title}
                        </span>
                        <a
                          href={tech.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="technique-link-btn"
                        >
                          {tech.link_text}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="results-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Weight</th>
                    <th>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {(limeExplanation.factors ?? []).map((factor, index) => (
                    <tr key={`${factor.rule}-${index}`}>
                      <td>{factor.rule}</td>
                      <td>{Number(factor.weight).toFixed(6)}</td>
                      <td>
                        <span className={`impact-badge ${factor.impact}`}>{factor.impact}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="student-analyse-results glass-panel shap-panel">
        <h2>Raw SHAP Explanation</h2>
        {shapError ? <div className="alert error shap-alert">{shapError}</div> : null}
        {!shapExplanation ? (
          <p className="empty-state">Click Raw Analyse on a row to generate real SHAP output.</p>
        ) : (
          <div className="lime-content">
            <p>
              <strong>Record:</strong> #{shapExplanation.prediction_id} | <strong>Student:</strong> {shapExplanation.student_id} |{' '}
              <strong>Cognitive Load:</strong> {shapExplanation.predicted_cognitive_load}
            </p>
            <p>
              <strong>Base Value:</strong> {Number(shapExplanation.expected_value).toFixed(4)}
            </p>
            <p className="shap-summary">{shapExplanation.summary}</p>

            <div className="results-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Feature Value</th>
                    <th>SHAP Value</th>
                    <th>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {(shapExplanation.shap_values ?? []).map((item, index) => (
                    <tr key={`${item.feature}-${index}`}>
                      <td>{item.feature}</td>
                      <td>{Number(item.value).toFixed(4)}</td>
                      <td>{Number(item.shap_value).toFixed(6)}</td>
                      <td>
                        <span className={`impact-badge ${item.impact}`}>{item.impact}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
