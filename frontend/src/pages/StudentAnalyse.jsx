import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createStudentLessonSummary,
  fetchAggregateExplanation,
  fetchLimeExplanation,
  fetchLimeLessons,
  fetchLimeStudentsByLesson,
} from '../lime/apiClient';
import { fetchShapExplanation } from '../shap/apiClient';
import { analyseCognitiveStyle } from '../cognitiveStyle/apiClient';
import '../styles/studentAnalyse.css';

function formatRecommendationItems(text) {
  if (!text) return [];

  // If backend returned "Unable to generate", return empty
  if (text.includes('Unable to generate strategies')) {
    return [];
  }

  const normalized = String(text).replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 5) return [];

  // Strategy 1: Split by numbered patterns (1) text, 1. text, 1- text, 1: text)
  const items = [];
  const patterns = [
    /^\s*\d+[).:-]\s*(.+?)$/gm,  // Lines starting with number
    /(\d+[).:-]\s*[^):\n]+(?=[1-9][).:-]|$))/g  // Inline numbered items
  ];

  for (const pattern of patterns) {
    const matches = normalized.matchAll(pattern);
    for (const match of matches) {
      const text = match[1] || match[0];
      if (text && text.length > 5) {
        // Clean quotes and special leading chars
        const clean = text
          .replace(/^[\d)\-.:]\s*/, '')
          .replace(/^["']|["']$/g, '')
          .trim();
        if (clean && !items.includes(clean)) {
          items.push(clean);
        }
      }
    }
  }

  if (items.length > 0) {
    return items.slice(0, 5); // Max 5 items
  }

  // Strategy 2: Split by sentence endings if no numbered pattern found
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(item => item.length > 5)
    .slice(0, 5);
}

