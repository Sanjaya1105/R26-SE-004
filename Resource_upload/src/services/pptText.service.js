const AdmZip = require("adm-zip");

function decodeXmlEntities(input) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanExtractedText(input) {
  return String(input || "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b[a-zA-Z0-9_:-]+\s*=\s*"[^"]*"/g, " ")
    .replace(/\/[a-zA-Z0-9:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPptxTextFromBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip
    .getEntries()
    .filter(
      (entry) =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName) && !entry.isDirectory
    )
    .sort((a, b) => {
      const aNum = Number(a.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const bNum = Number(b.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return aNum - bNum;
    });

  const chunks = [];
  for (const entry of entries) {
    const xml = entry.getData().toString("utf8");
    const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
    for (const m of matches) {
      const cleaned = cleanExtractedText(decodeXmlEntities(m[1]));
      if (cleaned) chunks.push(cleaned);
    }
  }

  return cleanExtractedText(chunks.join(" "));
}

function extractPptText(buffer, originalName) {
  const lower = String(originalName || "").toLowerCase();
  if (lower.endsWith(".pptx")) {
    return extractPptxTextFromBuffer(buffer);
  }
  // Legacy .ppt binary format is not parsed here.
  return "";
}

module.exports = {
  extractPptText,
};
