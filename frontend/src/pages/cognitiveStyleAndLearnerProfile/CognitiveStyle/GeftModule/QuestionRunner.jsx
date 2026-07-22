

// // import React, { useMemo, useState, useEffect } from "react";
// // import GazeTracker from "./GazeTracker";
// // import QuestionView from "./QuestionView";
// // import CalibrationScreen from "../Calibration/Calibration"; // IMPORT THE NEW CALIBRATION COMPONENT
// // import { useNavigate } from "react-router-dom";

// // // --- Math Helpers ---
// // const calculateMedian = (arr) => {
// //     if (arr.length === 0) return 0;
// //     const sorted = [...arr].sort((a, b) => a - b);
// //     const mid = Math.floor(sorted.length / 2);
// //     return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
// // };

// // const calculateAverage = (arr) => {
// //     if (arr.length === 0) return 0;
// //     return arr.reduce((a, b) => a + b, 0) / arr.length;
// // };

// // export default function QuestionRunner() {
// //     const ANSWER_BACKEND_URL = "";
// //     const navigate = useNavigate();

// //     const userPayload = useMemo(() => {
// //         const token = localStorage.getItem("token");
// //         if (!token) return null;
// //         try {
// //             return JSON.parse(atob(token.split(".")[1]));
// //         } catch {
// //             return null;
// //         }
// //     }, []);

// //     // --- TEST ANSWERS (3 Global, 3 Local) ---
// //     const ACTUAL_CORRECT_ANSWERS = [
// //         "Yes", "No", "Yes", // Global Answers (IDs 1, 2, 3)
// //         "Yes", "No", "Yes"  // Local Answers (IDs 4, 5, 6)
// //     ];

// //     const questions = useMemo(() => {
// //         const generatedQuestions = [];
// //         // Loop only 6 times
// //         for (let i = 1; i <= 6; i++) {
// //             // IDs 1-3 are global, 4-6 are local
// //             const type = i <= 3 ? "global" : "local";
// //             // ID 1 (Global Trial) and ID 4 (Local Trial)
// //             const isTrial = i === 1 || i === 4;
// //             const mappedAnswer = ACTUAL_CORRECT_ANSWERS[i - 1] || (i % 2 === 0 ? "Yes" : "No");

// //             generatedQuestions.push({
// //                 id: i,
// //                 type: type,
// //                 isTrial: isTrial,
// //                 leftImage: `/images/Question_${i}/q${i}_left.png`,
// //                 rightImage: `/images/Question_${i}/q${i}_right.png`,
// //                 correctAnswer: mappedAnswer,
// //             });
// //         }
// //         return generatedQuestions;
// //     }, []);

// //     // STATE MACHINE: INTRO -> CALIBRATE_1 -> TEST_GLOBAL -> INTERMISSION -> CALIBRATE_2 -> TEST_LOCAL -> DONE
// //     const [appPhase, setAppPhase] = useState("INTRO");
// //     const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

// //     const [answers, setAnswers] = useState({});
// //     const [gazeWindows, setGazeWindows] = useState([]);
// //     const [blocksSent, setBlocksSent] = useState({ global: false, local: false });

// //     const [sessionStartTime, setSessionStartTime] = useState(null);
// //     const [sessionEndTime, setSessionEndTime] = useState(null);

// //     const totalQuestions = questions.length;
// //     const currentQuestion = questions[currentQuestionIndex] || null;

// //     const handleStartSession = () => {
// //         setSessionStartTime(Date.now());
// //         setAppPhase("CALIBRATE_1"); // Start first calibration instead of skipping straight to test
// //     };

// //     const handleGazeWindow = (windowData) => {
// //         setGazeWindows((prev) => [...prev, windowData]);
// //     };

// //     const handleAnswerSubmit = (selectedAnswer, responseTimeMs) => {
// //         const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

// //         setAnswers((prev) => ({
// //             ...prev,
// //             [currentQuestion.id]: { selectedAnswer, isCorrect, responseTimeMs },
// //         }));
        
// //         // Question 3 (Index 2) is the end of the Global block
// //         if (currentQuestionIndex === 2) {
// //             setAppPhase("INTERMISSION");
// //             setCurrentQuestionIndex(3); // Prime the index for the local block (ID 4)
// //         }
// //         // Question 84 (Index 83) is the end of the Local block
// //         else if (currentQuestionIndex === totalQuestions - 1) {
// //             setAppPhase("DONE");
// //             setSessionEndTime(Date.now());
// //         }
// //         // Otherwise, just move to the next question
// //         else {
// //             setCurrentQuestionIndex((prev) => prev + 1);
// //         }
// //     };

// //     const processAndSendMetrics = async (type, currentAnswers, currentGaze) => {
// //         const validQuestions = questions.filter((q) => q.type === type && !q.isTrial);
// //         const validIds = validQuestions.map((q) => q.id);

