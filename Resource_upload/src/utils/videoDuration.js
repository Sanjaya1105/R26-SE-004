const { parseBuffer } = require("music-metadata");

const MAX_VIDEO_DURATION_SEC = 15 * 60;

class VideoDurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "VideoDurationError";
    this.status = 400;
  }
}

/**
 * Reads duration from the uploaded video buffer and rejects clips longer than 15 minutes.
 */
async function assertVideoDurationLimit(file) {
  if (!file?.buffer?.length) return;

  let durationSec;
  try {
    const metadata = await parseBuffer(file.buffer, {
      mimeType: file.mimetype,
      size: file.size,
    });
    durationSec = Number(metadata?.format?.duration);
  } catch (err) {
    throw new VideoDurationError(
      "Could not read video duration. Please upload a standard MP4/WebM file of 15 minutes or less."
    );
  }

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new VideoDurationError(
      "Could not determine video duration. Please upload a video of 15 minutes or less."
    );
  }

  if (durationSec > MAX_VIDEO_DURATION_SEC) {
    const minutes = Math.ceil(durationSec / 60);
    throw new VideoDurationError(
      `Video is too long (${minutes} minutes). Maximum allowed length is 15 minutes.`
    );
  }
}

module.exports = {
  MAX_VIDEO_DURATION_SEC,
  VideoDurationError,
  assertVideoDurationLimit,
};
