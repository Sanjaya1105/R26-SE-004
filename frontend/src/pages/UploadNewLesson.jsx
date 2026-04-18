import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const UploadNewLesson = () => {
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);
  const gatewayBaseUrl =
    import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';

  const [courseName, setCourseName] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!courseName.trim()) {
      setMessage('Course name is required.');
      return;
    }

    if (!thumbnailFile) {
      setMessage('Please upload a thumbnail image.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const formData = new FormData();
    formData.append('courseName', courseName.trim());
    formData.append('thumbnail', thumbnailFile);
    formData.append('keywords', keywords);
    formData.append('description', description.trim());

    try {
      setIsSubmitting(true);
      const response = await axios.post(
        `${gatewayBaseUrl}/api/courses`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      setMessage(response.data.message || 'Course saved successfully');
      setCourseName('');
      setThumbnailFile(null);
      setKeywords('');
      setDescription('');
      setFormKey((k) => k + 1);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setMessage(
        error.response?.data?.message || 'Failed to save course. Try again.'
      );
    } finally {
      setIsSubmitting(false);
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
            Courses
          </h1>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => navigate('/upload-lesson')}
        >
          Back
        </button>
      </nav>

      <main className="container" style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', fontWeight: 700 }}>
            New Course
          </h2>
          <form key={formKey} onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="courseName">
                Course name
              </label>
              <input
                id="courseName"
                name="courseName"
                type="text"
                className="form-input"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Enter course name"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="thumbnail">
                Upload thumbnail
              </label>
              <input
                id="thumbnail"
                name="thumbnail"
                type="file"
                accept="image/*"
                className="form-input"
                style={{ padding: '0.5rem' }}
                onChange={(e) =>
                  setThumbnailFile(e.target.files?.[0] || null)
                }
              />
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                Image only, max 2MB.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="keywords">
                Keywords for search
              </label>
              <input
                id="keywords"
                name="keywords"
                type="text"
                className="form-input"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. algebra, grade 9, semester 1"
              />
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                Comma-separated keywords.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className="form-input"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Course description"
                style={{ resize: 'vertical', minHeight: '120px' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ width: '100%' }}
            >
              {isSubmitting ? 'Saving…' : 'Save course'}
            </button>
          </form>

          {message && (
            <p
              style={{
                marginTop: '1.25rem',
                color: 'var(--text-muted)',
                fontSize: '0.95rem',
              }}
            >
              {message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default UploadNewLesson;
