import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { getGatewayBaseUrl } from '../config/gateway';
import TeacherWorkspaceLayout from '../components/TeacherWorkspaceLayout';

function formatUploadedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const UploadsView = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const gatewayBaseUrl = getGatewayBaseUrl();

  const fetchMyCourses = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const response = await axios.get(`${gatewayBaseUrl}/api/courses/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = response.data?.data;
    setCourses(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchMyCourses();
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        setMessage(
          error.response?.data?.message || 'Failed to load your courses.'
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [gatewayBaseUrl, navigate]);

  const handleDelete = async (id) => {
    const ok = window.confirm(
      'Delete this course and all its sections and materials? This cannot be undone.'
    );
    if (!ok) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const idStr = String(id);
    setDeletingId(idStr);
    setMessage('');
    try {
      await axios.delete(
        `${gatewayBaseUrl}/api/courses/${encodeURIComponent(idStr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCourses((prev) => prev.filter((c) => String(c.id) !== idStr));
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setMessage(
        error.response?.data?.message || 'Could not delete this course.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <TeacherWorkspaceLayout
      activePath="/upload-lesson"
      eyebrow="Lesson management"
      title="Uploaded lessons"
      description="Review the courses you have published, open the student preview, or update and remove a lesson."
      badge="LIB"
    >
      <div className="uploads-view-toolbar">
        <button
          type="button"
          className="teacher-workspace-secondary-button"
          onClick={() => navigate('/upload-lesson')}
        >
          Back to lesson uploads
        </button>
        <button
          type="button"
          className="teacher-workspace-primary-button"
          onClick={() => navigate('/upload-new_lesson')}
        >
          Upload a new course
        </button>
      </div>

      <section className="teacher-workspace-card">
        <div className="teacher-workspace-card-heading">
          <h2>Your courses</h2>
          <p>
            {isLoading
              ? 'Loading your uploaded courses…'
              : courses.length === 1
                ? '1 course is ready in your library.'
                : `${courses.length} courses are ready in your library.`}
          </p>
        </div>

        {message ? <p className="uploads-view-error">{message}</p> : null}

        {isLoading ? (
          <div className="uploads-view-empty">
            <span className="uploads-view-empty-icon" aria-hidden="true">
              …
            </span>
            <p>Loading your courses…</p>
          </div>
        ) : null}

        {!isLoading && !message && courses.length === 0 ? (
          <div className="uploads-view-empty">
            <span className="uploads-view-empty-icon" aria-hidden="true">
              L
            </span>
            <h3>No courses yet</h3>
            <p>You have not uploaded any courses. Create one to see it here.</p>
            <button
              type="button"
              className="teacher-workspace-primary-button"
              onClick={() => navigate('/upload-new_lesson')}
            >
              Upload a course
            </button>
          </div>
        ) : null}

        {!isLoading && courses.length > 0 ? (
          <ul className="uploads-view-list">
            {courses.map((course) => {
              const uploadedAt = formatUploadedAt(course.createdAt);
              return (
                <li key={String(course.id)}>
                  <article className="uploads-view-card">
                    <div className="uploads-view-thumb">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} alt="" />
                      ) : (
                        <span aria-hidden="true">C</span>
                      )}
                    </div>
                    <div className="uploads-view-copy">
                      <h3>{course.courseName || 'Untitled course'}</h3>
                      <p>
                        {uploadedAt
                          ? `Uploaded ${uploadedAt}`
                          : 'Uploaded course'}
                      </p>
                      <Link
                        to={`/course/${encodeURIComponent(String(course.id))}`}
                        className="uploads-view-preview"
                      >
                        Preview public page
                      </Link>
                    </div>
                    <div className="uploads-view-actions">
                      <button
                        type="button"
                        className="uploads-view-update"
                        onClick={() =>
                          navigate(
                            `/upload-course/edit/${encodeURIComponent(
                              String(course.id)
                            )}`
                          )
                        }
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        className="uploads-view-delete"
                        disabled={deletingId === String(course.id)}
                        onClick={() => handleDelete(course.id)}
                      >
                        {deletingId === String(course.id)
                          ? 'Deleting…'
                          : 'Delete'}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </TeacherWorkspaceLayout>
  );
};

export default UploadsView;