// //         const rts = [];
// //         let correctCount = 0;
// //         const transitionsList = [];
// //         const dwellTimesList = [];

// //         validIds.forEach((id) => {
// //             const ans = currentAnswers[id];
// //             if (ans) {
// //                 rts.push(ans.responseTimeMs);
// //                 if (ans.isCorrect) correctCount++;
// //             }

// //             const gaze = currentGaze.find((g) => g.questionId === id);
// //             if (gaze) {
// //                 transitionsList.push(gaze.transitions || 0);
// //                 dwellTimesList.push(gaze.totalDwellTime || 0);
// //             }
// //         });

// //         const medianRT = calculateMedian(rts);
// //         const avgTransitions = calculateAverage(transitionsList);
// //         const avgDwellTime = calculateAverage(dwellTimesList);
// //         const totalAccuracy = validQuestions.length > 0 ? (correctCount / validQuestions.length) * 100 : 0;

// //         const payload =
// //             type === "global"
// //                 ? {
// //                     Median_RT_Global: Number(medianRT.toFixed(2)),
// //                     Avg_Transitions_Global: Number(avgTransitions.toFixed(2)),
// //                     Avg_Dwell_Time_Global: Number(avgDwellTime.toFixed(2)),
// //                     Total_Accuracy_Global: Number(totalAccuracy.toFixed(2)),
// //                 }
// //                 : {
// //                     Median_RT_Local: Number(medianRT.toFixed(2)),
// //                     Avg_Transitions_Local: Number(avgTransitions.toFixed(2)),
// //                     Avg_Dwell_Time_Local: Number(avgDwellTime.toFixed(2)),
// //                     Total_Accuracy_Local: Number(totalAccuracy.toFixed(2)),
// //                 };

// //         console.log(`[${type.toUpperCase()}] Ready to send block metrics:`, payload);

// //         if (ANSWER_BACKEND_URL) {
// //             try {
// //                 await fetch(`${ANSWER_BACKEND_URL}/metrics-${type}`, {
// //                     method: "POST",
// //                     headers: { "Content-Type": "application/json" },
// //                     body: JSON.stringify({
// //                         sessionId: userPayload?.id || "session-test1",
// //                         ...payload,
// //                     }),
// //                 });
// //             } catch (error) {
// //                 console.error(`Failed to post ${type} metrics:`, error);
// //             }
// //         }
// //     };

// //     useEffect(() => {
// //         // We can evaluate if a block is complete regardless of the current phase
// //         const checkBlockCompletion = (type) => {
// //             const targetQuestions = questions.filter((q) => q.type === type && !q.isTrial);
// //             const targetIds = targetQuestions.map((q) => q.id);

// //             const hasAllAnswers = targetIds.every((id) => answers[id] !== undefined);
// //             const hasAllGaze = targetIds.every((id) => gazeWindows.find((g) => g.questionId === id) !== undefined);

// //             if (hasAllAnswers && hasAllGaze && !blocksSent[type]) {
// //                 setBlocksSent((prev) => ({ ...prev, [type]: true }));
// //                 processAndSendMetrics(type, answers, gazeWindows);
// //             }
// //         };

// //         checkBlockCompletion("global");
// //         checkBlockCompletion("local");
// //     }, [answers, gazeWindows, blocksSent, questions]);

// //     const finalSessionData = {
// //         sessionStartTime,
// //         sessionEndTime,
// //         totalQuestions,
// //         answers,
// //         gazeWindows,
// //     };

// //     // Evaluate which background to show depending on the active phase
// //     const isFullScreenPhase = appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL" || appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2";

// //     return (
// //         <div style={isFullScreenPhase ? styles.fullScreenPage : styles.page}>

// //             {/* 1. INTRO PHASE */}
// //             {appPhase === "INTRO" && (
// //                 <div style={styles.overlayContainer}>
// //                     <div style={styles.consentBox}>
// //                         <h2 style={styles.title}>Cognitive Style Assessment</h2>
// //                         <p style={styles.text}>
// //                             In this module, we will analyze your learning preference and cognitive style based on your interaction with visual materials.
// //                         </p>
// //                         <div style={styles.guidelineBox}>
// //                             <p style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#333", fontSize: "16px" }}>
// //                                 Please read the following guidelines carefully:
// //                             </p>
// //                             <ul style={styles.guidelineList}>
// //                                 <li>You will be shown two images. A simple shape on the left, and a complex shape on the right.</li>
// //                                 <li>Press <strong>"L"</strong> if the left shape IS hidden inside the right shape (YES).</li>
// //                                 <li>Press <strong>"A"</strong> if the left shape IS NOT inside the right shape (NO).</li>
// //                                 <li>Your gaze and attention behavior will be captured using your web camera. Keep your face visible.</li>
// //                                 <li>Answer as quickly and accurately as possible.</li>
// //                             </ul>
// //                         </div>
// //                         <p style={{ color: "#666", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
// //                             By continuing, you acknowledge that you understand the purpose of this module.
// //                         </p>
// //                         <div style={{ display: "flex", justifyContent: "center" }}>
// //                             <button style={styles.primaryButton} onClick={handleStartSession}>
// //                                 I Understand and Continue
// //                             </button>
// //                         </div>
// //                     </div>
// //                 </div>
// //             )}

