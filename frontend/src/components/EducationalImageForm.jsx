const IMAGE_STYLES = [
  { value: 'textbook', label: 'Textbook' },
  { value: 'simple cartoon', label: 'Simple cartoon' },
  { value: 'realistic', label: 'Realistic' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'classroom poster', label: 'Classroom poster' },
];

/**
 * Reusable educator form for lesson-based visual generation.
 */
export default function EducationalImageForm({
  values,
  onChange,
  onSubmit,
  disabled,
  error,
  submitLabel = 'Generate',
}) {
  const set = (key, v) => onChange({ ...values, [key]: v });

  return (
    <form
      className="educational-image-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="form-label" htmlFor="ei-lesson">
        Lesson text / extracted content
      </label>
      <textarea
        id="ei-lesson"
        className="form-input"
        rows={8}
        value={values.lessonText}
        onChange={(e) => set('lessonText', e.target.value)}
        placeholder="Paste lesson content, reading passage, or extracted PDF text…"
        disabled={disabled}
        style={{ resize: 'vertical' }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        <div>
          <label className="form-label" htmlFor="ei-age">
            Student age
          </label>
          <input
            id="ei-age"
            className="form-input"
            value={values.studentAge}
            onChange={(e) => set('studentAge', e.target.value)}
            placeholder="e.g. 12–13"
            disabled={disabled}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        <div>
          <label className="form-label" htmlFor="ei-style">
            Image style
          </label>
          <select
            id="ei-style"
            className="form-input"
            value={values.imageStyle}
            onChange={(e) => set('imageStyle', e.target.value)}
            disabled={disabled}
          >
            {IMAGE_STYLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="ei-lang">
            Language
          </label>
          <select
            id="ei-lang"
            className="form-input"
            value={values.language}
            onChange={(e) => set('language', e.target.value)}
            disabled={disabled}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="error-message" style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled}
        style={{ marginTop: '1.25rem' }}
      >
        {submitLabel}
      </button>
    </form>
  );
}

export { IMAGE_STYLES };
