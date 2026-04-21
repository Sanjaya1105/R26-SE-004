import React, { useEffect, useRef } from "react";

const WINDOW_MS = 5000;
const API_URL = "http://localhost:4000/cognitive-style/simple/cursor-summary";

// Noise guards
const MIN_HOVER_MS = 80;
const MIN_ZONE_TIME_MS_FOR_HOVER = 120;
const MAX_IDLE_GAP_MS = 250;

function createEmptyWindow(startTime) {
  return {
    windowStart: startTime,
    windowEnd: startTime + WINDOW_MS,

    visualTimeMs: 0,
    textTimeMs: 0,

    visualHoverTotalMs: 0,
    textHoverTotalMs: 0,
    visualHoverCount: 0,
    textHoverCount: 0,

    visualSpeedSum: 0,
    textSpeedSum: 0,
    visualMoveCount: 0,
    textMoveCount: 0,

    clickCountVisual: 0,
    clickCountText: 0,

    scrollCountVisual: 0,
    scrollCountText: 0,

    zoneSwitchCount: 0,
  };
}

export default function CursorTracker() {
  const lastPointRef = useRef(null);
  const lastZoneRef = useRef("UNKNOWN");
  const lastMoveTimeRef = useRef(Date.now());

  const hoverStartRef = useRef(null);
  const lastHoverZoneRef = useRef("UNKNOWN");

  const bufferRef = useRef(createEmptyWindow(Date.now()));

  useEffect(() => {
    async function sendSummary(payload) {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error("Failed to send cursor summary:", response.status);
        } else {
          console.log("Cursor summary sent:", payload);
        }
      } catch (error) {
        console.error("Error sending cursor summary:", error);
        console.log("Fallback payload:", payload);
      }
    }

    function getZone(target) {
      if (!(target instanceof Element)) return "UNKNOWN";
      const zoneEl = target.closest("[data-zone]");
      if (!zoneEl) return "UNKNOWN";
      return zoneEl.getAttribute("data-zone") || "UNKNOWN";
    }

    function addTrackedTime(previousZone, deltaMs) {
      if (previousZone === "VISUAL") {
        bufferRef.current.visualTimeMs += deltaMs;
      } else if (previousZone === "TEXT") {
        bufferRef.current.textTimeMs += deltaMs;
      }
    }

    function finalizeHover(zone, now) {
      if (!hoverStartRef.current) return;
      if (zone !== "VISUAL" && zone !== "TEXT") return;

      const hoverDuration = Math.max(0, now - hoverStartRef.current);

      // Ignore tiny accidental hover flickers
      if (hoverDuration < MIN_HOVER_MS) return;

      if (zone === "VISUAL") {
        bufferRef.current.visualHoverTotalMs += hoverDuration;
        bufferRef.current.visualHoverCount += 1;
      } else if (zone === "TEXT") {
        bufferRef.current.textHoverTotalMs += hoverDuration;
        bufferRef.current.textHoverCount += 1;
      }
    }

    function startHover(zone, now) {
      lastHoverZoneRef.current = zone;
      hoverStartRef.current = zone === "UNKNOWN" ? null : now;
    }

    function flushWindow() {
      const now = Date.now();
      const w = bufferRef.current;

      // Finalize current hover before flushing
      if (lastHoverZoneRef.current !== "UNKNOWN") {
        finalizeHover(lastHoverZoneRef.current, now);
      }

      const totalTrackedTime = w.visualTimeMs + w.textTimeMs;

      const visualTimeRatio =
        totalTrackedTime > 0 ? w.visualTimeMs / totalTrackedTime : 0;
      const textTimeRatio =
        totalTrackedTime > 0 ? w.textTimeMs / totalTrackedTime : 0;

      let avgHoverVisual =
        w.visualHoverCount > 0 ? w.visualHoverTotalMs / w.visualHoverCount : 0;
      let avgHoverText =
        w.textHoverCount > 0 ? w.textHoverTotalMs / w.textHoverCount : 0;

      // Clean hover mismatches: if almost no time was tracked in a zone,
      // zero out hover there because it's likely noise
      if (w.visualTimeMs < MIN_ZONE_TIME_MS_FOR_HOVER) {
        avgHoverVisual = 0;
      }
      if (w.textTimeMs < MIN_ZONE_TIME_MS_FOR_HOVER) {
        avgHoverText = 0;
      }

      const avgSpeedVisual =
        w.visualMoveCount > 0 ? w.visualSpeedSum / w.visualMoveCount : 0;
      const avgSpeedText =
        w.textMoveCount > 0 ? w.textSpeedSum / w.textMoveCount : 0;

      const summary = {
        sessionId: "session-demo-1",
        windowStart: w.windowStart,
        windowEnd: now,

        visualTimeRatio: Number(visualTimeRatio.toFixed(4)),
        textTimeRatio: Number(textTimeRatio.toFixed(4)),

        avgHoverVisual: Number(avgHoverVisual.toFixed(2)),
        avgHoverText: Number(avgHoverText.toFixed(2)),

        avgSpeedVisual: Number(avgSpeedVisual.toFixed(4)),
        avgSpeedText: Number(avgSpeedText.toFixed(4)),

        clickCountVisual: w.clickCountVisual,
        clickCountText: w.clickCountText,

        scrollCountVisual: w.scrollCountVisual,
        scrollCountText: w.scrollCountText,

        zoneSwitchCount: w.zoneSwitchCount,
      };

      sendSummary(summary);

      bufferRef.current = createEmptyWindow(now);

      // Start new window hover state from current zone
      if (lastZoneRef.current === "VISUAL" || lastZoneRef.current === "TEXT") {
        startHover(lastZoneRef.current, now);
      } else {
        startHover("UNKNOWN", now);
      }
    }

    function onMouseMove(event) {
      const now = Date.now();
      const zone = getZone(event.target);
      const x = event.clientX;
      const y = event.clientY;

      const prevZone = lastZoneRef.current;
      const deltaSinceLastMove = Math.max(0, now - lastMoveTimeRef.current);

      // Add tracked time, but cap long idle gaps so time ratios don't get distorted
      if (prevZone === "VISUAL" || prevZone === "TEXT") {
        addTrackedTime(prevZone, Math.min(deltaSinceLastMove, MAX_IDLE_GAP_MS));
      }

      // Zone switch logic
      if (
        prevZone !== "UNKNOWN" &&
        zone !== "UNKNOWN" &&
        zone !== prevZone
      ) {
        bufferRef.current.zoneSwitchCount += 1;
      }

      // Hover zone changed
      if (zone !== lastHoverZoneRef.current) {
        if (lastHoverZoneRef.current !== "UNKNOWN") {
          finalizeHover(lastHoverZoneRef.current, now);
        }
        startHover(zone, now);
      }

      // Speed calculation stays, but only for same-zone movement
      if (lastPointRef.current) {
        const dx = x - lastPointRef.current.x;
        const dy = y - lastPointRef.current.y;
        const dt = now - lastPointRef.current.t;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = dt > 0 ? distance / dt : 0;

        if (zone === "VISUAL") {
          bufferRef.current.visualSpeedSum += speed;
          bufferRef.current.visualMoveCount += 1;
        } else if (zone === "TEXT") {
          bufferRef.current.textSpeedSum += speed;
          bufferRef.current.textMoveCount += 1;
        }
      }

      lastPointRef.current = { x, y, t: now };
      lastZoneRef.current = zone;
      lastMoveTimeRef.current = now;
    }

    function onClick(event) {
      const zone = getZone(event.target);

      if (zone === "VISUAL") {
        bufferRef.current.clickCountVisual += 1;
      } else if (zone === "TEXT") {
        bufferRef.current.clickCountText += 1;
      }
    }

    function onPaneScroll(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const zone = getZone(target);

      if (zone === "VISUAL") {
        bufferRef.current.scrollCountVisual += 1;
      } else if (zone === "TEXT") {
        bufferRef.current.scrollCountText += 1;
      }
    }

    const panes = document.querySelectorAll("[data-zone]");
    panes.forEach((pane) =>
      pane.addEventListener("scroll", onPaneScroll, { passive: true })
    );

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("click", onClick);

    const interval = setInterval(flushWindow, WINDOW_MS);

    return () => {
      clearInterval(interval);

      const now = Date.now();
      if (lastHoverZoneRef.current !== "UNKNOWN") {
        finalizeHover(lastHoverZoneRef.current, now);
      }

      panes.forEach((pane) =>
        pane.removeEventListener("scroll", onPaneScroll)
      );

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}