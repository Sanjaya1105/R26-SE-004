import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';
import AssistantMarkdown from '../components/AssistantMarkdown';
import { selectBestOutputLocally } from '../utils/selectBestOutputLocal';
import { parseCanonicalEquations } from '../utils/assistantMath';

function buildGptAskUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/gpt/ask`,
    'http://localhost:4000/api/gpt/ask',
    'http://127.0.0.1:4000/api/gpt/ask',
    'http://localhost:5002/api/gpt/ask',
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

function buildDeepseekChatUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/deepseek/chat`,
    'http://localhost:4000/api/deepseek/chat',
    'http://127.0.0.1:4000/api/deepseek/chat',
    'http://localhost:5004/api/deepseek/chat',
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

function buildSelectBestUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/deepseek/select-best`,
    'http://localhost:4000/api/deepseek/select-best',
    'http://127.0.0.1:4000/api/deepseek/select-best',
    'http://localhost:5004/api/deepseek/select-best',
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

function buildGptPromptUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/gpt/build-prompt`,
    'http://localhost:4000/api/gpt/build-prompt',
    'http://127.0.0.1:4000/api/gpt/build-prompt',
    'http://localhost:5002/api/gpt/build-prompt',
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

const PLAYBACK_PROMPT_COPY = {
  mid: {
    title: 'Lesson suggestion',
    body: 'Do you need any suggestion?',
    extraInstruction:
      'The student is halfway through the lesson video and asked for a suggestion. Adapt the knowledge chunk again for this student.',
  },
  end: {
    title: 'Lesson suggestion',
    body: 'Do you need any suggestion in another way?',
    extraInstruction:
      'The student finished the lesson video and asked for a suggestion in another way. Explain the same knowledge chunk using a different method than a first pass, such as a worked example, analogy, or step-by-step recap.',
  },
};

