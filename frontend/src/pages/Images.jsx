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
  subject: '',
  gradeLevel: '',
  studentAge: '',
  learningObjective: '',
  visualType: 'auto',
  imageStyle: 'textbook',
  language: 'English',
};

function formatVisualTypeLabel(v) {
  if (!v) return '';
  return String(v)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Why illustration raster failed — server sends illustration_image_error (no secrets). */
function illustrationImageHint(status, err) {
  if (status === 'not_configured') {
    return 'Image API not configured on gpt-service: set HF_IMAGE_API_URL and HF_API_TOKEN in gpt-service/.env, restart port 5002, then try again.';
  }
  const code = err?.code;
  const http = err?.httpStatus;
  if (code === 'HTTP_ERROR' && http === 401) {
    return 'Hugging Face returned 401 — invalid or expired HF_API_TOKEN in gpt-service/.env.';
  }
  if (code === 'HTTP_ERROR' && http === 403) {
    return 'Hugging Face returned 403 — open the model page on HF and accept terms, and ensure your token has Inference access.';
  }
  if (code === 'HTTP_ERROR' && http === 429) {
    return 'Hugging Face rate limit (429). Wait a few minutes and tap Regenerate Image.';
  }
  if (code === 'PARSE_ERROR') {
    return 'Could not decode the image response — wrong endpoint or model format. Check gpt-service logs for [hfTextToImage]; try another HF_IMAGE_API_URL.';
  }
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR') {
    return 'Network timeout talking to Hugging Face — request can exceed several minutes on cold start. Retry or increase timeouts.';
  }
  if (code === 'HTTP_ERROR' && http >= 500) {
    return 'Hugging Face server error — retry later.';
  }
  return 'See gpt-service terminal logs while generating, or open “Show generation prompt” and try Regenerate.';
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
          subject: form.subject.trim(),
          gradeLevel: form.gradeLevel.trim(),
          studentAge: form.studentAge.trim(),
          learningObjective: form.learningObjective.trim(),
          visualType: form.visualType,
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

  const img = result?.generated_image;
  const dataUrl =
    result?.image_url ||
    (img?.base64 && img?.mime_type ? `data:${img.mime_type};base64,${img.base64}` : null);

  const isIllustrationPrimary = result?.primary_visual === 'illustration';
  const illustrationStatus = result?.illustration_image_status;
  const illustrationErr = result?.illustration_image_error;

  const isMapPrimary = result?.primary_visual === 'map';

  const diagramPayload =
    result &&
    !isMapPrimary &&
    ({
      ...(result.diagram_data && typeof result.diagram_data === 'object' ? result.diagram_data : {}),
      ...(result.mermaid && !result.diagram_data?.mermaid
        ? { format: 'mermaid', mermaid: result.mermaid }
        : {}),
    });

  const hasMapCard = Boolean(
    isMapPrimary && result.diagram_data && typeof result.diagram_data === 'object'
  );

  const hasDiagram =
    !isMapPrimary &&
    diagramPayload &&
    typeof diagramPayload === 'object' &&
    (diagramPayload.format === 'mermaid'
      ? Boolean(diagramPayload.mermaid || diagramPayload.source)
      : Object.keys(diagramPayload).length > 0);

  const isLabeledPrimary = result?.primary_visual === 'labeled_diagram';
  const isLabeledSecondary = result?.secondary_visual === 'labeled_diagram';
  const showLabeledDiagramSvg =
    Boolean(result && isLabeledPrimary && result.contentMismatch !== true);

  const labeledTemplate =
    result && showLabeledDiagramSvg
      ? resolveLabeledDiagramTemplate(result.topic, result.diagram_data)
      : null;

  const labelsForList =
    result && Array.isArray(result.labels) && result.labels.length > 0
      ? result.labels
      : showLabeledDiagramSvg && labeledTemplate === 'plant_cell'
        ? PLANT_CELL_DEFAULT_LABELS
        : result?.labels || [];

  const showLabels =
    result &&
    labelsForList.length > 0 &&
    (isLabeledPrimary || isLabeledSecondary || isMapPrimary);

  const showProcessMismatchWarning = result?.contentMismatch === true;

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
                Generating illustration...
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
              <span style={{ color: 'var(--text-muted)' }}>Primary visual: </span>
              <strong>{formatVisualTypeLabel(result.primary_visual)}</strong>
            </div>
            {result.secondary_visual ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Secondary visual: </span>
                <strong>{formatVisualTypeLabel(result.secondary_visual)}</strong>
              </div>
            ) : null}
            {result.visual_reason ? (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>Why this visual: </span>
                {result.visual_reason}
              </div>
            ) : null}

            {showProcessMismatchWarning ? (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ color: '#fcd34d', fontWeight: 600 }}>Note: </span>
                This lesson is mainly about a process or sequence. A flowchart or process diagram is better as the
                primary teaching visual. A labeled diagram can be used only as a secondary support visual.
              </div>
            ) : null}

            {showLabeledDiagramSvg ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Diagram preview (SVG)
                </p>
                <LabeledDiagramPreview
                  topic={result.topic}
                  labels={result.labels}
                  diagramData={result.diagram_data}
                />
              </div>
            ) : null}

            {result.helper_note ? (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.28)',
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                {result.helper_note}
              </div>
            ) : null}

            {hasMapCard ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Map (geographic context — where)
                </p>
                <MapCard data={result.diagram_data} />
              </div>
            ) : null}

            {hasDiagram ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                  {result.diagram_format === 'mermaid' || result.mermaid
                    ? result.primary_visual === 'cause_effect_diagram'
                      ? 'Cause-effect (Mermaid)'
                      : result.primary_visual === 'hierarchy_tree'
                        ? 'Hierarchy / classification (Mermaid)'
                        : 'Diagram (Mermaid)'
                    : result.diagram_format === 'image_prompt_with_label_metadata'
                      ? 'Structured diagram'
                      : result.diagram_format === 'timeline'
                        ? 'Timeline (Mermaid)'
                        : result.diagram_format === 'chart'
                          ? 'Chart'
                          : result.diagram_format === 'html_table'
                            ? 'Comparison table'
                            : 'Diagram / data'}
                </p>
                <DiagramPreview
                  diagramData={diagramPayload}
                  key={`${diagramPayload?.format || ''}-${String(diagramPayload?.mermaid || '').slice(0, 200)}-${String(diagramPayload?.html || '').length}-${String(diagramPayload?.chart?.title || '')}`}
                />
              </div>
            ) : null}

            {isIllustrationPrimary ? (
              <div style={{ marginBottom: '1.25rem' }}>
                {!dataUrl ? (
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(251, 191, 36, 0.35)',
                      color: 'var(--text-muted)',
                      marginBottom: '1rem',
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0' }}>
                      Image generation failed. Showing illustration plan instead.
                    </p>
                    <p style={{ margin: '0.6rem 0 0', fontSize: '0.92rem', lineHeight: 1.5 }}>
                      {illustrationImageHint(illustrationStatus, illustrationErr)}
                    </p>
                  </div>
                ) : null}
                {dataUrl ? (
                  <div
                    style={{
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.2)',
                      marginBottom: '1rem',
                    }}
                  >
                    <img
                      src={dataUrl}
                      alt={result.alt_text || 'Educational illustration'}
                      style={{ width: '100%', display: 'block', maxHeight: 'min(70vh, 520px)', objectFit: 'contain' }}
                    />
                  </div>
                ) : null}

                <div style={{ marginBottom: '0.75rem' }}>
                  <p className="form-label" style={{ marginBottom: '0.35rem' }}>
                    Student caption
                  </p>
                  <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.55 }}>
                    {result.student_caption || '—'}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn"
                  style={{ marginBottom: '1rem' }}
                  disabled={loading}
                  onClick={() => runGenerate()}
                >
                  Regenerate Image
                </button>

                <details style={{ marginBottom: '1rem' }}>
                  <summary className="form-label" style={{ cursor: 'pointer', marginBottom: '0.35rem' }}>
                    Alt text (accessibility)
                  </summary>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    {result.alt_text || '—'}
                  </p>
                </details>

                {result.image_prompt ? (
                  <details
                    style={{
                      marginBottom: '0.5rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.45)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <summary className="form-label" style={{ cursor: 'pointer', marginBottom: 0 }}>
                      Show generation prompt
                    </summary>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        margin: '0.75rem 0 0',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      {result.image_prompt}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}

            {dataUrl && !isIllustrationPrimary ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Image preview (optional — no text baked into pixels)
                </p>
                <div
                  style={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <img
                    src={dataUrl}
                    alt={result.alt_text || 'Generated educational visual'}
                    style={{ width: '100%', display: 'block', maxHeight: 'min(70vh, 520px)', objectFit: 'contain' }}
                  />
                </div>
              </div>
            ) : null}

            {result.image_prompt && !isIllustrationPrimary ? (
              <details
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <summary className="form-label" style={{ cursor: 'pointer', marginBottom: 0 }}>
                  Optional image-generation prompt (HF / external tools)
                </summary>
                <p style={{ whiteSpace: 'pre-wrap', margin: '0.75rem 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  {result.image_prompt}
                </p>
              </details>
            ) : null}

            {showLabels ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Labels (for overlays — not drawn inside generated images)
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                  {labelsForList.map((l, i) => (
                    <li key={String(i)}>
                      <strong>{l.text}</strong>
                      {l.target ? (
                        <span style={{ color: 'var(--text-muted)' }}> → {l.target}</span>
                      ) : null}
                      {l.position_hint ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {' '}
                          ({l.position_hint})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!isIllustrationPrimary ? (
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: '1fr',
                }}
              >
                <div>
                  <p className="form-label" style={{ marginBottom: '0.35rem' }}>
                    Alt text
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>{result.alt_text || '—'}</p>
                </div>
                <div>
                  <p className="form-label" style={{ marginBottom: '0.35rem' }}>
                    Student caption
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>{result.student_caption || '—'}</p>
                </div>
              </div>
            ) : null}

            {Array.isArray(result.verification_notes) && result.verification_notes.length > 0 ? (
              <div style={{ marginTop: '1.25rem' }}>
                <p className="form-label" style={{ marginBottom: '0.35rem' }}>
                  Verification notes
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                  {result.verification_notes.map((n, i) => (
                    <li key={String(i)}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
