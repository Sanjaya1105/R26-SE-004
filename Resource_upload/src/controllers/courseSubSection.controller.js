const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const CourseSection = require("../models/courseSection.model");
const CourseSubSection = require("../models/courseSubSection.model");
const SubsectionTranscriptChunk = require("../models/subsectionTranscriptChunk.model");
const { runWhisperTranscription } = require("../services/transcription.service");
const { extractPptText, extractPptMathText } = require("../services/pptText.service");
const { extractPdfText, extractPdfMathText } = require("../services/pdfText.service");
const {
  resolveEducatorNameFromRequest,
  ensureCourseEducatorName,
} = require("../utils/educatorDisplay");
const { assertVideoDurationLimit } = require("../utils/videoDuration");
const { parseContainsMath, hasContainsMathField } = require("../utils/parseContainsMath");
const { collectEquations } = require("../utils/mathText");
const { dedupeSubsectionExtracts } = require("../services/semanticDedupe.service");
const {
  extractAndStoreDocumentImages,
  replaceExtractedBySource,
  destroyCloudinaryImages,
  mapExtractedImages,
} = require("../services/documentImage.service");
const {
  originalOfficeFileName,
  uploadRawDocument,
} = require("../utils/officeFiles");

const MAX_VIDEO = 40 * 1024 * 1024;
const MAX_OFFICE = 15 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

function toEquationDocs(latexList, source) {
  return (latexList || [])
    .map((latex) => String(latex || "").trim())
    .filter(Boolean)
    .map((latex) => ({ latex, source }));
}

function fileNameFromUrl(url, fallback) {
  try {
    const pathname = new URL(url).pathname;
    const base = decodeURIComponent(pathname.split("/").pop() || "");
    return base || fallback;
  } catch (_) {
    return fallback;
  }
}

async function fetchRemoteBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download stored file (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractLessonDocuments({ pptBuffer, pptName, pdfBuffer, containsMath }) {
  let pptText = "";
  let pdfText = "";
  const equations = [];

  if (pptBuffer?.length) {
    if (containsMath) {
      const result = extractPptMathText(pptBuffer, pptName);
      pptText = result.text || "";
      equations.push(...toEquationDocs(result.equations, "ppt"));
    } else {
      pptText = extractPptText(pptBuffer, pptName);
    }
  }

  if (pdfBuffer?.length) {
    if (containsMath) {
      const result = await extractPdfMathText(pdfBuffer);
      pdfText = result.text || "";
      equations.push(...toEquationDocs(result.equations, "pdf"));
    } else {
      pdfText = await extractPdfText(pdfBuffer);
    }
  }

  if (containsMath && !equations.length) {
    equations.push(
      ...toEquationDocs(collectEquations(pptText), "ppt"),
      ...toEquationDocs(collectEquations(pdfText), "pdf")
    );
  }

  return { pptText, pdfText, equations: containsMath ? equations : [] };
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
    stream.end(buffer);
  });
}

