/**
 * Heuristic extraction of time labels + event phrases for timeline visuals.
 */

const TIME_TOKEN =
  /\b((?:19|20)\d{2}s?|\d{4}|today|now|initially|finally|present[- ]?day|currently)\b/i;

function escapeMermaidToken(s) {
  return String(s || "")
    .replace(/:/g, "—")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeTimeLabel(t) {
  const x = String(t || "").trim();
  if (!x) return "";
  if (/^today|now|present|currently|modern|contemporary$/i.test(x)) {
    return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
  }
  return x;
}

function timeSortKey(timeLabel) {
  const s = String(timeLabel || "").toLowerCase();
  const m = s.match(/^(19|20)(\d{2})s?$/);
  if (m) return parseInt(m[1] + m[2], 10);
  const m4 = s.match(/\b(1\d{3}|20\d{2})\b/);
  if (m4) return parseInt(m4[1], 10);
  if (/today|now|present|current|modern|contemporary|finally/.test(s)) return 9999;
  if (/initially|first|early/.test(s)) return -1;
  return 1500;
}

/**
 * @param {string} lessonText
 * @returns {Array<{ time: string, event: string }>}
 */
function extractTimelineRows(lessonText) {
  const text = String(lessonText || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = [];
  const pushRow = (sentence, rawTime) => {
    const time = normalizeTimeLabel(rawTime);
    const idx = sentence.search(new RegExp(escapeReg(rawTime), "i"));
    if (idx < 0) return;
    const after = sentence
      .slice(idx + String(rawTime).length)
      .replace(/^[\s,;:.-]+/, "")
      .trim();
    const before = sentence.slice(0, idx).replace(/\s+$/, "").trim();
    let event = after;
    if (!event || event.length < 3) {
      event = before
        .replace(/\s+(in the|during the|by the|at the|in|during|by|at)\s*$/i, "")
        .replace(/\b(in|during|by|at|the|a|an)\s+$/i, "")
        .trim();
    }
    if (!event || event.length < 3) {
      event = sentence.replace(new RegExp(escapeReg(rawTime), "gi"), "").trim();
    }
    rows.push({
      time,
      event: escapeMermaidToken(event) || escapeMermaidToken(sentence),
    });
  };

  for (const sentence of sentences) {
    const re = new RegExp(TIME_TOKEN.source, "gi");
    let m;
    while ((m = re.exec(sentence)) !== null) {
      const rawTime = m[1];
      pushRow(sentence, rawTime);
    }
  }

  if (rows.length === 0) {
    const timePattern =
      /\b((?:19|20)\d{2}s?|\d{4}|today|now|initially|finally|present[- ]?day|currently)\b/gi;
    const matches = [...text.matchAll(timePattern)];
    for (let i = 0; i < matches.length; i += 1) {
      const m = matches[i];
      const rawTime = m[1];
      const tokenEnd = m.index + m[0].length;
      const nextStart = i + 1 < matches.length ? matches[i + 1].index : text.length;
      let afterToken = text.slice(tokenEnd, nextStart).replace(/^\s*[.,:]\s*/, "").trim();
      afterToken = afterToken.split(/(?<=[.!?])\s+/)[0] || afterToken;
      const time = normalizeTimeLabel(rawTime);
      rows.push({
        time,
        event:
          escapeMermaidToken(afterToken) ||
          escapeMermaidToken(`Event at ${time}`),
      });
    }
  }

  const sorted = [...rows].sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));
  return dedupeTimelineRows(sorted);
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeTimelineRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = `${r.time}::${r.event}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * @param {string} title
 * @param {Array<{ time: string, event: string }>} rows
 * @returns {string}
 */
function buildMermaidTimeline(title, rows) {
  const lines = ["timeline"];
  const t = escapeMermaidToken(title);
  if (t) lines.push(`  title ${t}`);
  for (const r of rows) {
    const time = escapeMermaidToken(r.time);
    const ev = escapeMermaidToken(r.event);
    if (time && ev) lines.push(`  ${time} : ${ev}`);
  }
  return lines.join("\n");
}

module.exports = {
  extractTimelineRows,
  buildMermaidTimeline,
  timeSortKey,
};
