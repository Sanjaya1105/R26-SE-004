import React, { useMemo, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WINDOW_MS = 5000;
const API_URL = "http://localhost:4000/cognitive-style/gaze/event";

// Tune these if needed
const LOOK_DIFF_THRESHOLD = 0.08; // minimum gap between left/right signals
const LOOK_MIN_SIGNAL = 0.04; // ignore tiny noisy signals

function createEmptyWindow(startTime) {
  return {
    windowStart: startTime,
    frameCount: 0,
    facePresentFrames: 0,
    leftFrames: 0,
    rightFrames: 0,
    centerFrames: 0,
    noFaceFrames: 0,

    eyeLookInLeftSum: 0,
    eyeLookInRightSum: 0,
    lookDiffSum: 0,
  };
}

function getBlendshapeScore(blendShapes, name) {
  const item = blendShapes.find((b) => b.categoryName === name);
  return item ? item.score : 0;
}

function classifyByEyeLookBlendshapes(blendShapes) {
  const eyeLookInLeft = getBlendshapeScore(blendShapes, "eyeLookInLeft");
  const eyeLookInRight = getBlendshapeScore(blendShapes, "eyeLookInRight");

  const maxSignal = Math.max(eyeLookInLeft, eyeLookInRight);
  const diff = Math.abs(eyeLookInLeft - eyeLookInRight);

  if (maxSignal < LOOK_MIN_SIGNAL) {
    return {
      gazeLabel: "CENTER",
      eyeLookInLeft,
      eyeLookInRight,
      diff,
    };
  }

  if (diff < LOOK_DIFF_THRESHOLD) {
    return {
      gazeLabel: "CENTER",
      eyeLookInLeft,
      eyeLookInRight,
      diff,
    };
  }

  return {
    gazeLabel: eyeLookInLeft > eyeLookInRight ? "LEFT" : "RIGHT",
    eyeLookInLeft,
    eyeLookInRight,
    diff,
  };
}

export default function GazeTracker() {
  const webcamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const windowRef = useRef(createEmptyWindow(Date.now()));

  const userPayload = useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      console.log("Decoded user payload:", JSON.parse(atob(token.split(".")[1])));
      return JSON.parse(atob(token.split(".")[1]));

    } catch {
      return null;
    }
  }, []);



  useEffect(() => {
    let cancelled = false;

    async function setupLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });

        if (!cancelled) {
          faceLandmarkerRef.current = faceLandmarker;
          console.log("Face Landmarker ready");
        }
      } catch (error) {
        console.error("Failed to initialize Face Landmarker:", error);
      }
    }

    setupLandmarker();

    return () => {
      cancelled = true;

      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function updateWindow(sample) {
      const w = windowRef.current;
      w.frameCount += 1;

      if (sample.facePresent) {
        w.facePresentFrames += 1;
      } else {
        w.noFaceFrames += 1;
        return;
      }

      w.eyeLookInLeftSum += sample.eyeLookInLeft;
      w.eyeLookInRightSum += sample.eyeLookInRight;
      w.lookDiffSum += sample.lookDiff;

      if (sample.gazeLabel === "LEFT") {
        w.leftFrames += 1;
      } else if (sample.gazeLabel === "RIGHT") {
        w.rightFrames += 1;
      } else {
        w.centerFrames += 1;
      }
    }

    async function flushWindow() {
      const now = Date.now();
      const w = windowRef.current;

      if (w.frameCount === 0) {
        windowRef.current = createEmptyWindow(now);
        return;
      }

      const dominantGaze =
        w.leftFrames > w.rightFrames
          ? "LEFT"
          : w.rightFrames > w.leftFrames
            ? "RIGHT"
            : "CENTER";

      const payload = {
        sessionId: userPayload?.id || "session-demo-1",
        windowStart: w.windowStart,
        windowEnd: now,
        frameCount: w.frameCount,
        facePresentRatio: Number((w.facePresentFrames / w.frameCount).toFixed(4)),

        lookLeftFrames: w.leftFrames,
        lookRightFrames: w.rightFrames,
        centerFrames: w.centerFrames,

        avgEyeLookInLeft: Number((w.eyeLookInLeftSum / w.frameCount).toFixed(6)),
        avgEyeLookInRight: Number((w.eyeLookInRightSum / w.frameCount).toFixed(6)),
        avgLookDiff: Number((w.lookDiffSum / w.frameCount).toFixed(6)),

        dominantGaze,
      };

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error("Failed to send gaze summary:", response.status, payload);
        } else {
          console.log("Gaze summary sent:", payload);
        }
      } catch (error) {
        console.error("Error sending gaze summary:", error);
        console.log("Fallback payload:", payload);
      }

      windowRef.current = createEmptyWindow(now);
    }

    let running = true;

    const loop = () => {
      if (!running) return;

      const video = webcamRef.current?.video;
      const landmarker = faceLandmarkerRef.current;

      if (
        landmarker &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        if (lastVideoTimeRef.current !== video.currentTime) {
          lastVideoTimeRef.current = video.currentTime;

          const result = landmarker.detectForVideo(video, performance.now());

          let sample = {
            facePresent: false,
            gazeLabel: "NO_FACE",
            eyeLookInLeft: 0,
            eyeLookInRight: 0,
            lookDiff: 0,
          };

          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const blendShapes = result.faceBlendshapes?.[0]?.categories || [];
            const lookData = classifyByEyeLookBlendshapes(blendShapes);

            sample = {
              facePresent: true,
              gazeLabel: lookData.gazeLabel,
              eyeLookInLeft: Number(lookData.eyeLookInLeft.toFixed(6)),
              eyeLookInRight: Number(lookData.eyeLookInRight.toFixed(6)),
              lookDiff: Number(lookData.diff.toFixed(6)),
            };
          }

          updateWindow(sample);
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    const interval = setInterval(flushWindow, WINDOW_MS);

    return () => {
      running = false;

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      clearInterval(interval);
      flushWindow();
    };
  }, []);
  return (
    <div
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
    >
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 320,
          height: 240,
          facingMode: "user",
        }}
        style={{
          width: "1px",
          height: "1px",
          display: "block",
        }}
      />
    </div>
  );
}