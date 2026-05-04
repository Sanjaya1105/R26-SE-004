/**
 * Hugging Face Inference image generation (server-side).
 * Security: uses HF_API_KEY / HF_API_TOKEN only on the server — never expose to the frontend.
 *
 * Env:
 *   HF_IMAGE_API_URL — e.g. https://api-inference.huggingface.co/models/... or router.huggingface.co/...
 *   HF_API_KEY or HF_API_TOKEN
 *
 * Many endpoints return raw image bytes with Content-Type: application/octet-stream (not image/*).
 * This module detects PNG/JPEG/WebP/GIF from magic bytes and parses common JSON-wrapped base64 shapes.
 */

const HF_TIMEOUT_MS = 180000;
const MAX_503_RETRIES = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function getHfImageAuth() {
  return String(
    process.env.HF_API_KEY || process.env.HF_API_TOKEN || ""
  ).trim();
}

function getHfImageUrl() {
  return String(process.env.HF_IMAGE_API_URL || "").trim();
}

function isImageApiConfigured() {
  return Boolean(getHfImageUrl() && getHfImageAuth());
}

/**
 * Request body for HF text-to-image. SDXL-Turbo must use guidance_scale 0 (per model card).
 * Optional: merge JSON from HF_IMAGE_PARAMETERS_JSON, e.g. {"parameters":{"width":1024,"height":1024}}
 */
function buildHfImageRequestBody(prompt) {
  const strPrompt = String(prompt || "").trim().slice(0, 4000);
  if (process.env.HF_IMAGE_REQUEST_BODY === "openai") {
    return { prompt: strPrompt, response_format: "b64_json" };
  }

  const url = getHfImageUrl().toLowerCase();
  const body = { inputs: strPrompt };

  if (url.includes("sdxl-turbo") || url.includes("stabilityai/sdxl")) {
    const steps = Number(process.env.HF_IMAGE_NUM_STEPS || 1);
    body.parameters = {
      guidance_scale: Number(
        process.env.HF_IMAGE_GUIDANCE_SCALE != null
          ? process.env.HF_IMAGE_GUIDANCE_SCALE
          : 0
      ),
      num_inference_steps: Math.min(4, Math.max(1, Number.isFinite(steps) ? steps : 1)),
    };
  }

  const extra = String(process.env.HF_IMAGE_PARAMETERS_JSON || "").trim();
  if (extra) {
    try {
      const parsed = JSON.parse(extra);
      if (parsed && typeof parsed === "object") {
        if (parsed.parameters && typeof parsed.parameters === "object") {
          body.parameters = { ...(body.parameters || {}), ...parsed.parameters };
        }
        if (typeof parsed.inputs === "string") {
          body.inputs = parsed.inputs.slice(0, 4000);
        }
      }
    } catch {
      // ignore
    }
  }

  return body;
}

function detectRasterFromBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime_type: "image/png", base64: buffer.toString("base64") };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime_type: "image/jpeg", base64: buffer.toString("base64") };
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mime_type: "image/gif", base64: buffer.toString("base64") };
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime_type: "image/webp", base64: buffer.toString("base64") };
  }
  return null;
}

/**
 * Extract image from HF JSON bodies (shapes vary by router / model).
 */
function imageFromJsonObject(d) {
  if (!d || typeof d !== "object") {
    return null;
  }
  if (typeof d.error === "string" && d.error.length > 0) {
    return null;
  }

  if (typeof d.b64_json === "string") {
    return { mime_type: "image/png", base64: String(d.b64_json) };
  }
  if (d?.data?.[0]?.b64_json) {
    return { mime_type: "image/png", base64: String(d.data[0].b64_json) };
  }

  const candidates = [
    d.image,
    d.generated_image,
    d.output,
    d.result,
    d.url,
  ];
  for (const c of candidates) {
    if (typeof c !== "string") {
      continue;
    }
    if (c.startsWith("data:")) {
      const m = c.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        return { mime_type: m[1], base64: m[2] };
      }
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(c.trim()) && c.length > 100) {
      const compact = c.replace(/\s/g, "");
      return { mime_type: "image/png", base64: compact };
    }
  }

  if (Array.isArray(d) && d.length > 0) {
    const first = d[0];
    if (typeof first === "string" && first.length > 50) {
      return { mime_type: "image/png", base64: first.replace(/\s/g, "") };
    }
    if (first && typeof first === "object") {
      return imageFromJsonObject(first);
    }
  }

  if (Array.isArray(d.images) && typeof d.images[0] === "string") {
    return { mime_type: "image/png", base64: String(d.images[0]).replace(/\s/g, "") };
  }

  return null;
}

function firstNonSpaceByte(buffer) {
  let i = 0;
  while (i < buffer.length) {
    const b = buffer[i];
    if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      return { byte: b, offset: i };
    }
    i += 1;
  }
  return { byte: null, offset: 0 };
}

