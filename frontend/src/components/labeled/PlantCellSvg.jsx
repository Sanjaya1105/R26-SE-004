/**
 * Textbook-style plant cell: wall, membrane, cytoplasm, nucleus, chloroplasts.
 * Labels are SVG <text>; leader lines connect to geometric anchors.
 */

const VB = { w: 540, h: 420 };

const ANCHORS = {
  wall: { x: 52, y: 95 },
  membrane: { x: 78, y: 118 },
  cytoplasm: { x: 175, y: 195 },
  nucleus: { x: 168, y: 158 },
  chloroplast: { x: 218, y: 228 },
};

const DEFAULT_ORDER = ['wall', 'membrane', 'cytoplasm', 'nucleus', 'chloroplast'];

const DEFAULT_NAMES = {
  wall: 'Cell wall',
  membrane: 'Cell membrane',
  cytoplasm: 'Cytoplasm',
  nucleus: 'Nucleus',
  chloroplast: 'Chloroplasts',
};

function matchPlantCellPart(label) {
  const blob = `${label?.text || ''} ${label?.target || ''} ${label?.position_hint || ''}`.toLowerCase();
  if (/cell\s*wall|^wall\b|outer\s*wall/.test(blob)) return 'wall';
  if (/membrane|plasma/.test(blob)) return 'membrane';
  if (/cytoplasm|cytosol|matrix/.test(blob)) return 'cytoplasm';
  if (/nucleus|nuclear/.test(blob)) return 'nucleus';
  if (/chloroplast/.test(blob)) return 'chloroplast';
  return null;
}

function buildPartRows(labels) {
  const list = Array.isArray(labels) ? labels : [];
  const core = DEFAULT_ORDER.map((key) => {
    const found = list.find((l) => matchPlantCellPart(l) === key);
    return {
      key,
      text: found?.text || DEFAULT_NAMES[key],
      target: found?.target || null,
    };
  });
  const extras = list
    .filter((l) => !matchPlantCellPart(l))
    .map((l) => ({ key: 'extra', text: l.text, target: l.target }));
  return [...core, ...extras];
}

function LabelLeader({ ax, ay, tx, ty, text, sub }) {
  const midX = (ax + tx) / 2;
  const d = `M ${ax} ${ay} Q ${midX} ${ay - 22} ${tx - 4} ${ty - 3}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#94a3b8" strokeWidth={1.25} strokeLinecap="round" />
      <text x={tx} y={ty} fill="#f8fafc" fontSize={13} fontWeight={600} fontFamily="inherit">
        {text}
      </text>
      {sub ? (
        <text x={tx} y={ty + 14} fill="#94a3b8" fontSize={11} fontFamily="inherit">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export default function PlantCellSvg({ labels }) {
  const rows = buildPartRows(labels);
  const labelX = 358;

  return (
    <div
      className="plant-cell-svg-wrap"
      style={{
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      }}
    >
      <svg
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        role="img"
        aria-label="Plant cell cross-section with labeled parts"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <text x={VB.w / 2} y={28} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={500}>
          Plant cell (schematic)
        </text>

        <rect
          x={48}
          y={58}
          width={234}
          height={258}
          rx={56}
          ry={56}
          fill="none"
          stroke="#166534"
          strokeWidth={8}
        />

        <rect
          x={62}
          y={72}
          width={206}
          height={230}
          rx={46}
          ry={46}
          fill="#bbf7d0"
          fillOpacity={0.88}
          stroke="#22c55e"
          strokeWidth={3.5}
        />

        <circle cx={168} cy={158} r={30} fill="#fef08a" stroke="#b45309" strokeWidth={2} opacity={0.95} />

        {[
          [205, 118, 18, 11],
          [128, 205, 16, 10],
          [235, 195, 17, 10],
          [118, 145, 15, 9],
          [208, 248, 16, 10],
          [155, 188, 14, 9],
        ].map(([cx, cy, rx, ry], i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="#15803d"
            stroke="#14532d"
            strokeWidth={1}
            opacity={0.92}
          />
        ))}

        {rows.map((row, i) => {
          const ty = 44 + i * 34;
          const a =
            row.key === 'extra' ? ANCHORS.cytoplasm : ANCHORS[row.key] || ANCHORS.cytoplasm;
          return (
            <LabelLeader
              key={`${row.key}-${i}-${row.text}`}
              ax={a.x}
              ay={a.y}
              tx={labelX}
              ty={ty}
              text={row.text}
              sub={row.target}
            />
          );
        })}
      </svg>
    </div>
  );
}