// //             {/* 2. CALIBRATION PHASES */}
// //             {(appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2") && (
// //                 <CalibrationScreen
// //                     onComplete={() => {
// //                         if (appPhase === "CALIBRATE_1") setAppPhase("TEST_GLOBAL");
// //                         if (appPhase === "CALIBRATE_2") setAppPhase("TEST_LOCAL");
// //                     }}
// //                 />
// //             )}

// //             {/* 3. TEST PHASES */}
// //             {(appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL") && (
// //                 <>
// //                     <GazeTracker
// //                         sessionActive={true}
// //                         currentQuestionId={currentQuestion?.id ?? null}
// //                         onWindowReady={handleGazeWindow}
// //                     />
// //                     <QuestionView
// //                         question={currentQuestion}
// //                         onAnswerSubmit={handleAnswerSubmit}
// //                     />
// //                 </>
// //             )}

// //             {/* 4. INTERMISSION PHASE */}
// //             {appPhase === "INTERMISSION" && (
// //                 <div style={styles.overlayContainer}>
// //                     <div style={styles.consentBox}>
// //                         <h2 style={styles.title}>Halfway There!</h2>
// //                         <p style={styles.text}>
// //                             You have successfully completed the first half of the assessment.
// //                         </p>
// //                         <div style={styles.guidelineBox}>
// //                             <p style={{ margin: "0", color: "#555", fontSize: "15px", lineHeight: "1.8" }}>
// //                                 Before we begin the second half of the questions, we need to quickly recalibrate your eye-tracker to ensure the data remains highly accurate.
// //                             </p>
// //                         </div>
// //                         <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
// //                             <button style={styles.primaryButton} onClick={() => setAppPhase("CALIBRATE_2")}>
// //                                 Start Recalibration
// //                             </button>
// //                         </div>
// //                     </div>
// //                 </div>
// //             )}

// //             {/* 5. DONE PHASE */}
// //             {appPhase === "DONE" && (
// //                 <div style={styles.overlayContainer}>
// //                     <div style={styles.consentBox}>
// //                         <h2 style={styles.title}>Session Finished</h2>
// //                         <p style={styles.text}>Below is the collected session data structure.</p>
// //                         <pre style={styles.pre}>
// //                             {JSON.stringify(finalSessionData, null, 2)}
// //                         </pre>
// //                         <div style={{ display: "flex", justifyContent: "center" }}>
// //                             <button style={styles.primaryButton} onClick={() => navigate("/course")}>
// //                                 Return to Course
// //                             </button>
// //                         </div>
// //                     </div>
// //                 </div>
// //             )}

// //         </div>
// //     );
// // }

// // const styles = {
// //     page: {
// //         minHeight: "100vh",
// //         display: "flex",
// //         alignItems: "center",
// //         justifyContent: "center",
// //         background: "#f8fafc",
// //         fontFamily: "sans-serif",
// //     },
// //     fullScreenPage: {
// //         height: "100vh",
// //         width: "100vw",
// //         margin: 0,
// //         padding: 0,
// //         overflow: "hidden",
// //         backgroundColor: "#ffffff",
// //     },
// //     overlayContainer: {
// //         position: "fixed",
// //         top: 0,
// //         left: 0,
// //         width: "100%",
// //         height: "100%",
// //         backgroundColor: "rgba(0, 0, 0, 0.55)",
// //         display: "flex",
// //         alignItems: "center",
// //         justifyContent: "center",
// //         zIndex: 9999,
// //     },
// //     consentBox: {
// //         backgroundColor: "#ffffff",
// //         width: "620px",
// //         maxWidth: "92%",
// //         borderRadius: "18px",
// //         padding: "30px",
// //         boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
// //         fontFamily: "sans-serif",
// //     },
// //     title: {
// //         marginTop: 0,
// //         marginBottom: "12px",
// //         color: "#222",
// //         fontSize: "25px",
// //         textAlign: "center",
// //     },
// //     text: {
// //         color: "#444",
// //         fontSize: "16px",
// //         lineHeight: "1.7",
// //         textAlign: "center",
// //         marginBottom: "22px",
// //     },
// //     guidelineBox: {
// //         backgroundColor: "#f4f6f8",
// //         border: "1px solid #e0e0e0",
// //         borderRadius: "12px",
// //         padding: "18px",
// //         marginBottom: "20px",
// //     },
// //     guidelineList: {
// //         margin: 0,
// //         paddingLeft: "22px",
// //         color: "#555",
// //         fontSize: "15px",
// //         lineHeight: "1.8",
// //     },
// //     primaryButton: {
// //         padding: "12px 28px",
// //         border: "none",
// //         borderRadius: "10px",
// //         backgroundColor: "#2563eb",
// //         color: "#fff",
// //         fontSize: "16px",
// //         fontWeight: "bold",
// //         cursor: "pointer",
// //         boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
// //     },
// //     pre: {
// //         background: "#0f172a",
// //         color: "#e2e8f0",
// //         padding: "16px",
// //         borderRadius: "12px",
// //         overflowX: "auto",
// //         fontSize: "12px",
// //         marginBottom: "16px",
// //         maxHeight: "300px",
// //     },
// // };


