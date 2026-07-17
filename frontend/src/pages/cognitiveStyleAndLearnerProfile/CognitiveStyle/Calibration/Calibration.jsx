
// import { useEffect, useState } from 'react'
// import { useNavigate } from 'react-router-dom' // <-- 1. Import useNavigate

// export default function CalibrationPage() {
//   const [status, setStatus] = useState('loading')
//   const [message, setMessage] = useState('Loading GazeCloud API...')
  
//   const navigate = useNavigate() // <-- 2. Initialize navigate

//   useEffect(() => {
//     if (window.GazeCloudAPI) {
//       setStatus('ready')
//       setMessage('API ready. Click "Begin Calibration".')
//       return
//     }
//     const script = document.createElement('script')
//     script.src = 'https://api.gazerecorder.com/GazeCloudAPI.js'
//     script.async = true
//     script.onload = () => { setStatus('ready'); setMessage('API loaded. Click "Begin Calibration".') }
//     script.onerror = () => { setStatus('error'); setMessage('Failed to load API. Check internet connection.') }
//     document.head.appendChild(script)
//   }, [])

//   const begin = () => {
//     if (!window.GazeCloudAPI) return
//     setStatus('calibrating')
//     setMessage('Follow the dots with your eyes...')
    
//     window.GazeCloudAPI.OnCalibrationComplete = () => {
//       console.log('[GazeStudy] Calibration complete!')
//       setStatus('done')
//       setMessage('Done! Proceeding to study...')
      
//       // <-- 3. Navigate to your test point / split-screen here
//       setTimeout(() => {
//         navigate('/split-screen') // Change this to whatever route you need to test
//       }, 1200)
//     }
    
//     window.GazeCloudAPI.OnCamDenied = () => {
//       setStatus('error')
//       setMessage('Camera denied. Allow access and retry.')
//     }
//     window.GazeCloudAPI.OnError = (m) => {
//       setStatus('error')
//       setMessage('Error: ' + m)
//     }
//     window.GazeCloudAPI.UseClickRecalibration = false
//     window.GazeCloudAPI.StartEyeTracking()
//   }

//   const colors = { loading:'#8b90a8', ready:'#4f8ef7', calibrating:'#f7c948', done:'#4caf82', error:'#f06a6a' }

//   return (
//     <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117' }}>
//       <div style={{ background:'#1a1d27', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'1.25rem', padding:'3rem', maxWidth:'480px', width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:'1.25rem', textAlign:'center' }}>
//         <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.1em', color: colors[status] }}>
//           {status.toUpperCase()}
//         </div>
//         <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:'#e8eaf0' }}>Eye Tracking Calibration</h2>
//         <p style={{ fontSize:'0.925rem', color:'#8b90a8', lineHeight:1.6 }}>{message}</p>
        
//         {status === 'calibrating' && (
//           <div style={{ background:'#222638', borderRadius:'0.625rem', padding:'1rem', fontSize:'0.85rem', color:'#8b90a8', width:'100%' }}>
//             <p>👁 Calibration overlay will appear — click each dot.</p>
//           </div>
//         )}
        
//         {status === 'ready' && (
//           <button onClick={begin} style={{ background:'#4f8ef7', color:'white', border:'none', borderRadius:'9999px', padding:'0.85rem 2rem', fontSize:'1rem', fontWeight:600, cursor:'pointer' }}>
//             Begin Calibration
//           </button>
//         )}
        
//         {status === 'error' && (
//           <button
//             onClick={() => { setStatus('ready'); setMessage('Click "Begin Calibration" to retry.') }}
//             style={{ background:'#f06a6a', color:'white', border:'none', borderRadius:'9999px', padding:'0.85rem 2rem', fontSize:'1rem', fontWeight:600, cursor:'pointer' }}>
//             Try Again
//           </button>
//         )}
//       </div>
//     </div>
//   )
// }

//Webgazer the free one 

// import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// const DOTS = [
//   { top: '15%', left: '15%' }, { top: '15%', left: '50%' }, { top: '15%', left: '85%' },
//   { top: '50%', left: '15%' }, { top: '50%', left: '50%' }, { top: '50%', left: '85%' },
//   { top: '85%', left: '15%' }, { top: '85%', left: '50%' }, { top: '85%', left: '85%' },
// ];

// const CLICKS_REQUIRED = 5;

// export default function CalibrationPage() {
//   const navigate = useNavigate();
//   const [status, setStatus] = useState('loading'); // loading, instructions, calibrating, done
//   const [clickCounts, setClickCounts] = useState(Array(9).fill(0));

//   useEffect(() => {
//     // 1. Load WebGazer dynamically
//     if (window.webgazer) {
//       setStatus('instructions');
//       return;
//     }

//     const script = document.createElement('script');
//     script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
//     script.async = true;
//     script.onload = () => setStatus('instructions');
//     script.onerror = () => {
//       setStatus('error');
//       console.error('Failed to load WebGazer');
//     };
//     document.head.appendChild(script);

//     return () => {
//       // Safety cleanup if they leave the page early
//       if (window.webgazer) {
//         window.webgazer.pause();
//         window.webgazer.showVideoPreview(false);
//       }
//     };
//   }, []);

//   const beginCalibration = async () => {
//     setStatus('calibrating');

//     // 2. Clear any old calibration data so the new user starts fresh
//     window.webgazer.clearData();

//     // 3. Start WebGazer and show the webcam preview
//     await window.webgazer
//       .setGazeListener(() => {}) // We don't need the coordinates during calibration
//       .begin();

//     // Show the video feed so the user can see if their face is centered
//     window.webgazer.showVideoPreview(true);
//     window.webgazer.showPredictionPoints(true);
//   };

//   const handleDotClick = (index) => {
//     setClickCounts((prev) => {
//       const newCounts = [...prev];
//       if (newCounts[index] < CLICKS_REQUIRED) {
//         newCounts[index] += 1;
//       }

//       // Check if all dots have been clicked 5 times
//       const isComplete = newCounts.every((count) => count >= CLICKS_REQUIRED);
//       if (isComplete) {
//         finishCalibration();
//       }

//       return newCounts;
//     });
//   };

//   const finishCalibration = () => {
//     setStatus('done');
    
//     // 4. Hide the webcam and red dot for the actual study
//     window.webgazer.showVideoPreview(false);
//     window.webgazer.showPredictionPoints(false);
    
//     // Keep it running in the background, just paused until the Study page mounts
//     window.webgazer.pause();

//     setTimeout(() => {
//       navigate('/split-screen'); // Change to your study route
//     }, 1500);
//   };

//   // --- Rendering UI States ---

//   if (status === 'calibrating') {
//     return (
//       <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0f1117' }}>

