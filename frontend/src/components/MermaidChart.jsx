import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

let mermaidReady = false;

function ensureMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    themeVariables: {
      darkMode: true,
      background: 'transparent',
      primaryColor: '#312e81',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#818cf8',
      lineColor: '#a5b4fc',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a',
      clusterBkg: '#1e293b',
      clusterBorder: '#6366f1',
      titleColor: '#f8fafc',
      nodeTextColor: '#e2e8f0',
    },
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      padding: 12,
    },
  });
  mermaidReady = true;
}

export default function MermaidChart({ definition }) {
  const reactId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const source = String(definition || '').trim();
    if (!source) {
      setSvg('');
      setError('');
      return undefined;
    }

    ensureMermaid();
    const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`;
    mermaid
      .render(id, source)
      .then((result) => {
        if (!cancelled) {
          setError('');
          setSvg(result.svg || '');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSvg('');
          setError(err?.message || 'Could not draw this diagram.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definition, reactId]);

  if (error) {
    return <pre className="assistant-md-mermaid-fallback">{definition}</pre>;
  }
  if (!svg) {
    return <p className="assistant-md-mermaid-loading">Drawing diagram…</p>;
  }
  return (
    <div
      className="assistant-md-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