// import React, { useMemo, useState, useEffect } from "react";
// import GazeTracker from "./GazeTracker";
// import QuestionView from "./QuestionView";
// import CalibrationScreen from "../Calibration/Calibration";
// import { useNavigate } from "react-router-dom";

// // --- Math Helpers ---
// const calculateMedian = (arr) => {
//     if (arr.length === 0) return 0;
//     const sorted = [...arr].sort((a, b) => a - b);
//     const mid = Math.floor(sorted.length / 2);
//     return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
// };

// const calculateAverage = (arr) => {
//     if (arr.length === 0) return 0;
//     return arr.reduce((a, b) => a + b, 0) / arr.length;
// };

// export default function QuestionRunner() {
//     const ANSWER_BACKEND_URL = "";
//     const navigate = useNavigate();

//     const userPayload = useMemo(() => {
//         const token = localStorage.getItem("token");
//         if (!token) return null;
//         try {
//             return JSON.parse(atob(token.split(".")[1]));
//         } catch {
//             return null;
//         }
//     }, []);

//     // --- TEST ANSWERS (3 Global, 3 Local) ---
//     const ACTUAL_CORRECT_ANSWERS = [
//         "Yes", "No", "Yes", // Global Answers (IDs 1, 2, 3)
//         "Yes", "No", "Yes"  // Local Answers (IDs 4, 5, 6)
//     ];

//     const questions = useMemo(() => {
//         const generatedQuestions = [];
//         for (let i = 1; i <= 6; i++) {
//             const type = i <= 3 ? "global" : "local";
//             const isTrial = i === 1 || i === 4;
//             const mappedAnswer = ACTUAL_CORRECT_ANSWERS[i - 1] || (i % 2 === 0 ? "Yes" : "No");

//             generatedQuestions.push({
//                 id: i,
//                 type: type,
//                 isTrial: isTrial,
//                 leftImage: `/images/Question_${i}/q${i}_left.png`,
//                 rightImage: `/images/Question_${i}/q${i}_right.png`,
//                 correctAnswer: mappedAnswer,
//             });
//         }
//         return generatedQuestions;
//     }, []);

//     const [appPhase, setAppPhase] = useState("INTRO");
//     const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

//     const [answers, setAnswers] = useState({});
//     const [gazeWindows, setGazeWindows] = useState([]);
//     const [blocksSent, setBlocksSent] = useState({ global: false, local: false });

//     const [sessionStartTime, setSessionStartTime] = useState(null);
//     const [sessionEndTime, setSessionEndTime] = useState(null);

//     const totalQuestions = questions.length;
//     const currentQuestion = questions[currentQuestionIndex] || null;

//     const handleStartSession = () => {
//         setSessionStartTime(Date.now());
//         setAppPhase("CALIBRATE_1"); 
//     };

//     // SMART UPDATE FIX: Overwrite older window entries with newer/better data for the same questionId
//     const handleGazeWindow = (windowData) => {
//         setGazeWindows((prev) => {
//             const existingIndex = prev.findIndex((g) => g.questionId === windowData.questionId);
//             if (existingIndex !== -1) {
//                 const existing = prev[existingIndex];
//                 if (windowData.frameCount >= existing.frameCount) {
//                     const updated = [...prev];
//                     updated[existingIndex] = windowData;
//                     return updated;
//                 }
//                 return prev;
//             }
//             return [...prev, windowData];
//         });
//     };

//     const handleAnswerSubmit = (selectedAnswer, responseTimeMs) => {
//         const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

//         setAnswers((prev) => ({
//             ...prev,
//             [currentQuestion.id]: { selectedAnswer, isCorrect, responseTimeMs },
//         }));
        