//       {/* ✨ ADD THIS STYLE BLOCK ✨ */}
//         <style>{`
//           #webgazerVideoContainer {
//             display: none !important;
//           }
//         `}</style>
//         {/* Instruction Banner */}
//         <div style={{ position: 'absolute', top: '20px', width: '100%', textAlign: 'center', color: '#e8eaf0', zIndex: 10 }}>
//           <h3 style={{ margin: 0 }}>Look at each dot and click it 5 times.</h3>
//           <p style={{ color: '#8b90a8', margin: '5px 0 0 0' }}>Keep your head still and follow the mouse with your eyes.</p>
//         </div>

//         {/* 9 Calibration Dots */}
//         {DOTS.map((pos, index) => {
//           const clicks = clickCounts[index];
//           const isDone = clicks >= CLICKS_REQUIRED;
          
//           // Change color from Red -> Yellow -> Green based on clicks
//           const dotColor = clicks === 0 ? '#f06a6a' : clicks < CLICKS_REQUIRED ? '#f7c948' : '#4caf82';
          
//           if (isDone) return null; // Hide the dot once it reaches 5 clicks

//           return (
//             <button
//               key={index}
//               onClick={() => handleDotClick(index)}
//               style={{
//                 position: 'absolute',
//                 top: pos.top,
//                 left: pos.left,
//                 transform: 'translate(-50%, -50%)',
//                 width: '40px',
//                 height: '40px',
//                 borderRadius: '50%',
//                 background: dotColor,
//                 border: 'none',
//                 cursor: 'pointer',
//                 color: '#fff',
//                 fontWeight: 'bold',
//                 transition: 'all 0.2s',
//                 zIndex: 100
//               }}
//             >
//               {CLICKS_REQUIRED - clicks}
//             </button>
//           );
//         })}
//       </div>
//     );
//   }

//   // Loading, Instructions, or Done UI
//   return (
//     <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
//       <div style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '3rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        
//         <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e8eaf0', marginBottom: '1rem' }}>
//           Eye Tracking Calibration
//         </h2>
        
//         {status === 'loading' && <p style={{ color: '#8b90a8' }}>Loading WebGazer API...</p>}
//         {status === 'error' && <p style={{ color: '#f06a6a' }}>Failed to load tracker. Check internet connection.</p>}
        
//         {status === 'instructions' && (
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
//             <p style={{ color: '#8b90a8', lineHeight: 1.6, margin: 0 }}>
//               To track your eyes accurately, we need to calibrate the camera. 
//               <br/><br/>
//               When you begin, 9 dots will appear. Look at each dot and <strong>click it 5 times</strong> until it disappears.
//             </p>
//             <button 
//               onClick={beginCalibration} 
//               style={{ background: '#4f8ef7', color: 'white', border: 'none', borderRadius: '9999px', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
//             >
//               Start Calibration
//             </button>
//           </div>
//         )}

//         {status === 'done' && (
//           <div style={{ color: '#4caf82', fontWeight: 600, fontSize: '1.2rem' }}>
//             ✅ Calibration Complete! Proceeding...
//           </div>
//         )}
        
//       </div>
//     </div>
//   );
// }

//This iS WORKING FINE JUST TO ENHANCE THE FLOWWWWWWWWWWWWWWWWWWWWWWWW

// import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Webcam from 'react-webcam';
// import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// const DOTS = [
//   { top: '10%', left: '10%', label: 'Top-Left' }, { top: '10%', left: '50%', label: 'Top-Center' }, { top: '10%', left: '90%', label: 'Top-Right' },
//   { top: '50%', left: '10%', label: 'Mid-Left' }, { top: '50%', left: '50%', label: 'Center' }, { top: '50%', left: '90%', label: 'Mid-Right' },
//   { top: '90%', left: '10%', label: 'Bot-Left' }, { top: '90%', left: '50%', label: 'Bot-Center' }, { top: '90%', left: '90%', label: 'Bot-Right' }
// ];

// export default function CalibrationPage() {
//   const navigate = useNavigate();
//   const webcamRef = useRef(null);
//   const faceLandmarkerRef = useRef(null);
  
//   const [status, setStatus] = useState('loading');
//   const [currentDot, setCurrentDot] = useState(0);
//   const [calibrationData, setCalibrationData] = useState([]);

//   useEffect(() => {
//     async function setupLandmarker() {
//       try {
//         const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
//         faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
//           baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
//           runningMode: "VIDEO",
//           numFaces: 1,
//         });
//         setStatus('ready');
//       } catch (err) {
//         setStatus('error');
//       }
//     }
//     setupLandmarker();
//   }, []);

//   // --- MATH HELPERS ---
//   const average = (points) => {
//     const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
//     return { x: sum.x / points.length, y: sum.y / points.length };
//   };

//   const getGazeFeatures = (landmarks) => {
//     // 1. Head Yaw (Left/Right) & Pitch (Up/Down)
//     const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
//     const topFace = landmarks[10], botFace = landmarks[152];
//     const faceW = Math.abs(rightFace.x - leftFace.x) || 1, faceH = Math.abs(botFace.y - topFace.y) || 1;
//     const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
//     const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 100;

//     // 2. Iris Offset
//     const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
//     const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
//     const leftEye = average([33, 133].map(i => landmarks[i]));
//     const rightEye = average([362, 263].map(i => landmarks[i]));
    
//     const eyeOffsetX = ((leftIris.x - leftEye.x) + (rightIris.x - rightEye.x)) / 2;
//     const eyeOffsetY = ((leftIris.y - leftEye.y) + (rightIris.y - rightEye.y)) / 2;

//     // Combine them into a single X/Y feature score
//     return {
//       gazeX: yaw + (eyeOffsetX * 50),
//       gazeY: pitch + (eyeOffsetY * 50)
//     };
//   };

//   const handleDotClick = () => {
//     const video = webcamRef.current?.video;
//     if (!video || !faceLandmarkerRef.current) return;

//     // Grab the face data the exact moment they click
//     const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
    
//     if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//       const features = getGazeFeatures(result.faceLandmarks[0]);
//       const newCalibData = [...calibrationData, features];
//       setCalibrationData(newCalibData);

//       if (currentDot < DOTS.length - 1) {
//         setCurrentDot(prev => prev + 1);
//       } else {
//         finishCalibration(newCalibData);
//       }
//     } else {
//       alert("No face detected! Please ensure you are well-lit and facing the camera.");
//     }
//   };

//   const finishCalibration = (data) => {
//     setStatus('done');
    
//     // Calculate the absolute boundaries of their eye movements
//     const allX = data.map(d => d.gazeX);
//     const allY = data.map(d => d.gazeY);
    
//     const rules = {
//       minX: Math.min(...allX),
//       maxX: Math.max(...allX),
//       minY: Math.min(...allY),
//       maxY: Math.max(...allY)
//     };

