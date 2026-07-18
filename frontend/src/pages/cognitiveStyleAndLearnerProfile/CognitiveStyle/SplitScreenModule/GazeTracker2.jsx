// // import React, { useMemo, useEffect, useRef } from "react";
// // import Webcam from "react-webcam";
// // import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// // const WINDOW_MS = 5000;
// // const API_URL = "http://localhost:4000/cognitive-style/gaze/event";

// // // Tune these if needed
// // const LOOK_DIFF_THRESHOLD = 0.08; // minimum gap between left/right signals
// // const LOOK_MIN_SIGNAL = 0.04; // ignore tiny noisy signals

// // function createEmptyWindow(startTime) {
// //   return {
// //     windowStart: startTime,
// //     frameCount: 0,
// //     facePresentFrames: 0,
// //     leftFrames: 0,
// //     rightFrames: 0,
// //     centerFrames: 0,
// //     noFaceFrames: 0,

// //     eyeLookInLeftSum: 0,
// //     eyeLookInRightSum: 0,
// //     lookDiffSum: 0,
// //   };
// // }

// // function getBlendshapeScore(blendShapes, name) {
// //   const item = blendShapes.find((b) => b.categoryName === name);
// //   return item ? item.score : 0;
// // }

// // function classifyByEyeLookBlendshapes(blendShapes) {
// //   const eyeLookInLeft = getBlendshapeScore(blendShapes, "eyeLookInLeft");
// //   const eyeLookInRight = getBlendshapeScore(blendShapes, "eyeLookInRight");

// //   const maxSignal = Math.max(eyeLookInLeft, eyeLookInRight);
// //   const diff = Math.abs(eyeLookInLeft - eyeLookInRight);

// //   if (maxSignal < LOOK_MIN_SIGNAL) {
// //     return {
// //       gazeLabel: "CENTER",
// //       eyeLookInLeft,
// //       eyeLookInRight,
// //       diff,
// //     };
// //   }

// //   if (diff < LOOK_DIFF_THRESHOLD) {
// //     return {
// //       gazeLabel: "CENTER",
// //       eyeLookInLeft,
// //       eyeLookInRight,
// //       diff,
// //     };
// //   }

// //   return {
// //     gazeLabel: eyeLookInLeft > eyeLookInRight ? "LEFT" : "RIGHT",
// //     eyeLookInLeft,
// //     eyeLookInRight,
// //     diff,
// //   };
// // }

// // export default function GazeTracker() {
// //   const webcamRef = useRef(null);
// //   const faceLandmarkerRef = useRef(null);
// //   const animationRef = useRef(null);
// //   const lastVideoTimeRef = useRef(-1);
// //   const windowRef = useRef(createEmptyWindow(Date.now()));

// //   const userPayload = useMemo(() => {
// //     const token = localStorage.getItem("token");
// //     if (!token) return null;

// //     try {
// //       console.log("Decoded user payload:", JSON.parse(atob(token.split(".")[1])));
// //       return JSON.parse(atob(token.split(".")[1]));

// //     } catch {
// //       return null;
// //     }
// //   }, []);



// //   useEffect(() => {
// //     let cancelled = false;

// //     async function setupLandmarker() {
// //       try {
// //         const vision = await FilesetResolver.forVisionTasks(
// //           "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
// //         );

// //         const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
// //           baseOptions: {
// //             modelAssetPath:
// //               "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
// //             delegate: "GPU",
// //           },
// //           runningMode: "VIDEO",
// //           numFaces: 1,
// //           outputFaceBlendshapes: true,
// //           outputFacialTransformationMatrixes: false,
// //         });

// //         if (!cancelled) {
// //           faceLandmarkerRef.current = faceLandmarker;
// //           console.log("Face Landmarker ready");
// //         }
// //       } catch (error) {
// //         console.error("Failed to initialize Face Landmarker:", error);
// //       }
// //     }

// //     setupLandmarker();

// //     return () => {
// //       cancelled = true;

// //       if (faceLandmarkerRef.current) {
// //         faceLandmarkerRef.current.close();
// //         faceLandmarkerRef.current = null;
// //       }
// //     };
// //   }, []);

// //   useEffect(() => {
// //     function updateWindow(sample) {
// //       const w = windowRef.current;
// //       w.frameCount += 1;

// //       if (sample.facePresent) {
// //         w.facePresentFrames += 1;
// //       } else {
// //         w.noFaceFrames += 1;
// //         return;
// //       }