//         if (currentQuestionIndex === 2) {
//             setAppPhase("INTERMISSION");
//             setCurrentQuestionIndex(3);
//         }
//         else if (currentQuestionIndex === totalQuestions - 1) {
//             setAppPhase("DONE");
//             setSessionEndTime(Date.now());
//         }
//         else {
//             setCurrentQuestionIndex((prev) => prev + 1);
//         }
//     };

//     const processAndSendMetrics = async (type, currentAnswers, currentGaze) => {
//         const validQuestions = questions.filter((q) => q.type === type && !q.isTrial);
//         const validIds = validQuestions.map((q) => q.id);

//         const rts = [];
//         let correctCount = 0;
//         const transitionsList = [];
//         const dwellTimesList = [];

//         validIds.forEach((id) => {
//             const ans = currentAnswers[id];
//             if (ans) {
//                 rts.push(ans.responseTimeMs);
//                 if (ans.isCorrect) correctCount++;
//             }

//             const gaze = currentGaze.find((g) => g.questionId === id);
//             if (gaze) {
//                 transitionsList.push(gaze.transitions || 0);
//                 dwellTimesList.push(gaze.totalDwellTime || 0);
//             }
//         });

//         const medianRT = calculateMedian(rts);
//         const avgTransitions = calculateAverage(transitionsList);
//         const avgDwellTime = calculateAverage(dwellTimesList);
//         const totalAccuracy = validQuestions.length > 0 ? (correctCount / validQuestions.length) * 100 : 0;

//         const payload =
//             type === "global"
//                 ? {
//                     Median_RT_Global: Number(medianRT.toFixed(2)),
//                     Avg_Transitions_Global: Number(avgTransitions.toFixed(2)),
//                     Avg_Dwell_Time_Global: Number(avgDwellTime.toFixed(2)),
//                     Total_Accuracy_Global: Number(totalAccuracy.toFixed(2)),
//                 }
//                 : {
//                     Median_RT_Local: Number(medianRT.toFixed(2)),
//                     Avg_Transitions_Local: Number(avgTransitions.toFixed(2)),
//                     Avg_Dwell_Time_Local: Number(avgDwellTime.toFixed(2)),
//                     Total_Accuracy_Local: Number(totalAccuracy.toFixed(2)),
//                 };

//         console.log(`[${type.toUpperCase()}] Ready to send block metrics:`, payload);

//         if (ANSWER_BACKEND_URL) {
//             try {
//                 await fetch(`${ANSWER_BACKEND_URL}/metrics-${type}`, {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     body: JSON.stringify({
//                         sessionId: userPayload?.id || "session-test1",
//                         ...payload,
//                     }),
//                 });
//             } catch (error) {
//                 console.error(`Failed to post ${type} metrics:`, error);
//             }
//         }
//     };

//     useEffect(() => {
//         const checkBlockCompletion = (type) => {
//             const targetQuestions = questions.filter((q) => q.type === type && !q.isTrial);
//             const targetIds = targetQuestions.map((q) => q.id);

//             const hasAllAnswers = targetIds.every((id) => answers[id] !== undefined);
//             const hasAllGaze = targetIds.every((id) => gazeWindows.find((g) => g.questionId === id) !== undefined);

//             if (hasAllAnswers && hasAllGaze && !blocksSent[type]) {
//                 setBlocksSent((prev) => ({ ...prev, [type]: true }));
//                 processAndSendMetrics(type, answers, gazeWindows);
//             }
//         };

//         checkBlockCompletion("global");
//         checkBlockCompletion("local");
//     }, [answers, gazeWindows, blocksSent, questions]);

//     const finalSessionData = {
//         sessionStartTime,
//         sessionEndTime,
//         totalQuestions,
//         answers,
//         gazeWindows,
//     };

//     const isFullScreenPhase = appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL" || appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2";

//     return (
//         <div style={isFullScreenPhase ? styles.fullScreenPage : styles.page}>