//     // Save the rules to the browser memory!
//     localStorage.setItem('customGazeRules', JSON.stringify(rules));
    
//     setTimeout(() => { navigate('/split-screen'); }, 1000);
//   };

//   return (
//     <div style={{ width: '100vw', height: '100vh', background: '#0f1117', position: 'relative' }}>
      
//       {/* Hidden Webcam - needed to capture the frames */}
//       <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: 'absolute', opacity: 0 }} />

//       {status === 'loading' && <div style={{ color: 'white', padding: 20 }}>Loading AI Models...</div>}
//       {status === 'done' && <div style={{ color: '#4caf82', padding: 20, fontSize: 24, textAlign: 'center', width: '100%', marginTop: '20%' }}>Calibration Complete!</div>}
      
//       {status === 'ready' && (
//         <>
//           <div style={{ position: 'absolute', top: 20, width: '100%', textAlign: 'center', color: '#8b90a8' }}>
//             Look directly at the red dot, then click it.
//           </div>
          
//           <button
//             onClick={handleDotClick}
//             style={{
//               position: 'absolute', top: DOTS[currentDot].top, left: DOTS[currentDot].left,
//               transform: 'translate(-50%, -50%)', width: 40, height: 40, borderRadius: '50%',
//               background: '#f06a6a', border: 'none', cursor: 'pointer', zIndex: 100
//             }}
//           />
//         </>
//       )}
//     </div>
//   );
// }

//THIS IS ALSO GOOD BUT I AM DOING SOME MORE ADJUSTMENTS
// import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Webcam from 'react-webcam';
// import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// const SEQUENCE = [
//   { top: '50%', left: '50%' }, // Center
//   { top: '15%', left: '15%' }, // Top-Left
//   { top: '15%', left: '85%' }, // Top-Right
//   { top: '85%', left: '15%' }, // Bot-Left
//   { top: '85%', left: '85%' }, // Bot-Right
// ];

// export default function CalibrationPage() {
//   const navigate = useNavigate();
//   const webcamRef = useRef(null);
//   const faceLandmarkerRef = useRef(null);
  
//   const [phase, setPhase] = useState('positioning'); // positioning, tracking, done
//   const [currentStep, setCurrentStep] = useState(0);
//   const [isCapturing, setIsCapturing] = useState(false);
//   const [calibrationData, setCalibrationData] = useState([]);

//   // 1. Load MediaPipe AI
//   useEffect(() => {
//     async function setupLandmarker() {
//       const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
//       faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
//         baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
//         runningMode: "VIDEO", numFaces: 1,
//       });
//     }
//     setupLandmarker();
//   }, []);

//   // --- MATH HELPERS ---
//   const average = (points) => {
//     const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
//     return { x: sum.x / points.length, y: sum.y / points.length };
//   };

//   const getGazeFeatures = (landmarks) => {
//     const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
//     const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
//     const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
    
//     const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
//     const leftEye = average([33, 133].map(i => landmarks[i]));
//     const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
//     const rightEye = average([362, 263].map(i => landmarks[i]));
    
//     const eyeOffsetX = ((leftIris.x - leftEye.x) + (rightIris.x - rightEye.x)) / 2;
//     return { gazeX: yaw + (eyeOffsetX * 50) };
//   };

//   // 2. The Animation & Capture Loop
//   useEffect(() => {
//     if (phase !== 'tracking') return;

//     // Step A: Wait 600ms for the dot to finish smoothly gliding to its new position
//     const glideTimer = setTimeout(() => {
      
//       // Step B: Trigger the shrinking ring animation
//       setIsCapturing(true);

//       // Step C: Wait 1500ms for the ring to shrink, then capture the face data
//       setTimeout(() => {
//         const video = webcamRef.current?.video;
//         if (video && faceLandmarkerRef.current) {
//           const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
//           if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//             const features = getGazeFeatures(result.faceLandmarks[0]);
//             setCalibrationData(prev => [...prev, features]);
//           }
//         }

//         setIsCapturing(false); // Reset animation

//         // Step D: Move to the next dot, or finish
//         if (currentStep < SEQUENCE.length - 1) {
//           setCurrentStep(prev => prev + 1);
//         } else {
//           finishCalibration();
//         }
//       }, 1500); // 1.5 seconds for the shrink animation

//     }, 600); // 0.6 seconds for the glide animation

//     return () => clearTimeout(glideTimer);
//   }, [phase, currentStep]);

//   const finishCalibration = () => {
//     setPhase('done');
//     // Calculate custom limits for your tracker here...
//     setTimeout(() => navigate('/split-screen'), 1500);
//   };

//   return (
//     <div style={{ width: '100vw', height: '100vh', background: '#808080', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      
//       {/* ✨ CSS Keyframes for the Shrinking Ring ✨ */}
//       <style>{`
//         @keyframes shrinkRing {
//           0% { transform: scale(3); opacity: 0; border-width: 2px; }
//           20% { opacity: 1; border-width: 4px; }
//           100% { transform: scale(1); opacity: 1; border-width: 8px; }
//         }
//         .target-dot {
//           transition: top 0.6s ease-in-out, left 0.6s ease-in-out;
//         }
//         .shrinking-ring {
//           animation: shrinkRing 1.5s linear forwards;
//         }
//       `}</style>

//       {/* PHASE 1: Positioning */}
//       {phase === 'positioning' && (
//         <div style={{ textAlign: 'center', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
//           <h2 style={{ margin: '0 0 1rem 0' }}>Position Your Face</h2>
//           <div style={{ width: 320, height: 240, background: '#333', borderRadius: '8px', overflow: 'hidden', position: 'relative', margin: '0 auto 1.5rem' }}>
//             <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
//             <div style={{ position: 'absolute', top: '10%', left: '25%', width: '50%', height: '80%', border: '4px dashed rgba(255,255,255,0.6)', borderRadius: '50%' }} />
//           </div>
//           <button onClick={() => setPhase('tracking')} style={{ background: '#4caf50', color: 'white', padding: '12px 32px', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
//             Start Gaze Calibration
//           </button>
//         </div>
//       )}

//       {/* PHASE 2: Animated Tracking */}
//       {phase === 'tracking' && (
//         <>
//           <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: 'absolute', opacity: 0 }} />
          
//           <h2 style={{ position: 'absolute', top: '10%', color: '#222', fontSize: '1.5rem' }}>
//             Follow the red dot with your eyes. Keep your head still!
//           </h2>
          
//           {/* The Animated Target */}
//           <div
//             className="target-dot"
//             style={{
//               position: 'absolute',
//               top: SEQUENCE[currentStep].top,
//               left: SEQUENCE[currentStep].left,
//               transform: 'translate(-50%, -50%)',
//               width: 36,
//               height: 36,
//               borderRadius: '50%',
//               background: 'red',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               boxShadow: '0 0 10px rgba(255,0,0,0.5)',
//             }}
//           >
//             {/* The Crosshair lines (like the screenshot) */}
//             <div style={{ width: '150%', height: 2, background: 'black', position: 'absolute' }} />
//             <div style={{ width: 2, height: '150%', background: 'black', position: 'absolute' }} />