const createSubSection = async (req, res) => {
  const { sectionId: sectionIdParam } = req.params;
  const educatorId = req.user?.id ? String(req.user.id).trim() : "";

  if (!educatorId || !mongoose.Types.ObjectId.isValid(educatorId)) {
    return res.status(400).json({ message: "Invalid educator session." });
  }

  if (!sectionIdParam || !mongoose.Types.ObjectId.isValid(sectionIdParam)) {
    return res.status(400).json({ message: "Invalid section id." });
  }

  const sectionObjectId = new mongoose.Types.ObjectId(sectionIdParam);
  const section = await CourseSection.findById(sectionObjectId).lean();
  if (!section) {
    return res.status(404).json({ message: "Section not found." });
  }

  if (String(section.educatorId) !== educatorId) {
    return res.status(403).json({ message: "Access denied for this section." });
  }

  const files = req.files || {};
  const videoFile = files.video?.[0];
  const pptFile = files.ppt?.[0];
  const pdfFile = files.pdf?.[0];
  const imageFiles = files.images || [];

  if (!videoFile?.buffer?.length) {
    return res.status(400).json({
      message: "Video is required for subsection. PPT, PDF, and images are optional.",
    });
  }

  if (videoFile?.size > MAX_VIDEO) {
    return res.status(400).json({ message: "Video must be 40MB or smaller." });
  }
  try {
    await assertVideoDurationLimit(videoFile);
  } catch (durationErr) {
    return res.status(400).json({
      message: durationErr.message || "Video must be 15 minutes or less.",
    });
  }
  if (pptFile?.size > MAX_OFFICE) {
    return res.status(400).json({ message: "PPT must be 15MB or smaller." });
  }
  if (pdfFile?.size > MAX_OFFICE) {
    return res.status(400).json({ message: "PDF must be 15MB or smaller." });
  }
  for (const img of imageFiles) {
    if (img.size > MAX_IMAGE) {
      return res.status(400).json({ message: "Each image must be 5MB or smaller." });
    }
    if (!img.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Images must be image files." });
    }
  }

  const uploaded = {
    videoUrl: "",
    videoPublicId: "",
    pptUrl: "",
    pptPublicId: "",
    pptFileName: "",
    pdfUrl: "",
    pdfPublicId: "",
    pdfFileName: "",
    images: [],
    extractedImages: [],
    pptText: "",
    pdfText: "",
    transcriptText: "",
    transcriptPreview: "",
    transcriptChunkCount: 0,
    containsMath: parseContainsMath(req.body),
    equations: [],
  };

  const rollbackIds = [];

  try {
    let transcriptionResult = { text: "", chunks: [] };
    if (videoFile?.buffer?.length) {
      if (!videoFile.mimetype.startsWith("video/")) {
        return res.status(400).json({ message: "Video file must be a video." });
      }
      transcriptionResult = await runWhisperTranscription(
        videoFile.buffer,
        videoFile.originalname
      );
      const r = await uploadBuffer(videoFile.buffer, {
        folder: "upload_section_subsections/video",
        resource_type: "video",
      });
      uploaded.videoUrl = r.secure_url;
      uploaded.videoPublicId = r.public_id;
      uploaded.transcriptText = transcriptionResult.text || "";
      uploaded.transcriptPreview = (transcriptionResult.text || "").slice(0, 300);
      uploaded.transcriptChunkCount = Array.isArray(transcriptionResult.chunks)
        ? transcriptionResult.chunks.length
        : 0;
      rollbackIds.push(r.public_id);
    }

    if (pptFile?.buffer?.length) {
      const extracted = await extractLessonDocuments({
        pptBuffer: pptFile.buffer,
        pptName: pptFile.originalname,
        containsMath: uploaded.containsMath,
      });
      uploaded.pptText = extracted.pptText;
      uploaded.equations.push(...extracted.equations);
      const fileName = originalOfficeFileName("ppt", pptFile.originalname);
      const r = await uploadRawDocument(
        pptFile.buffer,
        "upload_section_subsections/ppt",
        fileName
      );
      uploaded.pptUrl = r.secure_url;
      uploaded.pptPublicId = r.public_id;
      uploaded.pptFileName = fileName;
      rollbackIds.push(r.public_id);
    }

    if (pdfFile?.buffer?.length) {
      const extracted = await extractLessonDocuments({
        pdfBuffer: pdfFile.buffer,
        containsMath: uploaded.containsMath,
      });
      uploaded.pdfText = extracted.pdfText;
      uploaded.equations.push(...extracted.equations);
      const fileName = originalOfficeFileName("pdf", pdfFile.originalname);
      const r = await uploadRawDocument(
        pdfFile.buffer,
        "upload_section_subsections/pdf",
        fileName
      );
      uploaded.pdfUrl = r.secure_url;
      uploaded.pdfPublicId = r.public_id;
      uploaded.pdfFileName = fileName;
      rollbackIds.push(r.public_id);
    }

    uploaded.extractedImages = await extractAndStoreDocumentImages({
      pptBuffer: pptFile?.buffer,
      pdfBuffer: pdfFile?.buffer,
      rollbackIds,
    });

    for (const img of imageFiles) {
      if (!img.buffer?.length) continue;
      const r = await uploadBuffer(img.buffer, {
        folder: "upload_section_subsections/images",
        resource_type: "image",
      });
      uploaded.images.push({ url: r.secure_url, publicId: r.public_id });
      rollbackIds.push(r.public_id);
    }

    const dedupeResult = await dedupeSubsectionExtracts({
      pptText: uploaded.pptText,
      pdfText: uploaded.pdfText,
      transcriptText: uploaded.transcriptText,
      protectMath: uploaded.containsMath,
    });
    uploaded.dedupedPptText = dedupeResult.ppt || "";
    uploaded.dedupedPdfText = dedupeResult.pdf || "";
    uploaded.dedupedTranscriptText = dedupeResult.transcript || "";
    uploaded.dedupeStats = dedupeResult.stats || null;

    const order = await CourseSubSection.countDocuments({
      sectionId: sectionObjectId,
    });
    const doc = await CourseSubSection.create({
      sectionId: sectionObjectId,
      courseId: section.courseId,
      educatorId: new mongoose.Types.ObjectId(educatorId),
      order,
      ...uploaded,
    });

    if (Array.isArray(transcriptionResult.chunks) && transcriptionResult.chunks.length > 0) {
      const chunkDocs = transcriptionResult.chunks.map((chunk, idx) => ({
        courseId: section.courseId,
        sectionId: sectionObjectId,
        subsectionId: doc._id,
        index: Number.isFinite(chunk.index) ? chunk.index : idx,
        startSec: Number(chunk.startSec ?? idx * 10),
        endSec: Number(chunk.endSec ?? (idx + 1) * 10),
        text: chunk.text || "",
      }));
      await SubsectionTranscriptChunk.insertMany(chunkDocs);
    }

    await ensureCourseEducatorName(
      section.courseId,
      resolveEducatorNameFromRequest(req)
    );

    return res.status(201).json({
      success: true,
      message: "Subsection saved under this section.",
      data: {
        section: {
          id: section._id,
          sectionName: section.sectionName,
          courseId: section.courseId,
          sectionOrder: section.order,
        },
        subsection: {
          id: doc._id,
          sectionId: doc.sectionId,
          courseId: doc.courseId,
          order: doc.order,
          videoUrl: doc.videoUrl,
          pptUrl: doc.pptUrl,
          pptText: doc.pptText,
          pdfUrl: doc.pdfUrl,
          pdfText: doc.pdfText,
          images: doc.images,
          extractedImages: mapExtractedImages(doc.extractedImages),
          containsMath: doc.containsMath,
          transcriptText: doc.transcriptText,
          transcriptPreview: doc.transcriptPreview,
          transcriptChunkCount: doc.transcriptChunkCount,
          createdAt: doc.createdAt,
        },
      },
    });
  } catch (error) {
    console.error(error);
    for (const pid of rollbackIds) {
      cloudinary.uploader.destroy(pid, { resource_type: "auto" }).catch(() => {});
    }
    return res.status(500).json({
      message: error.message || "Failed to save subsection.",
    });
  }
};