//             {/* 1. INTRO PHASE */}
//             {appPhase === "INTRO" && (
//                 <div style={styles.overlayContainer}>
//                     <div style={styles.consentBox}>
//                         <h2 style={styles.title}>Cognitive Style Assessment</h2>
//                         <p style={styles.text}>
//                             In this module, we will analyze your learning preference and cognitive style based on your interaction with visual materials.
//                         </p>
//                         <div style={styles.guidelineBox}>
//                             <p style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#333", fontSize: "16px" }}>
//                                 Please read the following guidelines carefully:
//                             </p>
//                             <ul style={styles.guidelineList}>
//                                 <li>You will be shown two images. A simple shape on the left, and a complex shape on the right.</li>
//                                 <li>Press <strong>"L"</strong> if the left shape IS hidden inside the right shape (YES).</li>
//                                 <li>Press <strong>"A"</strong> if the left shape IS NOT inside the right shape (NO).</li>
//                                 <li>Your gaze and attention behavior will be captured using your web camera. Keep your face visible.</li>
//                                 <li>Answer as quickly and accurately as possible.</li>
//                             </ul>
//                         </div>
//                         <p style={{ color: "#666", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
//                             By continuing, you acknowledge that you understand the purpose of this module.
//                         </p>
//                         <div style={{ display: "flex", justifyContent: "center" }}>
//                             <button style={styles.primaryButton} onClick={handleStartSession}>
//                                 I Understand and Continue
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             {/* 2. CALIBRATION PHASES */}
//             {(appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2") && (
//                 <CalibrationScreen
//                     onComplete={() => {
//                         if (appPhase === "CALIBRATE_1") setAppPhase("TEST_GLOBAL");
//                         if (appPhase === "CALIBRATE_2") setAppPhase("TEST_LOCAL");
//                     }}
//                 />
//             )}

//             {/* 3. TEST PHASES */}
//             {(appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL") && (
//                 <>
//                     <GazeTracker
//                         sessionActive={true}
//                         currentQuestionId={currentQuestion?.id ?? null}
//                         onWindowReady={handleGazeWindow}
//                     />
//                     <QuestionView
//                         question={currentQuestion}
//                         onAnswerSubmit={handleAnswerSubmit}
//                     />
//                 </>
//             )}

//             {/* 4. INTERMISSION PHASE */}
//             {appPhase === "INTERMISSION" && (
//                 <div style={styles.overlayContainer}>
//                     <div style={styles.consentBox}>
//                         <h2 style={styles.title}>Halfway There!</h2>
//                         <p style={styles.text}>
//                             You have successfully completed the first half of the assessment.
//                         </p>
//                         <div style={styles.guidelineBox}>
//                             <p style={{ margin: "0", color: "#555", fontSize: "15px", lineHeight: "1.8" }}>
//                                 Before we begin the second half of the questions, we need to quickly recalibrate your eye-tracker to ensure the data remains highly accurate.
//                             </p>
//                         </div>
//                         <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
//                             <button style={styles.primaryButton} onClick={() => setAppPhase("CALIBRATE_2")}>
//                                 Start Recalibration
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             {/* 5. DONE PHASE */}
//             {appPhase === "DONE" && (
//                 <div style={styles.overlayContainer}>
//                     <div style={styles.consentBox}>
//                         <h2 style={styles.title}>Session Finished</h2>
//                         <p style={styles.text}>Below is the collected session data structure.</p>
//                         <pre style={styles.pre}>
//                             {JSON.stringify(finalSessionData, null, 2)}
//                         </pre>
//                         <div style={{ display: "flex", justifyContent: "center" }}>
//                             <button style={styles.primaryButton} onClick={() => navigate("/course")}>
//                                 Return to Course
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             )}

//         </div>
//     );
// }

// const styles = {
//     page: {
//         minHeight: "100vh",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         background: "#f8fafc",
//         fontFamily: "sans-serif",
//     },
//     fullScreenPage: {
//         height: "100vh",
//         width: "100vw",
//         margin: 0,
//         padding: 0,
//         overflow: "hidden",
//         backgroundColor: "#ffffff",
//     },
//     overlayContainer: {
//         position: "fixed",
//         top: 0,
//         left: 0,
//         width: "100%",
//         height: "100%",
//         backgroundColor: "rgba(0, 0, 0, 0.55)",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         zIndex: 9999,
//     },
//     consentBox: {
//         backgroundColor: "#ffffff",
//         width: "620px",
//         maxWidth: "92%",
//         borderRadius: "18px",
//         padding: "30px",
//         boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
//         fontFamily: "sans-serif",
//     },
//     title: {
//         marginTop: 0,
//         marginBottom: "12px",
//         color: "#222",
//         fontSize: "25px",
//         textAlign: "center",
//     },
//     text: {
//         color: "#444",
//         fontSize: "16px",
//         lineHeight: "1.7",
//         textAlign: "center",
//         marginBottom: "22px",
//     },
//     guidelineBox: {
//         backgroundColor: "#f4f6f8",
//         border: "1px solid #e0e0e0",
//         borderRadius: "12px",
//         padding: "18px",
//         marginBottom: "20px",
//     },
//     guidelineList: {
//         margin: 0,
//         paddingLeft: "22px",
//         color: "#555",
//         fontSize: "15px",
//         lineHeight: "1.8",
//     },
//     primaryButton: {
//         padding: "12px 28px",
//         border: "none",
//         borderRadius: "10px",
//         backgroundColor: "#2563eb",
//         color: "#fff",
//         fontSize: "16px",
//         fontWeight: "bold",
//         cursor: "pointer",
//         boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
//     },
//     pre: {
//         background: "#0f172a",
//         color: "#e2e8f0",
//         padding: "16px",
//         borderRadius: "12px",
//         overflowX: "auto",
//         fontSize: "12px",
//         marginBottom: "16px",
//         maxHeight: "300px",
//     },
// };

