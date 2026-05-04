import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationalImageForm from '../components/EducationalImageForm';
import DiagramPreview from '../components/DiagramPreview';
import MapCard from '../components/MapCard';
import LabeledDiagramPreview from '../utils/renderLabeledDiagram';
import { resolveLabeledDiagramTemplate } from '../utils/labeledDiagramTemplate';
import { generateEducationalVisual } from '../services/educationalImageService';

const PLANT_CELL_DEFAULT_LABELS = [
  { text: 'Cell wall' },
  { text: 'Cell membrane' },
  { text: 'Cytoplasm' },
  { text: 'Nucleus' },
  { text: 'Chloroplasts' },
];

const initialForm = {
  lessonText: '',
  studentAge: '',
  imageStyle: 'textbook',
  language: 'English',
};

function formatVisualTypeLabel(v) {
  if (!v) return '';
  return String(v)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Images() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const runGenerate = async () => {
    setError('');
    setResult(null);
    const lessonText = form.lessonText.trim();
    if (!lessonText) {
      setError('Please enter lesson text or extracted content.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const data = await generateEducationalVisual(
        {
          lessonText,
          studentAge: form.studentAge.trim(),
          imageStyle: form.imageStyle,
          language: form.language.trim() || 'English',
        },
        token
      );
      setResult(data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      const data = err.response?.data;
      if (data?.code === 'HF_INSUFFICIENT_CREDITS' && data?.message) {
        setError(data.message);
        return;
      }
      const status = err.response?.status;
      if (status >= 500 || !err.response) {
        setError('Generation could not be completed. Please try again.');
      } else {
        setError(
          [err.response?.data?.message, err.response?.data?.detail, err.message]
            .filter(Boolean)
            .join('\n\n') || 'Generation failed.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const visuals =
    Array.isArray(result?.visuals) && result.visuals.length > 0
      ? result.visuals
      : result
        ? [
            {
              id: 'visual_1',
              title: `${formatVisualTypeLabel(result.primary_visual || 'visual')} visual`,
              visual_type: result.primary_visual || '',
              why_selected: result.visual_reason || '',
              diagram_format: result.diagram_format || '',
              diagram_data: result.diagram_data || {},
              mermaid: result.mermaid || '',
              image_prompt: result.image_prompt || '',
              image_url: result.image_url || '',
              labels: Array.isArray(result.labels) ? result.labels : [],
              alt_text: result.alt_text || '',
              student_caption: result.student_caption || '',
              verification_notes: Array.isArray(result.verification_notes) ? result.verification_notes : [],
              illustration_image_status: result.illustration_image_status || null,
              illustration_image_error: result.illustration_image_error || null,
            },
          ]
        : [];
  const renderVisual = (visual, idx) => {
    const visualType = visual?.visual_type;
    const diagramData = visual?.diagram_data || {};
    const mergedDiagram =
      visual?.diagram_format === 'mermaid' && !diagramData.mermaid
        ? { ...diagramData, format: 'mermaid', mermaid: visual?.mermaid || '' }
        : diagramData;
    const labels = Array.isArray(visual?.labels) ? visual.labels : [];
    const showLabeledTemplate = visualType === 'labeled_diagram';
    const template = showLabeledTemplate
      ? resolveLabeledDiagramTemplate(result?.topic || visual?.title, mergedDiagram)
      : null;
    const labelsForList =
      labels.length > 0
        ? labels
        : showLabeledTemplate && template === 'plant_cell'
          ? PLANT_CELL_DEFAULT_LABELS
          : [];

    return (
      <div
        key={visual?.id || String(idx)}
        style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.35)',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ marginBottom: '0.65rem' }}>
          <strong>{visual?.title || `Visual ${idx + 1}`}</strong>
        </div>
        <div style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
          Type: <strong>{formatVisualTypeLabel(visualType)}</strong>
        </div>
        {visual?.visual_reason ? (
          <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
            Why selected: {visual.visual_reason}
          </div>
        ) : null}
        {visualType === 'map' ? <MapCard data={mergedDiagram} /> : null}
        {showLabeledTemplate ? (
          <div style={{ marginBottom: '1rem' }}>
            <LabeledDiagramPreview
              topic={result?.topic || visual?.title}
              labels={labels}
              diagramData={mergedDiagram}
            />
          </div>
        ) : null}
        {visualType !== 'map' && (!showLabeledTemplate || !template) ? (
          <DiagramPreview diagramData={mergedDiagram} />
        ) : null}
        {visual?.image_url ? (
          <div style={{ marginTop: '0.75rem' }}>
            <img
              src={visual.image_url}
              alt={visual?.alt_text || 'Generated visual'}
              style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '10px' }}
            />
          </div>
        ) : null}
        {visualType === 'illustration' && !visual?.image_url ? (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: 'var(--text-muted)',
            }}
          >
            {illustrationImageHint(visual?.illustration_image_status, visual?.illustration_image_error)}
          </div>
        ) : null}
        {visualType === 'illustration' ? (
          <button type="button" className="btn" style={{ marginTop: '0.75rem' }} disabled={loading} onClick={runGenerate}>
            Regenerate Image
          </button>
        ) : null}
        {labelsForList.length > 0 ? (
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            {labelsForList.map((l, i) => (
              <li key={String(i)}>
                <strong>{l.text}</strong>
                {l.target ? <span style={{ color: 'var(--text-muted)' }}> → {l.target}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {visual?.image_prompt ? (
          <details style={{ marginTop: '0.75rem' }}>
            <summary className="form-label" style={{ cursor: 'pointer' }}>
              Show generation prompt
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {visual.image_prompt}
            </pre>
          </details>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 className="gradient-text" style={{ margin: '0 0 0.35rem' }}>
                Lesson visuals
              </h1>
              <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '640px' }}>
                Structured diagrams (Mermaid, tables, charts) keep text accurate. Images are only for
                illustrations or unlabeled bases—never for text inside the picture.
              </p>
            </div>
            <button type="button" className="btn" onClick={() => navigate('/dashboard')}>
              Back
            </button>
          </div>

          <EducationalImageForm
            values={form}
            onChange={setForm}
            onSubmit={runGenerate}
            disabled={loading}
            error={error}
            submitLabel={loading ? 'Generating…' : 'Generate'}
          />
        </div>

        {loading ? (
          <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  border: '2px solid rgba(148, 163, 184, 0.35)',
                  borderTopColor: 'var(--accent, #38bdf8)',
                  borderRadius: '50%',
                  animation: 'images-spin 0.75s linear infinite',
                }}
              />
              <style>{`@keyframes images-spin { to { transform: rotate(360deg); } }`}</style>
              <p className="gradient-text" style={{ margin: 0 }}>
                Generating lesson visuals...
              </p>
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.95rem' }}>
              Hugging Face may take longer on the first request (cold start). Safe to wait up to a few minutes.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>Result</h2>

            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Topic: </span>
              <strong>{result.topic || '—'}</strong>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subject: </span>
              <strong>{result.subject || '—'}</strong>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Learner level: </span>
              <strong>{result.learner_level || '—'}</strong>
            </div>
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              {result.summary || '—'}
            </div>
            {Array.isArray(result.learning_objectives) && result.learning_objectives.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <p className="form-label" style={{ marginBottom: '0.35rem' }}>Learning objectives</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                  {result.learning_objectives.map((o, i) => <li key={String(i)}>{o}</li>)}
                </ul>
              </div>
            ) : null}
            {Array.isArray(result.key_concepts) && result.key_concepts.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <p className="form-label" style={{ marginBottom: '0.35rem' }}>Key concepts</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                  {result.key_concepts.map((k, i) => <li key={String(i)}>{k}</li>)}
                </ul>
              </div>
            ) : null}
            {Array.isArray(result.detected_relationships) && result.detected_relationships.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <p className="form-label" style={{ marginBottom: '0.35rem' }}>Detected relationships</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                  {result.detected_relationships.map((r, i) => (
                    <li key={String(i)}>
                      <strong>{formatVisualTypeLabel(r.recommended_visual)}</strong> - {r.evidence}
                      {r.confidence ? (
                        <span style={{ color: 'var(--text-muted)' }}> ({r.confidence} confidence)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {visuals.map((v, i) => renderVisual(v, i))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