// //       w.eyeLookInLeftSum += sample.eyeLookInLeft;
// //       w.eyeLookInRightSum += sample.eyeLookInRight;
// //       w.lookDiffSum += sample.lookDiff;

// //       if (sample.gazeLabel === "LEFT") {
// //         w.leftFrames += 1;
// //       } else if (sample.gazeLabel === "RIGHT") {
// //         w.rightFrames += 1;
// //       } else {
// //         w.centerFrames += 1;
// //       }
// //     }

// //     async function flushWindow() {
// //       const now = Date.now();
// //       const w = windowRef.current;

// //       if (w.frameCount === 0) {
// //         windowRef.current = createEmptyWindow(now);
// //         return;
// //       }

// //       const dominantGaze =
// //         w.leftFrames > w.rightFrames
// //           ? "LEFT"
// //           : w.rightFrames > w.leftFrames
// //             ? "RIGHT"
// //             : "CENTER";

// //       const payload = {
// //         sessionId: userPayload?.id || "session-demo-1",
// //         windowStart: w.windowStart,
// //         windowEnd: now,
// //         frameCount: w.frameCount,
// //         facePresentRatio: Number((w.facePresentFrames / w.frameCount).toFixed(4)),

// //         lookLeftFrames: w.leftFrames,
// //         lookRightFrames: w.rightFrames,
// //         centerFrames: w.centerFrames,

// //         avgEyeLookInLeft: Number((w.eyeLookInLeftSum / w.frameCount).toFixed(6)),
// //         avgEyeLookInRight: Number((w.eyeLookInRightSum / w.frameCount).toFixed(6)),
// //         avgLookDiff: Number((w.lookDiffSum / w.frameCount).toFixed(6)),

// //         dominantGaze,
// //       };

// //       try {
// //         const response = await fetch(API_URL, {
// //           method: "POST",
// //           headers: {
// //             "Content-Type": "application/json",
// //           },
// //           body: JSON.stringify(payload),
// //         });

// //         if (!response.ok) {
// //           console.error("Failed to send gaze summary:", response.status, payload);
// //         } else {
// //           console.log("Gaze summary sent:", payload);
// //         }
// //       } catch (error) {
// //         console.error("Error sending gaze summary:", error);
// //         console.log("Fallback payload:", payload);
// //       }

// //       windowRef.current = createEmptyWindow(now);
// //     }

// //     let running = true;

// //     const loop = () => {
// //       if (!running) return;

// //       const video = webcamRef.current?.video;
// //       const landmarker = faceLandmarkerRef.current;

// //       if (
// //         landmarker &&
// //         video &&
// //         video.readyState >= 2 &&
// //         video.videoWidth > 0 &&
// //         video.videoHeight > 0
// //       ) {
// //         if (lastVideoTimeRef.current !== video.currentTime) {
// //           lastVideoTimeRef.current = video.currentTime;

// //           const result = landmarker.detectForVideo(video, performance.now());

// //           let sample = {
// //             facePresent: false,
// //             gazeLabel: "NO_FACE",
// //             eyeLookInLeft: 0,
// //             eyeLookInRight: 0,
// //             lookDiff: 0,
// //           };

// //           if (result.faceLandmarks && result.faceLandmarks.length > 0) {
// //             const blendShapes = result.faceBlendshapes?.[0]?.categories || [];
// //             const lookData = classifyByEyeLookBlendshapes(blendShapes);

// //             sample = {
// //               facePresent: true,
// //               gazeLabel: lookData.gazeLabel,
// //               eyeLookInLeft: Number(lookData.eyeLookInLeft.toFixed(6)),
// //               eyeLookInRight: Number(lookData.eyeLookInRight.toFixed(6)),
// //               lookDiff: Number(lookData.diff.toFixed(6)),
// //             };
// //           }

// //           updateWindow(sample);
// //         }
// //       }

// //       animationRef.current = requestAnimationFrame(loop);
// //     };

// //     animationRef.current = requestAnimationFrame(loop);
// //     const interval = setInterval(flushWindow, WINDOW_MS);

// //     return () => {
// //       running = false;

// //       if (animationRef.current) {
// //         cancelAnimationFrame(animationRef.current);
// //       }

