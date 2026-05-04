/**
 * Extracts a JSON value from an LLM reply that may include prose or fenced blocks.
 */
function parseJsonFromLlm(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return {};
  }

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : text;

  const attempts = [candidate];

  const objStart = candidate.indexOf("{");
  const objEnd = candidate.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    attempts.push(candidate.slice(objStart, objEnd + 1));
  }

  const arrStart = candidate.indexOf("[");
  const arrEnd = candidate.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    attempts.push(candidate.slice(arrStart, arrEnd + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // keep trying
    }
  }

  // Best-effort repair for common LLM JSON mistakes.
  for (const attempt of attempts) {
    const repaired = attempt
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
        return `"${String(inner).replace(/"/g, '\\"')}"`;
      });
    try {
      return JSON.parse(repaired);
    } catch {
      // keep trying
    }
  }

  return {};
}

module.exports = { parseJsonFromLlm };