function isNoRecommendationLoad(level) {
  const normalized = String(level || '').trim().toLowerCase();
  return normalized === 'very low' || normalized === 'low';
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
  const [styleAnalysis, setStyleAnalysis] = useState(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState('');

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

  useEffect(() => {
    setStyleAnalysis(null);
    setStyleError('');
  }, [selectedLessonId, selectedStudentId]);

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
    if (!selectedLessonId || !selectedStudentId) {
      setError('Please select both a lesson and a student.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const summary = await createStudentLessonSummary(selectedLessonId, selectedStudentId);
      setPredictions(summary ? [summary] : []);
      setLimeExplanation(null);
      setShapExplanation(null);
      setAggregateExplanation(null);
      setAggregateError('');
      setShapError('');
      setSelectedAnalysisRowId(null);

      if (!summary) {
        setStatusMessage('Failed to create student-lesson summary.');
      } else if (isNoRecommendationLoad(summary.predicted_cognitive_load)) {
        setStatusMessage(
          `Student ${selectedStudentId} cognitive load is ${summary.predicted_cognitive_load}. No recommendation needed, so Raw Analyse is hidden.`,
        );
      } else {
        setStatusMessage(`Aggregated summary created for student ${selectedStudentId}. Click "Raw Analyse" to generate LIME and SHAP explanations.`);
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

  async function handleAnalyseStyle() {
    if (!selectedLessonId || !selectedStudentId) return;
    try {
      setStyleLoading(true);
      setStyleError('');
      setStyleAnalysis(null);
      const result = await analyseCognitiveStyle(selectedLessonId, selectedStudentId);
      setStyleAnalysis(result);
      setStatusMessage(`Cognitive-style LIME and SHAP analysis completed for student ${selectedStudentId}.`);
    } catch (err) {
      setStyleError(err.message);
    } finally {
      setStyleLoading(false);
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
          <h1>High Cognitive Load Monitor</h1>
          <p className="hero-copy">
            Select lesson and student from LIME AI records, then display High and Very High cognitive-load results.
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

        <button onClick={handleShowHighLoad} disabled={!selectedLessonId || !selectedStudentId || loading}>
          {loading ? 'Aggregating...' : 'Generate Student-Lesson Summary'}
        </button>

        {selectedLessonId && selectedStudentId ? (
          <button className="analyse-style-btn" onClick={handleAnalyseStyle} disabled={styleLoading}>
            {styleLoading ? 'Analysing Style...' : 'Analyse Style'}
          </button>
        ) : null}
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {styleError ? <div className="alert error">{styleError}</div> : null}
      {statusMessage ? <div className="alert success">{statusMessage}</div> : null}

      {styleLoading || styleAnalysis ? (
        <section className="student-analyse-results glass-panel cognitive-style-panel">
          <h2>Cognitive Style Explanation</h2>
          {styleLoading ? (
            <p className="empty-state">Running LIME and SHAP in parallel...</p>
          ) : (
            <>
              <div className="style-summary-row">
                <div>
                  <span className="style-summary-label">Predicted style</span>
                  <strong className="style-name">{styleAnalysis.cognitive_style}</strong>
                </div>
                <div>
                  <span className="style-summary-label">Confidence</span>
                  <strong>{(Number(styleAnalysis.confidence) * 100).toFixed(1)}%</strong>
                </div>
              </div>

              {styleAnalysis.human_explanation ? (
                <div className="human-explanation-card style-human-explanation">
                  <p className="human-explanation-title">Human-Readable Cognitive Style Explanation</p>
                  <p className="human-explanation-source">
                    Generated by Ollama ({styleAnalysis.explanation_model || 'configured model'})
                  </p>
                  <p className="human-explanation-text">{styleAnalysis.human_explanation}</p>
                </div>
              ) : null}

              <h3>Top 3 Combined Features</h3>
              <div className="style-feature-grid">
                {(styleAnalysis.top_features ?? []).map((feature, index) => (
                  <article className="style-feature-card" key={feature.feature}>
                    <span className="feature-rank">#{index + 1}</span>
                    <h4>{feature.feature}</h4>
                    <p>Combined importance: {(Number(feature.importance) * 100).toFixed(2)}%</p>
                    <p>Feature value: {Number(feature.feature_value).toFixed(4)}</p>
                    <span className={`impact-badge ${feature.direction}`}>{feature.direction}</span>
                  </article>
                ))}
              </div>

              <div className="style-raw-grid">
                <details>
                  <summary>Raw LIME output</summary>
                  <div className="results-table-wrapper">
                    <table><thead><tr><th>Feature</th><th>Weight</th></tr></thead><tbody>
                      {(styleAnalysis.lime_output ?? []).map((item) => (
                        <tr key={item.feature}><td>{item.feature}</td><td>{Number(item.weight).toFixed(6)}</td></tr>
                      ))}
                    </tbody></table>
                  </div>
                </details>
                <details>
                  <summary>Raw SHAP output</summary>
                  <div className="results-table-wrapper">
                    <table><thead><tr><th>Feature</th><th>SHAP value</th></tr></thead><tbody>
                      {(styleAnalysis.shap_output ?? []).map((item) => (
                        <tr key={item.feature}><td>{item.feature}</td><td>{Number(item.shap_value).toFixed(6)}</td></tr>
                      ))}
                    </tbody></table>
                  </div>
                </details>
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="student-analyse-results glass-panel">
        <h2>Aggregated Student Summary</h2>

        {!predictions.length ? (
          <p className="empty-state">No results loaded yet.</p>
        ) : (
          <div className="results-table-wrapper">
            <table>
  <thead>
    <tr>
      <th>Lesson</th>
      <th>Student</th>
      <th>Cognitive Load</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    {predictions.map((row) => (
      <tr key={row.id}>
        <td>{row.lesson_id}</td>
        <td>{row.student_id}</td>
        <td>
          <span
            className={`load-badge ${
              row.predicted_cognitive_load === 'Very High'
                ? 'very-high'
                : row.predicted_cognitive_load === 'High'
                ? 'high'
                : 'medium'
            }`}
          >
            {row.predicted_cognitive_load}
          </span>
        </td>
        <td>
          {isNoRecommendationLoad(row.predicted_cognitive_load) ? (
            <span className="empty-state">No recommendation needed</span>
          ) : (
            <button
              className={`raw-analyse-btn ${
                selectedAnalysisRowId === row.id ? 'active' : ''
              }`}
              onClick={() => handleRawAnalyse(row)}
              disabled={Boolean(analysisLoadingId)}
            >
              {analysisLoadingId === row.id ? 'Analysing...' : 'Raw Analyse'}
            </button>
          )}
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
                Source: {(aggregateExplanation?.explanation_source || 'unavailable').toUpperCase()}
              </p>

              <div className="explanation-split-block">
                <p className="split-block-title">Explanation Output</p>
                <p className="human-explanation-text">
                  {aggregateExplanation?.human_explanation ||
                    'No explanation text returned.'}
                </p>
              </div>

              <div className="explanation-split-block">
                <p className="split-block-title">Recommendation Part</p>
                {aggregateExplanation?.lecture_support?.strategies ? (
                  <div className="recommendation-list">
                    {formatRecommendationItems(aggregateExplanation.lecture_support.strategies).map((item, index) => (
                      <div key={`${index}-${item}`} className="recommendation-item">
                        <span className="recommendation-item-number">{index + 1}</span>
                        <p className="recommendation-item-text">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : recommendationItems.length > 0 ? (
                  <div className="recommendation-list">
                    {recommendationItems.map((item, index) => (
                      <div key={`${index}-${item}`} className="recommendation-item">
                        <span className="recommendation-item-number">{index + 1}</span>
                        <p className="recommendation-item-text">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="human-explanation-text">No specific strategies available. Focus on the explanation and top signals above.</p>
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
