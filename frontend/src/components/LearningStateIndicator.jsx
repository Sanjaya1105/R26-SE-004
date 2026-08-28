import { useMemo, useState } from 'react';

const LOAD_CLASS = {
  'Very Low': 'very-low',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  'Very High': 'very-high',
};

const TREND_CLASS = {
  rising: 'rising',
  decreasing: 'decreasing',
  stable: 'stable',
  fluctuating: 'fluctuating',
};

const LOAD_LABEL = {
  'Very Low': 'Calm',
  Low: 'Calm',
  Medium: 'Focused',
  High: 'Heavy',
  'Very High': 'Intense',
};

const LOAD_SCORE = {
  'Very Low': 1,
  Low: 2,
  Medium: 3,
  High: 4,
  'Very High': 5,
};

const TREND_SYMBOL = {
  rising: 'up',
  decreasing: 'down',
  stable: 'steady',
  fluctuating: 'wave',
};

const GRAPH_WIDTH = 230;
const GRAPH_HEIGHT = 118;
const GRAPH_TOP = 12;
const GRAPH_RIGHT = 12;
const GRAPH_BOTTOM = 26;
const GRAPH_LEFT = 54;

function readableValue(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildGraphPoints(timeline = []) {
  const points = timeline
    .map((item) => ({
      minuteIndex: item.minute_index,
      score: Number(item.predicted_score) || LOAD_SCORE[item.predicted_load] || 0,
      label: item.predicted_load || 'Unknown',
    }))
    .filter((item) => item.score > 0)
    .slice(-8);

  if (!points.length) return [];

  const drawableWidth = GRAPH_WIDTH - GRAPH_LEFT - GRAPH_RIGHT;
  const drawableHeight = GRAPH_HEIGHT - GRAPH_TOP - GRAPH_BOTTOM;
  const stepWidth = points.length > 1 ? drawableWidth / (points.length - 1) : 0;

  return points.map((item, index) => ({
    ...item,
    x: points.length > 1 ? GRAPH_LEFT + stepWidth * index : GRAPH_LEFT + drawableWidth / 2,
    y: GRAPH_TOP + ((5 - item.score) / 4) * drawableHeight,
    xLabel: item.minuteIndex ? `W${item.minuteIndex}` : `W${index + 1}`,
  }));
}

export default function LearningStateIndicator({ analysis, loading = false, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const loadClass = LOAD_CLASS[analysis?.current_load] || 'unknown';
  const trendClass = TREND_CLASS[analysis?.trend] || 'stable';
  const showAlertIcon = loadClass === 'high' || loadClass === 'very-high';
  const loadScore = LOAD_SCORE[analysis?.current_load] || 0;
  const loadLabel = LOAD_LABEL[analysis?.current_load] || 'Waiting';
  const trendLabel = TREND_SYMBOL[analysis?.trend] || 'steady';
  const graphPoints = useMemo(
    () => buildGraphPoints(analysis?.timeline),
    [analysis?.timeline],
  );
  const graphPath = graphPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const latestPoint = graphPoints[graphPoints.length - 1];
  const previousPoint = graphPoints[graphPoints.length - 2];
  const loadShift = latestPoint && previousPoint ? latestPoint.score - previousPoint.score : 0;
  const shiftLabel = loadShift > 0 ? `+${loadShift}` : String(loadShift);
  const title = analysis
    ? `${analysis.current_load || 'Unknown'} load, ${readableValue(
        analysis.trend,
      )} trend`
    : 'Learning state is waiting for enough video activity.';

  return (
    <div className={`learning-state-wrap${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`learning-state learning-state--${loadClass}${
          loading ? ' is-loading' : ''
        }${isOpen ? ' is-open' : ''}`}
        aria-label={`${title}. Click to ${isOpen ? 'hide' : 'show'} learning graph.`}
        aria-expanded={isOpen}
        title={title}
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="learning-state__orb" aria-hidden="true">
          <div className="learning-state__ring">
            {showAlertIcon ? (
              <span className={`learning-state__alert learning-state__alert--${loadClass}`} />
            ) : (
              <span className={`learning-state__trend learning-state__trend--${trendClass}`} />
            )}
          </div>
          <span className="learning-state__glow" />
        </div>
        <div className="learning-state__content" aria-hidden="true">
          <span className="learning-state__eyebrow">Learning Pulse</span>
          <strong>{loadLabel}</strong>
          <span className="learning-state__meta">{trendLabel}</span>
          <div className="learning-state__dots">
            {[1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className={step <= loadScore ? 'is-active' : ''}
              />
            ))}
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className={`learning-state-graph learning-state-graph--${loadClass}`}>
          <div className="learning-state-graph__head">
            <span>Pulse Path</span>
            <strong>{readableValue(analysis?.trend || 'steady')}</strong>
          </div>
          <svg
            className="learning-state-graph__chart"
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            role="img"
            aria-label="Recent cognitive load trend graph"
          >
            <line x1={GRAPH_LEFT} y1={GRAPH_TOP} x2={GRAPH_LEFT} y2={GRAPH_HEIGHT - GRAPH_BOTTOM} />
            <line
              x1={GRAPH_LEFT}
              y1={GRAPH_HEIGHT - GRAPH_BOTTOM}
              x2={GRAPH_WIDTH - GRAPH_RIGHT}
              y2={GRAPH_HEIGHT - GRAPH_BOTTOM}
            />
            {[1, 2, 3, 4, 5].map((score) => {
              const y = GRAPH_TOP + ((5 - score) / 4) * (GRAPH_HEIGHT - GRAPH_TOP - GRAPH_BOTTOM);
              return (
                <line
                  key={score}
                  className="grid-line"
                  x1={GRAPH_LEFT}
                  y1={y}
                  x2={GRAPH_WIDTH - GRAPH_RIGHT}
                  y2={y}
                />
              );
            })}
            <text className="axis-label axis-label--high" x="2" y="15">
              High load
            </text>
            <text className="axis-label axis-label--low" x="2" y={GRAPH_HEIGHT - GRAPH_BOTTOM + 3}>
              Low load
            </text>
            {graphPath && graphPoints.length > 1 ? <path d={graphPath} /> : null}
            {graphPoints.map((point) => (
              <g key={`${point.minuteIndex}-${point.score}`}>
                <circle cx={point.x} cy={point.y} r="4.4" />
                <text
                  className="x-axis-label"
                  x={point.x}
                  y={GRAPH_HEIGHT - 7}
                  textAnchor="middle"
                >
                  {point.xLabel}
                </text>
              </g>
            ))}
          </svg>
          <div className="learning-state-graph__details">
            <span>
              <small>Windows</small>
              <strong>{graphPoints.length || 0}</strong>
            </span>
            <span>
              <small>Latest</small>
              <strong>{latestPoint?.label || analysis?.current_load || 'Waiting'}</strong>
            </span>
            <span>
              <small>Change</small>
              <strong>{previousPoint ? shiftLabel : 'New'}</strong>
            </span>
          </div>
          <div className="learning-state-graph__chips">
            <span>{readableValue(analysis?.risk_level || 'waiting')}</span>
            <span>{readableValue(analysis?.trend || 'steady')}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
