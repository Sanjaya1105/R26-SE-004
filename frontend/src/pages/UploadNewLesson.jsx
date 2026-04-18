import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getGatewayBaseUrl } from '../config/gateway';

const resetInnerSectionState = () => ({
  sectionName: '',
  activeSectionId: null,
  subToggleOpen: false,
  subVideo: null,
  subPpt: null,
  subPdf: null,
  subImages: [],
  lastSubsectionSubmitted: false,
  submittedSubsections: [],
  subsectionFormKey: 0,
});

const SUBSECTION_TOGGLE_DELAY_MS = 220;

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

const UploadNewLesson = () => {
  const navigate = useNavigate();
  const subsectionPanelDelayRef = useRef(null);
  const [formKey, setFormKey] = useState(0);
  const gatewayBaseUrl = getGatewayBaseUrl();

  const [courseName, setCourseName] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [savedThumbnailUrl, setSavedThumbnailUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [savedCourseId, setSavedCourseId] = useState(null);

  const [sectionsPanelOpen, setSectionsPanelOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [subToggleOpen, setSubToggleOpen] = useState(false);
  const [subVideo, setSubVideo] = useState(null);
  const [subPpt, setSubPpt] = useState(null);
  const [subPdf, setSubPdf] = useState(null);
  const [subImages, setSubImages] = useState([]);
  const [lastSubsectionSubmitted, setLastSubsectionSubmitted] = useState(false);
  const [submittedSubsections, setSubmittedSubsections] = useState([]);
  const [subsectionFormKey, setSubsectionFormKey] = useState(0);

  useEffect(() => {
    return () => {
      if (subsectionPanelDelayRef.current != null) {
        clearTimeout(subsectionPanelDelayRef.current);
        subsectionPanelDelayRef.current = null;
      }
    };
  }, []);

  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  const coursePartComplete = Boolean(savedCourseId);
  const courseFieldsLocked = coursePartComplete;
  const sectionNameLocked = Boolean(activeSectionId);

  const applyInnerReset = useCallback(() => {
    const r = resetInnerSectionState();
    setSectionName(r.sectionName);
    setActiveSectionId(r.activeSectionId);
    setSubToggleOpen(r.subToggleOpen);
    setSubVideo(r.subVideo);
    setSubPpt(r.subPpt);
    setSubPdf(r.subPdf);
    setSubImages(r.subImages);
    setLastSubsectionSubmitted(r.lastSubsectionSubmitted);
    setSubmittedSubsections(r.submittedSubsections);
    setSubsectionFormKey((k) => k + 1);
  }, []);

  const toggleSectionsPanel = () => {
    if (sectionsPanelOpen) {
      setSectionsPanelOpen(false);
      applyInnerReset();
    } else {
      setSectionsPanelOpen(true);
    }
  };

  const startNewCourseSection = () => {
    setSectionName('');
    setActiveSectionId(null);
    setSubToggleOpen(false);
    setSubVideo(null);
    setSubPpt(null);
    setSubPdf(null);
    setSubImages([]);
    setLastSubsectionSubmitted(false);
    setSubmittedSubsections([]);
    setSubsectionFormKey((k) => k + 1);
  };

  const startNewCourse = () => {
    setCourseName('');
    setThumbnailFile(null);
    setSavedThumbnailUrl('');
    setKeywords('');
    setDescription('');
    setSavedCourseId(null);
    setSectionsPanelOpen(false);
    applyInnerReset();
    setMessage('');
    setFormKey((k) => k + 1);
  };

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  const handleSaveCourse = async () => {
    setMessage('');

    if (savedCourseId) {
      return;
    }

    if (!courseName.trim()) {
      setMessage('Course name is required.');
      return;
    }

    if (!thumbnailFile) {
      setMessage('Please upload a thumbnail image.');
      return;
    }

    const token = getToken();
    if (!token) return;

    const formData = new FormData();
    formData.append('courseName', courseName.trim());
    formData.append('thumbnail', thumbnailFile);
    formData.append('keywords', keywords);
    formData.append('description', description.trim());
    const educatorLabel = getLoggedInEducatorName();
    if (educatorLabel) {
      formData.append('educatorName', educatorLabel);
    }

    try {
      setIsSavingCourse(true);
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

      const data = response.data?.data;
      const courseId = data?.id;
      if (!courseId) {
        setMessage(response.data?.message || 'Course saved but missing id.');
        return;
      }

      setSavedCourseId(courseId);
      if (typeof data.courseName === 'string') {
        setCourseName(data.courseName);
      }
      if (Array.isArray(data.keywords)) {
        setKeywords(data.keywords.join(', '));
      }
      if (typeof data.description === 'string') {
        setDescription(data.description);
      }
      if (typeof data.thumbnailUrl === 'string') {
        setSavedThumbnailUrl(data.thumbnailUrl);
      }
      setThumbnailFile(null);

      setMessage(
        'Course saved. Use the right column to add a section, then subsections with files.'
      );
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
      setIsSavingCourse(false);
    }
  };

  const handleAddSubSection = async () => {
    setMessage('');
    if (!savedCourseId) {
      setMessage('Save the course first.');
      return;
    }
    if (!sectionName.trim()) {
      setMessage('Enter a section name first.');
      return;
    }

    const token = getToken();
    if (!token) return;

    if (!activeSectionId) {
      try {
        setIsCreatingSection(true);
        const educatorName = getLoggedInEducatorName();
        const res = await axios.post(
          `${gatewayBaseUrl}/api/courses/${savedCourseId}/section`,
          {
            name: sectionName.trim(),
            ...(educatorName ? { educatorName } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const sid = res.data?.data?.id ?? res.data?.data?._id;
        if (sid == null) {
          setMessage(res.data?.message || 'Could not create section.');
          return;
        }
        setActiveSectionId(String(sid));
        setSubToggleOpen(true);
        setLastSubsectionSubmitted(false);
        setMessage('Section created. Add files for the first subsection below.');
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        setMessage(
          error.response?.data?.message || 'Failed to create section.'
        );
      } finally {
        setIsCreatingSection(false);
      }
      return;
    }

    setSubToggleOpen((open) => !open);
  };

  const clearSubFiles = () => {
    setSubVideo(null);
    setSubPpt(null);
    setSubPdf(null);
    setSubImages([]);
    setSubsectionFormKey((k) => k + 1);
  };

  const handleSubmitSubsection = async () => {
    setMessage('');
    const sectionIdStr =
      activeSectionId != null ? String(activeSectionId).trim() : '';
    if (!sectionIdStr) {
      setMessage('Create the section first (Add sub section).');
      return;
    }

    const hasFile =
      subVideo ||
      subPpt ||
      subPdf ||
      (Array.isArray(subImages) && subImages.length > 0);
    if (!hasFile) {
      setMessage(
        'Add at least one file: video, PPT, PDF, or one or more images.'
      );
      return;
    }

    const token = getToken();
    if (!token) return;

    const formData = new FormData();
    if (subVideo) formData.append('video', subVideo);
    if (subPpt) formData.append('ppt', subPpt);
    if (subPdf) formData.append('pdf', subPdf);
    if (Array.isArray(subImages)) {
      subImages.forEach((file) => formData.append('images', file));
    }
    const educatorLabel = getLoggedInEducatorName();
    if (educatorLabel) {
      formData.append('educatorName', educatorLabel);
    }

    try {
      setIsSubmittingSub(true);
      const res = await axios.post(
        `${gatewayBaseUrl}/api/sections/${activeSectionId}/subsections`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const payload = res.data?.data;
      const sub = payload?.subsection ?? payload;
      const sec = payload?.section;
      if (sub?.id) {
        setSubmittedSubsections((prev) => [
          ...prev,
          {
            id: sub.id,
            order: sub.order,
            sectionId: String(sec?.id ?? activeSectionId),
            sectionName: sec?.sectionName ?? sectionName,
          },
        ]);
      }
      setLastSubsectionSubmitted(true);
      clearSubFiles();
      setMessage(
        sec?.sectionName
          ? `Subsection saved under section "${sec.sectionName}". You can add another subsection when ready.`
          : 'Subsection saved under this section. You can add another subsection when ready.'
      );
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      const detail =
        error.response?.data?.message ||
        error.message ||
        (error.code === 'ERR_NETWORK'
          ? 'Network error — is the API gateway running?'
          : 'Failed to save subsection.');
      setMessage(detail);
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleAddAnotherSubsection = () => {
    if (!lastSubsectionSubmitted) return;
    setLastSubsectionSubmitted(false);
    setSubToggleOpen(false);
    setMessage('');

    if (subsectionPanelDelayRef.current != null) {
      clearTimeout(subsectionPanelDelayRef.current);
    }
    subsectionPanelDelayRef.current = window.setTimeout(() => {
      subsectionPanelDelayRef.current = null;
      clearSubFiles();
      setSubToggleOpen(true);
      setMessage('Enter the next subsection files, then submit.');
    }, SUBSECTION_TOGGLE_DELAY_MS);
  };

  const readonlyFieldStyle = courseFieldsLocked
    ? { opacity: 0.92, cursor: 'default' }
    : undefined;

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <nav
        className="navbar glass-panel"
        style={{
          borderRadius: '12px',
          marginBottom: '2rem',
          maxWidth: '1120px',
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

      <main
        className="container"
        style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 1rem' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2
              style={{
                fontSize: '1.75rem',
                marginBottom: '1.5rem',
                fontWeight: 700,
              }}
            >
              New Course
            </h2>

            <div key={formKey}>
              {courseFieldsLocked && (
                <p
                  style={{
                    color: 'var(--success, #10b981)',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  Course saved — fields below show what was stored.
                </p>
              )}

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
                  readOnly={courseFieldsLocked}
                  style={readonlyFieldStyle}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="thumbnail">
                  Upload thumbnail
                </label>
                {!courseFieldsLocked ? (
                  <>
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
                  </>
                ) : (
                  <div>
                    {savedThumbnailUrl ? (
                      <img
                        src={savedThumbnailUrl}
                        alt="Course thumbnail"
                        style={{
                          width: '100%',
                          maxWidth: '320px',
                          borderRadius: '8px',
                          border: '1px solid var(--surface-light)',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Thumbnail URL saved (preview unavailable).
                      </p>
                    )}
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Thumbnail is stored on Cloudinary; the link above is what
                      was saved for this course.
                    </p>
                  </div>
                )}
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
                  readOnly={courseFieldsLocked}
                  style={readonlyFieldStyle}
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
                  style={{
                    resize: 'vertical',
                    minHeight: '120px',
                    ...readonlyFieldStyle,
                  }}
                  readOnly={courseFieldsLocked}
                />
              </div>

              {!courseFieldsLocked ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCourse}
                  disabled={isSavingCourse}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  {isSavingCourse ? 'Saving course…' : 'Save course'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={startNewCourse}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  Start another course
                </button>
              )}
            </div>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: '2rem',
              opacity: coursePartComplete ? 1 : 0.55,
              pointerEvents: coursePartComplete ? 'auto' : 'none',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                marginBottom: '1rem',
                fontWeight: 700,
              }}
            >
              Sections
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
              }}
            >
              {coursePartComplete
                ? 'Open Add section, enter a section name, then use Add sub section to upload materials. Submit each subsection before adding another.'
                : 'Save the course on the left first.'}
            </p>

            <button
              type="button"
              className="btn"
              onClick={toggleSectionsPanel}
              disabled={!coursePartComplete}
              style={{
                width: '100%',
                marginBottom: '1rem',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#93c5fd',
                border: '1px solid rgba(59, 130, 246, 0.35)',
              }}
            >
              {sectionsPanelOpen ? 'Hide add section' : 'Add section'}
            </button>

            {sectionsPanelOpen && coursePartComplete && (
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '1rem',
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="sectionName">
                    Section name
                  </label>
                  <input
                    id="sectionName"
                    type="text"
                    className="form-input"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="e.g. Module 1"
                    readOnly={sectionNameLocked}
                    style={
                      sectionNameLocked
                        ? { opacity: 0.92, cursor: 'default' }
                        : undefined
                    }
                    autoComplete="off"
                  />
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={handleAddSubSection}
                  disabled={isCreatingSection || !sectionName.trim()}
                  style={{
                    width: '100%',
                    marginBottom: '1rem',
                    backgroundColor: 'rgba(168, 85, 247, 0.12)',
                    color: '#d8b4fe',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                  }}
                >
                  {isCreatingSection
                    ? 'Creating section…'
                    : activeSectionId
                      ? subToggleOpen
                        ? 'Hide sub section'
                        : 'Show sub section'
                      : 'Add sub section'}
                </button>

                {activeSectionId && subToggleOpen && (
                  <div
                    key={subsectionFormKey}
                    style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(15, 23, 42, 0.35)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                      }}
                    >
                      Upload one video, and/or PPT, PDF, and multiple images
                      (stored on Cloudinary). At least one file is required to
                      submit.
                    </p>

                    <div className="form-group">
                      <label className="form-label" htmlFor="sub-video">
                        Video
                      </label>
                      <input
                        id="sub-video"
                        type="file"
                        accept="video/*"
                        className="form-input"
                        style={{ padding: '0.5rem' }}
                        onChange={(e) =>
                          setSubVideo(e.target.files?.[0] || null)
                        }
                      />
                      <p
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Max 40MB.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="sub-ppt">
                        PowerPoint (PPT / PPTX)
                      </label>
                      <input
                        id="sub-ppt"
                        type="file"
                        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        className="form-input"
                        style={{ padding: '0.5rem' }}
                        onChange={(e) =>
                          setSubPpt(e.target.files?.[0] || null)
                        }
                      />
                      <p
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Max 15MB.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="sub-pdf">
                        PDF
                      </label>
                      <input
                        id="sub-pdf"
                        type="file"
                        accept=".pdf,application/pdf"
                        className="form-input"
                        style={{ padding: '0.5rem' }}
                        onChange={(e) =>
                          setSubPdf(e.target.files?.[0] || null)
                        }
                      />
                      <p
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Max 15MB.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="sub-images">
                        Images (multiple)
                      </label>
                      <input
                        id="sub-images"
                        type="file"
                        accept="image/*"
                        multiple
                        className="form-input"
                        style={{ padding: '0.5rem' }}
                        onChange={(e) =>
                          setSubImages(
                            e.target.files
                              ? Array.from(e.target.files)
                              : []
                          )
                        }
                      />
                      <p
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Up to 15 files, 5MB each.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmitSubsection}
                      disabled={isSubmittingSub}
                      style={{ width: '100%', marginBottom: '0.75rem' }}
                    >
                      {isSubmittingSub
                        ? 'Submitting subsection…'
                        : 'Submit subsection'}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={handleAddAnotherSubsection}
                      disabled={!lastSubsectionSubmitted}
                      style={{
                        width: '100%',
                        backgroundColor: lastSubsectionSubmitted
                          ? 'rgba(34, 197, 94, 0.12)'
                          : 'rgba(100, 116, 139, 0.15)',
                        color: lastSubsectionSubmitted
                          ? '#86efac'
                          : 'var(--text-muted)',
                        border: `1px solid ${
                          lastSubsectionSubmitted
                            ? 'rgba(34, 197, 94, 0.35)'
                            : 'rgba(100,116,139,0.25)'
                        }`,
                        cursor: lastSubsectionSubmitted
                          ? 'pointer'
                          : 'not-allowed',
                      }}
                    >
                      + Add another subsection
                    </button>
                  </div>
                )}

                {submittedSubsections.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <p
                      className="form-label"
                      style={{ marginBottom: '0.35rem' }}
                    >
                      Hierarchy (this course section)
                    </p>
                    <div
                      style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.35)',
                      }}
                    >
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          marginBottom: '0.5rem',
                          color: 'var(--text)',
                        }}
                      >
                        Section:{' '}
                        {sectionName.trim() ||
                          submittedSubsections[0]?.sectionName ||
                          '(unnamed)'}
                      </p>
                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Subsections saved under this section (
                        {submittedSubsections.length})
                      </p>
                      <ul
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.875rem',
                          paddingLeft: '1.25rem',
                          margin: 0,
                          listStyleType: 'disc',
                        }}
                      >
                        {submittedSubsections.map((s, i) => (
                          <li key={s.id} style={{ marginBottom: '0.25rem' }}>
                            Subsection {i + 1} (order {s.order})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeSectionId && (
                  <button
                    type="button"
                    className="btn"
                    onClick={startNewCourseSection}
                    style={{
                      width: '100%',
                      marginTop: '1.25rem',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    New course section
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {message && (
          <p
            style={{
              marginTop: '1.25rem',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              textAlign: 'center',
            }}
          >
            {message}
          </p>
        )}
      </main>
    </div>
  );
};

export default UploadNewLesson;