const updateSubSection = async (req, res) => {
  const { sectionId: sectionIdParam, subsectionId } = req.params;
  const educatorId = req.user?.id ? String(req.user.id).trim() : "";

  if (!educatorId || !mongoose.Types.ObjectId.isValid(educatorId)) {
    return res.status(400).json({ message: "Invalid educator session." });
  }

  if (!sectionIdParam || !mongoose.Types.ObjectId.isValid(sectionIdParam)) {
    return res.status(400).json({ message: "Invalid section id." });
  }

  if (!subsectionId || !mongoose.Types.ObjectId.isValid(subsectionId)) {
    return res.status(400).json({ message: "Invalid subsection id." });
  }

  const sectionObjectId = new mongoose.Types.ObjectId(sectionIdParam);
  const section = await CourseSection.findById(sectionObjectId).lean();
  if (!section) {
    return res.status(404).json({ message: "Section not found." });
  }

  if (String(section.educatorId) !== educatorId) {
    return res.status(403).json({ message: "Access denied for this section." });
  }

  const doc = await CourseSubSection.findById(subsectionId);
  if (!doc) {
    return res.status(404).json({ message: "Subsection not found." });
  }

  if (String(doc.sectionId) !== String(sectionObjectId)) {
    return res.status(400).json({ message: "Subsection does not belong to this section." });
  }

  if (String(doc.educatorId) !== educatorId) {
    return res.status(403).json({ message: "Access denied for this subsection." });
  }

  const files = req.files || {};
  const videoFile = files.video?.[0];
  const pptFile = files.ppt?.[0];
  const pdfFile = files.pdf?.[0];
  const imageFiles = files.images || [];

  const nextContainsMath = hasContainsMathField(req.body)
    ? parseContainsMath(req.body)
    : Boolean(doc.containsMath);
  const mathModeChanged = nextContainsMath !== Boolean(doc.containsMath);

  const hasAny =
    Boolean(videoFile?.buffer?.length) ||
    Boolean(pptFile?.buffer?.length) ||
    Boolean(pdfFile?.buffer?.length) ||
    imageFiles.some((f) => f.buffer?.length) ||
    hasContainsMathField(req.body);

  if (!hasAny) {
    return res.status(400).json({
      message:
        "Provide at least one new file (video, PPT, PDF, or images) or update the equations option.",
    });
  }

  if (videoFile?.size > MAX_VIDEO) {
    return res.status(400).json({ message: "Video must be 40MB or smaller." });
  }
  if (videoFile?.buffer?.length) {
    try {
      await assertVideoDurationLimit(videoFile);
    } catch (durationErr) {
      return res.status(400).json({
        message: durationErr.message || "Video must be 15 minutes or less.",
      });
    }
  }
  if (pptFile?.size > MAX_OFFICE) {
    return res.status(400).json({ message: "PPT must be 15MB or smaller." });
  }
  if (pdfFile?.size > MAX_OFFICE) {
    return res.status(400).json({ message: "PDF must be 15MB or smaller." });
  }
  for (const img of imageFiles) {
    if (img.size > MAX_IMAGE) {
      return res.status(400).json({ message: "Each image must be 5MB or smaller." });
    }
    if (img.buffer?.length && !img.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Images must be image files." });
    }
  }

  const rollbackIds = [];

  try {
    if (videoFile?.buffer?.length) {
      if (!videoFile.mimetype.startsWith("video/")) {
        return res.status(400).json({ message: "Video file must be a video." });
      }
      if (doc.videoPublicId) {
        cloudinary.uploader
          .destroy(doc.videoPublicId, { resource_type: "video" })
          .catch(() => {});
      }
      const transcriptionResult = await runWhisperTranscription(
        videoFile.buffer,
        videoFile.originalname
      );
      const r = await uploadBuffer(videoFile.buffer, {
        folder: "upload_section_subsections/video",
        resource_type: "video",
      });
      doc.videoUrl = r.secure_url;
      doc.videoPublicId = r.public_id;
      rollbackIds.push(r.public_id);
      doc.transcriptText = transcriptionResult.text || "";
      doc.transcriptPreview = (transcriptionResult.text || "").slice(0, 300);
      doc.transcriptChunkCount = Array.isArray(transcriptionResult.chunks)
        ? transcriptionResult.chunks.length
        : 0;

      await SubsectionTranscriptChunk.deleteMany({ subsectionId: doc._id });
      if (Array.isArray(transcriptionResult.chunks) && transcriptionResult.chunks.length > 0) {
        const chunkDocs = transcriptionResult.chunks.map((chunk, idx) => ({
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
    }

    if (pptFile?.buffer?.length) {
      if (doc.pptPublicId) {
        cloudinary.uploader.destroy(doc.pptPublicId, { resource_type: "raw" }).catch(() => {});
      }
      const extracted = await extractLessonDocuments({
        pptBuffer: pptFile.buffer,
        pptName: pptFile.originalname,
        containsMath: nextContainsMath,
      });
      doc.pptText = extracted.pptText;
      const fileName = originalOfficeFileName("ppt", pptFile.originalname);
      const r = await uploadRawDocument(
        pptFile.buffer,
        "upload_section_subsections/ppt",
        fileName
      );
      doc.pptUrl = r.secure_url;
      doc.pptPublicId = r.public_id;
      doc.pptFileName = fileName;
      rollbackIds.push(r.public_id);
      const pptExtracted = await extractAndStoreDocumentImages({
        pptBuffer: pptFile.buffer,
        rollbackIds,
      });
      destroyCloudinaryImages(
        (doc.extractedImages || []).filter((img) => img.source === "ppt")
      );
      doc.extractedImages = replaceExtractedBySource(
        doc.extractedImages,
        "ppt",
        pptExtracted
      );
      doc.markModified("extractedImages");
    } else if (mathModeChanged && doc.pptUrl) {
      try {
        const remote = await fetchRemoteBuffer(doc.pptUrl);
        const extracted = await extractLessonDocuments({
          pptBuffer: remote,
          pptName: fileNameFromUrl(doc.pptUrl, "lesson.pptx"),
          containsMath: nextContainsMath,
        });
        doc.pptText = extracted.pptText;
      } catch (error) {
        console.warn("[math-extract] Could not re-parse stored PPT:", error.message);
      }
    }

    if (pdfFile?.buffer?.length) {
      if (doc.pdfPublicId) {
        cloudinary.uploader.destroy(doc.pdfPublicId, { resource_type: "raw" }).catch(() => {});
      }
      const extracted = await extractLessonDocuments({
        pdfBuffer: pdfFile.buffer,
        containsMath: nextContainsMath,
      });
      doc.pdfText = extracted.pdfText;
      const fileName = originalOfficeFileName("pdf", pdfFile.originalname);
      const r = await uploadRawDocument(
        pdfFile.buffer,
        "upload_section_subsections/pdf",
        fileName
      );
      doc.pdfUrl = r.secure_url;
      doc.pdfPublicId = r.public_id;
      doc.pdfFileName = fileName;
      rollbackIds.push(r.public_id);
      const pdfExtracted = await extractAndStoreDocumentImages({
        pdfBuffer: pdfFile.buffer,
        rollbackIds,
      });
      destroyCloudinaryImages(
        (doc.extractedImages || []).filter((img) => img.source === "pdf")
      );
      doc.extractedImages = replaceExtractedBySource(
        doc.extractedImages,
        "pdf",
        pdfExtracted
      );
      doc.markModified("extractedImages");
    } else if (mathModeChanged && doc.pdfUrl) {
      try {
        const remote = await fetchRemoteBuffer(doc.pdfUrl);
        const extracted = await extractLessonDocuments({
          pdfBuffer: remote,
          containsMath: nextContainsMath,
        });
        doc.pdfText = extracted.pdfText;
      } catch (error) {
        console.warn("[math-extract] Could not re-parse stored PDF:", error.message);
      }
    }

    doc.containsMath = nextContainsMath;
    if (nextContainsMath) {
      const pptEq = toEquationDocs(collectEquations(doc.pptText), "ppt");
      const pdfEq = toEquationDocs(collectEquations(doc.pdfText), "pdf");
      doc.equations = [...pptEq, ...pdfEq];
    } else {
      doc.equations = [];
    }

    if (imageFiles.some((f) => f.buffer?.length)) {
      if (Array.isArray(doc.images)) {
        for (const im of doc.images) {
          if (im.publicId) {
            cloudinary.uploader.destroy(im.publicId, { resource_type: "image" }).catch(() => {});
          }
        }
      }
      const newImages = [];
      for (const img of imageFiles) {
        if (!img.buffer?.length) continue;
        const r = await uploadBuffer(img.buffer, {
          folder: "upload_section_subsections/images",
          resource_type: "image",
        });
        newImages.push({ url: r.secure_url, publicId: r.public_id });
        rollbackIds.push(r.public_id);
      }
      doc.images = newImages;
    }

    const dedupeResult = await dedupeSubsectionExtracts({
      pptText: doc.pptText,
      pdfText: doc.pdfText,
      transcriptText: doc.transcriptText,
      protectMath: nextContainsMath,
    });
    doc.dedupedPptText = dedupeResult.ppt || "";
    doc.dedupedPdfText = dedupeResult.pdf || "";
    doc.dedupedTranscriptText = dedupeResult.transcript || "";
    doc.dedupeStats = dedupeResult.stats || null;

    await doc.save();

    await ensureCourseEducatorName(
      section.courseId,
      resolveEducatorNameFromRequest(req)
    );

    return res.status(200).json({
      success: true,
      message: "Subsection updated.",
      data: {
        subsection: {
          id: doc._id,
          sectionId: doc.sectionId,
          courseId: doc.courseId,
          order: doc.order,
          videoUrl: doc.videoUrl,
          pptUrl: doc.pptUrl,
          pdfUrl: doc.pdfUrl,
          images: doc.images,
          extractedImages: mapExtractedImages(doc.extractedImages),
          containsMath: doc.containsMath,
          updatedAt: doc.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error(error);
    for (const pid of rollbackIds) {
      cloudinary.uploader.destroy(pid, { resource_type: "auto" }).catch(() => {});
    }
    return res.status(500).json({
      message: error.message || "Failed to update subsection.",
    });
  }
};

module.exports = { createSubSection, updateSubSection };