//             {/* The Shrinking Ring Animation */}
//             {isCapturing && (
//               <div 
//                 className="shrinking-ring"
//                 style={{
//                   position: 'absolute',
//                   width: '100%',
//                   height: '100%',
//                   borderRadius: '50%',
//                   border: 'solid black',
//                   boxSizing: 'border-box'
//                 }} 
//               />
//             )}
//           </div>
//         </>
//       )}

//       {/* PHASE 3: Done */}
//       {phase === 'done' && (
//         <div style={{ textAlign: 'center' }}>
//           <h1 style={{ color: '#fff', fontSize: '2.5rem' }}>✅ Perfect!</h1>
//           <p style={{ color: '#eee', fontSize: '1.2rem' }}>Calibration Complete. Starting study...</p>
//         </div>
//       )}
//     </div>
//   );
// }

//??????ANIMATED ONE MORE ADJUSTMENTS NEEDED ???????????????????

// import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Webcam from 'react-webcam';
// import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// // --- SEQUENCE DEFINITIONS ---
// // Phase 2: 4x4 Grid (16 points)
// const gridStops = ['15%', '38%', '62%', '85%'];
// const IRIS_POINTS = [];
// gridStops.forEach(y => gridStops.forEach(x => IRIS_POINTS.push({ top: y, left: x })));

// // Phase 3: Head Turns (Center dot, but asks user to turn head)
// const ARROWS = [
//   { direction: 'up', symbol: '⬆️' },
//   { direction: 'down', symbol: '⬇️' },
//   { direction: 'left', symbol: '⬅️' },
//   { direction: 'right', symbol: '➡️' },
// ];

// // Phase 4: Inner Rectangle Refinement (Not extreme corners)
// const REFINE_POINTS = [
//   { top: '35%', left: '35%' }, { top: '35%', left: '65%' },
//   { top: '65%', left: '35%' }, { top: '65%', left: '65%' },
// ];

// export default function AdvancedCalibrationPage() {
//   const navigate = useNavigate();
//   const webcamRef = useRef(null);
//   const faceLandmarkerRef = useRef(null);

//   const [isModelReady, setIsModelReady] = useState(false);
//   const [phase, setPhase] = useState('positioning'); // positioning, iris, head, refine, done
//   const [step, setStep] = useState(0);
//   const [isCapturing, setIsCapturing] = useState(false);
  
//   // Phase 1 specific state
//   const [isFaceAligned, setIsFaceAligned] = useState(false);
//   const [calibrationData, setCalibrationData] = useState([]);

//   // 1. Initialize MediaPipe
//   useEffect(() => {
//     async function setup() {
//       const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
//       faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
//         baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
//         runningMode: "VIDEO", numFaces: 1,
//       });
//       setIsModelReady(true);
//     }
//     setup();
//   }, []);

//   // 2. PHASE 1 LOOP: Real-time Face Alignment Checker
//   useEffect(() => {
//     let animId;
//     const checkAlignment = () => {
//       if (phase !== 'positioning' || !isModelReady) return;

//       const video = webcamRef.current?.video;
//       if (video && video.readyState >= 2 && faceLandmarkerRef.current) {
//         const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        
//         if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//           const landmarks = result.faceLandmarks[0];
          
//           // Calculate face bounding box
//           const xs = landmarks.map(l => l.x);
//           const ys = landmarks.map(l => l.y);
//           const minX = Math.min(...xs), maxX = Math.max(...xs);
//           const minY = Math.min(...ys), maxY = Math.max(...ys);
          
//           const centerX = (minX + maxX) / 2;
//           const centerY = (minY + maxY) / 2;
//           const faceWidth = maxX - minX;

//           // Rule: Face must be centered and take up ~25-50% of the frame
//           const centered = centerX > 0.35 && centerX < 0.65 && centerY > 0.35 && centerY < 0.65;
//           const goodDistance = faceWidth > 0.25 && faceWidth < 0.55;
          
//           setIsFaceAligned(centered && goodDistance);
//         } else {
//           setIsFaceAligned(false);
//         }
//       }
//       animId = requestAnimationFrame(checkAlignment);
//     };

//     if (phase === 'positioning') checkAlignment();
//     return () => cancelAnimationFrame(animId);
//   }, [phase, isModelReady]);

//   // 3. MASTER ANIMATION & CAPTURE LOOP (Phases 2, 3, 4)
//   useEffect(() => {
//     if (phase === 'positioning' || phase === 'done') return;

//     // Adjust timing based on phase
//     let glideTime = 600;
//     let captureTime = 1200;

//     if (phase === 'head') {
//       glideTime = 200; // No movement, just switch arrows quickly
//       captureTime = 2500; // Give them time to turn their head
//     }

//     const timer = setTimeout(() => {
//       setIsCapturing(true); // Start shrinking ring

//       setTimeout(() => {
//         // Capture Data
//         const video = webcamRef.current?.video;
//         if (video && faceLandmarkerRef.current) {
//           const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
//           if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//             setCalibrationData(prev => [...prev, { phase, step, landmarks: result.faceLandmarks[0] }]);
//           }
//         }
        
//         setIsCapturing(false);

//         // State Machine Router
//         if (phase === 'iris') {
//           if (step < IRIS_POINTS.length - 1) setStep(s => s + 1);
//           else { setPhase('head'); setStep(0); }
//         } 
//         else if (phase === 'head') {
//           if (step < ARROWS.length - 1) setStep(s => s + 1);
//           else { setPhase('refine'); setStep(0); }
//         } 
//         else if (phase === 'refine') {
//           if (step < REFINE_POINTS.length - 1) setStep(s => s + 1);
//           else { setPhase('done'); }
//         }
//       }, captureTime);
//     }, glideTime);

//     return () => clearTimeout(timer);
//   }, [phase, step]);

//   // Finish routing
//   useEffect(() => {
//     if (phase === 'done') {
//       console.log("Calibration Complete. Collected datapoints:", calibrationData.length);
//       // Save your calibration rules to localStorage here based on the data
//       setTimeout(() => navigate('/split-screen'), 2000);
//     }
//   }, [phase, navigate, calibrationData]);


//   // --- STYLES ---
//   const bgColors = { positioning: '#ffffff', iris: '#808080', head: '#ffffff', refine: '#000000', done: '#0f1117' };
  