import React, { useMemo, useState, useEffect } from "react";
import GazeTracker from "./GazeTracker";
import QuestionView from "./QuestionView";
import CalibrationScreen from "../Calibration/Calibration";
import { useNavigate } from "react-router-dom";

export default function QuestionRunner() {
    // Put your FastAPI endpoint here to receive the entire session payload
    const BACKEND_URL = "http://localhost:4000/cognitive-style/anaylticwholistic/savebehavioraldata";
    const navigate = useNavigate();

    const userPayload = useMemo(() => {
        const token = localStorage.getItem("token");
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split(".")[1]));
        } catch {
            return null;
        }
    }, []);

    // --- TEST ANSWERS (3 Global, 3 Local) ---
    const ACTUAL_CORRECT_ANSWERS = [
        "Yes", "No", "Yes", // Global Answers (IDs 1, 2, 3)
        "Yes", "No", "Yes"  // Local Answers (IDs 4, 5, 6)
    ];

    const questions = useMemo(() => {
        const generatedQuestions = [];
        for (let i = 1; i <= 6; i++) {
            const type = i <= 3 ? "global" : "local";
            const isTrial = i === 1 || i === 4;
            const mappedAnswer = ACTUAL_CORRECT_ANSWERS[i - 1] || (i % 2 === 0 ? "Yes" : "No");

            generatedQuestions.push({
                id: i,
                type: type,
                isTrial: isTrial,
                leftImage: `/images/Question_${i}/q${i}_left.png`,
                rightImage: `/images/Question_${i}/q${i}_right.png`,
                correctAnswer: mappedAnswer,
            });
        }
        return generatedQuestions;
    }, []);

    const [appPhase, setAppPhase] = useState("INTRO");
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const [answers, setAnswers] = useState({});
    const [gazeWindows, setGazeWindows] = useState([]);
    
    // Prevent duplicate sending
    const [dataSent, setDataSent] = useState(false);

    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [sessionEndTime, setSessionEndTime] = useState(null);

    const totalQuestions = questions.length;
    const currentQuestion = questions[currentQuestionIndex] || null;

    const handleStartSession = () => {
        setSessionStartTime(Date.now());
        setAppPhase("CALIBRATE_1"); 
    };

    // SMART UPDATE FIX: Overwrite older window entries with newer/better data for the same questionId
    const handleGazeWindow = (windowData) => {
        setGazeWindows((prev) => {
            const existingIndex = prev.findIndex((g) => g.questionId === windowData.questionId);
            if (existingIndex !== -1) {
                const existing = prev[existingIndex];
                if (windowData.frameCount >= existing.frameCount) {
                    const updated = [...prev];
                    updated[existingIndex] = windowData;
                    return updated;
                }
                return prev;
            }
            return [...prev, windowData];
        });
    };

    const handleAnswerSubmit = (selectedAnswer, responseTimeMs) => {
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

        setAnswers((prev) => ({
            ...prev,
            [currentQuestion.id]: { selectedAnswer, isCorrect, responseTimeMs },
        }));
        
        if (currentQuestionIndex === 2) {
            setAppPhase("INTERMISSION");
            setCurrentQuestionIndex(3);
        }
        else if (currentQuestionIndex === totalQuestions - 1) {
            setAppPhase("DONE");
            setSessionEndTime(Date.now());
        }
        else {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };

    const finalSessionData = {
        sessionStartTime,
        sessionEndTime,
        totalQuestions,
        answers,
        gazeWindows,
    };
// --- SEND DATA TO BACKEND WHEN SESSION IS DONE ---
    useEffect(() => {
        if (appPhase === "DONE" && sessionEndTime && !dataSent) {
            
            // 1. SET THE LOCK IMMEDIATELY (Synchronous)
            setDataSent(true); 
            
            console.log("Sending entire session data to backend:", finalSessionData);
            
            // 2. FIRE THE FETCH REQUEST
            fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalSessionData),
            })
            .then(res => res.json())
            .then(data => {
                console.log("Backend successfully processed the session:", data);
            })
            .catch(error => {
                console.error("Failed to save session data:", error);
                // Optional: Unlock it if the request fails so it can be retried
                setDataSent(false); 
            });
        }
    }, [appPhase, sessionEndTime, dataSent, finalSessionData]);

    const isFullScreenPhase = appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL" || appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2";

    return (
        <div style={isFullScreenPhase ? styles.fullScreenPage : styles.page}>

            {/* 1. INTRO PHASE */}
            {appPhase === "INTRO" && (
                <div style={styles.overlayContainer}>
                    <div style={styles.consentBox}>
                        <h2 style={styles.title}>Cognitive Style Assessment</h2>
                        <p style={styles.text}>
                            In this module, we will analyze your learning preference and cognitive style based on your interaction with visual materials.
                        </p>
                        <div style={styles.guidelineBox}>
                            <p style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#333", fontSize: "16px" }}>
                                Please read the following guidelines carefully:
                            </p>
                            <ul style={styles.guidelineList}>
                                <li>You will be shown two images. A simple shape on the left, and a complex shape on the right.</li>
                                <li>Press <strong>"L"</strong> if the left shape IS hidden inside the right shape (YES).</li>
                                <li>Press <strong>"A"</strong> if the left shape IS NOT inside the right shape (NO).</li>
                                <li>Your gaze and attention behavior will be captured using your web camera. Keep your face visible.</li>
                                <li>Answer as quickly and accurately as possible.</li>
                            </ul>
                        </div>
                        <p style={{ color: "#666", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
                            By continuing, you acknowledge that you understand the purpose of this module.
                        </p>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <button style={styles.primaryButton} onClick={handleStartSession}>
                                I Understand and Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. CALIBRATION PHASES */}
            {(appPhase === "CALIBRATE_1" || appPhase === "CALIBRATE_2") && (
                <CalibrationScreen
                    onComplete={() => {
                        if (appPhase === "CALIBRATE_1") setAppPhase("TEST_GLOBAL");
                        if (appPhase === "CALIBRATE_2") setAppPhase("TEST_LOCAL");
                    }}
                />
            )}

            {/* 3. TEST PHASES */}
            {(appPhase === "TEST_GLOBAL" || appPhase === "TEST_LOCAL") && (
                <>
                    <GazeTracker
                        sessionActive={true}
                        currentQuestionId={currentQuestion?.id ?? null}
                        onWindowReady={handleGazeWindow}
                    />
                    <QuestionView
                        question={currentQuestion}
                        onAnswerSubmit={handleAnswerSubmit}
                    />
                </>
            )}

            {/* 4. INTERMISSION PHASE */}
            {appPhase === "INTERMISSION" && (
                <div style={styles.overlayContainer}>
                    <div style={styles.consentBox}>
                        <h2 style={styles.title}>Halfway There!</h2>
                        <p style={styles.text}>
                            You have successfully completed the first half of the assessment.
                        </p>
                        <div style={styles.guidelineBox}>
                            <p style={{ margin: "0", color: "#555", fontSize: "15px", lineHeight: "1.8" }}>
                                Before we begin the second half of the questions, we need to quickly recalibrate your eye-tracker to ensure the data remains highly accurate.
                            </p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
                            <button style={styles.primaryButton} onClick={() => setAppPhase("CALIBRATE_2")}>
                                Start Recalibration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. DONE PHASE */}
            {appPhase === "DONE" && (
                <div style={styles.overlayContainer}>
                    <div style={styles.consentBox}>
                        <h2 style={styles.title}>Session Finished</h2>
                        <p style={styles.text}>Below is the collected session data structure sent to the backend.</p>
                        <pre style={styles.pre}>
                            {JSON.stringify(finalSessionData, null, 2)}
                        </pre>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <button style={styles.primaryButton} onClick={() => navigate("/course")}>
                                Return to Course
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "sans-serif",
    },
    fullScreenPage: {
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#ffffff",
    },
    overlayContainer: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    consentBox: {
        backgroundColor: "#ffffff",
        width: "620px",
        maxWidth: "92%",
        borderRadius: "18px",
        padding: "30px",
        boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
        fontFamily: "sans-serif",
    },
    title: {
        marginTop: 0,
        marginBottom: "12px",
        color: "#222",
        fontSize: "25px",
        textAlign: "center",
    },
    text: {
        color: "#444",
        fontSize: "16px",
        lineHeight: "1.7",
        textAlign: "center",
        marginBottom: "22px",
    },
    guidelineBox: {
        backgroundColor: "#f4f6f8",
        border: "1px solid #e0e0e0",
        borderRadius: "12px",
        padding: "18px",
        marginBottom: "20px",
    },
    guidelineList: {
        margin: 0,
        paddingLeft: "22px",
        color: "#555",
        fontSize: "15px",
        lineHeight: "1.8",
    },
    primaryButton: {
        padding: "12px 28px",
        border: "none",
        borderRadius: "10px",
        backgroundColor: "#2563eb",
        color: "#fff",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    },
    pre: {
        background: "#0f172a",
        color: "#e2e8f0",
        padding: "16px",
        borderRadius: "12px",
        overflowX: "auto",
        fontSize: "12px",
        marginBottom: "16px",
        maxHeight: "300px",
    },
};