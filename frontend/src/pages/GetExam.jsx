import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkExamAnswers, fetchExamLessons, generateExamQuiz } from '../exam/apiClient';
import './GetExam.css';

function formatCognitiveLoadCounts(counts) {
  const displayOrder = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  return displayOrder
    .filter((level) => Number(counts?.[level] || 0) > 0)
    .map((level) => `${level}: ${counts[level]}`)
    .join(', ');
}

export default function GetExam() {
  const [lessons, setLessons] = useState([]);
  const [showLessons, setShowLessons] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLessonKey, setSelectedLessonKey] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const selectedLesson = lessons.find(
    (lesson) => `${lesson.courseId}\u0000${lesson.lessonName}\u0000${lesson.unitNo}` === selectedLessonKey
  );

  async function loadLessons() {
    setShowLessons(true);
    setLoading(true);
    setError('');
    setSelectedLessonKey('');
    setQuiz(null);
    setResult(null);
    try {
      setLessons(await fetchExamLessons());
    } catch (requestError) {
      setLessons([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function chooseLesson(value) {
    setSelectedLessonKey(value);
    setQuiz(null);
    setAnswers([]);
    setResult(null);
    setError('');
  }

  async function generateQuiz() {
    if (!selectedLesson) return;
    setGenerating(true);
    setError('');
    setQuiz(null);
    setAnswers([]);
    setResult(null);
    try {
      const generatedQuiz = await generateExamQuiz(selectedLesson);
      setQuiz(generatedQuiz);
      setAnswers(Array(generatedQuiz.questions.length).fill(''));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionIndex, answer) {
    if (result) return;
    setAnswers((current) => current.map((value, index) => (
      index === questionIndex ? answer : value
    )));
  }

  async function checkAnswers(event) {
    event.preventDefault();
    if (!quiz || answers.some((answer) => !answer)) {
      setError('Answer all 10 questions before checking your exam.');
      return;
    }
    setChecking(true);
    setError('');
    try {
      setResult(await checkExamAnswers(quiz.id, answers));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="get-exam-page">
      <header className="get-exam-header">
        <div>
          <p>Exam preparation</p>
          <h1>Get Exam</h1>
          <span>Generate a personalized 10-question exam from your enrolled lessons.</span>
        </div>
        <button type="button" className="get-exam-button secondary" onClick={() => navigate('/course')}>
          Back to courses
        </button>
      </header>

      <main className="get-exam-main">
        <section className="get-exam-panel intro-panel">
          <div>
            <h2>Choose your lesson</h2>
            <p>Lessons are loaded only from courses in which you are enrolled.</p>
          </div>
          <button type="button" className="get-exam-button primary" onClick={loadLessons} disabled={loading}>
            {loading ? 'Loading lessons...' : 'Select Lesson'}
          </button>
        </section>

        {showLessons && (
          <section className="get-exam-panel" aria-live="polite">
            <div className="lesson-list-heading">
              <div>
                <p className="eyebrow">Available lessons</p>
                <h2>Select one lesson</h2>
              </div>
              {!loading && <span>{lessons.length} lessons</span>}
            </div>

            {error && !quiz && <p className="get-exam-message error">{error}</p>}
            {!loading && !error && lessons.length === 0 && (
              <div className="empty-lessons">
                <h3>No lessons found</h3>
                <p>No exam material is available for your enrolled courses.</p>
                <button type="button" className="get-exam-button secondary" onClick={() => navigate('/course')}>
                  Browse courses
                </button>
              </div>
            )}

            {!loading && lessons.length > 0 && (
              <label className="lesson-select-label">
                <span>Lesson name</span>
                <select value={selectedLessonKey} onChange={(event) => chooseLesson(event.target.value)}>
                  <option value="">Choose a lesson</option>
                  {lessons.map((lesson) => {
                    const key = `${lesson.courseId}\u0000${lesson.lessonName}\u0000${lesson.unitNo}`;
                    return (
                      <option value={key} key={key}>
                        {lesson.courseName} - {lesson.lessonName} - Unit {lesson.unitNo}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            {selectedLesson && (
              <div className="selected-lesson-actions">
                <p className="get-exam-message success">
                  Selected lesson: <strong>{selectedLesson.lessonName}</strong> (Unit {selectedLesson.unitNo})
                </p>
                <button type="button" className="get-exam-button primary" onClick={generateQuiz} disabled={generating}>
                  {generating ? 'Generating 10 questions...' : 'Generate 10 MCQs'}
                </button>
              </div>
            )}
          </section>
        )}

        {error && quiz && <p className="get-exam-message error">{error}</p>}

        {quiz && (
          <form className="get-exam-panel quiz-panel" onSubmit={checkAnswers}>
            <div className="lesson-list-heading">
              <div>
                <p className="eyebrow">Generated exam</p>
                <h2>{quiz.lessonName} - 10 MCQs</h2>
              </div>
              <span>
                Cognitive load: {quiz.cognitiveLoad || 'Unknown'} · {answers.filter(Boolean).length}/10 answered
              </span>
            </div>

            <p className="get-exam-message success">
              MCQ prompt used dominant cognitive load: <strong>{quiz.cognitiveLoad || 'Unknown'}</strong>
              {formatCognitiveLoadCounts(quiz.cognitiveLoadCounts)
                ? ` (${formatCognitiveLoadCounts(quiz.cognitiveLoadCounts)})`
                : ' (no cognitive-load predictions were recorded for this lesson)'}.
            </p>

            <div className="quiz-questions">
              {quiz.questions.map((question, questionIndex) => {
                const checkedResult = result?.results?.[questionIndex];
                return (
                  <fieldset className="quiz-question" key={question.index}>
                    <legend>{questionIndex + 1}. {question.question}</legend>
                    <div className="quiz-options">
                      {question.options.map((option, optionIndex) => {
                        const letter = String.fromCharCode(65 + optionIndex);
                        const isChosen = answers[questionIndex] === letter;
                        const isCorrect = checkedResult?.correctAnswer === letter;
                        const isIncorrectChoice = Boolean(result && isChosen && !isCorrect);
                        return (
                          <label
                            className={`quiz-option${isCorrect ? ' correct' : ''}${isIncorrectChoice ? ' incorrect' : ''}`}
                            key={letter}
                          >
                            <input
                              type="radio"
                              name={`question-${questionIndex}`}
                              value={letter}
                              checked={isChosen}
                              onChange={() => selectAnswer(questionIndex, letter)}
                              disabled={Boolean(result)}
                            />
                            <strong>{letter}.</strong>
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                    {checkedResult && (
                      <p className={`answer-explanation ${checkedResult.correct ? 'correct' : 'incorrect'}`}>
                        <strong>{checkedResult.correct ? 'Correct.' : `Incorrect. Correct answer: ${checkedResult.correctAnswer}.`}</strong>{' '}
                        {checkedResult.explanation}
                      </p>
                    )}
                  </fieldset>
                );
              })}
            </div>

            {result ? (
              <div className="quiz-score" role="status">
                <span>Your score</span>
                <strong>{result.score}/{result.total}</strong>
                <button type="button" className="get-exam-button secondary" onClick={generateQuiz} disabled={generating}>
                  Generate another exam
                </button>
              </div>
            ) : (
              <button type="submit" className="get-exam-button primary" disabled={checking}>
                {checking ? 'Checking answers...' : 'Check Answers'}
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