//  return (
//     <div style={{ width: '100vw', height: '100vh', background: bgColors[phase], transition: 'background 0.5s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      
//       <style>{`
//         @keyframes shrinkRing {
//           0% { transform: scale(3); opacity: 0; border-width: 2px; }
//           20% { opacity: 1; border-width: 4px; }
//           100% { transform: scale(1); opacity: 1; border-width: 8px; }
//         }
//         .dot { transition: top 0.6s ease-in-out, left 0.6s ease-in-out; }
//       `}</style>

//       {/* PHASE 1: POSITIONING CARD */}
//       {phase === 'positioning' && (
//         <div style={{ zIndex: 10, textAlign: 'center', background: '#ffffff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxWidth: '500px', width: '90%' }}>
          
//           {/* Preview Container */}
//           <div style={{ width: 340, height: 260, background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', margin: '0 auto 1.5rem' }}>
            
//             {/* ✨ 1. WEBCAM MOVED INSIDE THE PREVIEW BOX ✨ */}
//             <Webcam 
//               ref={webcamRef} 
//               audio={false} 
//               mirrored={true} 
//               style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
//             />
            
//             {/* The Dashed Scope Overlay */}
//             <div style={{ 
//               position: 'absolute', top: '10%', left: '25%', width: '50%', height: '80%', 
//               border: `4px dashed ${isFaceAligned ? '#4caf50' : 'rgba(255,255,255,0.6)'}`, 
//               borderRadius: '50%', transition: 'border-color 0.3s', pointerEvents: 'none' 
//             }} />
//           </div>
          
//           <button 
//             disabled={!isFaceAligned || !isModelReady}
//             onClick={() => setPhase('iris')} 
//             style={{ 
//               background: isFaceAligned ? '#4caf50' : '#f06a6a', 
//               color: 'white', padding: '14px 28px', border: 'none', borderRadius: '8px', 
//               fontSize: '1.1rem', fontWeight: 'bold', cursor: isFaceAligned ? 'pointer' : 'not-allowed',
//               transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 auto'
//             }}
//           >
//             {isFaceAligned ? 'Start Gaze Calibration' : 'Align face in scope...'}
//           </button>
//         </div>
//       )}

//       {/* ✨ 2. INVISIBLE WEBCAM FOR PHASES 2, 3, & 4 ✨ */}
//       {phase !== 'positioning' && (
//         <Webcam 
//           ref={webcamRef} 
//           audio={false} 
//           mirrored={true} 
//           style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
//         />
//       )}

//       {/* PHASE 2: IRIS 16-POINT GRID */}
//       {phase === 'iris' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '15%', color: '#222' }}>Follow the dots with your eyes. Do not move your head.</h2>
//           <TargetDot top={IRIS_POINTS[step].top} left={IRIS_POINTS[step].left} isCapturing={isCapturing} />
//         </>
//       )}

//       {/* PHASE 3: HEAD POSE ARROWS */}
//       {phase === 'head' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '25%', color: '#000' }}>Turn your head slightly in the direction of the arrow</h2>
//           <p style={{ position: 'absolute', top: '65%', color: '#000', fontSize: '1.2rem' }}>{step + 1} / 4</p>
          
//           <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 80, height: 80, background: 'black', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white' }}>
//             {ARROWS[step].symbol}
//           </div>
//           {isCapturing && <CaptureRing size={120} />}
//         </>
//       )}

//       {/* PHASE 4: REFINE (BLACK SCREEN) */}
//       {phase === 'refine' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '15%', color: '#666' }}>Look at the dot.</h2>
//           <TargetDot top={REFINE_POINTS[step].top} left={REFINE_POINTS[step].left} isCapturing={isCapturing} invertColors />
//         </>
//       )}

//       {/* PHASE 5: DONE */}
//       {phase === 'done' && (
//         <div style={{ textAlign: 'center', color: '#4caf82' }}>
//           <h1 style={{ fontSize: '3rem', margin: 0 }}>Calibration Complete</h1>
//           <p style={{ color: '#8b90a8', fontSize: '1.2rem' }}>Building cognitive model...</p>
//         </div>
//       )}
//     </div>
//   );
// }

// // --- SUB-COMPONENTS ---

// function TargetDot({ top, left, isCapturing, invertColors = false }) {
//   return (
//     <div className="dot" style={{ position: 'absolute', top, left, transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', background: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
//       <div style={{ width: '150%', height: 2, background: 'black', position: 'absolute' }} />
//       <div style={{ width: 2, height: '150%', background: 'black', position: 'absolute' }} />
//       {isCapturing && <CaptureRing size={36} invertColors={invertColors} />}
//     </div>
//   );
// }

// function CaptureRing({ size, invertColors }) {
//   return (
//     <div 
//       style={{ position: 'absolute', top: '50%', left: '50%', width: size, height: size, marginTop: -(size/2), marginLeft: -(size/2), borderRadius: '50%', border: `solid ${invertColors ? 'white' : 'black'}`, boxSizing: 'border-box', animation: 'shrinkRing 1.2s linear forwards', zIndex: 90 }} 
//     />
//   );
// }



//??????????????FAR MORE ADJUSTMENTS???????????????????????

// import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Webcam from 'react-webcam';
// import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// // --- CONFIGURATIONS ---

// // 1. Extreme Corners Grid (Starts at center, then snake-paths the edges 3% to 97%)
// const gridStops = ['3%', '34%', '66%', '97%'];
// const OUTWARD_GRID = [{ top: '50%', left: '50%' }]; // 1st point is Center

// gridStops.forEach((y, rowIndex) => {
//   // Snake pattern: Left-to-Right, then Right-to-Left to prevent massive diagonal jumps
//   const rowX = rowIndex % 2 === 0 ? gridStops : [...gridStops].reverse();
//   rowX.forEach(x => OUTWARD_GRID.push({ top: y, left: x }));
// });

// // 2. Head Pose Positions (Starts at center, then moves Up, Down, Left, Right)
// const ARROW_POSITIONS = [
//   { top: '50%', left: '50%', symbol: '🎯' }, // Center Start
//   { top: '25%', left: '50%', symbol: '⬆️' }, // Up
//   { top: '75%', left: '50%', symbol: '⬇️' }, // Down
//   { top: '50%', left: '25%', symbol: '⬅️' }, // Left
//   { top: '50%', left: '75%', symbol: '➡️' }, // Right
// ];

// // 3. Enlarged Inner Rectangle Refinement (Starts at center, goes in a circle)
// const REFINE_POINTS = [
//   { top: '50%', left: '50%' }, // Center Start
//   { top: '25%', left: '25%' }, { top: '25%', left: '75%' },
//   { top: '75%', left: '75%' }, { top: '75%', left: '25%' },
// ];

// export default function AdvancedCalibrationPage() {
//   const navigate = useNavigate();
//   const webcamRef = useRef(null);
//   const faceLandmarkerRef = useRef(null);

