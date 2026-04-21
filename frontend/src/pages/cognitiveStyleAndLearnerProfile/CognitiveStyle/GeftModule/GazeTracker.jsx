import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const BACKEND_URL = "http://localhost:4000/cognitive-style/question-runner/gaze"; // keep empty for now

export default function GazeTracker({
  sessionActive = false,
  currentQuestionId = null,
  onWindowReady = () => {},
}) {
  const webcamRef = useRef(null);
  const questionIdRef = useRef(currentQuestionId);
  const animationRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);


  useEffect(() => {
  questionIdRef.current = currentQuestionId;
}, [currentQuestionId]);

  const frameBufferRef = useRef([]);
  const lastBlinkStateRef = useRef(false);

  const sessionIdRef = useRef(`session-test1`);
  const prevEyeOffsetRef = useRef({ x: 0, y: 0 });

  const [isModelReady, setIsModelReady] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({
    facePresent: false,
    gazeDirection: "UNKNOWN",
    yaw: 0,
    pitch: 0,
    eyeOffsetX: 0,
    eyeOffsetY: 0,
    avgEyeOpenness: 0,
    gazeConfidence: 0,
    blinkDetected: false,
    eyeMovementMagnitude: 0,
  });

  const [lastPostedWindow, setLastPostedWindow] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function setupLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });

        if (!cancelled) {
          faceLandmarkerRef.current = faceLandmarker;
          setIsModelReady(true);
          console.log("Face Landmarker ready");
        }
      } catch (error) {
        console.error("Failed to initialize Face Landmarker:", error);
      }
    }

    setupLandmarker();

    return () => {
      cancelled = true;
    };
  }, []);

  function average(points) {
    if (!points || points.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    const sum = points.reduce(
      (acc, p) => ({
        x: acc.x + p.x,
        y: acc.y + p.y,
        z: acc.z + (p.z || 0),
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length,
    };
  }

  function estimateHeadPose(landmarks) {
    const noseTip = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    if (!noseTip || !leftFace || !rightFace || !forehead || !chin) {
      return { yaw: 0, pitch: 0 };
    }

    const faceCenterX = (leftFace.x + rightFace.x) / 2;
    const faceCenterY = (forehead.y + chin.y) / 2;

    const faceWidth = Math.abs(rightFace.x - leftFace.x) || 1e-6;
    const faceHeight = Math.abs(chin.y - forehead.y) || 1e-6;

    const yaw = ((noseTip.x - faceCenterX) / faceWidth) * 120;
    const pitch = ((noseTip.y - faceCenterY) / faceHeight) * 120;

    return { yaw, pitch };
  }

  function estimateEyeOpenness(landmarks) {
    const leftUpper = landmarks[159];
    const leftLower = landmarks[145];
    const leftOuter = landmarks[33];
    const leftInner = landmarks[133];

    const rightUpper = landmarks[386];
    const rightLower = landmarks[374];
    const rightOuter = landmarks[362];
    const rightInner = landmarks[263];

    if (
      !leftUpper ||
      !leftLower ||
      !leftOuter ||
      !leftInner ||
      !rightUpper ||
      !rightLower ||
      !rightOuter ||
      !rightInner
    ) {
      return {
        leftEyeOpenness: 0,
        rightEyeOpenness: 0,
        avgEyeOpenness: 0,
      };
    }

    const leftHeight = Math.abs(leftLower.y - leftUpper.y);
    const rightHeight = Math.abs(rightLower.y - rightUpper.y);

    const leftWidth = Math.abs(leftInner.x - leftOuter.x) || 1e-6;
    const rightWidth = Math.abs(rightInner.x - rightOuter.x) || 1e-6;

    const leftEyeOpenness = leftHeight / leftWidth;
    const rightEyeOpenness = rightHeight / rightWidth;
    const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;

    return {
      leftEyeOpenness: Number(leftEyeOpenness.toFixed(4)),
      rightEyeOpenness: Number(rightEyeOpenness.toFixed(4)),
      avgEyeOpenness: Number(avgEyeOpenness.toFixed(4)),
    };
  }

  function estimateEyeOffsets(landmarks) {
    const leftIris = [468, 469, 470, 471, 472]
      .map((i) => landmarks[i])
      .filter(Boolean);
    const rightIris = [473, 474, 475, 476, 477]
      .map((i) => landmarks[i])
      .filter(Boolean);

    const leftEyeCorners = [33, 133].map((i) => landmarks[i]).filter(Boolean);
    const rightEyeCorners = [362, 263].map((i) => landmarks[i]).filter(Boolean);

    const leftUpperLower = [159, 145].map((i) => landmarks[i]).filter(Boolean);
    const rightUpperLower = [386, 374].map((i) => landmarks[i]).filter(Boolean);

    if (
      leftIris.length === 0 ||
      rightIris.length === 0 ||
      leftEyeCorners.length < 2 ||
      rightEyeCorners.length < 2 ||
      leftUpperLower.length < 2 ||
      rightUpperLower.length < 2
    ) {
      return {
        eyeOffsetX: 0,
        eyeOffsetY: 0,
      };
    }

    const leftIrisCenter = average(leftIris);
    const rightIrisCenter = average(rightIris);

    const leftEyeCenter = average(leftEyeCorners);
    const rightEyeCenter = average(rightEyeCorners);

    const leftEyeWidth =
      Math.abs(leftEyeCorners[1].x - leftEyeCorners[0].x) || 1e-6;
    const rightEyeWidth =
      Math.abs(rightEyeCorners[1].x - rightEyeCorners[0].x) || 1e-6;

    const leftEyeHeight =
      Math.abs(leftUpperLower[1].y - leftUpperLower[0].y) || 1e-6;
    const rightEyeHeight =
      Math.abs(rightUpperLower[1].y - rightUpperLower[0].y) || 1e-6;

    const leftOffsetX = (leftIrisCenter.x - leftEyeCenter.x) / leftEyeWidth;
    const rightOffsetX =
      (rightIrisCenter.x - rightEyeCenter.x) / rightEyeWidth;

    const leftOffsetY =
      (leftIrisCenter.y - average(leftUpperLower).y) / leftEyeHeight;
    const rightOffsetY =
      (rightIrisCenter.y - average(rightUpperLower).y) / rightEyeHeight;

    return {
      eyeOffsetX: Number((((leftOffsetX + rightOffsetX) / 2)).toFixed(4)),
      eyeOffsetY: Number((((leftOffsetY + rightOffsetY) / 2)).toFixed(4)),
    };
  }

  function classifyGaze(yaw, pitch, eyeOffsetX, eyeOffsetY) {
    const horizontal = yaw + eyeOffsetX * 40;
    const vertical = pitch + eyeOffsetY * 40;

    if (horizontal < -12) return "LEFT";
    if (horizontal > 12) return "RIGHT";
    if (vertical < -10) return "UP";
    if (vertical > 10) return "DOWN";
    return "CENTER";
  }

  function computeGazeConfidence(eyeOffsetX, eyeOffsetY) {
    return Math.max(
      0,
      Math.min(
        1,
        1 - (Math.abs(eyeOffsetX) * 0.8 + Math.abs(eyeOffsetY) * 0.8) / 2
      )
    );
  }

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function std(values) {
    if (!values.length) return 0;
    const m = mean(values);
    const variance =
      values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
    return Math.sqrt(variance);
  }

  function countDirectionChanges(directions) {
    if (!directions.length) return 0;

    let changes = 0;
    for (let i = 1; i < directions.length; i++) {
      if (directions[i] !== directions[i - 1]) {
        changes += 1;
      }
    }
    return changes;
  }

  async function flushWindowToBackend() {
    const frames = frameBufferRef.current;

    if (!frames.length) return;

    const totalFrames = frames.length;
    const durationMs =
      frames[frames.length - 1].timestamp - frames[0].timestamp || 1;

    const presentFrames = frames.filter((f) => f.facePresent);
    const centerFrames = frames.filter((f) => f.gazeDirection === "CENTER");
    const eyesOpenFrames = frames.filter((f) => f.avgEyeOpenness > 0.18);

    const yaws = presentFrames.map((f) => f.yaw);
    const pitches = presentFrames.map((f) => f.pitch);
    const eyeOffsetXs = presentFrames.map((f) => f.eyeOffsetX);
    const eyeOffsetYs = presentFrames.map((f) => f.eyeOffsetY);
    const eyeOpenness = presentFrames.map((f) => f.avgEyeOpenness);
    const gazeConfidenceVals = presentFrames.map((f) => f.gazeConfidence);
    const eyeMovementVals = presentFrames.map((f) => f.eyeMovementMagnitude);

    const blinkCount = frames.filter((f) => f.blinkStart === true).length;

    const windowPayload = {
      sessionId: sessionIdRef.current,
      questionId: questionIdRef.current,
      windowStartTs: frames[0].timestamp,
      windowEndTs: frames[frames.length - 1].timestamp,
      durationMs,
      frameCount: totalFrames,

      facePresentRatio: Number((presentFrames.length / totalFrames).toFixed(4)),
      centerRatio: Number((centerFrames.length / totalFrames).toFixed(4)),
      eyesOpenRatio: Number((eyesOpenFrames.length / totalFrames).toFixed(4)),

      yawMean: Number(mean(yaws).toFixed(4)),
      yawStd: Number(std(yaws).toFixed(4)),

      pitchMean: Number(mean(pitches).toFixed(4)),
      pitchStd: Number(std(pitches).toFixed(4)),

      eyeOffsetXMean: Number(mean(eyeOffsetXs).toFixed(4)),
      eyeOffsetXStd: Number(std(eyeOffsetXs).toFixed(4)),

      eyeOffsetYMean: Number(mean(eyeOffsetYs).toFixed(4)),
      eyeOffsetYStd: Number(std(eyeOffsetYs).toFixed(4)),

      avgEyeOpennessMean: Number(mean(eyeOpenness).toFixed(4)),
      avgEyeOpennessStd: Number(std(eyeOpenness).toFixed(4)),

      gazeConfidenceMean: Number(mean(gazeConfidenceVals).toFixed(4)),

      eyeMovementMagnitudeMean: Number(mean(eyeMovementVals).toFixed(4)),
      eyeMovementMagnitudeStd: Number(std(eyeMovementVals).toFixed(4)),

      blinkCount,
      blinkRatePerMin: Number(((blinkCount * 60000) / durationMs).toFixed(4)),

      directionChangeCount: countDirectionChanges(
        frames.map((f) => f.gazeDirection)
      ),

      attentionScore: Number(
        (
          0.35 * (presentFrames.length / totalFrames) +
          0.35 * (centerFrames.length / totalFrames) +
          0.2 * mean(gazeConfidenceVals) +
          0.1 * (1 - Math.min(mean(eyeMovementVals) * 5, 1))
        ).toFixed(4)
      ),
    };

    setLastPostedWindow(windowPayload);
    onWindowReady(windowPayload);

    if (BACKEND_URL) {
      try {
        await fetch(BACKEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(windowPayload),
        });
        console.log("Posted 5s gaze window:", windowPayload);
      } catch (error) {
        console.error("Failed to POST gaze window:", error);
      }
    } else {
      console.log("BACKEND_URL is empty. Gaze window not posted.", windowPayload);
    }

    frameBufferRef.current = [];
  }

  useEffect(() => {
    if (!isModelReady || !sessionActive) return;

    const interval = setInterval(() => {
      flushWindowToBackend();
    }, 5000);

    return () => clearInterval(interval);
  }, [isModelReady, sessionActive, currentQuestionId]);

  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      const video = webcamRef.current?.video;
      const faceLandmarker = faceLandmarkerRef.current;

      if (
        sessionActive &&
        isModelReady &&
        faceLandmarker &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const nowMs = performance.now();

        if (lastVideoTimeRef.current !== video.currentTime) {
          lastVideoTimeRef.current = video.currentTime;

          const result = faceLandmarker.detectForVideo(video, nowMs);

          let payload = {
            timestamp: Date.now(),
            questionId: questionIdRef.current,
            facePresent: false,
            yaw: 0,
            pitch: 0,
            eyeOffsetX: 0,
            eyeOffsetY: 0,
            avgEyeOpenness: 0,
            blinkDetected: false,
            blinkStart: false,
            gazeConfidence: 0,
            gazeDirection: "AWAY",
            eyeMovementMagnitude: 0,
          };

          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];

            const { yaw, pitch } = estimateHeadPose(landmarks);
            const { eyeOffsetX, eyeOffsetY } = estimateEyeOffsets(landmarks);
            const { avgEyeOpenness } = estimateEyeOpenness(landmarks);

            const gazeDirection = classifyGaze(
              yaw,
              pitch,
              eyeOffsetX,
              eyeOffsetY
            );

            const blinkDetected = avgEyeOpenness < 0.18;
            const blinkStart = blinkDetected && !lastBlinkStateRef.current;
            lastBlinkStateRef.current = blinkDetected;

            const gazeConfidence = computeGazeConfidence(
              eyeOffsetX,
              eyeOffsetY
            );

            const eyeMovementMagnitude = Math.sqrt(
              Math.pow(eyeOffsetX - prevEyeOffsetRef.current.x, 2) +
                Math.pow(eyeOffsetY - prevEyeOffsetRef.current.y, 2)
            );

            prevEyeOffsetRef.current = {
              x: eyeOffsetX,
              y: eyeOffsetY,
            };

            payload = {
              timestamp: Date.now(),
              questionId: questionIdRef.current,
              facePresent: true,
              yaw: Number(yaw.toFixed(2)),
              pitch: Number(pitch.toFixed(2)),
              eyeOffsetX,
              eyeOffsetY,
              avgEyeOpenness,
              blinkDetected,
              blinkStart,
              gazeConfidence: Number(gazeConfidence.toFixed(3)),
              gazeDirection,
              eyeMovementMagnitude: Number(eyeMovementMagnitude.toFixed(4)),
            };
          } else {
            lastBlinkStateRef.current = false;
          }

          frameBufferRef.current.push(payload);

          setLiveMetrics({
            facePresent: payload.facePresent,
            gazeDirection: payload.gazeDirection,
            yaw: payload.yaw,
            pitch: payload.pitch,
            eyeOffsetX: payload.eyeOffsetX,
            eyeOffsetY: payload.eyeOffsetY,
            avgEyeOpenness: payload.avgEyeOpenness,
            gazeConfidence: payload.gazeConfidence,
            blinkDetected: payload.blinkDetected,
            eyeMovementMagnitude: payload.eyeMovementMagnitude,
          });
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isModelReady, sessionActive, currentQuestionId]);

  useEffect(() => {
    if (!sessionActive) {
      frameBufferRef.current = [];
      lastBlinkStateRef.current = false;
      prevEyeOffsetRef.current = { x: 0, y: 0 };
    }
  }, [sessionActive]);

  useEffect(() => {
    return () => {
      flushWindowToBackend();
    };
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>GEFT Gaze Tracker</h2>

      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: "user",
        }}
        style={{
          width: 420,
          borderRadius: 12,
          border: "1px solid #ccc",
        }}
      />

      <div style={{ marginTop: 16 }}>
        <p>
          <strong>Model Ready:</strong> {isModelReady ? "Yes" : "No"}
        </p>
        <p>
          <strong>Session Active:</strong> {sessionActive ? "Yes" : "No"}
        </p>
        <p>
          <strong>Current Question ID:</strong>{" "}
          {currentQuestionId ?? "None"}
        </p>
        <p>
          <strong>Face Present:</strong> {liveMetrics.facePresent ? "Yes" : "No"}
        </p>
        <p>
          <strong>Gaze Direction:</strong> {liveMetrics.gazeDirection}
        </p>
        <p>
          <strong>Yaw:</strong> {liveMetrics.yaw}
        </p>
        <p>
          <strong>Pitch:</strong> {liveMetrics.pitch}
        </p>
        <p>
          <strong>Eye Offset X:</strong> {liveMetrics.eyeOffsetX}
        </p>
        <p>
          <strong>Eye Offset Y:</strong> {liveMetrics.eyeOffsetY}
        </p>
        <p>
          <strong>Avg Eye Openness:</strong> {liveMetrics.avgEyeOpenness}
        </p>
        <p>
          <strong>Blink Detected:</strong>{" "}
          {liveMetrics.blinkDetected ? "Yes" : "No"}
        </p>
        <p>
          <strong>Gaze Confidence:</strong> {liveMetrics.gazeConfidence}
        </p>
        <p>
          <strong>Eye Movement Magnitude:</strong>{" "}
          {liveMetrics.eyeMovementMagnitude}
        </p>
      </div>

      <div style={{ marginTop: 24, padding: 12, border: "1px solid #ddd" }}>
        <h3>Last 5s Aggregated Window</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
          {lastPostedWindow
            ? JSON.stringify(lastPostedWindow, null, 2)
            : "No 5-second window posted yet."}
        </pre>
      </div>
    </div>
  );
}