// //       clearInterval(interval);
// //       flushWindow();
// //     };
// //   }, []);
// //   return (
// //     <div
// //       style={{
// //         position: "absolute",
// //         width: 1,
// //         height: 1,
// //         overflow: "hidden",
// //         opacity: 0,
// //         pointerEvents: "none",
// //       }}
// //     >
// //       <Webcam
// //         ref={webcamRef}
// //         audio={false}
// //         mirrored
// //         screenshotFormat="image/jpeg"
// //         videoConstraints={{
// //           width: 320,
// //           height: 240,
// //           facingMode: "user",
// //         }}
// //         style={{
// //           width: "1px",
// //           height: "1px",
// //           display: "block",
// //         }}
// //       />
// //     </div>
// //   );
// // }


// import React, { useMemo, useEffect, useRef } from "react";

// const BACKEND_URL = "http://localhost:4000/cognitive-style/gaze/event";
// const MAX_FRAME_GAP_MS = 100; // Ignore gaps larger than 100ms (e.g., tab switched)

// export default function GazeTracker({ sessionActive = true }) {
//   const userPayload = useMemo(() => {
//     const token = localStorage.getItem("token");
//     if (!token) return null;
//     try {
//       return JSON.parse(atob(token.split(".")[1]));
//     } catch {
//       return null;
//     }
//   }, []);

//   // Use a ref to keep a running tally without causing React re-renders 30 times a second
//   const trackerRef = useRef({
//     sessionStart: Date.now(),
//     lastFrameTime: Date.now(),
//     visualGazeTimeMs: 0,
//     textGazeTimeMs: 0,
//     firstInteractionPreference: null, // Will store "VISUAL" or "TEXT"
//   });

//   useEffect(() => {
//     if (!sessionActive || !window.GazeCloudAPI) return;

//     // Reset tracking stats when session starts
//     trackerRef.current.sessionStart = Date.now();
//     trackerRef.current.lastFrameTime = Date.now();
//     trackerRef.current.visualGazeTimeMs = 0;
//     trackerRef.current.textGazeTimeMs = 0;
//     trackerRef.current.firstInteractionPreference = null;

//     // Attach the GazeCloud listener
//     window.GazeCloudAPI.OnResult = (GazeData) => {
//       // state 0 means eyes are successfully tracked
//       if (GazeData.state !== 0) return; 

//       const now = Date.now();
//       const deltaMs = now - trackerRef.current.lastFrameTime;
//       trackerRef.current.lastFrameTime = now;

//       // Cap delta time to prevent tracking backgrounded tabs
//       if (deltaMs > MAX_FRAME_GAP_MS) return;

//       const x = GazeData.docX;
//       const y = GazeData.docY;

//       // Find which zone the eyes are currently looking at
//       const el = document.elementFromPoint(x, y);
//       if (!el) return;

//       const zoneEl = el.closest("[data-zone]");
//       const zone = zoneEl ? zoneEl.getAttribute("data-zone") : "UNKNOWN";

//       if (zone === "VISUAL" || zone === "TEXT") {
//         // 1. Tally the time
//         if (zone === "VISUAL") trackerRef.current.visualGazeTimeMs += deltaMs;
//         if (zone === "TEXT") trackerRef.current.textGazeTimeMs += deltaMs;

//         // 2. Capture First Interaction Preference
//         if (!trackerRef.current.firstInteractionPreference) {
//           trackerRef.current.firstInteractionPreference = zone;
//         }
//       }
//     };

//     // CLEANUP FUNCTION: Runs when sessionActive turns false or component unmounts
//     return () => {
//       // Detach the listener so it stops tracking
//       if (window.GazeCloudAPI) {
//         window.GazeCloudAPI.OnResult = null; 
//       }

//       const totals = trackerRef.current;
//       const finalPayload = {
//         userId: userPayload?.id || "session-demo-1",
//         totalActiveTimeMs: totals.visualGazeTimeMs + totals.textGazeTimeMs,
//         visualGazeTimeMs: totals.visualGazeTimeMs,
//         textGazeTimeMs: totals.textGazeTimeMs,
//         firstInteractionPreference: totals.firstInteractionPreference || "NONE",
//       };

//       console.log("Session complete. Sending Gaze Data:", finalPayload);

//       // Send to backend using keepalive so it works during navigation
//       fetch(BACKEND_URL, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(finalPayload),
//         keepalive: true,
//       }).catch((err) => {
//         console.error("Failed to send gaze data:", err);
//       });
//     };
//   }, [sessionActive, userPayload]);

//   // This component doesn't need to render any UI or webcams anymore
//   return null;
// }

// import React, { useMemo, useEffect, useRef } from "react";