//   const [isModelReady, setIsModelReady] = useState(false);
//   const [phase, setPhase] = useState('positioning'); // positioning, iris, head, refine, done
//   const [step, setStep] = useState(0);
//   const [isCapturing, setIsCapturing] = useState(false);
  
//   const [isFaceAligned, setIsFaceAligned] = useState(false);
//   const [calibrationData, setCalibrationData] = useState([]);

//   // 1. Initialize MediaPipe
//   useEffect(() => {
//     async function setup() {
//       const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
//       faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
//         baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
//         runningMode: "VIDEO", numFaces: 1,
//       });
//       setIsModelReady(true);
//     }
//     setup();
//   }, []);

//   // 2. Real-time Scope Alignment
//   useEffect(() => {
//     let animId;
//     const checkAlignment = () => {
//       if (phase !== 'positioning' || !isModelReady) return;

//       const video = webcamRef.current?.video;
//       if (video && video.readyState >= 2 && faceLandmarkerRef.current) {
//         const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        
//         if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//           const landmarks = result.faceLandmarks[0];
//           const xs = landmarks.map(l => l.x);
//           const ys = landmarks.map(l => l.y);
//           const minX = Math.min(...xs), maxX = Math.max(...xs);
//           const minY = Math.min(...ys), maxY = Math.max(...ys);
          
//           const centerX = (minX + maxX) / 2;
//           const centerY = (minY + maxY) / 2;
//           const faceWidth = maxX - minX;

//           const centered = centerX > 0.35 && centerX < 0.65 && centerY > 0.35 && centerY < 0.65;
//           const goodDistance = faceWidth > 0.25 && faceWidth < 0.55;
          
//           setIsFaceAligned(centered && goodDistance);
//         } else {
//           setIsFaceAligned(false);
//         }
//       }
//       animId = requestAnimationFrame(checkAlignment);
//     };

//     if (phase === 'positioning') checkAlignment();
//     return () => cancelAnimationFrame(animId);
//   }, [phase, isModelReady]);

//   // 3. MASTER ANIMATION LOOP (Continuous Path)
//   useEffect(() => {
//     if (phase === 'positioning' || phase === 'done') return;

//     let glideTime = 700;
//     let captureTime = 1200;

//     if (phase === 'head') {
//       glideTime = 800; 
//       captureTime = 2000; 
//     }

//     const timer = setTimeout(() => {
//       setIsCapturing(true);

//       setTimeout(() => {
//         // Capture face landmarks
//         const video = webcamRef.current?.video;
//         if (video && faceLandmarkerRef.current) {
//           const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
//           if (result.faceLandmarks && result.faceLandmarks.length > 0) {
//             setCalibrationData(prev => [...prev, { phase, step, landmarks: result.faceLandmarks[0] }]);
//           }
//         }
        
//         setIsCapturing(false);

//         // State Machine Movement (Direct from Point to Point)
//         if (phase === 'iris') {
//           if (step < OUTWARD_GRID.length - 1) setStep(s => s + 1);
//           else { setPhase('head'); setStep(0); }
//         } 
//         else if (phase === 'head') {
//           if (step < ARROW_POSITIONS.length - 1) setStep(s => s + 1);
//           else { setPhase('refine'); setStep(0); }
//         } 
//         else if (phase === 'refine') {
//           if (step < REFINE_POINTS.length - 1) setStep(s => s + 1);
//           else { setPhase('done'); }
//         }
//       }, captureTime);
//     }, glideTime);

//     return () => clearTimeout(timer);
//   }, [phase, step]);

//   // Finish routing
//   useEffect(() => {
//     if (phase === 'done') {
//       setTimeout(() => navigate('/split-screen'), 1800);
//     }
//   }, [phase, navigate]);

//   const bgColors = { positioning: '#ffffff', iris: '#808080', head: '#ffffff', refine: '#000000', done: '#0f1117' };

//   return (
//     <div style={{ width: '100vw', height: '100vh', background: bgColors[phase], transition: 'background 0.5s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      
//       <style>{`
//         @keyframes shrinkRing {
//           0% { transform: scale(3); opacity: 0; border-width: 2px; }
//           20% { opacity: 1; border-width: 4px; }
//           100% { transform: scale(1); opacity: 1; border-width: 8px; }
//         }
//         .animated-dot { transition: top 0.7s cubic-bezier(0.4, 0, 0.2, 1), left 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
//       `}</style>

//       {/* PHASE 1: POSITIONING CARD */}
//       {phase === 'positioning' && (
//         <div style={{ zIndex: 10, textAlign: 'center', background: '#ffffff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxWidth: '500px', width: '90%' }}>
//           <div style={{ width: 340, height: 260, background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', margin: '0 auto 1.5rem' }}>
//             <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
//             <div style={{ position: 'absolute', top: '10%', left: '25%', width: '50%', height: '80%', border: `4px dashed ${isFaceAligned ? '#4caf50' : 'rgba(255,255,255,0.6)'}`, borderRadius: '50%', transition: 'border-color 0.3s', pointerEvents: 'none' }} />
//           </div>
//           <button 
//             disabled={!isFaceAligned || !isModelReady}
//             onClick={() => { setPhase('iris'); setStep(0); }} 
//             style={{ 
//               background: isFaceAligned ? '#4caf50' : '#f06a6a', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isFaceAligned ? 'pointer' : 'not-allowed', transition: 'all 0.3s', margin: '0 auto' 
//             }}
//           >
//             {isFaceAligned ? 'Start Gaze Calibration' : 'Align face in scope...'}
//           </button>
//         </div>
//       )}

//       {/* INVISIBLE WEBCAM FOR BACKGROUND TRACKING */}
//       {phase !== 'positioning' && (
//         <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
//       )}

//       {/* PHASE 2: IRIS FULL EDGE GRID */}
//       {phase === 'iris' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '8%', color: '#222', fontSize: '1.4rem' }}>Follow the dot. Keep your head still.</h2>
//           <TargetDot top={OUTWARD_GRID[step].top} left={OUTWARD_GRID[step].left} isCapturing={isCapturing} />
//         </>
//       )}

//       {/* PHASE 3: MOVING ARROWS */}
//       {phase === 'head' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '10%', color: '#000', fontSize: '1.4rem' }}>Turn your head in the direction of the moving target</h2>
          
//           <div 
//             className="animated-dot"
//             style={{ 
//               position: 'absolute', top: ARROW_POSITIONS[step].top, left: ARROW_POSITIONS[step].left, transform: 'translate(-50%, -50%)', 
//               width: 80, height: 80, background: 'black', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 100 
//             }}
//           >
//             {ARROW_POSITIONS[step].symbol}
//           </div>
//           {isCapturing && <CaptureRing top={ARROW_POSITIONS[step].top} left={ARROW_POSITIONS[step].left} size={120} />}
//         </>
//       )}

