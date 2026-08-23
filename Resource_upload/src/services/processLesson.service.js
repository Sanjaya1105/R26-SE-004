const CourseSubSection = require("../models/courseSubSection.model");
const SubsectionTranscriptChunk = require("../models/subsectionTranscriptChunk.model");
const {
  runWhisperTranscription,
  runWhisperFromUrl,
} = require("./transcription.service");
const {
  extractLessonDocuments,
  fetchRemoteBuffer,
  fileNameFromUrl,
} = require("./lessonExtract.service");
const {
  extractAndStoreDocumentImages,
  replaceExtractedBySource,
} = require("./documentImage.service");
const { dedupeSubsectionExtracts } = require("./semanticDedupe.service");
const {
  evaluateKnowledgeQuality,
  applyUniqueKnowledge,
} = require("./knowledgeQuality.service");
const { filterWhisperNoise } = require("./whisperNoise.service");
const { notifyLessonProcessed } = require("./pushNotification.service");
const { readVideoDurationSec } = require("../utils/videoDuration");

const running = new Set();

function hasUsableKnowledge(dedupeResult, transcriptText) {
  const uniqueLen = [dedupeResult?.ppt, dedupeResult?.pdf, dedupeResult?.transcript]
    .map((text) => String(text || "").trim())
    .join("\n").length;
  const transcriptLen = filterWhisperNoise(transcriptText).length;
  return uniqueLen > 0 || transcriptLen > 0;
}

async function transcribeVideo(doc, assets, transcribe) {
  const existing = doc.transcriptText || "";
  if (!transcribe && existing) {
    return { text: existing, chunks: [] };
  }
  if (assets?.videoBuffer?.length) {
    return runWhisperTranscription(
      assets.videoBuffer,
      assets.videoName || "lesson.mp4"
    );
  }
  if (!doc.videoUrl) {
    return { text: existing, chunks: [] };
  }
  return runWhisperFromUrl(
    doc.videoUrl,
    assets?.videoName || fileNameFromUrl(doc.videoUrl, "lesson.mp4")
  );
}

async function loadOfficeBuffers(doc, assets) {
  let pptBuffer = assets?.pptBuffer || null;
  let pdfBuffer = assets?.pdfBuffer || null;

  if (!pptBuffer?.length && doc.pptUrl) {
    try {
      pptBuffer = await fetchRemoteBuffer(doc.pptUrl);
    } catch (error) {
      console.warn("[lesson-process] PPT download failed:", error.message);
    }
  }
  if (!pdfBuffer?.length && doc.pdfUrl) {
    try {
      pdfBuffer = await fetchRemoteBuffer(doc.pdfUrl);
    } catch (error) {
      console.warn("[lesson-process] PDF download failed:", error.message);
    }
  }

  return {
    pptBuffer,
    pdfBuffer,
    pptName:
      assets?.pptName ||
      doc.pptFileName ||
      fileNameFromUrl(doc.pptUrl, "lesson.pptx"),
  };
}

async function saveTranscriptChunks(doc, chunks) {
  await SubsectionTranscriptChunk.deleteMany({ subsectionId: doc._id });
  if (!Array.isArray(chunks) || !chunks.length) return;
  const chunkDocs = chunks.map((chunk, idx) => ({
    courseId: doc.courseId,
    sectionId: doc.sectionId,
    subsectionId: doc._id,
    index: Number.isFinite(chunk.index) ? chunk.index : idx,
    startSec: Number(chunk.startSec ?? idx * 10),
    endSec: Number(chunk.endSec ?? (idx + 1) * 10),
    text: chunk.text || "",
  }));
  await SubsectionTranscriptChunk.insertMany(chunkDocs);
}

