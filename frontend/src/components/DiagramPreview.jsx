import { useLayoutEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf'];

let mermaidInitPromise = null;

function initMermaidOnce() {
  if (mermaidInitPromise) return mermaidInitPromise;
  mermaidInitPromise = (async () => {
    const m = (await import('mermaid')).default;
    m.initialize({
      startOnLoad: false,
      // flowchart / sequence labels use foreignObject; 'loose' matches mermaid.run() and keeps labels visible
      securityLevel: 'loose',
      fontFamily: 'inherit',
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        primaryTextColor: '#f8fafc',
        secondaryTextColor: '#94a3b8',
        lineColor: '#64748b',
        mainBkg: '#1e293b',
        nodeBorder: '#64748b',
        clusterBkg: 'rgba(15, 23, 42, 0.6)',
        titleColor: '#f8fafc',
      },
    });
  })();
  return mermaidInitPromise;
}

/**
 * Mermaid 10+ / 11: use two-argument render; assign SVG to the host (third-arg render can throw firstChild errors).
 */
async function renderMermaid(code, container) {
  if (!container || !code?.trim()) {
    throw new Error('Missing diagram container or source');
  }
  const mermaid = (await import('mermaid')).default;
  await initMermaidOnce();
  const id = `mmd-${Date.now()}-${Math.random().toString(36).slice(2).replace(/[^a-z0-9]/gi, '')}`;
  const result = await mermaid.render(id, code);
  const svg = typeof result === 'string' ? result : result?.svg;
  const bindFunctions = typeof result === 'object' && result ? result.bindFunctions : undefined;
  if (typeof svg !== 'string' || !svg) {
    throw new Error('Mermaid returned no SVG');
  }
  container.replaceChildren();
  const wrap = document.createElement('div');
  wrap.innerHTML = svg;
  while (wrap.firstChild) {
    container.appendChild(wrap.firstChild);
  }
  if (typeof bindFunctions === 'function') {
    bindFunctions(container);
  }
  return svg;
}

function ChartPreview({ chart }) {
  const type = String(chart?.chart_type || 'bar').toLowerCase();
  const title = chart?.title || '';
  const xKey = chart?.x_key || 'name';
  const rows = Array.isArray(chart?.rows) ? chart.rows : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];

  if (!rows.length) {
    return <p style={{ color: 'var(--text-muted)' }}>No chart rows returned.</p>;
  }

  if (type === 'pie' && series.length) {
    const dataKey = series[0].data_key || 'value';
    const nameKey = xKey;
    return (
      <div style={{ width: '100%', height: 320 }}>
        {title ? (
          <p className="form-label" style={{ marginBottom: '0.5rem' }}>
            {title}
          </p>
        ) : null}
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={rows}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {rows.map((_, i) => (
                <Cell key={String(i)} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div style={{ width: '100%', height: 320 }}>
        {title ? (
          <p className="form-label" style={{ marginBottom: '0.5rem' }}>
            {title}
          </p>
        ) : null}
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey={xKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            {series.map((s, i) => (
              <Line
                key={s.data_key || i}
                type="monotone"
                dataKey={s.data_key}
                name={s.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      {title ? (
        <p className="form-label" style={{ marginBottom: '0.5rem' }}>
          {title}
        </p>
      ) : null}
      <ResponsiveContainer>
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.data_key || i}
              dataKey={s.data_key}
              name={s.name}
              fill={COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Renders structured diagram_data from the API (Mermaid, chart spec, or HTML table).
 */
const MERMAID_FAIL_MESSAGE = 'Diagram preview failed. Showing source instead.';

export default function DiagramPreview({ diagramData }) {
  const hostRef = useRef(null);
  const [mermaidFailed, setMermaidFailed] = useState(false);

  const fmt = diagramData?.format;
  const rawSource = diagramData?.mermaid || diagramData?.source;
  const mermaidSrc = typeof rawSource === 'string' ? rawSource.trim() : '';

  useLayoutEffect(() => {
    if (fmt === 'map_card') {
      return undefined;
    }
    if (fmt !== 'mermaid' || !mermaidSrc) {
      const host = hostRef.current;
      if (host) host.replaceChildren();
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      const el = hostRef.current;
      if (!el || !el.isConnected) {
        return;
      }
      el.removeAttribute('data-processed');
      el.replaceChildren();
      try {
        await renderMermaid(mermaidSrc, el);
        if (cancelled) return;
        setMermaidFailed(false);
      } catch {
        if (!cancelled) {
          setMermaidFailed(true);
          if (el.isConnected) el.replaceChildren();
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [fmt, mermaidSrc]);

  if (!diagramData || typeof diagramData !== 'object') {
    return null;
  }

  if (fmt === 'map_card') {
    return null;
  }

  if (fmt === 'mermaid') {
    if (!mermaidSrc) {
      return (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.45)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-muted)',
          }}
        >
          No Mermaid diagram source was returned.
        </div>
      );
    }

    return (
      <div
        className="diagram-preview-mermaid"
        style={{
          overflow: 'auto',
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {mermaidFailed ? (
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{MERMAID_FAIL_MESSAGE}</p>
        ) : null}
        <div
          ref={hostRef}
          className="diagram-mermaid-host"
          style={{ minHeight: mermaidFailed ? 0 : '120px', width: '100%' }}
        />
        {mermaidFailed ? (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#e2e8f0',
              overflow: 'auto',
            }}
          >
            {mermaidSrc}
          </pre>
        ) : (
          <details style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <summary>Mermaid source</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{mermaidSrc}</pre>
          </details>
        )}
      </div>
    );
  }

  if (fmt === 'chart' && diagramData.chart) {
    return (
      <div
        style={{
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <ChartPreview chart={diagramData.chart} />
      </div>
    );
  }

  if (fmt === 'html_table' && diagramData.html) {
    return (
      <div
        className="diagram-preview-table"
        style={{
          overflow: 'auto',
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        dangerouslySetInnerHTML={{ __html: diagramData.html }}
      />
    );
  }

  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.35)',
        borderRadius: '10px',
        fontSize: '0.85rem',
      }}
    >
      {JSON.stringify(diagramData, null, 2)}
    </pre>
  );
}