// const BACKEND_URL = "http://localhost:4000/cognitive-style/question-runner/gaze";
// const MAX_FRAME_GAP_MS = 1000;

// export default function GazeTracker({ sessionActive = true }) {
//   const userPayload = useMemo(() => {
//     const token = localStorage.getItem("token");
//     if (!token) return null;
//     try {
//       return JSON.parse(atob(token.split(".")[1]));
//     } catch {
//       return null;
//     }
//   }, []);

//   const trackerRef = useRef({
//     sessionStart: Date.now(),
//     lastFrameTime: Date.now(),
//     visualGazeTimeMs: 0,
//     textGazeTimeMs: 0,
//     firstInteractionPreference: null,
//   });

//   useEffect(() => {
//     if (!sessionActive) return;

//     trackerRef.current.sessionStart = Date.now();
//     trackerRef.current.lastFrameTime = Date.now();
//     trackerRef.current.visualGazeTimeMs = 0;
//     trackerRef.current.textGazeTimeMs = 0;
//     trackerRef.current.firstInteractionPreference = null;

//     let isTracking = true;

//     const initWebGazer = () => {
//       if (!window.webgazer) return;

//       window.webgazer.setGazeListener((data, elapsedTime) => {
//         if (!data || !isTracking) return;

//         const now = Date.now();
//         const deltaMs = now - trackerRef.current.lastFrameTime;
//         trackerRef.current.lastFrameTime = now;

//         if (deltaMs > MAX_FRAME_GAP_MS) return;

//         const x = data.x;
//         const y = data.y;

//         const el = document.elementFromPoint(x, y);
//         if (!el) return;

//         const zoneEl = el.closest("[data-zone]");
//         const zone = zoneEl ? zoneEl.getAttribute("data-zone") : "UNKNOWN";

//         // 🚨 DEBUG LOG: Check your console! It should print "VISUAL" or "TEXT". 
//         // If it prints "UNKNOWN", your HTML elements aren't tagged correctly.
//         console.log(`[Gaze] Element: ${el.tagName} | Zone: ${zone}`);

//         if (zone === "VISUAL" || zone === "TEXT") {
//           if (zone === "VISUAL") trackerRef.current.visualGazeTimeMs += deltaMs;
//           if (zone === "TEXT") trackerRef.current.textGazeTimeMs += deltaMs;

//           if (!trackerRef.current.firstInteractionPreference) {
//             trackerRef.current.firstInteractionPreference = zone;
//           }
//         }
//       }).begin();

//       window.webgazer.showVideoPreview(false);
//       window.webgazer.showPredictionPoints(true); // Keep dot visible for testing
//     };

//     if (!window.webgazer) {
//       const script = document.createElement("script");
//       script.src = "https://webgazer.cs.brown.edu/webgazer.js";
//       script.async = true;
//       script.onload = initWebGazer;
//       document.head.appendChild(script);
//     } else {
//       window.webgazer.resume();
//       initWebGazer();
//     }

//     return () => {
//       isTracking = false;
//       if (window.webgazer) {
//         window.webgazer.pause();
//       }

//       const totals = trackerRef.current;
//       const finalPayload = {
//         userId: userPayload?.id || "session-demo-1",
//         totalActiveTimeMs: totals.visualGazeTimeMs + totals.textGazeTimeMs,
//         visualGazeTimeMs: totals.visualGazeTimeMs,
//         textGazeTimeMs: totals.textGazeTimeMs,
//         firstInteractionPreference: totals.firstInteractionPreference || "NONE",
//       };

//       console.log("Session complete. Sending Free Gaze Data:", finalPayload);

//       fetch(BACKEND_URL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(finalPayload),
//         keepalive: true,
//       }).catch((err) => console.error("Failed to send gaze data:", err));
//     };
//   }, [sessionActive, userPayload]);

//   // ✨ THE FIX: Return a style block that forces the red dot to ignore pointer events
//   return (
//     <style>{`
//       #webgazerGazeDot {
//         pointer-events: none !important; 
//       }
//     `}</style>
//   );
// }


// +++++++++++++++++++ This is working code now I am going to add animation to show where the user is looking at
// import React, { useMemo, useEffect, useRef, useState } from "react";
// import Webcam from "react-webcam";
// import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

// const BACKEND_URL = "http://localhost:4000/cognitive-style/gaze/event";

// export default function GazeTracker({ sessionActive = true }) {
//   const webcamRef = useRef(null);
//   const faceLandmarkerRef = useRef(null);
//   const animationRef = useRef(null);
  
