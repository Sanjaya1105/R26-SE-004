import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';
import AssistantMarkdown from '../components/AssistantMarkdown';

function buildGptAskUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/gpt/ask`,
    'http://localhost:4000/api/gpt/ask',
    'http://127.0.0.1:4000/api/gpt/ask',
    'http://localhost:5002/api/gpt/ask',
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

const ABOUT_PREVIEW_WORDS = 20;
const COGNITIVE_LOAD_WINDOW_MS = 120000;

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
  /** Inline GPT assistant (below extracted text when a subsection video is open) */
  const [gptQuestion, setGptQuestion] = useState('');
  const [gptAnswer, setGptAnswer] = useState('');
  const [gptLoading, setGptLoading] = useState(false);
  const [gptError, setGptError] = useState('');
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
  const [cognitiveLoadResult, setCognitiveLoadResult] = useState(null);
  const [cognitiveLoadError, setCognitiveLoadError] = useState('');
  const [cognitiveLoadLoading, setCognitiveLoadLoading] = useState(false);
  const [videoSessionId, setVideoSessionId] = useState('');
  const videoRef = useRef(null);
  const sessionStartRef = useRef(null);
  const lastVideoTimeRef = useRef(0);
  const seekStartTimeRef = useRef(0);
  const lastPlaybackRateRef = useRef(1);
  const predictTimeoutRef = useRef(null);

  const toggleSection = (sectionId) => {
    const k = String(sectionId);
    setSectionOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const toggleSubsectionLinks = (subsectionId) => {
    const k = String(subsectionId);
    setOpenSubsectionId((prev) => (prev === k ? null : k));
  };

  useEffect(() => {
    setOpenSubsectionId(null);
    setMainVideo(null);
    setAboutExpanded(false);
    setGptQuestion('');
    setGptAnswer('');
    setGptError('');
    setPedagogicalPrompt('');
    setPromptError('');
    setCognitiveLoadResult(null);
    setCognitiveLoadError('');
    setCognitiveLoadLoading(false);
    setVideoSessionId('');
  }, [courseId]);

  useEffect(() => {
    setGptQuestion('');
    setGptAnswer('');
    setGptError('');
    setPedagogicalPrompt('');
    setPromptError('');
    setCognitiveLoadResult(null);
    setCognitiveLoadError('');
  }, [mainVideo?.url]);

  useEffect(() => {
    if (!mainVideo?.url) {
      sessionStartRef.current = null;
      setVideoSessionId('');
      lastVideoTimeRef.current = 0;
      lastPlaybackRateRef.current = 1;
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
    lastVideoTimeRef.current = 0;
    lastPlaybackRateRef.current = 1;

    const sendRawEvent = async (payload) => {
      await axios.post(`${getGatewayBaseUrl()}/api/cognitive-load/events/raw`, {
        student_id: getActiveStudentId(),
        lesson_id: String(mainVideo.lessonId || mainVideo.subsectionId || courseId),
        session_id: sessionId,
        event_time: new Date().toISOString(),
        video_time: payload.video_time ?? null,
        from_position: payload.from_position ?? null,
        to_position: payload.to_position ?? null,
        event_value: payload.event_value ?? null,
        question_id: payload.question_id ?? null,
        is_correct: payload.is_correct ?? null,
        event_type: payload.event_type,
      });
    };

    sendRawEvent({
      event_type: 'adaptation_navigation',
      event_value: mainVideo.url,
    }).catch(() => {});

    return () => {
      if (predictTimeoutRef.current) {
        window.clearTimeout(predictTimeoutRef.current);
        predictTimeoutRef.current = null;
      }
    };
  }, [courseId, mainVideo?.lessonId, mainVideo?.subsectionId, mainVideo?.url]);

  const scheduleCognitiveLoadPrediction = () => {
    if (!mainVideo?.url || !videoSessionId || !sessionStartRef.current) {
      return;
    }

    if (predictTimeoutRef.current) {
      window.clearTimeout(predictTimeoutRef.current);
    }

    predictTimeoutRef.current = window.setTimeout(async () => {
      const now = new Date();
      const sessionStart = sessionStartRef.current;
      const elapsedMs = Math.max(0, now.getTime() - sessionStart.getTime());
      const minuteIndex = Math.floor(elapsedMs / COGNITIVE_LOAD_WINDOW_MS) + 1;
      const windowStart = new Date(
        sessionStart.getTime() + (minuteIndex - 1) * COGNITIVE_LOAD_WINDOW_MS
      );

      try {
        setCognitiveLoadLoading(true);
        setCognitiveLoadError('');
        const res = await axios.post(
          `${getGatewayBaseUrl()}/api/cognitive-load/predict/from-raw`,
          {
            student_id: getActiveStudentId(),
            lesson_id: String(
              mainVideo.lessonId || mainVideo.subsectionId || courseId
            ),
            session_id: videoSessionId,
            minute_index: minuteIndex,
            window_start: windowStart.toISOString(),
            window_end: now.toISOString(),
          }
        );
        setCognitiveLoadResult(res.data);
      } catch (error) {
        setCognitiveLoadError(
          error.response?.data?.detail?.[0]?.msg ||
            error.response?.data?.message ||
            error.message ||
            'Could not predict cognitive load for this video session.'
        );
      } finally {
        setCognitiveLoadLoading(false);
      }
    }, 700);
  };

  const sendCognitiveLoadEvent = async (payload) => {
    if (!mainVideo?.url || !videoSessionId) return;

    try {
      await axios.post(`${getGatewayBaseUrl()}/api/cognitive-load/events/raw`, {
        student_id: getActiveStudentId(),
        lesson_id: String(mainVideo.lessonId || mainVideo.subsectionId || courseId),
        session_id: videoSessionId,
        event_time: new Date().toISOString(),
        video_time: payload.video_time ?? null,
        from_position: payload.from_position ?? null,
        to_position: payload.to_position ?? null,
        event_value: payload.event_value ?? null,
        question_id: payload.question_id ?? null,
        is_correct: payload.is_correct ?? null,
        event_type: payload.event_type,
      });

      scheduleCognitiveLoadPrediction();
    } catch (_) {
      setCognitiveLoadError(
        'Could not send video interaction data to the cognitive load API.'
      );
    }
  };

  const handleVideoPause = () => {
    const currentTime = Number(videoRef.current?.currentTime?.toFixed(2) || 0);
    sendCognitiveLoadEvent({
      event_type: 'pause',
      video_time: currentTime,
    });
  };

  const handleVideoSeeking = () => {
    seekStartTimeRef.current = lastVideoTimeRef.current;
  };

  const handleVideoSeeked = () => {
    const nextTime = Number(videoRef.current?.currentTime?.toFixed(2) || 0);
    const previousTime = Number(seekStartTimeRef.current?.toFixed?.(2) || seekStartTimeRef.current || 0);
    const isBackwardSeek = nextTime < previousTime - 0.25;

    sendCognitiveLoadEvent({
      event_type: isBackwardSeek ? 'seek_backward' : 'seek_forward',
      from_position: previousTime,
      to_position: nextTime,
      video_time: nextTime,
    });
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
  };

  const handleVideoTimeUpdate = () => {
    lastVideoTimeRef.current = Number(videoRef.current?.currentTime || 0);
  };

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
        transcriptText: mainVideo.transcriptText || '',
        pptText: mainVideo.pptText || '',
        pdfText: mainVideo.pdfText || '',
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
    mainVideo?.transcriptText,
    mainVideo?.pptText,
    mainVideo?.pdfText,
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

  const askCourseGpt = async () => {
    setGptError('');
    setGptAnswer('');
    const q = gptQuestion.trim();
    if (!q) {
      setGptError('Enter a question for the assistant.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setGptError('Sign in to use the assistant (open /login in another tab).');
      return;
    }

    const ctxParts = [
      mainVideo?.title ? `Subsection: ${mainVideo.title}` : '',
      course?.courseName ? `Course: ${course.courseName}` : '',
    ].filter(Boolean);
    const ctxBody = [
      mainVideo?.transcriptText
        ? `Video transcript:\n${mainVideo.transcriptText}`.slice(0, 6000)
        : '',
      mainVideo?.pptText
        ? `PPT text:\n${mainVideo.pptText}`.slice(0, 4000)
        : '',
      mainVideo?.pdfText
        ? `PDF text:\n${mainVideo.pdfText}`.slice(0, 4000)
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const composedQuestion = ctxBody
      ? `${ctxParts.join(' · ')}\n\n---\n${ctxBody}\n---\n\nQuestion: ${q}`
      : `${ctxParts.join(' · ')}\n\nQuestion: ${q}`;

    try {
      setGptLoading(true);
      const urls = buildGptAskUrls();
      let lastErr;
      let res;
      for (const url of urls) {
        try {
          res = await axios.post(
            url,
            { question: composedQuestion },
            { headers: { Authorization: `Bearer ${token}` } }
          );
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
      setGptAnswer(String(res.data?.data?.answer || '').trim());
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
                                                    lessonId: sub.id,
                                                    subsectionId: sub.id,
                                                    title: `${
                                                      s.sectionName ||
                                                      'Section'
                                                    } · Subsection ${n}`,
                                                    transcriptText:
                                                      sub.transcriptText || '',
                                                    pptText: sub.pptText || '',
                                                    pdfText: sub.pdfText || '',
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
                                                href={sub.pptUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#93c5fd' }}
                                              >
                                                PPT link
                                              </a>
                                            ) : null}
                                            {sub.pdfUrl ? (
                                              <a
                                                href={sub.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#93c5fd' }}
                                              >
                                                PDF link
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
                  ref={videoRef}
                  key={mainVideo.url}
                  controls
                  playsInline
                  preload="metadata"
                  src={mainVideo.url}
                  onPause={handleVideoPause}
                  onSeeking={handleVideoSeeking}
                  onSeeked={handleVideoSeeked}
                  onRateChange={handleVideoRateChange}
                  onTimeUpdate={handleVideoTimeUpdate}
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
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(15, 23, 42, 0.35)',
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
                  Live cognitive load
                </p>
                {cognitiveLoadLoading ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Analysing current video interactions...
                  </p>
                ) : cognitiveLoadResult?.prediction ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)' }}>
                      {cognitiveLoadResult.prediction.predicted_label} cognitive load
                    </p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Score {cognitiveLoadResult.prediction.predicted_score} | Confidence{' '}
                      {cognitiveLoadResult.prediction.confidence}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Based on the current session events for this selected video.
                    </p>
                  </div>
                ) : cognitiveLoadError ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#fca5a5' }}>
                    {cognitiveLoadError}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Pause, seek, or change playback speed to generate a live prediction.
                  </p>
                )}
              </div>
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(15, 23, 42, 0.35)',
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
                  Extracted video text
                </p>
                {mainVideo.transcriptText ? (
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {mainVideo.transcriptText}
                  </div>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No extracted text available for this video yet.
                  </p>
                )}
              </div>
              {mainVideo.pptText ? (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(15, 23, 42, 0.35)',
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
                    Extracted PPT text
                  </p>
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {mainVideo.pptText}
                  </div>
                </div>
              ) : null}
              {mainVideo.pdfText ? (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(15, 23, 42, 0.35)',
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
                    Extracted PDF text
                  </p>
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {mainVideo.pdfText}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(34, 197, 94, 0.22)',
                  background: 'rgba(22, 101, 52, 0.12)',
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
                  Pedagogical prompt (subsection)
                </p>
                <p
                  style={{
                    margin: '0 0 0.65rem 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  Built from this subsection’s extracted video, PPT, and PDF text.
                  Adjust profile fields to refresh the template.
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
                <textarea
                  className="form-input"
                  readOnly
                  rows={14}
                  value={pedagogicalPrompt}
                  placeholder={
                    promptLoading
                      ? ''
                      : 'Prompt will appear here when the subsection has loaded.'
                  }
                  style={{
                    marginTop: '0.5rem',
                    resize: 'vertical',
                    fontSize: '0.78rem',
                    lineHeight: 1.45,
                    fontFamily: 'ui-monospace, monospace',
                    maxHeight: '360px',
                  }}
                />
              </div>

              <div
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
                  Questions use this subsection’s extracted text when available.{' '}
                  <Link to="/login" style={{ color: '#93c5fd' }}>
                    Sign in
                  </Link>{' '}
                  to ask.
                </p>
                <textarea
                  className="form-input"
                  rows={3}
                  value={gptQuestion}
                  onChange={(e) => setGptQuestion(e.target.value)}
                  placeholder="Ask about this lesson…"
                  style={{ resize: 'vertical', fontSize: '0.88rem' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={askCourseGpt}
                  disabled={gptLoading}
                  style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.85rem' }}
                >
                  {gptLoading ? 'Asking…' : 'Ask'}
                </button>
                {gptError ? (
                  <p
                    style={{
                      marginTop: '0.65rem',
                      marginBottom: 0,
                      fontSize: '0.82rem',
                      color: 'var(--danger)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {gptError}
                  </p>
                ) : null}
                {gptAnswer ? (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(15, 23, 42, 0.45)',
                    }}
                  >
                    <p
                      className="form-label"
                      style={{ marginBottom: '0.35rem', fontSize: '0.75rem' }}
                    >
                      Assistant reply
                    </p>
                    <AssistantMarkdown
                      style={{ maxHeight: '240px', overflowY: 'auto' }}
                    >
                      {gptAnswer}
                    </AssistantMarkdown>
                  </div>
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
              Use the sidebar to browse sections and subsections. Toggle ▼ on a
              subsection for links; click{' '}
              <strong style={{ color: 'var(--text)' }}>Video link</strong> to
              watch here in this column.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default CourseDetail;
