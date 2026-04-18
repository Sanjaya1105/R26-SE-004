const { PDFParse } = require("pdf-parse");

function normalizePdfText(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdfText(buffer) {
  if (!buffer || !buffer.length) return "";
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return normalizePdfText(result?.text || "");
  } catch (error) {
    if (parser) {
      try {
        await parser.destroy();
      } catch (_) {
        // ignore parser cleanup issues
      }
    }
    console.error("PDF extraction failed:", error?.message || error);
    return "";
  }
}

module.exports = {
  extractPdfText,
};
