const VISUAL_TYPES = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'labeled diagram', label: 'Labeled diagram' },
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'process diagram', label: 'Process diagram' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'chart', label: 'Chart' },
  { value: 'map', label: 'Map' },
  { value: 'comparison table', label: 'Comparison table' },
  { value: 'cause effect', label: 'Cause & effect' },
  { value: 'hierarchy', label: 'Hierarchy / tree' },
  { value: 'concept map', label: 'Concept map' },
  { value: 'illustration', label: 'Illustration' },
];

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
          <label className="form-label" htmlFor="ei-subject">
            Subject
          </label>
          <input
            id="ei-subject"
            className="form-input"
            value={values.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="e.g. Biology"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="ei-grade">
            Grade level
          </label>
          <input
            id="ei-grade"
            className="form-input"
            value={values.gradeLevel}
            onChange={(e) => set('gradeLevel', e.target.value)}
            placeholder="e.g. 7th grade"
            disabled={disabled}
          />
        </div>
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

      <div style={{ marginTop: '1rem' }}>
        <label className="form-label" htmlFor="ei-objective">
          Learning objective
        </label>
        <input
          id="ei-objective"
          className="form-input"
          value={values.learningObjective}
          onChange={(e) => set('learningObjective', e.target.value)}
          placeholder="What should learners understand or be able to do?"
          disabled={disabled}
        />
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
          <label className="form-label" htmlFor="ei-visual">
            Visual type
          </label>
          <select
            id="ei-visual"
            className="form-input"
            value={values.visualType}
            onChange={(e) => set('visualType', e.target.value)}
            disabled={disabled}
          >
            {VISUAL_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
          <input
            id="ei-lang"
            className="form-input"
            value={values.language}
            onChange={(e) => set('language', e.target.value)}
            placeholder="e.g. English"
            disabled={disabled}
          />
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

export { VISUAL_TYPES, IMAGE_STYLES };
