import { formatWatchClock, motivationCopy } from '../utils/videoWatchProgress';

function MiniWatchRing({ percent = 0, complete = false }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));

  if (complete) {
    return (
      <span className="course-learn__mini-ring is-complete" aria-hidden="true">
        ✓
      </span>
    );
  }

  return (
    <span
      className="course-learn__mini-pie"
      style={{
        background: `conic-gradient(#a78bfa ${p}%, rgba(255,255,255,0.12) 0)`,
      }}
      aria-hidden="true"
    />
  );
}

export function CourseWatchRing({ summary }) {
  const percent = Math.max(0, Math.min(100, Number(summary?.percent) || 0));
  const watchedSec = Number(summary?.watchedSec) || 0;
  const totalSec = Number(summary?.totalSec) || 0;
  const videoCount = Number(summary?.videoCount) || 0;

  if (videoCount <= 0) return null;

  return (
    <section
      className="course-learn__watch"
      aria-label={`Course video progress, ${Math.round(percent)} percent watched`}
    >
      <div
        className="course-learn__watch-pie"
        style={{
          background: `conic-gradient(#c4b5fd 0 ${percent}%, rgba(255,255,255,0.1) ${percent}% 100%)`,
        }}
        aria-hidden="true"
      >
        <span className="course-learn__watch-pie-hole">
          <strong>{Math.round(percent)}</strong>
          <em>%</em>
        </span>
      </div>
      <div className="course-learn__watch-copy">
        <p className="course-learn__watch-kicker">Your progress</p>
        <p className="course-learn__watch-line">
          {totalSec > 0
            ? `${formatWatchClock(watchedSec)} of ${formatWatchClock(totalSec)} watched`
            : 'Open a lecture to start the ring'}
        </p>
        <p className="course-learn__watch-nudge">{motivationCopy(percent)}</p>
      </div>
    </section>
  );
}

export { MiniWatchRing };
