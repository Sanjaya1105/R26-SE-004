import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

const ABOUT_PREVIEW_WORDS = 20;

function splitWords(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const CourseDetail = () => {
  const { courseId } = useParams();
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
  }, [courseId]);

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
                                                    transcriptText:
                                                      sub.transcriptText || '',
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
                  key={mainVideo.url}
                  controls
                  playsInline
                  preload="metadata"
                  src={mainVideo.url}
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
