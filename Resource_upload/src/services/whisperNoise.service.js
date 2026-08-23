const FILLER = new Set([
  "you",
  "yeah",
  "uh",
  "um",
  "uhm",
  "hmm",
  "mm",
  "mmm",
  "ah",
  "oh",
  "okay",
  "ok",
  "bye",
  "goodbye",
  "thanks",
  "thank",
  "please",
  "subscribe",
  "like",
  "share",
  "music",
  "applause",
  "silence",
  "foreign",
  "subtitle",
  "subtitles",
  "caption",
  "captions",
  "watching",
]);

const NOISE_EXACT = new Set([
  "you",
  "thank you",
  "thanks",
  "thanks for watching",
  "thanks for watching this video",
  "thank you for watching",
  "please subscribe",
  "like and subscribe",
  "see you next time",
  "see you in the next video",
  "bye",
  "bye bye",
  "goodbye",
  "music",
  "applause",
  "silence",
]);

const NOISE_PHRASE_RE = [
  /^(thank you[\s.!?]*)+$/i,
  /^(thanks( for watching)?[\s.!?]*)+$/i,
  /^(you[\s.!?]*)+$/i,
  /^(bye[\s.!?]*)+$/i,
  /^(uh+|um+|hmm+|mm+)([\s.!?]+(uh+|um+|hmm+|mm+))*$/i,
  /^(you|u)(\s+\1){2,}$/i,
  /thanks for watching/i,
  /like and subscribe/i,
  /please subscribe/i,
  /see you (in the )?next/i,
  /^\[?(music|applause|silence|inaudible|foreign)\]?$/i,
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(text) {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

function isSingleGlyphLoop(text) {
  const compact = normalize(text).replace(/\s+/g, "");
  return compact.length >= 4 && /^(.)\1+$/.test(compact);
}

function isRepeatedSameWord(tokens) {
  if (tokens.length < 3) return false;
  return tokens.every((token) => token === tokens[0]);
}

function fillerRatio(tokens) {
  if (!tokens.length) return 1;
  const fillerCount = tokens.filter((token) => FILLER.has(token)).length;
  return fillerCount / tokens.length;
}

function stripRepeatedFillerRuns(text) {
  return String(text || "")
    .replace(/\b(you|u|uh|um|uhm|yeah|mm|mmm|hmm)(\s+\1){2,}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWhisperNoiseChunk(text) {
  const sample = stripRepeatedFillerRuns(text);
  if (!sample) return true;
  if (isSingleGlyphLoop(sample)) return true;

  const normalized = normalize(sample);
  if (!normalized) return true;
  if (NOISE_EXACT.has(normalized)) return true;
  if (NOISE_PHRASE_RE.some((re) => re.test(normalized))) return true;

  const tokens = tokensOf(sample);
  if (!tokens.length) return true;
  if (isRepeatedSameWord(tokens)) return true;

  const unique = new Set(tokens);
  const maxCount = Math.max(
    ...[...unique].map((word) => tokens.filter((token) => token === word).length)
  );
  const topWord = [...unique].find(
    (word) => tokens.filter((token) => token === word).length === maxCount
  );
  if (
    tokens.length >= 4 &&
    maxCount / tokens.length >= 0.7 &&
    FILLER.has(topWord)
  ) {
    return true;
  }

  if (tokens.length <= 8 && fillerRatio(tokens) >= 0.85) return true;
  if (tokens.length <= 3 && tokens.every((token) => FILLER.has(token))) return true;

  return false;
}

function splitForFilter(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function filterWhisperNoise(text) {
  const source = String(text || "").trim();
  if (!source) return "";
  const paragraphs = source.split(/\n{2,}/);
  const cleaned = paragraphs
    .map((para) =>
      splitForFilter(para)
        .map((part) => stripRepeatedFillerRuns(part))
        .filter((part) => part && !isWhisperNoiseChunk(part))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
  return cleaned.join("\n\n");
}

module.exports = {
  isWhisperNoiseChunk,
  filterWhisperNoise,
};
