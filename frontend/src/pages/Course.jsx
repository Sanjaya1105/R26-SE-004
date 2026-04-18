import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

const Course = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      setLoading(true);
      try {
        const res = await axios.get(
          `${getGatewayBaseUrl()}/api/public/courses`
        );
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        if (!cancelled) setCourses(list);
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

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <header
        className="glass-panel"
        style={{
          maxWidth: '1200px',
          margin: '0 auto 2rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
        }}
      >
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
          Browse published courses from educators.
        </p>
      </header>

      <main className="container" style={{ maxWidth: '1200px', paddingTop: 0 }}>
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
            {courses.map((c) => (
              <Link
                key={String(c.id)}
                to={`/course/${encodeURIComponent(String(c.id))}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  borderRadius: '16px',
                  outlineOffset: '2px',
                }}
              >
              <article
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
                <div style={{ padding: '1rem 1.1rem 1.15rem' }}>
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
              </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Course;
