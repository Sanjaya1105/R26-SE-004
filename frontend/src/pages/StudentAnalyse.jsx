import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  fetchLimeExplanation,
  fetchLimeLessons,
  fetchLimePredictions,
  fetchLimeStudentsByLesson,
} from '../lime/apiClient';
import '../styles/studentAnalyse.css';

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
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

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
        limit: 500,
      });
      setPredictions(rows ?? []);
      setLimeExplanation(null);
      setSelectedAnalysisRowId(null);

      if (!rows?.length) {
        setStatusMessage('No High/Very High cognitive load records found for this selection.');
      } else {
        setStatusMessage(`Loaded ${rows.length} high-load records.`);
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
      const explanation = await fetchLimeExplanation(selectedLessonId, row.id, {
        numFeatures: 8,
        numSamples: 500,
      });
      setSelectedAnalysisRowId(row.id);
      setLimeExplanation(explanation);
      setStatusMessage(`LIME explanation generated for record #${row.id}.`);
    } catch (err) {
      setError(err.message);
      setLimeExplanation(null);
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
                Lesson {lesson.lesson_id} ({lesson.prediction_count} records)
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
                Student {student.student_id} ({student.prediction_count} records)
              </option>
            ))}
          </select>
        </label>

        <button onClick={handleShowHighLoad} disabled={!selectedLessonId || loading}>
          {loading ? 'Loading...' : 'Show High Cognitive Load'}
        </button>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {statusMessage ? <div className="alert success">{statusMessage}</div> : null}

      <section className="student-analyse-results glass-panel">
        <h2>High and Very High Results</h2>

        {!predictions.length ? (
          <p className="empty-state">No results loaded yet.</p>
        ) : (
          <div className="results-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Lesson</th>
                  <th>Student</th>
                  <th>Minute</th>
                  <th>Cognitive Load</th>
                  <th>Score</th>
                  <th>Confidence</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.lesson_id}</td>
                    <td>{row.student_id}</td>
                    <td>{row.minute_index}</td>
                    <td>
                      <span className={`load-badge ${row.predicted_cognitive_load === 'Very High' ? 'very-high' : 'high'}`}>
                        {row.predicted_cognitive_load}
                      </span>
                    </td>
                    <td>{row.predicted_score}</td>
                    <td>{Number(row.confidence).toFixed(2)}</td>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
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
              <p className="human-explanation-title">Human-Readable Explanation</p>
              <p className="human-explanation-source">
                Source: {(limeExplanation.explanation_source || 'fallback').toUpperCase()}
              </p>
              <p className="human-explanation-text">
                {limeExplanation.human_explanation || 'No explanation text returned.'}
              </p>
            </div>

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
    </div>
  );
}