/**
 * Parse HF response bytes into { mime_type, base64 } or null.
 */
function bufferToGeneratedImage(buf, contentTypeHeader) {
  const ctype = String(contentTypeHeader || "");
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const bufLen = buffer.length;
  if (!bufLen) {
    return null;
  }

  if (ctype.includes("image")) {
    const mime = ctype.split(";")[0].trim() || "image/png";
    return { mime_type: mime, base64: buffer.toString("base64") };
  }

  const { byte: firstSig } = firstNonSpaceByte(buffer);
  const looksLikeJson = firstSig === 0x7b || firstSig === 0x5b;
  if (!looksLikeJson) {
    const raster = detectRasterFromBytes(buffer);
    if (raster) {
      return raster;
    }
  }

  if (looksLikeJson || ctype.includes("json")) {
    try {
      const d = JSON.parse(buffer.toString("utf8"));
      const fromObj = imageFromJsonObject(d);
      if (fromObj) {
        return fromObj;
      }
    } catch {
      // not JSON
    }
  }

  const rasterLast = detectRasterFromBytes(buffer);
  if (rasterLast) {
    return rasterLast;
  }

  return null;
}

function logImageDecodeFailure(contentType, buffer) {
  const snippet = buffer.slice(0, 280).toString("utf8").replace(/\s+/g, " ");
  console.warn(
    "[hfTextToImage] Could not decode image response.",
    "Content-Type:",
    contentType || "(none)",
    "Bytes:",
    buffer.length,
    "Snippet:",
    snippet
  );
}

/** HF sometimes returns 200 + JSON { error: "Model ... loading" } */
function jsonIndicatesModelLoading(buffer) {
  try {
    const d = JSON.parse(buffer.toString("utf8"));
    const msg = `${d?.error || ""} ${d?.message || ""}`.toLowerCase();
    return /loading|initializ|warm|starting|not ready|warmup/.test(msg);
  } catch {
    return false;
  }
}

/**
 * POST to HF image endpoint; retries on 503 (model loading / cold start).
 */
async function fetchHfImageBuffer(prompt, attempt = 0) {
  const url = getHfImageUrl();
  const token = getHfImageAuth();
  if (!url || !token) {
    const err = new Error("Image generation not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const strPrompt = String(prompt || "").trim();
  if (!strPrompt) {
    const err = new Error("Image generation failed");
    err.code = "EMPTY_PROMPT";
    throw err;
  }

  const body = buildHfImageRequestBody(strPrompt);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify(body),
      signal: createTimeoutSignal(HF_TIMEOUT_MS),
    });
  } catch (e) {
    const name = e?.name || "";
    const err = new Error("Image generation failed");
    err.code =
      name === "AbortError" || /abort/i.test(String(e?.message))
        ? "TIMEOUT"
        : "NETWORK_ERROR";
    throw err;
  }

  const buf = Buffer.from(await response.arrayBuffer());
  const ct = response.headers.get("content-type") || "";

  if (response.status === 503 && attempt < MAX_503_RETRIES) {
    await sleep(5000 * (attempt + 1));
    return fetchHfImageBuffer(prompt, attempt + 1);
  }

  if (!response.ok) {
    const err = new Error("Image generation failed");
    err.code = "HTTP_ERROR";
    err.status = response.status;
    err.bodyPreview = buf.slice(0, 500).toString("utf8");
    throw err;
  }

  let generated = bufferToGeneratedImage(buf, ct);
  if (
    !generated &&
    jsonIndicatesModelLoading(buf) &&
    attempt < MAX_503_RETRIES
  ) {
    await sleep(5000 * (attempt + 1));
    return fetchHfImageBuffer(prompt, attempt + 1);
  }

  if (!generated) {
    logImageDecodeFailure(ct, buf);
    const err = new Error("Image generation failed");
    err.code = "PARSE_ERROR";
    throw err;
  }

  return generated;
}

/**
 * Returns a data URL suitable for JSON responses (browser: use as img src).
 * Retries once after 2 seconds on any failure (HF cold start, timeouts, transient errors).
 * Throws if both attempts fail.
 */
async function generateImage(prompt) {
  const toDataUrl = ({ mime_type, base64 }) =>
    `data:${mime_type};base64,${base64}`;
  try {
    return toDataUrl(await fetchHfImageBuffer(prompt));
  } catch {
    await sleep(2000);
    return toDataUrl(await fetchHfImageBuffer(prompt));
  }
}

/**
 * Same as generateImage but returns null on any failure (optional labeled-diagram / map base).
 */
async function generateImageFromPrompt(prompt) {
  try {
    const { mime_type, base64 } = await fetchHfImageBuffer(prompt);
    return { mime_type, base64 };
  } catch {
    return null;
  }
}

module.exports = {
  generateImage,
  generateImageFromPrompt,
  isImageApiConfigured,
};