async function processSubsection(subsectionId, options = {}) {
  const transcribe = options.transcribe !== false;
  const extractImages = options.extractImages !== false;
  const assets = options.assets || null;
  const doc = await CourseSubSection.findById(subsectionId);
  if (!doc) return;

  doc.knowledgeStatus = "processing";
  doc.knowledgeStatusReason = "";
  await doc.save();

  try {
    if (
      (!Number(doc.videoDurationSec) || Number(doc.videoDurationSec) <= 0) &&
      assets?.videoBuffer?.length
    ) {
      const durationSec = await readVideoDurationSec({
        buffer: assets.videoBuffer,
        mimetype: "video/mp4",
        size: assets.videoBuffer.length,
      });
      if (durationSec > 0) {
        doc.videoDurationSec = durationSec;
      }
    }

    let transcriptText = doc.transcriptText || "";
    let chunks = [];
    try {
      const transcription = await transcribeVideo(doc, assets, transcribe);
      transcriptText = transcription.text || transcriptText;
      chunks = Array.isArray(transcription.chunks) ? transcription.chunks : [];
      if (chunks.length) {
        doc.transcriptChunkCount = chunks.length;
      }
    } catch (error) {
      console.error("[lesson-process] Whisper failed:", error.message);
      if (!transcriptText) transcriptText = "";
    }

    const { pptBuffer, pdfBuffer, pptName } = await loadOfficeBuffers(doc, assets);
    const extracted = await extractLessonDocuments({
      pptBuffer,
      pptName,
      pdfBuffer,
      containsMath: Boolean(doc.containsMath),
    });
    const pptExtract = extracted.pptText || "";
    const pdfExtract = extracted.pdfText || "";
    const equations = extracted.equations || [];

    if (extractImages && (pptBuffer?.length || pdfBuffer?.length)) {
      const rollbackIds = [];
      const storedImages = await extractAndStoreDocumentImages({
        pptBuffer,
        pdfBuffer,
        rollbackIds,
      });
      if (pptBuffer?.length) {
        doc.extractedImages = replaceExtractedBySource(
          doc.extractedImages,
          "ppt",
          storedImages.filter((img) => img.source === "ppt")
        );
      }
      if (pdfBuffer?.length) {
        doc.extractedImages = replaceExtractedBySource(
          doc.extractedImages,
          "pdf",
          storedImages.filter((img) => img.source === "pdf")
        );
      }
      doc.markModified("extractedImages");
    }

    const dedupeResult = await dedupeSubsectionExtracts({
      pptText: pptExtract,
      pdfText: pdfExtract,
      transcriptText,
      protectMath: Boolean(doc.containsMath),
    });
    const quality = evaluateKnowledgeQuality({
      hasPptFile: Boolean(doc.pptUrl),
      hasPdfFile: Boolean(doc.pdfUrl),
      pptExtractLen: pptExtract.length,
      pdfExtractLen: pdfExtract.length,
      transcriptText,
      dedupedPpt: dedupeResult.ppt,
      dedupedPdf: dedupeResult.pdf,
      dedupedTranscript: dedupeResult.transcript,
      containsMath: Boolean(doc.containsMath),
      equations,
    });
    const usable = hasUsableKnowledge(dedupeResult, transcriptText);
    applyUniqueKnowledge(doc, {
      transcriptText,
      dedupeResult,
      equations,
      containsMath: Boolean(doc.containsMath),
      quality: {
        status: usable ? "ready" : "failed",
        reasons: usable ? [] : quality.reasons.length ? quality.reasons : ["empty_knowledge"],
      },
    });
    await doc.save();
    if (transcribe || chunks.length) {
      await saveTranscriptChunks(doc, chunks);
    }

    console.log(
      "[lesson-process]",
      String(doc._id),
      doc.knowledgeStatus,
      `transcript=${String(doc.transcriptText || "").length}`,
      `ppt=${pptExtract.length}`,
      `pdf=${pdfExtract.length}`,
      `unique=${String(doc.dedupedPptText || "").length + String(doc.dedupedPdfText || "").length + String(doc.dedupedTranscriptText || "").length}`,
      quality.ok ? "ok" : quality.reasons.join(",")
    );
    await notifyLessonProcessed(doc, doc.knowledgeStatus);
  } catch (error) {
    console.error("[lesson-process]", String(subsectionId), error.message);
    doc.knowledgeStatus = "failed";
    doc.knowledgeStatusReason = error.message || "Processing failed";
    await doc.save();
    await notifyLessonProcessed(doc, "failed").catch(() => {});
  }
}

function scheduleProcessSubsection(subsectionId, options = {}) {
  const id = String(subsectionId || "");
  if (!id || running.has(id)) return;
  running.add(id);
  const jobOptions = {
    transcribe: options.transcribe,
    extractImages: options.extractImages,
    assets: options.assets || null,
  };
  setImmediate(() => {
    processSubsection(id, jobOptions)
      .catch((error) => {
        console.error("[lesson-process]", id, error.message);
      })
      .finally(() => {
        running.delete(id);
      });
  });
}

module.exports = {
  scheduleProcessSubsection,
  processSubsection,
};
