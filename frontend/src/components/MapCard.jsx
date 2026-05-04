/**
 * Map visual: embedded preview (when location is clear) + structured card + Google Maps link.
 * Not Mermaid.
 */

function buildMapsUrlsFromQuery(q) {
  const query = String(q || '').trim();
  if (query.length < 2) return { map_url: '', embed_url: '' };
  const enc = encodeURIComponent(query);
  return {
    map_url: `https://www.google.com/maps?q=${enc}`,
    embed_url: `https://www.google.com/maps?q=${enc}&output=embed`,
  };
}

function SchematicPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '120px',
        borderRadius: '8px',
        background: 'linear-gradient(165deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(100, 116, 139, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 120 100" width="120" height="100" style={{ display: 'block', opacity: 0.95 }}>
        <defs>
          <linearGradient id="mcLand2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <path
          d="M10 78 Q25 55 45 62 Q60 40 78 48 Q95 35 110 50 L110 88 L10 88 Z"
          fill="url(#mcLand2)"
          stroke="#64748b"
          strokeWidth="1.2"
        />
        <path
          d="M72 38 Q88 28 102 40 Q96 52 82 48 Q76 42 72 38 Z"
          fill="#475569"
          stroke="#64748b"
          strokeWidth="0.8"
        />
        <circle cx="58" cy="44" r="5" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
        <path d="M58 49 L58 62 M52 56 L64 56" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
        <text x="58" y="92" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="inherit">
          schematic region
        </text>
      </svg>
    </div>
  );
}

export default function MapCard({ data }) {
  const d = data && typeof data === 'object' ? data : {};
  const countries = Array.isArray(d.countries) ? d.countries : [];
  const countriesText =
    countries.length === 0
      ? ''
      : countries.length === 2
        ? `${countries[0]} and ${countries[1]}`
        : countries.slice(0, -1).join(', ') + ', and ' + countries[countries.length - 1];

  const locationTrimmed = String(d.location || '').trim();
  const fallbackUrls = buildMapsUrlsFromQuery(locationTrimmed);
  const mapUrl = String(d.map_url || '').trim() || fallbackUrls.map_url;
  const embedUrl = String(d.embed_url || '').trim() || fallbackUrls.embed_url;

  /** Embed only when primary location is explicit (not region-only fallback). */
  const showEmbed =
    locationTrimmed.length >= 2 && Boolean(embedUrl);

  const row = (label, value) =>
    value ? (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ color: '#e2e8f0', lineHeight: 1.5 }}>{value}</div>
      </div>
    ) : null;

  return (
    <div
      className="map-card-visual"
      style={{
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.45)',
        overflow: 'hidden',
      }}
    >
      {showEmbed ? (
        <iframe
          title={`Map preview: ${locationTrimmed}`}
          width="100%"
          height={250}
          style={{ border: 0, display: 'block', minHeight: '200px' }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
        />
      ) : (
        <SchematicPlaceholder />
      )}

      <div style={{ padding: '1.1rem 1.25rem' }}>
        <div
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#94a3b8',
            marginBottom: '0.65rem',
          }}
        >
          Location info
        </div>
        {row('Location', d.location)}
        {row('Region', d.region)}
        {row('Countries', countriesText)}
        {row('Context', d.context)}
        {row('Marker', d.marker)}
        {!d.location && !d.region && !countriesText && !d.context && !d.marker ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Geographic details will appear here when the lesson names places or regions.
          </p>
        ) : null}
      </div>

      {mapUrl ? (
        <div
          style={{
            padding: '0 1.25rem 1.15rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '1rem',
          }}
        >
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.18)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#e2e8f0',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            📍 View on Map
          </a>
        </div>
      ) : null}
    </div>
  );
}
