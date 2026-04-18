import { useNavigate } from 'react-router-dom';

const LessonUploadHub = () => {
  const navigate = useNavigate();

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <nav className="navbar glass-panel" style={{ borderRadius: '12px', marginBottom: '2rem', maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lessons</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </nav>

      <main className="container" style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Lesson uploads</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Choose an action below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => navigate('/upload-new_lesson')}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#86efac',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                padding: '0.85rem 1.25rem',
                fontSize: '1rem',
              }}
            >
              Upload lessons
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate('/uploads')}
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#93c5fd',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                padding: '0.85rem 1.25rem',
                fontSize: '1rem',
              }}
            >
              View my upload lessons
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LessonUploadHub;
