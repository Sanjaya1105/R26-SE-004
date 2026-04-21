import React, { useMemo, useRef, useState } from "react";
import GazeTracker from "./GazeTracker";
import CursorTracker from "./CursorTrackerForQuestionTracker";
import QuestionView from "./QuestionView";

export default function QuestionRunner() {

    const ANSWER_BACKEND_URL = "http://localhost:4000/cognitive-style/question-runner/answers";

    const cursorTrackerRef = useRef(null);
    // Keep questions blank for now. You can fill these later.
    const postAnswer = async (question) => {
        const selectedAnswer = answers[question.id];
        if (!selectedAnswer) return;

        const payload = {
            sessionId: "session-test1", // You can replace this with a dynamic session ID if needed
            questionId: question.id,
            selectedAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: selectedAnswer === question.correctAnswer,
        };

        if (ANSWER_BACKEND_URL) {
            try {
                await fetch(ANSWER_BACKEND_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                console.log("Posted answer:", payload);
            } catch (error) {
                console.error("Failed to post answer:", error);
            }
        } else {
            console.log("ANSWER_BACKEND_URL is empty. Answer not posted.", payload);
        }
    };

    const questions = useMemo(() => {
        return [
            {
                id: 1,
                target: "C",
                complexImage: "/images/Question_1/q1_complex.png",
                options: [
                    { id: "A", image: "/images/Question_1/q1_A.png" },
                    { id: "B", image: "/images/Question_1/q1_B.png" },
                    { id: "C", image: "/images/Question_1/q1_C.png" },
                    { id: "D", image: "/images/Question_1/q1_D.png" }, // optional if you add D
                ],
                correctAnswer: "C",
            },
            {
                id: 2,
                target: "A",
                complexImage: "/images/Question_2/q2_complex.png",
                options: [
                    { id: "A", image: "/images/Question_2/q2_A.png" },
                    { id: "B", image: "/images/Question_2/q2_B.png" },
                    { id: "C", image: "/images/Question_2/q2_C.png" },
                    { id: "D", image: "/images/Question_2/q2_D.png" }, // optional if you add D
                ],
                correctAnswer: "A",
            },
            {
                id: 3,
                target: "D",
                complexImage: "/images/Question_3/q3_complex.png",
                options: [
                    { id: "A", image: "/images/Question_3/q3_A.png" },
                    { id: "B", image: "/images/Question_3/q3_B.png" },
                    { id: "C", image: "/images/Question_3/q3_C.png" },
                    { id: "D", image: "/images/Question_3/q3_D.png" }, // optional if you add D
                ],
                correctAnswer: "D",
            },
            {
                id: 4,
                target: "D",
                complexImage: "/images/Question_4/q4_complex.png",
                options: [
                    { id: "A", image: "/images/Question_4/q4_A.png" },
                    { id: "B", image: "/images/Question_4/q4_B.png" },
                    { id: "C", image: "/images/Question_4/q4_C.png" },
                    { id: "D", image: "/images/Question_4/q4_D.png" }, // optional if you add D
                ],
                correctAnswer: "D",
            },
        ];
    }, []);

    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionEnded, setSessionEnded] = useState(false);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);


    // Store selected answers by questionId
    const [answers, setAnswers] = useState({});

    // Store cursor summaries by questionId
    const [cursorSummaries, setCursorSummaries] = useState({});

    // Store gaze windows for whole session
    const [gazeWindows, setGazeWindows] = useState([]);

    // Optional session timestamps
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [sessionEndTime, setSessionEndTime] = useState(null);

    const totalQuestions = questions.length;
    const currentQuestion = questions[currentQuestionIndex] || null;
    const hasSelectedAnswer =
        currentQuestion && answers[currentQuestion.id];

    const handleStartSession = () => {
        setSessionStarted(true);
        setSessionEnded(false);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setCursorSummaries({});
        setGazeWindows([]);
        setSessionStartTime(Date.now());
        setSessionEndTime(null);
    };

    const handleAnswerChange = (questionId, value) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: value,
        }));
    };

    const handleCursorSummary = (summary) => {
        if (!summary?.questionId) return;

        setCursorSummaries((prev) => ({
            ...prev,
            [summary.questionId]: summary,
        }));
    };

    const handleGazeWindow = (windowData) => {
        setGazeWindows((prev) => [...prev, windowData]);
    };

    const handleNextQuestion = async () => {
        if (cursorTrackerRef.current) {
            await cursorTrackerRef.current.finalizeQuestion();
        }

        if (currentQuestion) {
            await postAnswer(currentQuestion);
        }

        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
            return;
        }

        setSessionEnded(true);
        setSessionStarted(false);
        setSessionEndTime(Date.now());
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
        }
    };

    const handleFinishSession = async () => {
        if (cursorTrackerRef.current) {
            await cursorTrackerRef.current.finalizeQuestion();
        }

        if (currentQuestion) {
            await postAnswer(currentQuestion);
        }
        setSessionEnded(true);
        setSessionStarted(false);
        setSessionEndTime(Date.now());
    };

    const finalSessionData = {
        sessionStartTime,
        sessionEndTime,
        totalQuestions,
        answers,
        cursorSummaries,
        gazeWindows,
    };

    return (
        <div style={styles.page}>
            <h1 style={styles.title}>GEFT Question Runner</h1>

            {!sessionStarted && !sessionEnded && (
                <div style={styles.card}>
                    <p style={styles.text}>
                        This is the common parent component for your GEFT flow.
                    </p>
                    <p style={styles.text}>
                        Questions are intentionally left blank for now.
                    </p>
                    <button style={styles.primaryButton} onClick={handleStartSession}>
                        Start Session
                    </button>
                </div>
            )}

            {sessionStarted && (
                <div style={styles.layout}>
                    <div style={styles.leftPanel}>
                        <GazeTracker
                            sessionActive={sessionStarted}
                            currentQuestionId={currentQuestion?.id ?? null}
                            onWindowReady={handleGazeWindow}
                        />
                    </div>

                    <div style={styles.rightPanel}>
                        <CursorTracker
                            ref={cursorTrackerRef}
                            questionId={currentQuestion?.id ?? null}
                            isActive={sessionStarted && !!currentQuestion}
                            onQuestionSummary={handleCursorSummary}
                        >
                            <div style={styles.card}>
                                <h2 style={styles.subtitle}>
                                    Question {currentQuestionIndex + 1}
                                </h2>

                                {currentQuestion ? (
                                    <>
                                        <QuestionView
                                            question={currentQuestion}
                                            selectedAnswer={answers[currentQuestion.id]}
                                            onSelect={(value) =>
                                                handleAnswerChange(currentQuestion.id, value)
                                            }
                                        />

                                        <div style={styles.navigationRow}>
                                            <button
                                                style={styles.secondaryButton}
                                                onClick={handlePreviousQuestion}
                                                disabled={currentQuestionIndex === 0}
                                            >
                                                Previous
                                            </button>

                                            {currentQuestionIndex < totalQuestions - 1 ? (
                                                <button
                                                    style={styles.primaryButton}
                                                    onClick={handleNextQuestion}
                                                    disabled={!hasSelectedAnswer}
                                                >
                                                    Next
                                                </button>
                                            ) : (
                                                <button
                                                    style={styles.primaryButton}
                                                    onClick={handleFinishSession}
                                                    disabled={!hasSelectedAnswer}
                                                >
                                                    Finish
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={styles.questionBox}>
                                        <p style={styles.text}>
                                            No questions added yet. Add your question structure later.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CursorTracker>
                    </div>
                </div>
            )}

            {sessionEnded && (
                <div style={styles.card}>
                    <h2 style={styles.subtitle}>Session Finished</h2>
                    <p style={styles.text}>
                        Below is the collected session data structure.
                    </p>

                    <pre style={styles.pre}>
                        {JSON.stringify(finalSessionData, null, 2)}
                    </pre>

                    <button style={styles.primaryButton} onClick={handleStartSession}>
                        Restart Session
                    </button>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        padding: "24px",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
    },
    title: {
        marginBottom: "20px",
        fontSize: "28px",
        fontWeight: "700",
    },
    subtitle: {
        marginBottom: "16px",
        fontSize: "22px",
        fontWeight: "600",
    },
    text: {
        fontSize: "15px",
        lineHeight: 1.6,
        marginBottom: "12px",
    },
    layout: {
        display: "grid",
        gridTemplateColumns: "420px 1fr",
        gap: "20px",
        alignItems: "start",
    },
    leftPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    rightPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    card: {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    },
    questionBox: {
        minHeight: "180px",
        border: "1px dashed #cbd5e1",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        background: "#f8fafc",
    },
    answerBox: {
        marginBottom: "16px",
    },
    label: {
        fontSize: "14px",
        fontWeight: "600",
        marginBottom: "8px",
    },
    input: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px solid #cbd5e1",
        fontSize: "14px",
        outline: "none",
    },
    navigationRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
    },
    primaryButton: {
        padding: "10px 16px",
        border: "none",
        borderRadius: "10px",
        background: "#2563eb",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: "600",
        cursor: "pointer",
    },
    secondaryButton: {
        padding: "10px 16px",
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#0f172a",
        fontSize: "14px",
        fontWeight: "600",
        cursor: "pointer",
    },
    pre: {
        background: "#0f172a",
        color: "#e2e8f0",
        padding: "16px",
        borderRadius: "12px",
        overflowX: "auto",
        fontSize: "12px",
        marginBottom: "16px",
    },
};