//   const [isReady, setIsReady] = useState(false);
  
//   // Load our custom rules!
//   const rules = JSON.parse(localStorage.getItem('customGazeRules'));

//   const userPayload = useMemo(() => {
//     try { return JSON.parse(atob(localStorage.getItem("token").split(".")[1])); } 
//     catch { return null; }
//   }, []);

//   const trackerRef = useRef({
//     lastFrameTime: Date.now(),
//     visualGazeTimeMs: 0,
//     textGazeTimeMs: 0,
//     firstInteractionPreference: null,
//   });

//   // 1. Load MediaPipe
//   useEffect(() => {
//     async function setup() {
//       const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
//       faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
//         baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
//         runningMode: "VIDEO", numFaces: 1,
//       });
//       setIsReady(true);
//     }
//     setup();
//   }, []);

//   // --- MATH HELPERS (Same as calibration) ---
//   const average = (points) => {
//     const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
//     return { x: sum.x / points.length, y: sum.y / points.length };
//   };

//   const getGazeFeatures = (landmarks) => {
//     const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
//     const topFace = landmarks[10], botFace = landmarks[152];
//     const faceW = Math.abs(rightFace.x - leftFace.x) || 1, faceH = Math.abs(botFace.y - topFace.y) || 1;
//     const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
//     const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 100;

//     const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
//     const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
//     const leftEye = average([33, 133].map(i => landmarks[i]));
//     const rightEye = average([362, 263].map(i => landmarks[i]));
    
//     return {
//       gazeX: yaw + ((((leftIris.x - leftEye.x) + (rightIris.x - rightEye.x)) / 2) * 50),
//       gazeY: pitch + ((((leftIris.y - leftEye.y) + (rightIris.y - rightEye.y)) / 2) * 50)
//     };
//   };

//   // 2. The Tracking Loop
//   useEffect(() => {
//     if (!isReady || !sessionActive || !rules) return;
//     let running = true;
//     trackerRef.current.lastFrameTime = Date.now();

//     const loop = () => {
//       if (!running) return;
//       const video = webcamRef.current?.video;
      
//       if (video && video.readyState >= 2) {
//         const now = Date.now();
//         const deltaMs = now - trackerRef.current.lastFrameTime;
//         trackerRef.current.lastFrameTime = now;

//         const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        
//         if (result.faceLandmarks && result.faceLandmarks.length > 0 && deltaMs < 1000) {
//           const features = getGazeFeatures(result.faceLandmarks[0]);
          
//           // MAP THE FEATURES TO SCREEN PIXELS USING OUR RULES!
//           let screenX = ((features.gazeX - rules.minX) / (rules.maxX - rules.minX)) * window.innerWidth;
//           let screenY = ((features.gazeY - rules.minY) / (rules.maxY - rules.minY)) * window.innerHeight;

//           // ✨ THE FIX: Flip the X-axis to account for the mirrored webcam!
//           screenX = window.innerWidth - screenX;
          
//           // Constrain coordinates to the screen size
//           screenX = Math.max(0, Math.min(window.innerWidth, screenX));
//           screenY = Math.max(0, Math.min(window.innerHeight, screenY));

//           // Find what they are looking at
//           const el = document.elementFromPoint(screenX, screenY);
//           const zoneEl = el ? el.closest("[data-zone]") : null;
//           const zone = zoneEl ? zoneEl.getAttribute("data-zone") : "UNKNOWN";

//           if (zone === "VISUAL") {
//             trackerRef.current.visualGazeTimeMs += deltaMs;
//             if (!trackerRef.current.firstInteractionPreference) trackerRef.current.firstInteractionPreference = "VISUAL";
//           } else if (zone === "TEXT") {
//             trackerRef.current.textGazeTimeMs += deltaMs;
//             if (!trackerRef.current.firstInteractionPreference) trackerRef.current.firstInteractionPreference = "TEXT";
//           }
//         }
//       }
//       animationRef.current = requestAnimationFrame(loop);
//     };

//     animationRef.current = requestAnimationFrame(loop);
//     return () => { running = false; };
//   }, [isReady, sessionActive, rules]);

//   // 3. Send Data on Unmount
//   useEffect(() => {
//     return () => {
//       const totals = trackerRef.current;
//       const finalPayload = {
//         userId: userPayload?.id || "session-demo-1",
//         totalActiveTimeMs: totals.visualGazeTimeMs + totals.textGazeTimeMs,
//         visualGazeTimeMs: totals.visualGazeTimeMs,
//         textGazeTimeMs: totals.textGazeTimeMs,
//         firstInteractionPreference: totals.firstInteractionPreference || "NONE",
//       };

