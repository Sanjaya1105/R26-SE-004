const path = require("path");
const cloudinary = require("../config/cloudinary");

const PPT_EXTS = new Set([".ppt", ".pptx"]);

function originalOfficeFileName(kind, originalName) {
  const base = path.basename(String(originalName || "").trim());
  const ext = path.extname(base).toLowerCase();
  if (kind === "ppt") {
    if (base && PPT_EXTS.has(ext)) return base;
    return "lesson.pptx";
  }
  if (base && ext === ".pdf") return base;
  return "lesson.pdf";
}

function mimeForFileName(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/octet-stream";
}

function contentDispositionAttachment(fileName) {
  const safe = String(fileName || "download")
    .replace(/[/\\]/g, "")
    .replace(/"/g, "")
    .slice(0, 180);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function rawPublicId(originalName) {
  const fileName = path.basename(String(originalName || "file"));
  const ext = path.extname(fileName).toLowerCase();
  const stem = path
    .basename(fileName, ext)
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "lesson";
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${stem}_${unique}${ext}`;
}

function uploadRawDocument(buffer, folder, originalName) {
  const publicId = rawPublicId(originalName);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function fileNameFromStoredUrl(url, fallback) {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    const base = path.posix.basename(pathname);
    if (base && path.extname(base)) return base;
  } catch (_) {
    // ignore malformed Cloudinary URLs
  }
  return fallback;
}

function sniffOfficeFileName(buffer, kind, preferredName) {
  if (preferredName && path.extname(preferredName)) return preferredName;
  const head = Buffer.isBuffer(buffer) ? buffer.subarray(0, 8) : Buffer.alloc(0);
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf;
  if (kind === "pdf" || isPdf) return "lesson.pdf";
  if (isOle) return "lesson.ppt";
  if (isZip) return "lesson.pptx";
  return kind === "ppt" ? "lesson.pptx" : "lesson.pdf";
}

module.exports = {
  originalOfficeFileName,
  mimeForFileName,
  contentDispositionAttachment,
  uploadRawDocument,
  fileNameFromStoredUrl,
  sniffOfficeFileName,
};