//       {/* PHASE 4: ENLARGED INNER RECTANGLE */}
//       {phase === 'refine' && (
//         <>
//           <h2 style={{ position: 'absolute', top: '10%', color: '#888', fontSize: '1.4rem' }}>Focus on the dot.</h2>
//           <TargetDot top={REFINE_POINTS[step].top} left={REFINE_POINTS[step].left} isCapturing={isCapturing} invertColors />
//         </>
//       )}

//       {/* PHASE 5: DONE */}
//       {phase === 'done' && (
//         <div style={{ textAlign: 'center', color: '#4caf82' }}>
//           <h1 style={{ fontSize: '3rem', margin: 0 }}>Calibration Complete</h1>
//           <p style={{ color: '#8b90a8', fontSize: '1.2rem' }}>Launching study...</p>
//         </div>
//       )}
//     </div>
//   );
// }

// // --- SUB-COMPONENTS ---

// function TargetDot({ top, left, isCapturing, invertColors = false }) {
//   return (
//     <div className="animated-dot" style={{ position: 'absolute', top, left, transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', background: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
//       <div style={{ width: '150%', height: 2, background: 'black', position: 'absolute' }} />
//       <div style={{ width: 2, height: '150%', background: 'black', position: 'absolute' }} />
//       {isCapturing && <CaptureRing top={top} left={left} size={36} invertColors={invertColors} />}
//     </div>
//   );
// }

// function CaptureRing({ top, left, size, invertColors }) {
//   return (
//     <div 
//       className="animated-dot"
//       style={{ 
//         position: 'absolute', top, left, transform: 'translate(-50%, -50%)', 
//         width: size, height: size, borderRadius: '50%', border: `solid ${invertColors ? 'white' : 'black'}`, boxSizing: 'border-box', animation: 'shrinkRing 1.2s linear forwards', zIndex: 90 
//       }} 
//     />
//   );
// }


import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// --- CONFIGURATIONS ---

// 1. Extreme Corners Typewriter Grid (Left to Right, jump to next row)
const gridStops = ['3%', '34%', '66%', '97%'];
const OUTWARD_GRID = [{ top: '50%', left: '50%' }]; // 1st point is Center

gridStops.forEach(y => {
  gridStops.forEach(x => OUTWARD_GRID.push({ top: y, left: x }));
});

// 2. Head Pose Positions
const ARROW_POSITIONS = [
  { top: '15%', left: '50%', symbol: '⬆️' }, // Up
  { top: '85%', left: '50%', symbol: '⬇️' }, // Down
  { top: '50%', left: '15%', symbol: '⬅️' }, // Left
  { top: '50%', left: '85%', symbol: '➡️' }, // Right
];

// 3. Enlarged Inner Rectangle Refinement
const REFINE_POINTS = [
  { top: '50%', left: '50%' }, // Center Start
  { top: '25%', left: '25%' }, { top: '25%', left: '75%' },
  { top: '75%', left: '25%' }, { top: '75%', left: '75%' },
];

export default function AdvancedCalibrationPage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);

  const [isModelReady, setIsModelReady] = useState(false);
  const [phase, setPhase] = useState('positioning'); // positioning, iris, head, refine, done
  
  const [step, setStep] = useState(0);
  const [isAtCenter, setIsAtCenter] = useState(true); // Used for arrow bounce
  const [isCapturing, setIsCapturing] = useState(false);
  
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [calibrationData, setCalibrationData] = useState([]);


    // --- MATH HELPERS ---
  const average = (points) => {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  };

  // const getGazeFeatures = (landmarks) => {

  //   const nose = landmarks[1], leftFace = landmarks[234], rightFace = landmarks[454];
  //   const topFace = landmarks[10], botFace = landmarks[152];
  //   const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
  //   const faceH = Math.abs(botFace.y - topFace.y) || 1;
    
  //   const yaw = ((nose.x - ((leftFace.x + rightFace.x) / 2)) / faceW) * 100;
  //   const pitch = ((nose.y - ((topFace.y + botFace.y) / 2)) / faceH) * 100;
    
  //   const leftIris = average([468, 469, 470, 471, 472].map(i => landmarks[i]));
  //   const leftEye = average([33, 133].map(i => landmarks[i]));
  //   const rightIris = average([473, 474, 475, 476, 477].map(i => landmarks[i]));
  //   const rightEye = average([362, 263].map(i => landmarks[i]));
    
  //   const eyeOffsetX = ((leftIris.x - leftEye.x) + (rightIris.x - rightEye.x)) / 2;
  //   const eyeOffsetY = ((leftIris.y - leftEye.y) + (rightIris.y - rightEye.y)) / 2;
    
  //   return { 
  //     gazeX: yaw + (eyeOffsetX * 50),
  //     gazeY: pitch + (eyeOffsetY * 50) 
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


  // 1. Initialize MediaPipe
  useEffect(() => {
    async function setup() {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numFaces: 1,
      });
      setIsModelReady(true);
    }
    setup();
  }, []);

  // 2. Real-time Scope Alignment
  useEffect(() => {
    let animId;
    const checkAlignment = () => {
      if (phase !== 'positioning' || !isModelReady) return;

      const video = webcamRef.current?.video;
      if (video && video.readyState >= 2 && faceLandmarkerRef.current) {
        const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const xs = landmarks.map(l => l.x);
          const ys = landmarks.map(l => l.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const faceWidth = maxX - minX;

          const centered = centerX > 0.35 && centerX < 0.65 && centerY > 0.35 && centerY < 0.65;
          const goodDistance = faceWidth > 0.25 && faceWidth < 0.55;
          
          setIsFaceAligned(centered && goodDistance);
        } else {
          setIsFaceAligned(false);
        }
      }
      animId = requestAnimationFrame(checkAlignment);
    };

    if (phase === 'positioning') checkAlignment();
    return () => cancelAnimationFrame(animId);
  }, [phase, isModelReady]);

  // 3. MASTER ANIMATION LOOP
  useEffect(() => {
    if (phase === 'positioning' || phase === 'done') return;

    let glideTime = 700;
    let captureTime = 1200;

    if (phase === 'head') {
      glideTime = 700; 
      // If returning to center, don't wait to capture. If at target, wait 2 seconds.
      captureTime = isAtCenter ? 0 : 2000; 
    }

    const timer = setTimeout(() => {
      const shouldCapture = phase !== 'head' || !isAtCenter;

      if (shouldCapture) setIsCapturing(true);

      setTimeout(() => {
        // Capture face landmarks
        if (shouldCapture) {
          const video = webcamRef.current?.video;
          if (video && faceLandmarkerRef.current) {
            const result = faceLandmarkerRef.current.detectForVideo(video, performance.now());
            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
              setCalibrationData(prev => [...prev, { phase, step, landmarks: result.faceLandmarks[0] }]);
            }
          }
        }
        
        setIsCapturing(false);

        // State Machine Routing
        if (phase === 'iris') {
          if (step < OUTWARD_GRID.length - 1) setStep(s => s + 1);
          else { setPhase('head'); setStep(0); setIsAtCenter(true); }
        } 
        else if (phase === 'head') {
          if (isAtCenter) {
            setIsAtCenter(false); // Move out to arrow target
          } else {
            setIsAtCenter(true);  // Return to center
            if (step < ARROW_POSITIONS.length - 1) {
              setStep(s => s + 1);
            } else { 
              setPhase('refine'); setStep(0); 
            }
          }
        } 
        else if (phase === 'refine') {
          if (step < REFINE_POINTS.length - 1) setStep(s => s + 1);
          else { setPhase('done'); }
        }
      }, captureTime);
    }, glideTime);

    return () => clearTimeout(timer);
  }, [phase, step, isAtCenter]);
  