//       console.log("Sending Custom Gaze Data:", finalPayload);
//       fetch(BACKEND_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalPayload), keepalive: true });
//     };
//   }, [userPayload]);

//   return <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: "absolute", opacity: 0 }} />;
// }


import React, { useMemo, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const BACKEND_URL = "http://localhost:4000/cognitive-style/gaze/event";

export default function GazeTracker({ sessionActive = true }) {
  const webcamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationRef = useRef(null);
  
  // 1. ADDED: A ref to directly manipulate the circle's position for high performance
  const gazeCircleRef = useRef(null);
  
  const [isReady, setIsReady] = useState(false);
  
  const rules = JSON.parse(localStorage.getItem('customGazeRules'));

  const userPayload = useMemo(() => {
    try { return JSON.parse(atob(localStorage.getItem("token").split(".")[1])); } 
    catch { return null; }
  }, []);

  const trackerRef = useRef({
    lastFrameTime: Date.now(),
    visualGazeTimeMs: 0,
    textGazeTimeMs: 0,
    firstInteractionPreference: null,
  });

  useEffect(() => {
    async function setup() {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numFaces: 1,
      });
      setIsReady(true);
    }
    setup();
  }, []);

  const average = (points) => {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  };

  // const getGazeFeatures = (landmarks) => {
  //   const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
  //   const topFace = landmarks[10], botFace = landmarks[152];
  //   const faceW = Math.abs(rightFace.x - leftFace.x) || 1, faceH = Math.abs(botFace.y - topFace.y) || 1;
  //   const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
  //   const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 100;

  //   const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
  //   const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
  //   const leftEye = average([33, 133].map(i => landmarks[i]));
  //   const rightEye = average([362, 263].map(i => landmarks[i]));
    
  //   return {
  //     gazeX: yaw + ((((leftIris.x - leftEye.x) + (rightIris.x - rightEye.x)) / 2) * 50),
  //     gazeY: pitch + ((((leftIris.y - leftEye.y) + (rightIris.y - rightEye.y)) / 2) * 50)
  //   };
  // };

  // const getGazeFeatures = (landmarks) => {
  //   // 1. Head Pose (Yaw & Pitch)
  //   const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
  //   const topFace = landmarks[10], botFace = landmarks[152];
    
  //   const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
  //   const faceH = Math.abs(botFace.y - topFace.y) || 1;
    
  //   const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
  //   const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 100;
    
  //   // 2. Iris Centers
  //   const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
  //   const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
    
  //   // 3. Eye Centers
  //   const leftEye = average([33, 133].map(i => landmarks[i]));
  //   const rightEye = average([362, 263].map(i => landmarks[i]));

  //   // 4. NEW: Calculate the physical boundaries of the eyes
  //   // Landmarks 33/133 & 362/263 are inner/outer eye corners. 145/159 & 374/386 are top/bottom eyelids.
  //   const leftEyeWidth = Math.abs(landmarks[133].x - landmarks[33].x) || 0.01;
  //   const rightEyeWidth = Math.abs(landmarks[263].x - landmarks[362].x) || 0.01;
    
  //   const leftEyeHeight = Math.abs(landmarks[145].y - landmarks[159].y) || 0.01;
  //   const rightEyeHeight = Math.abs(landmarks[374].y - landmarks[386].y) || 0.01;

  //   // 5. NEW: Normalize the Iris offset relative to the eye size
  //   // This gives us a much larger, usable ratio (usually between -0.4 and +0.4)
  //   const leftIrisOffsetX = (leftIris.x - leftEye.x) / leftEyeWidth;
  //   const rightIrisOffsetX = (rightIris.x - rightEye.x) / rightEyeWidth;
  //   const avgIrisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;

  //   const leftIrisOffsetY = (leftIris.y - leftEye.y) / leftEyeHeight;
  //   const rightIrisOffsetY = (rightIris.y - rightEye.y) / rightEyeHeight;
  //   const avgIrisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;
    
  //   // 6. Combine Head movement + Amplified Eye movement
  //   // By multiplying the eye ratio by 150, pure eye movement overrides head movement.
  //   return { 
  //     gazeX: yaw + (avgIrisOffsetX * 150),
  //     gazeY: pitch + (avgIrisOffsetY * 150) 
  //   };
  // };

  // const getGazeFeatures = (landmarks) => {
  //   // 1. Head Pose (Yaw & Pitch)
  //   const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
  //   const topFace = landmarks[10], botFace = landmarks[152];
    
  //   const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
  //   const faceH = Math.abs(botFace.y - topFace.y) || 1;
    
  //   // Tweak: Lowered head movement influence from 100 to 80 so eyes dominate more
  //   const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 80;
  //   const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 80;
    
  //   // 2. Iris Centers
  //   const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
  //   const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
    
  //   // 3. Eye Centers
  //   const leftEye = average([33, 133].map(i => landmarks[i]));
  //   const rightEye = average([362, 263].map(i => landmarks[i]));

  //   // 4. Calculate physical eye boundaries
  //   const leftEyeWidth = Math.abs(landmarks[133].x - landmarks[33].x) || 0.01;
  //   const rightEyeWidth = Math.abs(landmarks[263].x - landmarks[362].x) || 0.01;
    
  //   const leftEyeHeight = Math.abs(landmarks[145].y - landmarks[159].y) || 0.01;
  //   const rightEyeHeight = Math.abs(landmarks[374].y - landmarks[386].y) || 0.01;

  //   // 5. Normalize and CLAMP the Iris offset
  //   // Clamping to -0.4 and 0.4 prevents the dot from flying off-screen if MediaPipe glitches during a blink
  //   const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    
  //   const leftIrisOffsetX = clamp((leftIris.x - leftEye.x) / leftEyeWidth, -0.4, 0.4);
  //   const rightIrisOffsetX = clamp((rightIris.x - rightEye.x) / rightEyeWidth, -0.4, 0.4);
  //   const avgIrisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;

  //   const leftIrisOffsetY = clamp((leftIris.y - leftEye.y) / leftEyeHeight, -0.4, 0.4);
  //   const rightIrisOffsetY = clamp((rightIris.y - rightEye.y) / rightEyeHeight, -0.4, 0.4);
  //   const avgIrisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;
    
  //   // 6. Exponential Edge Boosting
  //   // This curve keeps small eye movements smooth in the center, 
  //   // but aggressively accelerates the cursor when you look hard to the edges.
  //   const boostCurve = (val) => Math.sign(val) * Math.pow(Math.abs(val), 1.2);

  //   // 7. Final Sensitivity Multipliers
  //   // TWEAK THESE: Increase to 300 if it's too hard to reach the edges, decrease to 150 if it's too wild.
  //   const eyeSensitivityX = 240; 
  //   const eyeSensitivityY = 240; 

  //   return { 
  //     gazeX: yaw + (boostCurve(avgIrisOffsetX) * eyeSensitivityX),
  //     gazeY: pitch + (boostCurve(avgIrisOffsetY) * eyeSensitivityY) 
  //   };
  // };

  const getGazeFeatures = (landmarks) => {
    // 1. Head Pose (Yaw & Pitch)
    const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
    const topFace = landmarks[10], botFace = landmarks[152];
    
    const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
    const faceH = Math.abs(botFace.y - topFace.y) || 1;
    
    const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 80;
    const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 80;
    
    // 2. Iris Centers
    const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
    const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
    
    // 3. FIX: True Vertical Eye Centers
    // The corners of the eyes (33/133) don't represent the true vertical middle.
    // We now use the top eyelids (159/386) and bottom eyelids (145/374) to find the exact Y-center.
    const leftEye = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[159].y + landmarks[145].y) / 2
    };
    const rightEye = {
      x: (landmarks[362].x + landmarks[263].x) / 2,
      y: (landmarks[386].y + landmarks[374].y) / 2
    };

    // 4. Calculate physical eye boundaries
    const leftEyeWidth = Math.abs(landmarks[133].x - landmarks[33].x) || 0.01;
    const rightEyeWidth = Math.abs(landmarks[263].x - landmarks[362].x) || 0.01;
    
    const leftEyeHeight = Math.abs(landmarks[145].y - landmarks[159].y) || 0.01;
    const rightEyeHeight = Math.abs(landmarks[374].y - landmarks[386].y) || 0.01;

    // 5. Normalize and CLAMP the Iris offset
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    
    const leftIrisOffsetX = clamp((leftIris.x - leftEye.x) / leftEyeWidth, -0.4, 0.4);
    const rightIrisOffsetX = clamp((rightIris.x - rightEye.x) / rightEyeWidth, -0.4, 0.4);
    const avgIrisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;

    const leftIrisOffsetY = clamp((leftIris.y - leftEye.y) / leftEyeHeight, -0.4, 0.4);
    const rightIrisOffsetY = clamp((rightIris.y - rightEye.y) / rightEyeHeight, -0.4, 0.4);
    const avgIrisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;
    
    // 6. Exponential Edge Boosting
    const boostCurve = (val) => Math.sign(val) * Math.pow(Math.abs(val), 1.2);

    const eyeSensitivityX = 240; 
    const eyeSensitivityY = 240; 

    // 7. FIX: Webcam Angle Compensation
    // Pushes the resting tracking point lower to account for the webcam looking down at you.
    // TWEAK THIS: If the dot is still too high, increase this to 25 or 30. 
    // If it overcorrects and points too low, drop it to 5 or 10.
    const verticalOffset = 15; 

    return { 
      gazeX: yaw + (boostCurve(avgIrisOffsetX) * eyeSensitivityX),
      gazeY: pitch + (boostCurve(avgIrisOffsetY) * eyeSensitivityY) + verticalOffset
    };
  };
  useEffect(() => {
    if (!isReady || !sessionActive || !rules) return;
    let running = true;
    trackerRef.current.lastFrameTime = Date.now();

    const loop = () => {
      if (!running) return;
      const video = webcamRef.current?.video;
      
      if (video && video.readyState >= 2) {
        const now = Date.now();
        const deltaMs = now - trackerRef.current.lastFrameTime;
        trackerRef.current.lastFrameTime = now;

        const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0 && deltaMs < 1000) {
          const features = getGazeFeatures(result.faceLandmarks[0]);
          
          let screenX = ((features.gazeX - rules.minX) / (rules.maxX - rules.minX)) * window.innerWidth;
          let screenY = ((features.gazeY - rules.minY) / (rules.maxY - rules.minY)) * window.innerHeight;

          screenX = window.innerWidth - screenX;
          
          screenX = Math.max(0, Math.min(window.innerWidth, screenX));
          screenY = Math.max(0, Math.min(window.innerHeight, screenY));

          // 2. ADDED: Update the circle's position directly on the DOM
          if (gazeCircleRef.current) {
            // Subtract half the width/height (15px) to center the dot exactly on the coordinate
            gazeCircleRef.current.style.transform = `translate(${screenX - 15}px, ${screenY - 15}px)`;
            gazeCircleRef.current.style.opacity = "1"; // Ensure it becomes visible once tracking starts
          }

          const el = document.elementFromPoint(screenX, screenY);
          const zoneEl = el ? el.closest("[data-zone]") : null;
          const zone = zoneEl ? zoneEl.getAttribute("data-zone") : "UNKNOWN";

          if (zone === "VISUAL") {
            trackerRef.current.visualGazeTimeMs += deltaMs;
            if (!trackerRef.current.firstInteractionPreference) trackerRef.current.firstInteractionPreference = "VISUAL";
          } else if (zone === "TEXT") {
            trackerRef.current.textGazeTimeMs += deltaMs;
            if (!trackerRef.current.firstInteractionPreference) trackerRef.current.firstInteractionPreference = "TEXT";
          }
        }
      }
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => { running = false; };
  }, [isReady, sessionActive, rules]);

  useEffect(() => {
    return () => {
      const totals = trackerRef.current;
      const finalPayload = {
        userId: userPayload?.id || "session-demo-1",
        totalActiveTimeMs: totals.visualGazeTimeMs + totals.textGazeTimeMs,
        visualGazeTimeMs: totals.visualGazeTimeMs,
        textGazeTimeMs: totals.textGazeTimeMs,
        firstInteractionPreference: totals.firstInteractionPreference || "NONE",
      };

      console.log("Sending Custom Gaze Data:", finalPayload);
      fetch(BACKEND_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalPayload), keepalive: true });
    };
  }, [userPayload]);

  return (
    <>
      <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: "absolute", opacity: 0 }} />
      
      {/* 3. ADDED: The Visual Gaze Circle */}
      <div 
        ref={gazeCircleRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          backgroundColor: "rgba(255, 0, 0, 0.4)",
          border: "2px solid red",
          zIndex: 9999,
          opacity: 0, // Hidden until the first tracking frame
          pointerEvents: "none", // CRUCIAL
          transition: "transform 0.05s linear", // Adds a slight smoothing effect to the micro-jitters
          boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)"
        }}
      />
    </>
  );
}