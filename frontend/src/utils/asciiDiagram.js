const BORDER_RE = /^\s*\+[+\-=:]+\+\s*$/;

export function isAsciiBorderLine(line) {
  const t = String(line || "").trim();
  return t.length >= 3 && t.startsWith("+") && t.endsWith("+") && /[-+=]/.test(t);
}

export function isAsciiRowLine(line) {
  const t = String(line || "").trim();
  return t.startsWith("|") && t.includes("|", 1);
}

function splitCells(line) {
  const t = String(line || "").trim();
  if (!t.startsWith("|")) return [];
  const inner = t.endsWith("|") ? t.slice(1, -1) : t.slice(1);
  return inner.split("|").map((cell) => cell.replace(/\s+/g, " ").trim());
}

function hasEmoji(text) {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(text || ""));
}

function rowIsHeader(row) {
  const filled = row.filter(Boolean);
  if (!filled.length) return false;
  const emojiHeaders = filled.filter(
    (cell) => hasEmoji(cell) && !cell.trim().startsWith("•")
  );
  if (emojiHeaders.length >= Math.ceil(filled.length / 2)) return true;
  if (filled.length < 2) return false;
  return filled.every((cell) => {
    const t = cell.trim();
    if (!t || /^[•\-*(]/.test(t) || /^[a-z]/.test(t)) return false;
    return t.length <= 32 && t.split(/\s+/).length <= 5;
  });
}

export function looksLikeAsciiTable(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) return false;
  const hits = lines.filter((line) => isAsciiBorderLine(line) || isAsciiRowLine(line)).length;
  return hits >= 3 && hits / lines.length >= 0.65;
}

export function parseAsciiBoxTable(block) {
  const dataRows = [];
  for (const line of String(block || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || BORDER_RE.test(trimmed) || isAsciiBorderLine(trimmed)) continue;
    if (!isAsciiRowLine(trimmed)) continue;
    const cells = splitCells(trimmed);
    if (cells.length) dataRows.push(cells);
  }
  if (!dataRows.length) return null;

  const titles = [];
  const bands = [];
  let current = null;

  const startBand = (row) => {
    current = {
      columns: row.length,
      headers: row.map((cell) => cell),
      bodies: row.map(() => []),
    };
    bands.push(current);
  };

  for (const row of dataRows) {
    const filled = row.filter(Boolean);
    if (filled.length <= 1 && row.length <= 2) {
      if (filled[0]) titles.push(filled[0]);
      continue;
    }
    const headerish = rowIsHeader(row);
    if (!current || headerish) {
      startBand(row);
      continue;
    }
    if (row.length === current.columns) {
      row.forEach((cell, index) => {
        if (cell) current.bodies[index].push(cell);
      });
      continue;
    }
    startBand(row);
  }

  const cards = [];
  for (const band of bands) {
    for (let i = 0; i < band.columns; i += 1) {
      const header = band.headers[i] || "";
      const body = band.bodies[i].join("\n").trim();
      if (!header && !body) continue;
      cards.push({
        title: header,
        body,
        columns: band.columns,
      });
    }
  }

  return {
    title: titles[0] || "",
    subtitle: titles.slice(1).join(" · "),
    cards,
    columnCount: Math.max(...bands.map((band) => band.columns), 1),
  };
}

function mermaidSafe(text) {
  return String(text || "")
    .replace(/"/g, "'")
    .replace(/[\[\]{}]/g, "")
    .replace(/\n+/g, "<br/>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function conceptBoardToMermaid(parsed) {
  if (!parsed?.cards?.length) return "";
  const cards = parsed.cards;
  const title = mermaidSafe(parsed.title || "Concept map");
  const nodes = cards.map((card, index) => {
    const label = mermaidSafe([card.title, card.body].filter(Boolean).join("<br/>"));
    return `  n${index}["${label || `Item ${index + 1}`}"]`;
  });

  let links = "";
  if (cards.length === 3) {
    links = "  n0 --> n1 --> n2";
  } else if (cards.length === 6) {
    links = ["  n0 --- n1 --- n2", "  n3 --> n4 --> n5"].join("\n");
  } else if (cards.length > 1) {
    links = cards
      .slice(0, -1)
      .map((_, index) => `  n${index} --> n${index + 1}`)
      .join("\n");
  }

  return [`flowchart TB`, `  title["${title}"]`, ...nodes, links ? `  title --> n0` : "", links]
    .filter(Boolean)
    .join("\n");
}

export function extractVisualSegments(text) {
  const source = String(text || "");
  const lines = source.split("\n");
  const parts = [];
  let markdownStart = 0;
  let index = 0;

  const pushMarkdown = (end) => {
    const chunk = lines.slice(markdownStart, end).join("\n");
    if (chunk.trim()) parts.push({ type: "markdown", content: chunk });
  };

  while (index < lines.length) {
    if (
      isAsciiBorderLine(lines[index]) ||
      (isAsciiRowLine(lines[index]) &&
        index + 1 < lines.length &&
        (isAsciiBorderLine(lines[index + 1]) || isAsciiRowLine(lines[index + 1])))
    ) {
      const start = index;
      index += 1;
      while (
        index < lines.length &&
        (isAsciiBorderLine(lines[index]) || isAsciiRowLine(lines[index]))
      ) {
        index += 1;
      }
      const block = lines.slice(start, index).join("\n");
      if (looksLikeAsciiTable(block) && parseAsciiBoxTable(block)?.cards?.length) {
        pushMarkdown(start);
        parts.push({ type: "ascii", content: block });
        markdownStart = index;
        continue;
      }
      index = start + 1;
      continue;
    }
    index += 1;
  }

  pushMarkdown(lines.length);
  return parts.length ? parts : [{ type: "markdown", content: source }];
}

export function looksLikeMermaid(text) {
  return /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|mindmap|timeline|stateDiagram)\b/m.test(
    String(text || "").trim()
  );
}