function PlaybackPersonalizationPrompt({ kind, onYes, onNo, busy }) {
  const copy = PLAYBACK_PROMPT_COPY[kind];
  if (!copy) return null;
  return (
    <aside
      role="status"
      aria-live="polite"
      aria-labelledby="playback-personalization-title"
      style={{
        position: 'fixed',
        right: '1.1rem',
        bottom: '1.1rem',
        width: 'min(360px, calc(100vw - 2rem))',
        zIndex: 40,
        padding: '0.9rem 1rem',
        borderRadius: '12px',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        background: '#1e293b',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.38)',
        color: '#e2e8f0',
      }}
    >
      <p
        id="playback-personalization-title"
        style={{
          margin: 0,
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#93c5fd',
        }}
      >
        {copy.title}
      </p>
      <p
        style={{
          margin: '0.4rem 0 0.75rem 0',
          fontSize: '0.9rem',
          lineHeight: 1.45,
          color: '#f8fafc',
        }}
      >
        {copy.body}
      </p>
      <div style={{ display: 'flex', gap: '0.45rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={onYes}
          style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
        >
          {busy ? 'Working…' : 'Yes'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={onNo}
          style={{
            flex: 1,
            fontSize: '0.8rem',
            padding: '0.4rem 0.6rem',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          No
        </button>
      </div>
    </aside>
  );
}

function subsectionDownloadUrl(courseId, subsectionId, kind) {
  return `${getGatewayBaseUrl()}/api/public/courses/${encodeURIComponent(
    courseId
  )}/subsections/${encodeURIComponent(subsectionId)}/${kind}`;
}

function collectSubsectionImages(sub) {
  const seen = new Set();
  const images = [];
  const add = (img, fallbackSource) => {
    const url = String(img?.url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({
      id: String(img?.id || img?.publicId || url),
      url,
      publicId: img?.publicId || '',
      source: String(img?.source || fallbackSource || '').toLowerCase(),
      filePath: img?.filePath || '',
      pageNumber: Number(img?.pageNumber) || 0,
    });
  };
  (Array.isArray(sub?.extractedImages) ? sub.extractedImages : []).forEach((img) =>
    add(img, img?.source)
  );
  (Array.isArray(sub?.images) ? sub.images : []).forEach((img) => add(img, 'upload'));
  return images;
}

function lessonImageCaption(img, index) {
  if (img.source === 'ppt' && img.pageNumber) return `PPT · slide ${img.pageNumber}`;
  if (img.source === 'pdf' && img.pageNumber) return `PDF · page ${img.pageNumber}`;
  if (img.source === 'ppt') return 'PPT image';
  if (img.source === 'pdf') return 'PDF image';
  if (img.source === 'upload') return `Uploaded image ${index + 1}`;
  return `Lesson image ${index + 1}`;
}

function LessonImageGallery({ images, afterGptOutput = false }) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return (
    <div
      style={{
        marginTop: '0.85rem',
        padding: '0.85rem',
        borderRadius: '10px',
        border: '1px solid rgba(125, 211, 252, 0.28)',
        background: 'rgba(14, 116, 144, 0.12)',
      }}
    >
      <p
        className="form-label"
        style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
      >
        {afterGptOutput
          ? 'Figures from this lesson'
          : 'Lesson images'}
      </p>
      <p
        style={{
          margin: '0 0 0.65rem 0',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          lineHeight: 1.45,
        }}
      >
        These images were extracted from the PPT and PDF. They belong to the
        lesson content, so they are shown for every cognitive style.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '0.65rem',
        }}
      >
        {images.map((img, index) => {
          const caption = lessonImageCaption(img, index);
          return (
            <a
              key={img.id || `${img.url}-${index}`}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                textDecoration: 'none',
                color: 'inherit',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: 'block',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(15, 23, 42, 0.55)',
                  height: '140px',
                }}
              >
                <img
                  src={img.url}
                  alt={caption}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#7dd3fc',
                  lineHeight: 1.35,
                }}
              >
                {caption}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Pretty-print dual-model selection reasoning in the browser console (for defense / debugging). */
function logOutputSelectionReasoning(data, { loadLevel, sourceChars } = {}) {
  const hf = data?.scores?.huggingface;
  const ds = data?.scores?.deepseek;
  const weights = data?.weights || {};
  const winner =
    data?.selectedModel === 'huggingface'
      ? 'Hugging Face'
      : data?.selectedModel === 'deepseek'
        ? 'DeepSeek'
        : data?.selectedModel || 'unknown';

  const row = (label, s) => {
    if (!s) {
      return { Model: label, Status: 'missing output' };
    }
    return {
      Model: label,
      Faithfulness: s.faithfulness == null ? 'n/a' : s.faithfulness,
      'Flesch (FRE)': s.fleschReadingEase,
      'Target FRE': s.targetFlesch,
      'Readability match': s.readabilityMatch,
      Composite: s.composite,
      Formula:
        s.faithfulness == null
          ? `composite = 1.0 * readabilityMatch = ${s.composite}`
          : `composite = ${(weights.faithfulness ?? 0.65)}*faithfulness + ${(weights.readabilityMatch ?? 0.35)}*readabilityMatch = ${s.composite}`,
    };
  };

  console.groupCollapsed(
    `%c[Assistant Select-Best]%c Winner → ${winner}`,
    'color:#2563eb;font-weight:700',
    'color:inherit;font-weight:600'
  );
  console.log('Cognitive load level:', loadLevel);
  console.log('Source content length (chars):', sourceChars);
  console.log('Faithfulness method:', data?.faithfulnessMethod || 'n/a');
  console.log('Reason:', data?.reason || 'n/a');
  if (data?.warning) {
    console.warn('Warning:', data.warning);
  }
  console.log('Weights:', weights);
  console.table([row('Hugging Face', hf), row('DeepSeek', ds)]);

  if (hf && ds) {
    const delta = Number(
      (Number(hf.composite) - Number(ds.composite)).toFixed(4)
    );
    console.log(
      'Composite delta (HF - DeepSeek):',
      delta,
      delta > 0
        ? '→ Hugging Face higher'
        : delta < 0
          ? '→ DeepSeek higher'
          : '→ tie (faithfulness tie-break applies)'
    );
  }

  console.log('Selected model:', data?.selectedModel);
  console.log(
    'Selected output preview:',
    String(data?.selectedText || '').slice(0, 280)
  );
  console.log('Full selection payload:', data);
  console.groupEnd();
}

const ABOUT_PREVIEW_WORDS = 20;
const COGNITIVE_LOAD_WINDOW_MS = 120000;
const SEEK_JUMP_THRESHOLD_SECONDS = 2;
const SEEK_EVENT_DEBOUNCE_MS = 900;

function getActiveStudentId() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'guest-user';
    const user = JSON.parse(raw);
    return String(
      user?.id ?? user?._id ?? user?.studentId ?? user?.email ?? 'guest-user'
    ).trim();
  } catch {
    return 'guest-user';
  }
}

function splitWords(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function formatIsoDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatSeconds(value) {
  if (value == null || value === 'N/A') return 'N/A';
  return `${value}s`;
}

function getLivePredictionSummary(result) {
  if (!result || typeof result !== 'object') return null;

  const prediction =
    result.prediction && typeof result.prediction === 'object'
      ? result.prediction
      : null;
  const featureWindow =
    result.feature_window && typeof result.feature_window === 'object'
      ? result.feature_window
      : null;

  return {
    rawEventCount:
      typeof result.raw_event_count === 'number' ? result.raw_event_count : null,
    predictedLoad:
      prediction?.predicted_cognitive_load ??
      prediction?.predicted_label ??
      result.predicted_cognitive_load ??
      result.predicted_label ??
      'Unknown',
    minuteIndex:
      prediction?.minute_index ??
      featureWindow?.minute_index ??
      result.minute_index ??
      null,
    createdAt:
      prediction?.created_at ?? result.created_at ?? featureWindow?.window_end ?? '',
    pauseFrequency:
      prediction?.pause_frequency ??
      featureWindow?.pause_frequency ??
      result.pause_frequency ??
      null,
    rewatchSegments:
      prediction?.rewatch_segments ??
      featureWindow?.rewatch_segments ??
      result.rewatch_segments ??
      null,
    navigationCountVideo:
      prediction?.navigation_count_video ??
      featureWindow?.navigation_count_video ??
      result.navigation_count_video ??
      null,
    playbackRateChange:
      prediction?.playback_rate_change ??
      featureWindow?.playback_rate_change ??
      result.playback_rate_change ??
      null,
    idleDurationVideo:
      prediction?.idle_duration_video ??
      featureWindow?.idle_duration_video ??
      result.idle_duration_video ??
      null,
    timeOnContent:
      prediction?.time_on_content ??
      featureWindow?.time_on_content ??
      result.time_on_content ??
      null,
  };
}

function createEmptyRawEventStats() {
  return {
    pauseCount: 0,
    seekCount: 0,
    rewatchCount: 0,
    rateChangeCount: 0,
    idleDuration: 0,
    lastEvent: '',
  };
}

function getRawEventLabel(eventType) {
  const labels = {
    play: 'Play',
    pause: 'Pause',
    seek_forward: 'Seek forward',
    seek_backward: 'Rewatch',
    rate_change: 'Rate change',
    adaptation_navigation: 'Video opened',
    adaptation_revisit: 'Adaptation revisit',
    adaptation_idle: 'Adaptation idle',
    idle_start: 'Idle started',
    idle_end: 'Idle ended',
    quiz_submit: 'Quiz submitted',
  };

  return labels[eventType] ?? eventType ?? 'Unknown';
}

function getCognitiveLoadTheme(load) {
  const value = String(load || '').toLowerCase();

  if (value.includes('very high')) {
    return {
      bg: '#fef2f2',
      border: '#fecaca',
      accent: '#dc2626',
      soft: '#fee2e2',
      text: '#7f1d1d',
    };
  }

  if (value.includes('high')) {
    return {
      bg: '#fff7ed',
      border: '#fed7aa',
      accent: '#ea580c',
      soft: '#ffedd5',
      text: '#7c2d12',
    };
  }

  if (value.includes('medium')) {
    return {
      bg: '#eff6ff',
      border: '#bfdbfe',
      accent: '#2563eb',
      soft: '#dbeafe',
      text: '#1e3a8a',
    };
  }

  if (value.includes('low')) {
    return {
      bg: '#ecfdf5',
      border: '#a7f3d0',
      accent: '#059669',
      soft: '#d1fae5',
      text: '#064e3b',
    };
  }

  return {
    bg: '#f8fafc',
    border: '#cbd5e1',
    accent: '#475569',
    soft: '#e2e8f0',
    text: '#334155',
  };
}

function MiniMetric({ label, value }) {
  return (
    <div
      style={{
        padding: '0.65rem 0.75rem',
        borderRadius: '10px',
        border: '1px solid rgba(148, 163, 184, 0.24)',
        background: 'rgba(255, 255, 255, 0.72)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          color: '#64748b',
          marginBottom: '0.22rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#1f2937',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function updateRawEventStats(previousStats, payload) {
  const nextStats = {
    ...previousStats,
    lastEvent: getRawEventLabel(payload.event_type),
  };

  if (payload.event_type === 'pause') {
    nextStats.pauseCount += 1;
  } else if (payload.event_type === 'seek_forward') {
    nextStats.seekCount += 1;
  } else if (payload.event_type === 'seek_backward') {
    nextStats.rewatchCount += 1;
  } else if (payload.event_type === 'rate_change') {
    nextStats.rateChangeCount += 1;
  } else if (payload.event_type === 'adaptation_idle') {
    nextStats.idleDuration += Number(payload.event_value || 0);
  }

  return nextStats;
}

function getCompletedWindowInfo(sessionStart, sessionId, now = new Date()) {
  if (!(sessionStart instanceof Date) || !sessionId) {
    return null;
  }

  const elapsedMs = Math.max(0, now.getTime() - sessionStart.getTime());
  const completedWindowCount = Math.floor(elapsedMs / COGNITIVE_LOAD_WINDOW_MS);
  if (completedWindowCount < 1) {
    return null;
  }

  const minuteIndex = completedWindowCount;
  const windowStart = new Date(
    sessionStart.getTime() + (minuteIndex - 1) * COGNITIVE_LOAD_WINDOW_MS
  );
  const windowEnd = new Date(
    sessionStart.getTime() + minuteIndex * COGNITIVE_LOAD_WINDOW_MS
  );

  return {
    minuteIndex,
    windowStart,
    windowEnd,
    windowKey: `${sessionId}:${minuteIndex}`,
  };
}

function getActiveWindowKey(sessionStart, sessionId, now = new Date()) {
  if (!(sessionStart instanceof Date) || !sessionId) {
    return '';
  }

  const elapsedMs = Math.max(0, now.getTime() - sessionStart.getTime());
  const activeWindowIndex = Math.floor(elapsedMs / COGNITIVE_LOAD_WINDOW_MS) + 1;
  return `${sessionId}:${activeWindowIndex}`;
}

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  /** Below this width, sidebar stacks full-width (fixed ¼ width is unreadable). */
  const [stackLayout, setStackLayout] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 760px)').matches
      : false
  );
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** section id → expanded */
  const [sectionOpen, setSectionOpen] = useState({});
  /** subsection id → show material links under that row (sidebar only) */
  const [openSubsectionId, setOpenSubsectionId] = useState(null);
  /** video shown in main column when user activates Video link */
  const [mainVideo, setMainVideo] = useState(null);
  /** About description: collapsed shows ~20 words */
  const [aboutExpanded, setAboutExpanded] = useState(false);
  /** Inline GPT assistant (when a subsection video is open) */
  const [gptQuestion, setGptQuestion] = useState('');
  const [gptAnswer, setGptAnswer] = useState('');
  const [deepseekAnswer, setDeepseekAnswer] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [selectionMeta, setSelectionMeta] = useState(null);
  const [selectionError, setSelectionError] = useState('');
  const [showBothOutputs, setShowBothOutputs] = useState(false);
  const [gptLoading, setGptLoading] = useState(false);
  const [gptError, setGptError] = useState('');
  const [deepseekError, setDeepseekError] = useState('');
  /** Pedagogical prompt (gpt-service prompt builder) */
  const [pedagogicalPrompt, setPedagogicalPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState('');
  const [studentMajor, setStudentMajor] = useState('');
  const [studentYear, setStudentYear] = useState('');
  const [studentInterests, setStudentInterests] = useState('');
  const [cognitiveStyle, setCognitiveStyle] = useState('Visual');
  const [loadLevel, setLoadLevel] = useState('Medium');
  const [frustration, setFrustration] = useState('Low');
  const [profileOpen, setProfileOpen] = useState(false);
  const [cognitiveLoadOpen, setCognitiveLoadOpen] = useState(false);
  const [predictionFeaturesOpen, setPredictionFeaturesOpen] = useState(false);
  const [promptBarOpen, setPromptBarOpen] = useState(false);
  const [playbackPrompt, setPlaybackPrompt] = useState(null);
  const [cognitiveLoadResult, setCognitiveLoadResult] = useState(null);
  const [cognitiveLoadError, setCognitiveLoadError] = useState('');
  const [cognitiveLoadLoading, setCognitiveLoadLoading] = useState(false);
  const [videoSessionId, setVideoSessionId] = useState('');
  const [rawEventStats, setRawEventStats] = useState(createEmptyRawEventStats);
  const videoRef = useRef(null);
  const askPanelRef = useRef(null);
  const playbackPromptRef = useRef(null);
  const midpointPromptShownRef = useRef(false);
  const endPromptShownRef = useRef(false);
  const sessionStartRef = useRef(null);
  const lastVideoTimeRef = useRef(0);
  const seekStartTimeRef = useRef(0);
  const lastPlaybackRateRef = useRef(1);
  const idleStartRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());
  const isSeekingRef = useRef(false);
  const lastSeekEventTimeRef = useRef(0);
  const lastRewatchEventTimeRef = useRef(0);
  const suppressPauseCountUntilRef = useRef(0);
  const pauseConfirmTimeoutRef = useRef(null);
  const seekGestureStartTimeRef = useRef(0);
  const seekDragActiveRef = useRef(false);
  const pendingSeekTargetRef = useRef(null);
  const lastNavigationCommitTimeRef = useRef(0);
  const commitSeekTimeoutRef = useRef(null);
  const predictTimeoutRef = useRef(null);
  const lastPredictedWindowKeyRef = useRef('');
  const predictionInFlightWindowKeyRef = useRef('');
  const activeRawEventWindowKeyRef = useRef('');
  const rawEventQueueRef = useRef(Promise.resolve());
  const windowStatsByKeyRef = useRef({});

  const toggleSection = (sectionId) => {
    const k = String(sectionId);
    setSectionOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const toggleSubsectionLinks = (subsectionId) => {
    const k = String(subsectionId);
    setOpenSubsectionId((prev) => (prev === k ? null : k));
  };

  const livePredictionSummary = getLivePredictionSummary(cognitiveLoadResult);
  const liveLoadStatus = livePredictionSummary?.predictedLoad || 'Collecting data';
  const liveLoadTheme = getCognitiveLoadTheme(liveLoadStatus);
  const liveLoadWindow =
    livePredictionSummary?.minuteIndex != null
      ? `Window #${livePredictionSummary.minuteIndex}`
      : 'Waiting for first 2-minute window';

  const clearWindowStats = () => {
    windowStatsByKeyRef.current = {};
    setRawEventStats(createEmptyRawEventStats());
  };

  const resetActiveWindowStats = (windowKey) => {
    if (windowKey) {
      windowStatsByKeyRef.current[windowKey] = createEmptyRawEventStats();
    }
    setRawEventStats(createEmptyRawEventStats());
  };

  const updateStatsForWindow = (windowKey, payload) => {
    if (!windowKey) return;

    const nextStats = updateRawEventStats(
      windowStatsByKeyRef.current[windowKey] || createEmptyRawEventStats(),
      payload
    );
    windowStatsByKeyRef.current[windowKey] = nextStats;

    if (activeRawEventWindowKeyRef.current === windowKey) {
      setRawEventStats(nextStats);
    }
  };

  useEffect(() => {
    setOpenSubsectionId(null);
    setMainVideo(null);
    setAboutExpanded(false);
    setGptQuestion('');
    setGptAnswer('');
    setDeepseekAnswer('');
    setSelectedAnswer('');
    setSelectionMeta(null);
    setSelectionError('');
    setShowBothOutputs(false);
    setGptError('');
    setDeepseekError('');
    setPedagogicalPrompt('');
    setPromptError('');
    setPlaybackPrompt(null);
    playbackPromptRef.current = null;
    midpointPromptShownRef.current = false;
    endPromptShownRef.current = false;
    setCognitiveLoadResult(null);
    setCognitiveLoadError('');
    setCognitiveLoadLoading(false);
    setVideoSessionId('');
    clearWindowStats();
    lastPredictedWindowKeyRef.current = '';
    predictionInFlightWindowKeyRef.current = '';
    activeRawEventWindowKeyRef.current = '';
  }, [courseId]);

  useEffect(() => {
    setGptQuestion('');
    setGptAnswer('');
    setDeepseekAnswer('');
    setSelectedAnswer('');
    setSelectionMeta(null);
    setSelectionError('');
    setShowBothOutputs(false);
    setGptError('');
    setDeepseekError('');
    setPedagogicalPrompt('');
    setPromptError('');
    setPlaybackPrompt(null);
    playbackPromptRef.current = null;
    midpointPromptShownRef.current = false;
    endPromptShownRef.current = false;
  }, [mainVideo?.url]);

  useEffect(() => {
    if (!mainVideo?.url) {
      sessionStartRef.current = null;
      setVideoSessionId('');
      clearWindowStats();
      lastVideoTimeRef.current = 0;
      lastPlaybackRateRef.current = 1;
      idleStartRef.current = null;
      lastInteractionTimeRef.current = Date.now();
      isSeekingRef.current = false;
      lastSeekEventTimeRef.current = 0;
      lastRewatchEventTimeRef.current = 0;
      suppressPauseCountUntilRef.current = 0;
      seekGestureStartTimeRef.current = 0;
      seekDragActiveRef.current = false;
      pendingSeekTargetRef.current = null;
      lastNavigationCommitTimeRef.current = 0;
      lastPredictedWindowKeyRef.current = '';
      predictionInFlightWindowKeyRef.current = '';
      activeRawEventWindowKeyRef.current = '';
      if (pauseConfirmTimeoutRef.current) {
        window.clearTimeout(pauseConfirmTimeoutRef.current);
        pauseConfirmTimeoutRef.current = null;
      }
      if (commitSeekTimeoutRef.current) {
        window.clearTimeout(commitSeekTimeoutRef.current);
        commitSeekTimeoutRef.current = null;
      }
      if (predictTimeoutRef.current) {
        window.clearTimeout(predictTimeoutRef.current);
        predictTimeoutRef.current = null;
      }
      return undefined;
    }

    const startedAt = new Date();
    const sessionId = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStartRef.current = startedAt;
    setVideoSessionId(sessionId);
    clearWindowStats();
    lastVideoTimeRef.current = 0;
    lastPlaybackRateRef.current = 1;
    idleStartRef.current = null;
    lastInteractionTimeRef.current = Date.now();
    isSeekingRef.current = false;
    lastSeekEventTimeRef.current = 0;
    lastRewatchEventTimeRef.current = 0;
    suppressPauseCountUntilRef.current = 0;
    seekGestureStartTimeRef.current = 0;
    seekDragActiveRef.current = false;
    pendingSeekTargetRef.current = null;
    lastNavigationCommitTimeRef.current = 0;
    lastPredictedWindowKeyRef.current = '';
    predictionInFlightWindowKeyRef.current = '';
    activeRawEventWindowKeyRef.current = getActiveWindowKey(startedAt, sessionId);
    resetActiveWindowStats(activeRawEventWindowKeyRef.current);

    return () => {
      if (pauseConfirmTimeoutRef.current) {
        window.clearTimeout(pauseConfirmTimeoutRef.current);
        pauseConfirmTimeoutRef.current = null;
      }
      if (commitSeekTimeoutRef.current) {
        window.clearTimeout(commitSeekTimeoutRef.current);
        commitSeekTimeoutRef.current = null;
      }
      if (predictTimeoutRef.current) {
        window.clearTimeout(predictTimeoutRef.current);
        predictTimeoutRef.current = null;
      }
    };
  }, [courseId, mainVideo?.lessonId, mainVideo?.subsectionId, mainVideo?.url]);

  const runCognitiveLoadPredictionForCompletedWindow = async () => {
    if (!mainVideo?.url || !videoSessionId || !sessionStartRef.current) {
      return;
    }

    const windowInfo = getCompletedWindowInfo(
      sessionStartRef.current,
      videoSessionId,
      new Date()
    );
    if (!windowInfo) {
      return;
    }

    const { minuteIndex, windowStart, windowEnd, windowKey } = windowInfo;

    if (
      lastPredictedWindowKeyRef.current === windowKey ||
      predictionInFlightWindowKeyRef.current === windowKey
    ) {
      return;
    }

    try {
      setCognitiveLoadLoading(true);
      setCognitiveLoadError('');
      predictionInFlightWindowKeyRef.current = windowKey;
      const completedWindowStats =
        windowStatsByKeyRef.current[windowKey] || createEmptyRawEventStats();
      const windowSeconds = Math.max(
        0,
        Math.round((windowEnd.getTime() - windowStart.getTime()) / 1000)
      );
      const idleDurationVideo = Math.max(
        0,
        Number(completedWindowStats.idleDuration || 0)
      );
      const res = await axios.post(
        `${getGatewayBaseUrl()}/api/cognitive-load/predict`,
        {
          student_id: getActiveStudentId(),
          lesson_id: String(
            mainVideo.lessonId || mainVideo.subsectionId || courseId
          ),
          session_id: videoSessionId,
          minute_index: minuteIndex,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          pause_frequency: completedWindowStats.pauseCount,
          navigation_count_video: completedWindowStats.seekCount,
          rewatch_segments: completedWindowStats.rewatchCount,
          playback_rate_change: completedWindowStats.rateChangeCount,
          idle_duration_video: idleDurationVideo,
          time_on_content: Math.max(0, windowSeconds - idleDurationVideo),
          save_result: true,
        }
      );
      setCognitiveLoadResult(res.data);
      lastPredictedWindowKeyRef.current = windowKey;
    } catch (error) {
      setCognitiveLoadError(
        error.response?.data?.detail?.[0]?.msg ||
          error.response?.data?.message ||
          error.message ||
          'Could not predict cognitive load for this video session.'
      );
    } finally {
      if (predictionInFlightWindowKeyRef.current === windowKey) {
        predictionInFlightWindowKeyRef.current = '';
      }
      setCognitiveLoadLoading(false);
    }
  };

  const enqueueRawEvent = ({ payload, sessionIdOverride, eventTime }) => {
    const activeSessionId = sessionIdOverride ?? videoSessionId;
    if (!mainVideo?.url || !activeSessionId) {
      return Promise.resolve();
    }

    rawEventQueueRef.current = rawEventQueueRef.current
      .catch(() => {})
      .then(async () => {
        await axios.post(`${getGatewayBaseUrl()}/api/cognitive-load/events/raw`, {
          student_id: getActiveStudentId(),
          lesson_id: String(mainVideo.lessonId || mainVideo.subsectionId || courseId),
          session_id: activeSessionId,
          event_time: eventTime,
          video_time: payload.video_time ?? null,
          from_position: payload.from_position ?? null,
          to_position: payload.to_position ?? null,
          event_value: payload.event_value ?? null,
          question_id: payload.question_id ?? null,
          is_correct: payload.is_correct ?? null,
          event_type: payload.event_type,
        });
      });

    return rawEventQueueRef.current;
  };

  const sendCognitiveLoadEvent = async (payload) => {
    if (!mainVideo?.url || !videoSessionId) return;

    const eventTime = new Date().toISOString();
    const currentWindowKey = getActiveWindowKey(
      sessionStartRef.current,
      videoSessionId
    );

    if (
      currentWindowKey &&
      activeRawEventWindowKeyRef.current !== currentWindowKey
    ) {
      activeRawEventWindowKeyRef.current = currentWindowKey;
      resetActiveWindowStats(currentWindowKey);
    }

    updateStatsForWindow(currentWindowKey, payload);

    enqueueRawEvent({ payload, eventTime }).catch(() => {
      setCognitiveLoadError(
        'Could not send video interaction data to the cognitive load API.'
      );
    });
  };

  const markInteraction = () => {
    lastInteractionTimeRef.current = Date.now();

    if (idleStartRef.current) {
      sendCognitiveLoadEvent({
        event_type: 'idle_end',
        video_time: Number(videoRef.current?.currentTime?.toFixed(2) || 0),
      });
    }

    idleStartRef.current = null;
  };

  const isPauseFromSeek = () => {
    const now = Date.now();
    const recentlySought = now - lastSeekEventTimeRef.current < 600;
    const recentlyRewatched = now - lastRewatchEventTimeRef.current < 3000;
    const inSuppressionWindow = now < suppressPauseCountUntilRef.current;

    return (
      isSeekingRef.current ||
      Boolean(videoRef.current?.seeking) ||
      recentlySought ||
      recentlyRewatched ||
      inSuppressionWindow
    );
  };

  const beginSeekGesture = () => {
    if (!seekDragActiveRef.current) {
      seekDragActiveRef.current = true;
      seekGestureStartTimeRef.current = seekStartTimeRef.current;
    }
  };

  const resetSeekGesture = () => {
    seekDragActiveRef.current = false;
    pendingSeekTargetRef.current = null;
    if (commitSeekTimeoutRef.current) {
      window.clearTimeout(commitSeekTimeoutRef.current);
      commitSeekTimeoutRef.current = null;
    }
  };

  const commitVideoNavigationEvent = ({ fromPosition, toPosition }) => {
    const from = Number(fromPosition || 0);
    const to = Number(toPosition || 0);
    const moveDistance = Math.abs(to - from);

    if (moveDistance < 0.5) {
      return false;
    }

    const now = Date.now();
    if (now - lastNavigationCommitTimeRef.current < SEEK_EVENT_DEBOUNCE_MS) {
      return false;
    }

    const isBackwardSeek = to < from - 0.25;

    lastNavigationCommitTimeRef.current = now;
    lastSeekEventTimeRef.current = now;
    suppressPauseCountUntilRef.current = now + 2500;
    lastVideoTimeRef.current = to;

    if (isBackwardSeek) {
      lastRewatchEventTimeRef.current = now;
    }

    sendCognitiveLoadEvent({
      event_type: isBackwardSeek ? 'seek_backward' : 'seek_forward',
      from_position: Number(from.toFixed(2)),
      to_position: Number(to.toFixed(2)),
      video_time: Number(to.toFixed(2)),
    });

    return true;
  };

  const handleVideoPause = () => {
    const pausePosition = Number(videoRef.current?.currentTime?.toFixed(2) || 0);

    if (pauseConfirmTimeoutRef.current) {
      window.clearTimeout(pauseConfirmTimeoutRef.current);
    }

    pauseConfirmTimeoutRef.current = window.setTimeout(() => {
      const positionChanged =
        Math.abs((videoRef.current?.currentTime || 0) - pausePosition) > 0.15;

      if (videoRef.current?.paused && !isPauseFromSeek() && !positionChanged) {
        sendCognitiveLoadEvent({
          event_type: 'pause',
          video_time: pausePosition,
        });
      }

      pauseConfirmTimeoutRef.current = null;
    }, 350);

    markInteraction();
  };

  const handleVideoPlay = () => {
    if (pauseConfirmTimeoutRef.current) {
      window.clearTimeout(pauseConfirmTimeoutRef.current);
      pauseConfirmTimeoutRef.current = null;
    }
    markInteraction();
  };

  const handleVideoSeeking = () => {
    seekStartTimeRef.current = lastVideoTimeRef.current;
    isSeekingRef.current = true;
    lastSeekEventTimeRef.current = Date.now();
    suppressPauseCountUntilRef.current = Date.now() + 2000;
    beginSeekGesture();
    markInteraction();
  };

  const handleVideoSeeked = () => {
    lastSeekEventTimeRef.current = Date.now();
    suppressPauseCountUntilRef.current = Date.now() + 2000;

    if (pauseConfirmTimeoutRef.current) {
      window.clearTimeout(pauseConfirmTimeoutRef.current);
      pauseConfirmTimeoutRef.current = null;
    }

    pendingSeekTargetRef.current = Number(videoRef.current?.currentTime?.toFixed(2) || 0);
    markInteraction();

    if (commitSeekTimeoutRef.current) {
      window.clearTimeout(commitSeekTimeoutRef.current);
    }

    commitSeekTimeoutRef.current = window.setTimeout(() => {
      const gestureStart = seekDragActiveRef.current
        ? seekGestureStartTimeRef.current
        : seekStartTimeRef.current;
      const finalTarget = Number(
        pendingSeekTargetRef.current ?? videoRef.current?.currentTime?.toFixed(2) ?? 0
      );

      commitVideoNavigationEvent({
        fromPosition: gestureStart,
        toPosition: finalTarget,
      });

      isSeekingRef.current = false;
      resetSeekGesture();
    }, 250);

    window.setTimeout(() => {
      if (!commitSeekTimeoutRef.current) {
        isSeekingRef.current = false;
      }
    }, 0);
  };

  const openPlaybackPersonalizationPrompt = (kind) => {
    if (kind !== 'mid' && kind !== 'end') return;
    if (kind === 'mid' && midpointPromptShownRef.current) return;
    if (kind === 'end' && endPromptShownRef.current) return;
    if (kind === 'mid' && playbackPromptRef.current) return;
    if (kind === 'mid') midpointPromptShownRef.current = true;
    if (kind === 'end') endPromptShownRef.current = true;
    playbackPromptRef.current = kind;
    setPlaybackPrompt(kind);
  };

  const dismissPlaybackPersonalizationPrompt = () => {
    playbackPromptRef.current = null;
    setPlaybackPrompt(null);
  };

  const handleVideoRateChange = () => {
    const currentRate = Number(videoRef.current?.playbackRate || 1);
    if (currentRate === lastPlaybackRateRef.current) return;
    lastPlaybackRateRef.current = currentRate;
    sendCognitiveLoadEvent({
      event_type: 'rate_change',
      event_value: String(currentRate),
      video_time: Number(videoRef.current?.currentTime?.toFixed(2) || 0),
    });
    markInteraction();
  };

  const handleVideoTimeUpdate = () => {
    const currentTime = Number(videoRef.current?.currentTime || 0);
    const previousTime = Number(lastVideoTimeRef.current || 0);
    const jumpDistance = Math.abs(currentTime - previousTime);

    if (jumpDistance > SEEK_JUMP_THRESHOLD_SECONDS) {
      commitVideoNavigationEvent({
        fromPosition: previousTime,
        toPosition: currentTime,
      });
    }

    lastVideoTimeRef.current = currentTime;

    const duration = Number(videoRef.current?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    if (currentTime >= duration - 0.35) {
      openPlaybackPersonalizationPrompt('end');
      return;
    }
    if (duration >= 8 && currentTime >= duration * 0.5) {
      openPlaybackPersonalizationPrompt('mid');
    }
  };

  const handleVideoEnded = () => {
    openPlaybackPersonalizationPrompt('end');
    markInteraction();
  };

  useEffect(() => {
    if (!mainVideo?.url || !videoSessionId) {
      return undefined;
    }

    const interactionEvents = ['mousemove', 'keydown', 'click'];
    const onInteraction = () => markInteraction();

    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, onInteraction);
    });

    const idleCheckIntervalId = window.setInterval(() => {
      const inactiveMs = Date.now() - lastInteractionTimeRef.current;

      if (inactiveMs > 60000) {
        if (!idleStartRef.current) {
          idleStartRef.current = Date.now();
          sendCognitiveLoadEvent({
            event_type: 'idle_start',
            video_time: Number(videoRef.current?.currentTime?.toFixed(2) || 0),
          });
        } else {
          const activeWindowKey = activeRawEventWindowKeyRef.current;
          if (activeWindowKey) {
            const nextStats = {
              ...(windowStatsByKeyRef.current[activeWindowKey] ||
                createEmptyRawEventStats()),
              idleDuration:
                (windowStatsByKeyRef.current[activeWindowKey]?.idleDuration || 0) + 1,
            };
            windowStatsByKeyRef.current[activeWindowKey] = nextStats;
          }
          setRawEventStats((prev) => ({
            ...prev,
            idleDuration: prev.idleDuration + 1,
          }));
        }
      }
    }, 1000);

    return () => {
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, onInteraction);
      });
      window.clearInterval(idleCheckIntervalId);
    };
  }, [mainVideo?.url, videoSessionId]);

  useEffect(() => {
    if (!mainVideo?.url || !videoSessionId || !sessionStartRef.current) {
      return undefined;
    }

    const scheduleNextWindowPrediction = () => {
      const sessionStart = sessionStartRef.current;
      if (!sessionStart) return;

      const now = Date.now();
      const elapsedMs = Math.max(0, now - sessionStart.getTime());
      const completedWindowCount = Math.floor(elapsedMs / COGNITIVE_LOAD_WINDOW_MS);
      const nextBoundaryMs =
        sessionStart.getTime() + (completedWindowCount + 1) * COGNITIVE_LOAD_WINDOW_MS;
      const delayMs = Math.max(0, nextBoundaryMs - now + 100);

      predictTimeoutRef.current = window.setTimeout(async () => {
        await runCognitiveLoadPredictionForCompletedWindow();
        activeRawEventWindowKeyRef.current = getActiveWindowKey(
          sessionStart,
          videoSessionId
        );
        resetActiveWindowStats(activeRawEventWindowKeyRef.current);
        scheduleNextWindowPrediction();
      }, delayMs);
    };

    scheduleNextWindowPrediction();

    return () => {
      if (predictTimeoutRef.current) {
        window.clearTimeout(predictTimeoutRef.current);
        predictTimeoutRef.current = null;
      }
    };
  }, [courseId, mainVideo?.url, mainVideo?.lessonId, mainVideo?.subsectionId, videoSessionId]);

  useEffect(() => {
    if (!mainVideo?.url) {
      setPedagogicalPrompt('');
      setPromptLoading(false);
      setPromptError('');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPromptLoading(true);
      setPromptError('');
      const body = {
        courseName: course?.courseName || '',
        subsectionTitle: mainVideo.title || '',
        knowledgeChunk: mainVideo.knowledgeChunk || '',
        containsMath: Boolean(mainVideo.containsMath),
        studentProfile: {
          major: studentMajor,
          year: studentYear,
          interests: studentInterests,
        },
        cognitiveStyle,
        cognitiveLoad: { level: loadLevel, frustration },
      };

      const urls = buildGptPromptUrls();
      let lastErr;
      try {
        let res;
        for (const url of urls) {
          try {
            res = await axios.post(url, body);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (e.response?.status === 404) continue;
            if (!e.response && e.code === 'ERR_NETWORK') continue;
            throw e;
          }
        }
        if (!res && lastErr) throw lastErr;
        if (!cancelled) {
          setPedagogicalPrompt(String(res.data?.data?.prompt || '').trim());
        }
      } catch (err) {
        if (!cancelled) {
          setPedagogicalPrompt('');
          setPromptError(
            [err.response?.data?.message, err.response?.data?.detail, err.message]
              .filter(Boolean)
              .join('\n\n') || 'Could not build pedagogical prompt.'
          );
        }
      } finally {
        if (!cancelled) setPromptLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    mainVideo?.url,
    mainVideo?.title,
    mainVideo?.knowledgeChunk,
    mainVideo?.containsMath,
    course?.courseName,
    studentMajor,
    studentYear,
    studentInterests,
    cognitiveStyle,
    loadLevel,
    frustration,
  ]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const sync = () => setStackLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!courseId?.trim()) {
      setLoading(false);
      setError('Missing course id.');
      return undefined;
    }

    (async () => {
      setError('');
      setLoading(true);
      try {
        const res = await axios.get(
          `${getGatewayBaseUrl()}/api/public/courses/${encodeURIComponent(courseId.trim())}`
        );
        const payload = res.data?.data;
        if (!cancelled) {
          setCourse(payload?.course ?? null);
          setSections(Array.isArray(payload?.sections) ? payload.sections : []);
        }
      } catch (e) {
        if (!cancelled) {
          setCourse(null);
          setSections([]);
          setError(
            e.response?.status === 404
              ? 'Course not found.'
              : e.response?.data?.message ||
                  e.message ||
                  'Could not load course.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const keywords =
    Array.isArray(course?.keywords) && course.keywords.length > 0
      ? course.keywords
      : [];
  const canonicalEquations = parseCanonicalEquations(mainVideo?.knowledgeChunk);

  const askCourseGpt = async (extraInstruction) => {
    setGptError('');
    setDeepseekError('');
    setSelectionError('');
    setGptAnswer('');
    setDeepseekAnswer('');
    setSelectedAnswer('');
    setSelectionMeta(null);
    setShowBothOutputs(false);

    const token = localStorage.getItem('token');
    if (!token) {
      setGptError('Sign in to use the assistant (open /login in another tab).');
      return;
    }

    const prompt = pedagogicalPrompt.trim();
    const studentQuestion = gptQuestion.trim();
    const extra =
      typeof extraInstruction === 'string' ? extraInstruction.trim() : '';
    const q = [prompt, studentQuestion ? `Student question: ${studentQuestion}` : '', extra]
      .filter(Boolean)
      .join('\n\n');
    if (!q) {
      setGptError('Wait for the subsection prompt to load, or type a question.');
      return;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };
    const sourceContent = String(mainVideo?.knowledgeChunk || '').slice(0, 12000);

    const postWithFallback = async (urls, body) => {
      let lastErr;
      for (const url of urls) {
        try {
          const res = await axios.post(url, body, { headers: authHeaders });
          return res;
        } catch (e) {
          lastErr = e;
          if (e.response?.status === 404) continue;
          if (!e.response && e.code === 'ERR_NETWORK') continue;
          throw e;
        }
      }
      throw lastErr || new Error('No reachable endpoint.');
    };

    try {
      setGptLoading(true);

      const [hfResult, deepseekResult] = await Promise.allSettled([
        postWithFallback(buildGptAskUrls(), { question: q }),
        postWithFallback(buildDeepseekChatUrls(), {
          message: q,
          history: [],
        }),
      ]);

      let hfText = '';
      let dsText = '';

      if (hfResult.status === 'fulfilled') {
        const payload = hfResult.value.data?.data;
        if (payload?.skipped) {
          setGptError(
            'Hugging Face did not generate a reply. Set HF_GENERATION_ENABLED=true in gpt-service/.env and restart gpt-service.'
          );
        } else {
          hfText = String(payload?.answer || '').trim();
          setGptAnswer(hfText);
          if (!hfText) {
            setGptError('Hugging Face returned an empty answer.');
          }
        }
      } else {
        const err = hfResult.reason;
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          throw err;
        }
        setGptError(
          [
            err?.response?.data?.message,
            err?.response?.data?.detail,
            err?.message,
          ]
            .filter(Boolean)
            .join('\n\n') || 'Hugging Face assistant request failed.'
        );
      }

      if (deepseekResult.status === 'fulfilled') {
        dsText = String(deepseekResult.value.data?.data?.answer || '').trim();
        setDeepseekAnswer(dsText);
      } else {
        const err = deepseekResult.reason;
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          throw err;
        }
        setDeepseekError(
          [
            err?.response?.data?.message,
            err?.response?.data?.detail,
            err?.message,
          ]
            .filter(Boolean)
            .join('\n\n') || 'DeepSeek assistant request failed.'
        );
      }

      if (!hfText && !dsText) {
        return;
      }

      // Cross-check both outputs against original source; pick less-hallucinated / better-fit text.
      try {
        const selectRes = await postWithFallback(buildSelectBestUrls(), {
          sourceContent,
          gptOutput: hfText,
          deepseekOutput: dsText,
          cognitiveLoadLevel: loadLevel,
        });
        const data = selectRes.data?.data;
        setSelectedAnswer(String(data?.selectedText || '').trim());
        setSelectionMeta(data || null);
        logOutputSelectionReasoning(data, {
          loadLevel,
          sourceChars: sourceContent.length,
        });
      } catch (selectErr) {
        console.warn(
          'select-best API failed; using local fallback scorer.',
          selectErr?.response?.status || selectErr?.message || selectErr
        );
        const local = selectBestOutputLocally({
          sourceContent,
          gptOutput: hfText,
          deepseekOutput: dsText,
          cognitiveLoadLevel: loadLevel,
        });
        if (!local.success) {
          setSelectionError(local.message || 'Could not select best output.');
          return;
        }
        setSelectedAnswer(String(local.selectedText || '').trim());
        setSelectionMeta(local);
        setSelectionError('');
        logOutputSelectionReasoning(local, {
          loadLevel,
          sourceChars: sourceContent.length,
        });
        console.warn(
          'Tip: restart deepseek-service so /api/deepseek/select-best returns 200 (currently missing on the running process).'
        );
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setGptError(
        [err.response?.data?.message, err.response?.data?.detail, err.message]
          .filter(Boolean)
          .join('\n\n') || 'Assistant request failed.'
      );
    } finally {
      setGptLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: stackLayout
            ? 'minmax(0, 1fr)'
            : 'minmax(0, 1fr) minmax(0, 3fr)',
          alignItems: 'start',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          padding: '1.25rem',
          gap: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <aside
          className="glass-panel"
          style={{
            minWidth: 0,
            width: '100%',
            alignSelf: 'start',
            position: 'sticky',
            top: '1.25rem',
            maxHeight: 'calc(100vh - 2.5rem)',
            overflowY: 'auto',
            padding: '1.25rem',
            borderRadius: '14px',
          }}
        >
          <Link
            to="/course"
            style={{
              fontSize: '0.85rem',
              color: 'var(--primary, #818cf8)',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: '1rem',
            }}
          >
            ← All courses
          </Link>

          {loading && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Loading…
            </p>
          )}
          {!loading && error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p>
          )}
          {!loading && !error && course && (
            <>
              <div
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  aspectRatio: '16 / 10',
                  background: 'var(--surface)',
                }}
              >
                {course.thumbnailUrl ? (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.courseName || 'Course thumbnail'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : null}
              </div>

              <h1
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: '0.5rem',
                  color: 'var(--text)',
                }}
              >
                {course.courseName || 'Untitled course'}
              </h1>

              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem',
                }}
              >
                {course.educatorName
                  ? `Educator: ${course.educatorName}`
                  : 'Educator: —'}
              </p>

              {keywords.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p
                    className="form-label"
                    style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                  >
                    Keywords
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                    }}
                  >
                    {keywords.map((k) => (
                      <span
                        key={k}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: 'rgba(79, 70, 229, 0.2)',
                          color: '#c7d2fe',
                          border: '1px solid rgba(129, 140, 248, 0.35)',
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {course.description ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p
                    className="form-label"
                    style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                  >
                    About
                  </p>
                  {(() => {
                    const words = splitWords(course.description);
                    const needsTruncate =
                      words.length > ABOUT_PREVIEW_WORDS;
                    const preview = words
                      .slice(0, ABOUT_PREVIEW_WORDS)
                      .join(' ');
                    return (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.55,
                        }}
                      >
                        {!needsTruncate || aboutExpanded ? (
                          <>
                            <p
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {course.description}
                            </p>
                            {needsTruncate ? (
                              <button
                                type="button"
                                onClick={() => setAboutExpanded(false)}
                                style={{
                                  marginTop: '0.35rem',
                                  padding: 0,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  color: '#93c5fd',
                                  textDecoration: 'underline',
                                  fontFamily: 'inherit',
                                }}
                              >
                                See less
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <p style={{ margin: 0 }}>
                            {preview} …{' '}
                            <button
                              type="button"
                              onClick={() => setAboutExpanded(true)}
                              aria-expanded={false}
                              style={{
                                padding: 0,
                                margin: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 'inherit',
                                color: '#93c5fd',
                                textDecoration: 'underline',
                                fontFamily: 'inherit',
                                verticalAlign: 'baseline',
                              }}
                            >
                              See more
                            </button>
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              <p
                className="form-label"
                style={{
                  marginBottom: '0.5rem',
                  fontSize: '0.8rem',
                  letterSpacing: '0.02em',
                }}
              >
                Sections
              </p>
              {sections.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No sections yet.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  {sections.map((s, idx) => {
                    const sid = String(s.id);
                    const subs = Array.isArray(s.subsections)
                      ? s.subsections
                      : [];
                    const open = Boolean(sectionOpen[sid]);
                    const num =
                      typeof s.order === 'number' ? s.order + 1 : idx + 1;

                    return (
                      <div
                        key={sid}
                        style={{
                          paddingBottom: '0.65rem',
                          borderBottom:
                            '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSection(s.id)}
                            aria-expanded={open}
                            aria-label={
                              open ? 'Hide subsections' : 'Show subsections'
                            }
                            style={{
                              flexShrink: 0,
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '8px',
                              background: 'rgba(15, 23, 42, 0.45)',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                transform: open
                                  ? 'rotate(0deg)'
                                  : 'rotate(-90deg)',
                                transition: 'transform 0.18s ease',
                                fontSize: '11px',
                              }}
                            >
                              ▼
                            </span>
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                color: 'var(--text-muted)',
                                marginRight: '0.35rem',
                              }}
                            >
                              {num}.
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {s.sectionName || 'Section'}
                            </span>
                            {subs.length > 0 ? (
                              <span
                                style={{
                                  marginLeft: '0.35rem',
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                ({subs.length})
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {open && (
                          <div
                            style={{
                              marginTop: '0.55rem',
                              marginLeft: '2.2rem',
                              paddingLeft: '0.5rem',
                              borderLeft:
                                '2px solid rgba(129, 140, 248, 0.35)',
                            }}
                          >
                            {subs.length === 0 ? (
                              <p
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  margin: 0,
                                }}
                              >
                                No subsections yet.
                              </p>
                            ) : (
                              <ul
                                style={{
                                  margin: 0,
                                  padding: 0,
                                  listStyle: 'none',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.45rem',
                                }}
                              >
                                {subs.map((sub, si) => {
                                  const subKey = String(sub.id);
                                  const linksOpen = openSubsectionId === subKey;
                                  const n =
                                    typeof sub.order === 'number'
                                      ? sub.order + 1
                                      : si + 1;
                                  const hasVideo = Boolean(sub.videoUrl);
                                  const hasImages =
                                    Array.isArray(sub.images) &&
                                    sub.images.length > 0;

                                  return (
                                    <li key={subKey}>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '0.35rem',
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleSubsectionLinks(sub.id)
                                          }
                                          aria-expanded={linksOpen}
                                          aria-label={
                                            linksOpen
                                              ? 'Hide download links'
                                              : 'Show video and file links'
                                          }
                                          style={{
                                            flexShrink: 0,
                                            width: '26px',
                                            height: '26px',
                                            padding: 0,
                                            border:
                                              '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: '6px',
                                            background: linksOpen
                                              ? 'rgba(79, 70, 229, 0.25)'
                                              : 'rgba(15, 23, 42, 0.45)',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1,
                                          }}
                                        >
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              transform: linksOpen
                                                ? 'rotate(0deg)'
                                                : 'rotate(-90deg)',
                                              transition:
                                                'transform 0.18s ease',
                                              fontSize: '10px',
                                            }}
                                          >
                                            ▼
                                          </span>
                                        </button>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              color: 'var(--text)',
                                            }}
                                          >
                                            Subsection {n}
                                          </span>
                                          {hasVideo ? (
                                            <span
                                              style={{
                                                marginLeft: '0.35rem',
                                                fontSize: '0.68rem',
                                                color: '#86efac',
                                              }}
                                            >
                                              · video
                                            </span>
                                          ) : (
                                            <span
                                              style={{
                                                marginLeft: '0.35rem',
                                                fontSize: '0.68rem',
                                                color: 'var(--text-muted)',
                                              }}
                                            >
                                              · materials
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {linksOpen && (
                                        <div
                                          style={{
                                            marginTop: '0.5rem',
                                            marginLeft: '2rem',
                                            padding: '0.45rem 0 0 0.5rem',
                                            borderLeft:
                                              '1px solid rgba(148, 163, 184, 0.25)',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: '0.35rem',
                                              fontSize: '0.78rem',
                                            }}
                                          >
                                            {sub.videoUrl ? (
                                              <a
                                                href={sub.videoUrl}
                                                rel="noopener noreferrer"
                                                style={{ color: '#93c5fd' }}
                                                onClick={(e) => {
                                                  if (
                                                    e.metaKey ||
                                                    e.ctrlKey ||
                                                    e.shiftKey ||
                                                    e.altKey ||
                                                    e.button !== 0
                                                  ) {
                                                    return;
                                                  }
                                                  e.preventDefault();
                                                  setMainVideo({
                                                    url: sub.videoUrl,
                                                    title: `${
                                                      s.sectionName ||
                                                      'Section'
                                                    } · Subsection ${n}`,
                                                    knowledgeChunk:
                                                      sub.knowledgeChunk || '',
                                                    containsMath: Boolean(
                                                      sub.containsMath
                                                    ),
                                                    subsectionId: sub.id,
                                                    extractedImages:
                                                      Array.isArray(
                                                        sub.extractedImages
                                                      )
                                                        ? sub.extractedImages
                                                        : [],
                                                    images: Array.isArray(
                                                      sub.images
                                                    )
                                                      ? sub.images
                                                      : [],
                                                  });
                                                }}
                                              >
                                                Video link
                                                {' '}
                                                <span
                                                  style={{
                                                    fontSize: '0.68rem',
                                                    color: 'var(--text-muted)',
                                                  }}
                                                >
                                                  (plays here →)
                                                </span>
                                              </a>
                                            ) : null}
                                            {sub.pptUrl ? (
                                              <a
                                                href={subsectionDownloadUrl(
                                                  courseId,
                                                  sub.id,
                                                  'ppt'
                                                )}
                                                download={
                                                  sub.pptFileName || 'lesson.pptx'
                                                }
                                                style={{ color: '#93c5fd' }}
                                              >
                                                Download PPT
                                              </a>
                                            ) : null}
                                            {sub.pdfUrl ? (
                                              <a
                                                href={subsectionDownloadUrl(
                                                  courseId,
                                                  sub.id,
                                                  'pdf'
                                                )}
                                                download={
                                                  sub.pdfFileName || 'lesson.pdf'
                                                }
                                                style={{ color: '#93c5fd' }}
                                              >
                                                Download PDF
                                              </a>
                                            ) : null}
                                            {hasImages
                                              ? sub.images.map((img, ii) =>
                                                  img?.url ? (
                                                    <a
                                                      key={`${subKey}-img-${ii}`}
                                                      href={img.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      style={{
                                                        color: '#93c5fd',
                                                        wordBreak: 'break-all',
                                                      }}
                                                    >
                                                      Image {ii + 1} link
                                                    </a>
                                                  ) : null
                                                )
                                              : null}
                                            {!sub.videoUrl &&
                                            !sub.pptUrl &&
                                            !sub.pdfUrl &&
                                            !hasImages ? (
                                              <span
                                                style={{
                                                  color: 'var(--text-muted)',
                                                  fontSize: '0.76rem',
                                                }}
                                              >
                                                No files for this subsection.
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </aside>

        <main
          className="glass-panel"
          style={{
            minWidth: 0,
            width: '100%',
            minHeight: '280px',
            padding: mainVideo ? '1.25rem 1.5rem' : '2rem',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: mainVideo ? 'stretch' : 'center',
            justifyContent: mainVideo ? 'flex-start' : 'center',
          }}
        >
          {mainVideo ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  {mainVideo.title}
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setMainVideo(null)}
                  style={{
                    fontSize: '0.82rem',
                    padding: '0.35rem 0.75rem',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  Close video
                </button>
              </div>
              <div
                style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: '#0f172a',
                  width: '100%',
                  maxHeight: 'min(72vh, 720px)',
                }}
              >
                <video
                  key={mainVideo.url}
                  ref={videoRef}
                  controls
                  playsInline
                  preload="metadata"
                  src={mainVideo.url}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onSeeking={handleVideoSeeking}
                  onSeeked={handleVideoSeeked}
                  onRateChange={handleVideoRateChange}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  style={{
                    width: '100%',
                    height: '100%',
                    maxHeight: 'min(72vh, 720px)',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <a
                  href={mainVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.82rem',
                    color: '#93c5fd',
                  }}
                >
                  Open video in new tab
                </a>
              </p>
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: `1px solid ${liveLoadTheme.border}`,
                  background: liveLoadTheme.bg,
                }}
              >
                <button
                  type="button"
                  onClick={() => setCognitiveLoadOpen((open) => !open)}
                  aria-expanded={cognitiveLoadOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <span
                      className="form-label"
                      style={{
                        display: 'block',
                        margin: 0,
                        fontSize: '0.8rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Live cognitive load
                    </span>
                    {!cognitiveLoadOpen ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '0.25rem',
                          fontSize: '0.75rem',
                          color: liveLoadTheme.text,
                          lineHeight: 1.4,
                        }}
                      >
                        <strong>{liveLoadStatus}</strong> · {liveLoadWindow}
                        {rawEventStats.lastEvent
                          ? ` · Last event ${rawEventStats.lastEvent}`
                          : ''}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      color: liveLoadTheme.accent,
                      transform: cognitiveLoadOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.18s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>

                {cognitiveLoadOpen ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: '0.85rem',
                        paddingTop: '0.85rem',
                        borderTop: `1px solid ${liveLoadTheme.border}`,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.45,
                        }}
                      >
                        Video interaction events are collected live. A prediction appears after each
                        completed 2-minute video window.
                      </p>
                      {cognitiveLoadLoading ? (
                        <span
                          style={{
                            padding: '0.28rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            background: 'rgba(59, 130, 246, 0.16)',
                            color: '#bfdbfe',
                          }}
                        >
                          Predicting...
                        </span>
                      ) : null}
                    </div>

                    {cognitiveLoadError ? (
                      <p
                        style={{
                          margin: '0.85rem 0 0 0',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '10px',
                          background: 'rgba(127, 29, 29, 0.26)',
                          border: '1px solid rgba(248, 113, 113, 0.22)',
                          color: '#fecaca',
                          fontSize: '0.82rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {cognitiveLoadError}
                      </p>
                    ) : null}

                    {!predictionFeaturesOpen ? (
                      <>
                        <p
                          className="form-label"
                          style={{
                            margin: '1rem 0 0.45rem 0',
                            fontSize: '0.76rem',
                            letterSpacing: '0.02em',
                          }}
                        >
                          Live events
                        </p>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                            gap: '0.55rem',
                          }}
                        >
                          <MiniMetric label="Pause" value={rawEventStats.pauseCount} />
                          <MiniMetric label="Seek" value={rawEventStats.seekCount} />
                          <MiniMetric label="Rewatch" value={rawEventStats.rewatchCount} />
                          <MiniMetric
                            label="Speed changes"
                            value={rawEventStats.rateChangeCount}
                          />
                          <MiniMetric label="Idle time" value={`${rawEventStats.idleDuration}s`} />
                          <MiniMetric
                            label="Last event"
                            value={rawEventStats.lastEvent || 'Waiting'}
                          />
                        </div>
                      </>
                    ) : null}

                    {livePredictionSummary ? (
                      <>
                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '0.75rem 0',
                            borderTop: `1px solid ${liveLoadTheme.border}`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setPredictionFeaturesOpen((open) => !open)}
                            aria-expanded={predictionFeaturesOpen}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: 0,
                              border: 'none',
                              background: 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>
                              <span
                                className="form-label"
                                style={{
                                  display: 'block',
                                  margin: 0,
                                  fontSize: '0.76rem',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                Prediction
                              </span>
                              {!predictionFeaturesOpen ? (
                                <span
                                  style={{
                                    display: 'block',
                                    marginTop: '0.25rem',
                                    fontSize: '0.74rem',
                                    color: liveLoadTheme.text,
                                    lineHeight: 1.4,
                                  }}
                                >
                                  <strong>{livePredictionSummary.predictedLoad}</strong> ·{' '}
                                  {livePredictionSummary.minuteIndex != null
                                    ? `Window #${livePredictionSummary.minuteIndex}`
                                    : 'Window N/A'}
                                </span>
                              ) : null}
                            </span>
                            <span
                              aria-hidden="true"
                              style={{
                                flexShrink: 0,
                                fontSize: '0.7rem',
                                color: liveLoadTheme.accent,
                                transform: predictionFeaturesOpen
                                  ? 'rotate(0deg)'
                                  : 'rotate(-90deg)',
                                transition: 'transform 0.18s ease',
                              }}
                            >
                              ▼
                            </span>
                          </button>
                        </div>

                        {predictionFeaturesOpen ? (
                          <>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'minmax(210px, 1.2fr) repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '0.65rem',
                                alignItems: 'stretch',
                              }}
                            >
                              <div
                                style={{
                                  padding: '0.85rem',
                                  borderRadius: '10px',
                                  border: `1px solid ${liveLoadTheme.border}`,
                                  background: liveLoadTheme.soft,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: liveLoadTheme.text,
                                    marginBottom: '0.3rem',
                                  }}
                                >
                                  Latest prediction
                                </div>
                                <div
                                  style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 800,
                                    color: liveLoadTheme.accent,
                                  }}
                                >
                                  {livePredictionSummary.predictedLoad}
                                </div>
                              </div>
                              <MiniMetric
                                label="Window"
                                value={
                                  livePredictionSummary.minuteIndex != null
                                    ? `#${livePredictionSummary.minuteIndex}`
                                    : 'N/A'
                                }
                              />
                              <MiniMetric
                                label="Last updated"
                                value={
                                  livePredictionSummary.createdAt
                                    ? formatIsoDateTime(livePredictionSummary.createdAt)
                                    : 'N/A'
                                }
                              />
                            </div>

                            <p
                              className="form-label"
                              style={{
                                margin: '0.9rem 0 0.45rem 0',
                                fontSize: '0.76rem',
                                letterSpacing: '0.02em',
                              }}
                            >
                              Prediction features
                            </p>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                                gap: '0.55rem',
                              }}
                            >
                              <MiniMetric
                                label="Pause frequency"
                                value={livePredictionSummary.pauseFrequency ?? 'N/A'}
                              />
                              <MiniMetric
                                label="Rewatch segments"
                                value={livePredictionSummary.rewatchSegments ?? 'N/A'}
                              />
                              <MiniMetric
                                label="Video navigation"
                                value={livePredictionSummary.navigationCountVideo ?? 'N/A'}
                              />
                              <MiniMetric
                                label="Rate changes"
                                value={livePredictionSummary.playbackRateChange ?? 'N/A'}
                              />
                              <MiniMetric
                                label="Video idle"
                                value={formatSeconds(livePredictionSummary.idleDurationVideo)}
                              />
                              <MiniMetric
                                label="Time on content"
                                value={formatSeconds(livePredictionSummary.timeOnContent)}
                              />
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <p
                        style={{
                          margin: '0.85rem 0 0 0',
                          padding: '0.75rem 0.85rem',
                          borderRadius: '10px',
                          border: '1px solid rgba(148, 163, 184, 0.24)',
                          background: 'rgba(255,255,255,0.62)',
                          fontSize: '0.82rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                        }}
                      >
                        Start watching and interacting with the video. The first
                        cognitive load prediction appears after the first completed
                        2-minute window.
                      </p>
                    )}
                  </>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(34, 197, 94, 0.22)',
                  background: 'rgba(22, 101, 52, 0.12)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-expanded={profileOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <span
                      className="form-label"
                      style={{
                        display: 'block',
                        margin: 0,
                        fontSize: '0.8rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Learner profile
                    </span>
                    {!profileOpen ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '0.25rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                        }}
                      >
                        {[
                          cognitiveStyle,
                          `Load ${loadLevel}`,
                          studentMajor,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      color: '#86efac',
                      transform: profileOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.18s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>
                {profileOpen ? (
                  <>
                <p
                  style={{
                    margin: '0.65rem 0 0.65rem 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  Adjust these fields. Ask uses the unique knowledge chunk below
                  (PPT, PDF, and video combined by MiniLM).
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '0.5rem',
                    marginBottom: '0.65rem',
                  }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Major"
                    value={studentMajor}
                    onChange={(e) => setStudentMajor(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Year"
                    value={studentYear}
                    onChange={(e) => setStudentYear(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Interests"
                    value={studentInterests}
                    onChange={(e) => setStudentInterests(e.target.value)}
                    style={{ gridColumn: '1 / -1', fontSize: '0.82rem' }}
                  />
                  <select
                    className="form-input"
                    value={cognitiveStyle}
                    onChange={(e) => setCognitiveStyle(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="Visual">Visual</option>
                    <option value="Auditory">Auditory</option>
                    <option value="Read/Write">Read/Write</option>
                    <option value="Kinesthetic">Kinesthetic</option>
                  </select>
                  <select
                    className="form-input"
                    value={loadLevel}
                    onChange={(e) => setLoadLevel(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="Very Low">Load: Very Low</option>
                    <option value="Low">Load: Low</option>
                    <option value="Medium">Load: Medium</option>
                    <option value="High">Load: High</option>
                    <option value="Very High">Load: Very High</option>
                  </select>
                  <select
                    className="form-input"
                    value={frustration}
                    onChange={(e) => setFrustration(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="Low">Frustration: Low</option>
                    <option value="Moderate">Frustration: Moderate</option>
                    <option value="High">Frustration: High</option>
                  </select>
                </div>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPromptBarOpen((open) => !open)}
                  aria-expanded={promptBarOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginTop: '0.85rem',
                    paddingTop: '0.85rem',
                    border: 'none',
                    borderTop: '1px solid rgba(34, 197, 94, 0.18)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <span
                      className="form-label"
                      style={{
                        display: 'block',
                        margin: 0,
                        fontSize: '0.8rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Full prompt
                    </span>
                    {!promptBarOpen ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '0.25rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                        }}
                      >
                        {promptLoading
                          ? 'Building prompt…'
                          : pedagogicalPrompt.trim()
                            ? 'Knowledge chunk and pedagogical prompt are ready'
                            : 'Open to review the knowledge chunk and prompt'}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      color: '#86efac',
                      transform: promptBarOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.18s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>
                {promptBarOpen ? (
                  <>
                {promptLoading ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Building prompt…
                  </p>
                ) : null}
                {promptError ? (
                  <p
                    style={{
                      margin: '0.35rem 0 0 0',
                      fontSize: '0.82rem',
                      color: 'var(--danger)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {promptError}
                  </p>
                ) : null}
                {String(mainVideo.knowledgeChunk || '').trim() ? (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(34, 197, 94, 0.28)',
                      background: 'rgba(15, 23, 42, 0.35)',
                    }}
                  >
                    <p
                      className="form-label"
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        marginBottom: '0.45rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Knowledge chunk
                    </p>
                    <div
                      style={{
                        maxHeight: '280px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        fontSize: '0.88rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {String(mainVideo.knowledgeChunk).trim()}
                    </div>
                  </div>
                ) : !promptLoading ? (
                  <p
                    style={{
                      margin: '0.45rem 0 0 0',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No unique knowledge text for this subsection.
                  </p>
                ) : null}
                <p
                  className="form-label"
                  style={{
                    margin: '0.85rem 0 0.45rem 0',
                    fontSize: '0.8rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  Pedagogical prompt (subsection)
                </p>
                <p
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  This prompt uses the unique knowledge chunk above. You can
                  review it here, then use it in Ask.
                </p>
                <textarea
                  className="form-input"
                  readOnly
                  rows={14}
                  value={pedagogicalPrompt}
                  placeholder={
                    promptLoading
                      ? 'Building prompt…'
                      : 'Prompt will appear here when the subsection has loaded.'
                  }
                  style={{
                    resize: 'vertical',
                    fontSize: '0.78rem',
                    lineHeight: 1.45,
                    fontFamily: 'ui-monospace, monospace',
                    maxHeight: '360px',
                  }}
                />
                  </>
                ) : null}
              </div>

              <div
                ref={askPanelRef}
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  background: 'rgba(79, 70, 229, 0.08)',
                }}
              >
                <p
                  className="form-label"
                  style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  Ask the assistant
                </p>
                <p
                  style={{
                    margin: '0 0 0.65rem 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  Ask sends the pedagogical prompt to Hugging Face and DeepSeek.
                  Open Full prompt above to review it, or type an extra question.{' '}
                  <Link to="/login" style={{ color: '#93c5fd' }}>
                    Sign in
                  </Link>{' '}
                  to ask.
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginBottom: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    disabled={!pedagogicalPrompt.trim() || gptLoading}
                    onClick={() => setGptQuestion(pedagogicalPrompt)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    Use full prompt
                  </button>
                </div>
                <textarea
                  className="form-input"
                  rows={6}
                  value={gptQuestion}
                  onChange={(e) => setGptQuestion(e.target.value)}
                  placeholder="Paste the pedagogical prompt here, or type a question…"
                  style={{ resize: 'vertical', fontSize: '0.88rem' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => askCourseGpt()}
                  disabled={gptLoading || !pedagogicalPrompt.trim()}
                  style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.85rem' }}
                >
                  {gptLoading
                    ? 'Generating + selecting best output…'
                    : 'Ask both models'}
                </button>

                {selectionError ? (
                  <p
                    style={{
                      marginTop: '0.65rem',
                      marginBottom: 0,
                      fontSize: '0.82rem',
                      color: 'var(--danger)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectionError}
                  </p>
                ) : null}

                {selectedAnswer ? (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(34, 197, 94, 0.35)',
                      background: 'rgba(22, 163, 74, 0.12)',
                    }}
                  >
                    <p
                      className="form-label"
                      style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                    >
                      Selected content for student
                      {selectionMeta?.selectedModel
                        ? ` (${selectionMeta.selectedModel === 'huggingface' ? 'Hugging Face' : 'DeepSeek'})`
                        : ''}
                    </p>
                    {selectionMeta?.reason ? (
                      <p
                        style={{
                          margin: '0 0 0.55rem 0',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.45,
                        }}
                      >
                        {selectionMeta.reason}
                        {selectionMeta.warning
                          ? ` · Warning: ${selectionMeta.warning}`
                          : ''}
                      </p>
                    ) : null}
                    {selectionMeta?.scores ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '0.5rem',
                          marginBottom: '0.65rem',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {['huggingface', 'deepseek'].map((key) => {
                          const s = selectionMeta.scores?.[key];
                          if (!s) return null;
                          const label =
                            key === 'huggingface' ? 'Hugging Face' : 'DeepSeek';
                          return (
                            <div
                              key={key}
                              style={{
                                padding: '0.45rem 0.55rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(15, 23, 42, 0.35)',
                              }}
                            >
                              <strong style={{ color: 'var(--text)' }}>
                                {label}
                              </strong>
                              <div>Composite: {s.composite}</div>
                              <div>
                                Faithfulness:{' '}
                                {s.faithfulness == null
                                  ? 'n/a'
                                  : s.faithfulness}
                              </div>
                              <div>
                                Readability match: {s.readabilityMatch} (FRE{' '}
                                {s.fleschReadingEase} → target {s.targetFlesch})
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <AssistantMarkdown
                      canonicalEquations={canonicalEquations}
                      style={{ maxHeight: '320px', overflowY: 'auto' }}
                    >
                      {selectedAnswer}
                    </AssistantMarkdown>
                    <LessonImageGallery
                      afterGptOutput
                      images={collectSubsectionImages(mainVideo)}
                    />
                  </div>
                ) : null}

                {(gptAnswer || deepseekAnswer || gptError || deepseekError) && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowBothOutputs((v) => !v)}
                    style={{
                      marginTop: '0.75rem',
                      width: '100%',
                      fontSize: '0.85rem',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                  >
                    {showBothOutputs
                      ? 'Hide both model outputs'
                      : 'View both model outputs'}
                  </button>
                )}

                {showBothOutputs ? (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(15, 23, 42, 0.45)',
                        minHeight: '140px',
                      }}
                    >
                      <p
                        className="form-label"
                        style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                      >
                        Hugging Face reply
                      </p>
                      {gptError ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            color: 'var(--danger)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {gptError}
                        </p>
                      ) : null}
                      {!gptError && gptAnswer ? (
                        <AssistantMarkdown
                          canonicalEquations={canonicalEquations}
                          style={{ maxHeight: '280px', overflowY: 'auto' }}
                        >
                          {gptAnswer}
                        </AssistantMarkdown>
                      ) : null}
                      {!gptError && !gptAnswer ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          No reply.
                        </p>
                      ) : null}
                    </div>

                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(15, 23, 42, 0.45)',
                        minHeight: '140px',
                      }}
                    >
                      <p
                        className="form-label"
                        style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                      >
                        DeepSeek reply
                      </p>
                      {deepseekError ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            color: 'var(--danger)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {deepseekError}
                        </p>
                      ) : null}
                      {!deepseekError && deepseekAnswer ? (
                        <AssistantMarkdown
                          canonicalEquations={canonicalEquations}
                          style={{ maxHeight: '280px', overflowY: 'auto' }}
                        >
                          {deepseekAnswer}
                        </AssistantMarkdown>
                      ) : null}
                      {!deepseekError && !deepseekAnswer ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          No reply.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!selectedAnswer ? (
                  <LessonImageGallery
                    images={collectSubsectionImages(mainVideo)}
                  />
                ) : null}
              </div>
            </>
          ) : (
           <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.95rem',
                textAlign: 'center',
                maxWidth: '420px',
                lineHeight: 1.55,
              }}
            >
              {/* Use the sidebar to browse sections and subsections. Toggle ▼ on a
              subsection for links; click{' '}
              <strong style={{ color: 'var(--text)' }}>Video link</strong> to
              watch here in this column. */}
            </p> 
          )}
        </main>
      </div>
      {mainVideo && playbackPrompt ? (
        <PlaybackPersonalizationPrompt
          kind={playbackPrompt}
          busy={gptLoading}
          onNo={dismissPlaybackPersonalizationPrompt}
          onYes={async () => {
            const copy = PLAYBACK_PROMPT_COPY[playbackPrompt];
            dismissPlaybackPersonalizationPrompt();
            await askCourseGpt(copy?.extraInstruction || '');
          }}
        />
      ) : null}
    </div>
  );
};

export default CourseDetail;