// Finish routing and PROCESS DATA
  useEffect(() => {
    if (phase === 'done') {
      console.log("Processing collected datapoints:", calibrationData.length);
      
      if (calibrationData.length > 0) {
        // 1. Run all snapshots through our math algorithm
        const processedFeatures = calibrationData.map(data => getGazeFeatures(data.landmarks));
        
        // 2. Find the extreme limits (Min/Max X and Y)
        const allX = processedFeatures.map(f => f.gazeX);
        const allY = processedFeatures.map(f => f.gazeY);
        
        const rules = {
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY)
        };

        // 3. Save to localStorage so GazeTracker.jsx can use it!
        localStorage.setItem('customGazeRules', JSON.stringify(rules));
        console.log("AI Trained! Personal rules saved:", rules);
      }

      setTimeout(() => navigate('/split-screen'), 1800);
    }
  }, [phase, navigate, calibrationData]);

  const bgColors = { positioning: '#ffffff', iris: '#808080', head: '#ffffff', refine: '#000000', done: '#0f1117' };

  return (
    <div style={{ width: '100vw', height: '100vh', background: bgColors[phase], transition: 'background 0.5s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      
<style>{`
        @keyframes shrinkRing {
          0% { transform: translate(-50%, -50%) scale(3); opacity: 0; border-width: 2px; }
          20% { transform: translate(-50%, -50%) scale(2.6); opacity: 1; border-width: 4px; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; border-width: 8px; }
        }
        .animated-dot { transition: top 0.7s cubic-bezier(0.4, 0, 0.2, 1), left 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      {/* PHASE 1: POSITIONING CARD */}
      {phase === 'positioning' && (
        <div style={{ zIndex: 10, textAlign: 'center', background: '#ffffff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxWidth: '500px', width: '90%' }}>
          <div style={{ width: 340, height: 260, background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', margin: '0 auto 1.5rem' }}>
            <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: '10%', left: '25%', width: '50%', height: '80%', border: `4px dashed ${isFaceAligned ? '#4caf50' : 'rgba(255,255,255,0.6)'}`, borderRadius: '50%', transition: 'border-color 0.3s', pointerEvents: 'none' }} />
          </div>
          <button 
            disabled={!isFaceAligned || !isModelReady}
            onClick={() => { setPhase('iris'); setStep(0); }} 
            style={{ 
              background: isFaceAligned ? '#4caf50' : '#f06a6a', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isFaceAligned ? 'pointer' : 'not-allowed', transition: 'all 0.3s', margin: '0 auto' 
            }}
          >
            {isFaceAligned ? 'Start Gaze Calibration' : 'Align face in scope...'}
          </button>
        </div>
      )}

      {/* INVISIBLE WEBCAM FOR BACKGROUND TRACKING */}
      {phase !== 'positioning' && (
        <Webcam ref={webcamRef} audio={false} mirrored={true} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
      )}

      {/* PHASE 2: IRIS FULL EDGE GRID */}
      {phase === 'iris' && (
        <>
          <h2 style={{ position: 'absolute', top: '8%', color: '#222', fontSize: '1.4rem' }}>Follow the dot. Keep your head still.</h2>
          <TargetDot top={OUTWARD_GRID[step].top} left={OUTWARD_GRID[step].left} isCapturing={isCapturing} />
        </>
      )}

      {/* PHASE 3: MOVING ARROWS (Center Bounce) */}
      {phase === 'head' && (
        <>
          <h2 style={{ position: 'absolute', top: '10%', color: '#000', fontSize: '1.4rem' }}>Turn your head in the direction of the moving target</h2>
          
          <div 
            className="animated-dot"
            style={{ 
              position: 'absolute', 
              top: isAtCenter ? '50%' : ARROW_POSITIONS[step].top, 
              left: isAtCenter ? '50%' : ARROW_POSITIONS[step].left, 
              transform: 'translate(-50%, -50%)', 
              width: 80, height: 80, background: 'black', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 100 
            }}
          >
            {isAtCenter ? '🎯' : ARROW_POSITIONS[step].symbol}
            {/* Capture ring safely wrapped inside the container */}
            {isCapturing && <CaptureRing size={120} invertColors={false} />}
          </div>
        </>
      )}

      {/* PHASE 4: ENLARGED INNER RECTANGLE */}
      {phase === 'refine' && (
        <>
          <h2 style={{ position: 'absolute', top: '10%', color: '#888', fontSize: '1.4rem' }}>Focus on the dot.</h2>
          <TargetDot top={REFINE_POINTS[step].top} left={REFINE_POINTS[step].left} isCapturing={isCapturing} invertColors />
        </>
      )}

      {/* PHASE 5: DONE */}
      {phase === 'done' && (
        <div style={{ textAlign: 'center', color: '#4caf82' }}>
          <h1 style={{ fontSize: '3rem', margin: 0 }}>Calibration Complete</h1>
          <p style={{ color: '#8b90a8', fontSize: '1.2rem' }}>Launching study...</p>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function TargetDot({ top, left, isCapturing, invertColors = false }) {
  return (
    <div className="animated-dot" style={{ position: 'absolute', top, left, transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', background: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ width: '150%', height: 2, background: 'black', position: 'absolute' }} />
      <div style={{ width: 2, height: '150%', background: 'black', position: 'absolute' }} />
      {/* Capturing ring securely pinned to the center of the dot */}
      {isCapturing && <CaptureRing size={36} invertColors={invertColors} />}
    </div>
  );
}

function CaptureRing({ size, invertColors }) {
  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        // The transform: translate(-50%, -50%) is now handled safely inside the keyframes!
        width: size, 
        height: size, 
        borderRadius: '50%', 
        border: `solid ${invertColors ? 'white' : 'black'}`, 
        boxSizing: 'border-box', 
        animation: 'shrinkRing 1.2s linear forwards', 
        zIndex: 90 
      }} 
    />
  );
}