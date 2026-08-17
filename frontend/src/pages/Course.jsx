import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const Course = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(() => new Set());
  const [enrollingId, setEnrollingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [myCoursesOpen, setMyCoursesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      const authHeaders = token
        ? { Authorization: `Bearer ${token}` }
        : undefined;

      try {
        const coursesRes = await axios.get(
          `${getGatewayBaseUrl()}/api/public/courses`
        );

        if (cancelled) return;

        const list = Array.isArray(coursesRes.data?.data)
          ? coursesRes.data.data
          : [];
        setCourses(list);

        if (authHeaders) {
          try {
            const enrollmentsRes = await axios.get(
              `${getGatewayBaseUrl()}/api/enrollments/me`,
              { headers: authHeaders }
            );
            if (!cancelled) {
              const rows = Array.isArray(enrollmentsRes.data?.data)
                ? enrollmentsRes.data.data
                : [];
              setEnrollments(rows);
              const ids = Array.isArray(enrollmentsRes.data?.courseIds)
                ? enrollmentsRes.data.courseIds
                : rows.map((row) => String(row.courseId));
              setEnrolledIds(new Set(ids.map(String)));
            }
          } catch {
            // Keep browsing courses even if enrollment status cannot load.
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e.response?.data?.message ||
              e.message ||
              'Could not load courses.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!myCoursesOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMyCoursesOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [myCoursesOpen]);

  const handleEnroll = async (event, course) => {
    event.preventDefault();
    event.stopPropagation();

    const courseId = String(course.id);
    if (enrolledIds.has(courseId) || enrollingId === courseId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setActionMessage('Please log in as a student to enroll.');
      return;
    }

    setEnrollingId(courseId);
    setActionMessage('');

    try {
      const res = await axios.post(
        `${getGatewayBaseUrl()}/api/enrollments`,
        {
          courseId,
          courseName: course.courseName || '',
          educatorName: course.educatorName || '',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const enrollment = res.data?.enrollment;
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        next.add(courseId);
        return next;
      });
      setEnrollments((prev) => {
        if (prev.some((row) => String(row.courseId) === courseId)) return prev;
        return [
          enrollment || {
            courseId,
            courseName: course.courseName || '',
            educatorName: course.educatorName || '',
          },
          ...prev,
        ];
      });
      setActionMessage(`Enrolled in ${course.courseName || 'course'}.`);
    } catch (e) {
      setActionMessage(
        e.response?.data?.message ||
          e.message ||
          'Enrollment failed. Please try again.'
      );
    } finally {
      setEnrollingId('');
    }
  };

  const initials = (user?.name || user?.email || 'S')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'S';

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <header
        className="glass-panel"
        style={{
          maxWidth: '1200px',
          margin: '0 auto 2rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            className="gradient-text"
            style={{ fontSize: '1.35rem', fontWeight: 700 }}
          >
            Courses
          </h1>
          <p
            style={{
              marginTop: '0.35rem',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
            }}
          >
            Browse published courses and enroll to start learning.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginLeft: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => setMyCoursesOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
            }}
          >
            My Courses
          </button>

          <Link
            to="/get-exam"
            className="btn"
            style={{
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: '1px solid #1d4ed8',
              whiteSpace: 'nowrap',
            }}
          >
            Get Exam
          </Link>

          <Link
            to="/student/previous-lesson-summary"
            className="btn"
            style={{
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff',
              border: '1px solid #6d28d9',
              whiteSpace: 'nowrap',
            }}
          >
            Previous Lesson Summary
          </Link>

          <button
            type="button"
            aria-label="Open student profile"
            onClick={() => navigate('/student/profile')}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'linear-gradient(135deg, #1d4ed8, #0f172a)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {initials}
          </button>
        </div>
      </header>

      <main className="container" style={{ maxWidth: '1200px', paddingTop: 0 }}>
        {actionMessage && (
          <p
            style={{
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            {actionMessage}
          </p>
        )}
        {loading && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Loading courses…
          </p>
        )}
        {!loading && error && (
          <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p>
        )}
        {!loading && !error && courses.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            No courses yet.
          </p>
        )}
        {!loading && !error && courses.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: '1.25rem',
            }}
          >
            {courses.map((c) => {
              const courseId = String(c.id);
              const isEnrolled = enrolledIds.has(courseId);
              const isEnrolling = enrollingId === courseId;

              return (
                <article
                  key={courseId}
                  className="glass-panel"
                  style={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    height: '100%',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <Link
                    to={`/course/${encodeURIComponent(courseId)}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '16 / 10',
                        background: 'var(--surface)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {c.thumbnailUrl ? (
                        <img
                          src={c.thumbnailUrl}
                          alt={c.courseName || 'Course thumbnail'}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : null}
                    </div>
                    <div style={{ padding: '1rem 1.1rem 0.75rem' }}>
                      <h2
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          lineHeight: 1.35,
                          marginBottom: '0.5rem',
                          color: 'var(--text)',
                        }}
                      >
                        {c.courseName || 'Untitled course'}
                      </h2>
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {c.educatorName
                          ? `Educator: ${c.educatorName}`
                          : 'Educator: —'}
                      </p>
                    </div>
                  </Link>

                  <div style={{ padding: '0 1.1rem 1.15rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isEnrolled || isEnrolling}
                      onClick={(event) => handleEnroll(event, c)}
                      style={{
                        width: '100%',
                        opacity: isEnrolled ? 0.85 : 1,
                        cursor: isEnrolled ? 'default' : 'pointer',
                      }}
                    >
                      {isEnrolled
                        ? 'Enrolled'
                        : isEnrolling
                          ? 'Enrolling…'
                          : 'Enroll'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {myCoursesOpen && (
        <div
          role="presentation"
          onClick={() => setMyCoursesOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-courses-title"
            className="glass-panel"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              maxHeight: 'min(80vh, 640px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              padding: '1.25rem 1.35rem',
              boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h2
                id="my-courses-title"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                My Courses ({enrollments.length})
              </h2>
              <button
                type="button"
                aria-label="Close my courses"
                onClick={() => setMyCoursesOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '1.4rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0.15rem 0.35rem',
                }}
              >
                ×
              </button>
            </div>

            {enrollments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                You have not enrolled in any courses yet.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: '0.65rem',
                  overflowY: 'auto',
                }}
              >
                {enrollments.map((enrollment) => {
                  const courseId = String(enrollment.courseId);
                  return (
                    <li key={courseId}>
                      <Link
                        to={`/course/${encodeURIComponent(courseId)}`}
                        onClick={() => setMyCoursesOpen(false)}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                          padding: '0.9rem 1rem',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            fontWeight: 650,
                            color: 'var(--text)',
                            marginBottom: '0.2rem',
                          }}
                        >
                          {enrollment.courseName || 'Untitled course'}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {enrollment.educatorName
                            ? `Educator: ${enrollment.educatorName}`
                            : 'Educator: —'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Course;
