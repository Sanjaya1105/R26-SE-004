import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { getGatewayBaseUrl } from '../config/gateway';

function getLoggedInEducatorName() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return String(u?.name ?? '').trim();
  } catch {
    return '';
  }
}

const EditCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const gatewayBaseUrl = getGatewayBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [courseName, setCourseName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [loadedOk, setLoadedOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!courseId?.trim()) {
      setLoading(false);
      setMessage('Missing course.');
      return undefined;
    }

    (async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      setMessage('');
      setLoading(true);
      try {
        const res = await axios.get(
          `${gatewayBaseUrl}/api/courses/${encodeURIComponent(courseId.trim())}/for-edit`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = res.data?.data;
        if (!cancelled && d) {
          setCourseName(d.courseName || '');
          setKeywords(Array.isArray(d.keywords) ? d.keywords.join(', ') : '');
          setDescription(d.description || '');
          setThumbnailUrl(d.thumbnailUrl || '');
          setLoadedOk(true);
        }
      } catch (e) {
        if (!cancelled) {
          if (e.response?.status === 401 || e.response?.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
            return;
          }
          setMessage(
            e.response?.data?.message || 'Could not load course for editing.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, gatewayBaseUrl, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!courseName.trim()) {
      setMessage('Course name is required.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const formData = new FormData();
    formData.append('courseName', courseName.trim());
    formData.append('keywords', keywords);
    formData.append('description', description.trim());
    const educatorLabel = getLoggedInEducatorName();
    if (educatorLabel) formData.append('educatorName', educatorLabel);
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

    try {
      setSaving(true);
      const patchRes = await axios.patch(
        `${gatewayBaseUrl}/api/courses/${encodeURIComponent(courseId.trim())}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      setThumbnailFile(null);
      setMessage(patchRes.data?.message || 'Course updated.');
      const u = patchRes.data?.data;
      if (u?.thumbnailUrl) setThumbnailUrl(u.thumbnailUrl);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setMessage(
        error.response?.data?.message || 'Failed to save changes. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <nav
        className="navbar glass-panel"
        style={{
          borderRadius: '12px',
          marginBottom: '2rem',
          maxWidth: '640px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <div>
          <h1
            className="gradient-text"
            style={{ fontSize: '1.25rem', fontWeight: 700 }}
          >
            Update course
          </h1>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => navigate('/uploads')}
        >
          Back to my courses
        </button>
      </nav>

      <main className="container" style={{ maxWidth: '640px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : !loadedOk ? (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
              {message || 'Course could not be loaded.'}
            </p>
            <button type="button" className="btn" onClick={() => navigate('/uploads')}>
              Back to my courses
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              Course details
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
              }}
            >
              Change the name, description, keywords, or thumbnail. Sections and
              materials are managed from{' '}
              <strong style={{ color: 'var(--text)' }}>
                Upload lessons → Upload lessons
              </strong>{' '}
              for this course id if needed.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-courseName">
                  Course name
                </label>
                <input
                  id="edit-courseName"
                  className="form-input"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-thumb">
                  Thumbnail (optional — leave empty to keep current)
                </label>
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    style={{
                      width: '100%',
                      maxWidth: '280px',
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                      border: '1px solid var(--surface-light)',
                      display: 'block',
                    }}
                  />
                ) : null}
                <input
                  id="edit-thumb"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  style={{ padding: '0.5rem' }}
                  onChange={(e) =>
                    setThumbnailFile(e.target.files?.[0] || null)
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-keywords">
                  Keywords (comma-separated)
                </label>
                <input
                  id="edit-keywords"
                  className="form-input"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-description">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  className="form-input"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '120px' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            {message ? (
              <p
                style={{
                  marginTop: '1rem',
                  fontSize: '0.9rem',
                  color: message.includes('updated')
                    ? 'var(--success, #10b981)'
                    : 'var(--danger)',
                }}
              >
                {message}
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default EditCourse;
