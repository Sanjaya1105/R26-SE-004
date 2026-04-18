const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const CourseSection = require("../models/courseSection.model");
const CourseSubSection = require("../models/courseSubSection.model");
const {
  resolveEducatorNameFromRequest,
  ensureCourseEducatorName,
} = require("../utils/educatorDisplay");

const MAX_VIDEO = 40 * 1024 * 1024;
const MAX_OFFICE = 15 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

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

  const hasAny =
    Boolean(videoFile?.buffer?.length) ||
    Boolean(pptFile?.buffer?.length) ||
    Boolean(pdfFile?.buffer?.length) ||
    imageFiles.some((f) => f.buffer?.length);

  if (!hasAny) {
    return res.status(400).json({
      message: "Upload at least one file (video, PPT, PDF, or images).",
    });
  }

  if (videoFile?.size > MAX_VIDEO) {
    return res.status(400).json({ message: "Video must be 40MB or smaller." });
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
    pdfUrl: "",
    pdfPublicId: "",
    images: [],
  };

  const rollbackIds = [];

  try {
    if (videoFile?.buffer?.length) {
      if (!videoFile.mimetype.startsWith("video/")) {
        return res.status(400).json({ message: "Video file must be a video." });
      }
      const r = await uploadBuffer(videoFile.buffer, {
        folder: "upload_section_subsections/video",
        resource_type: "video",
      });
      uploaded.videoUrl = r.secure_url;
      uploaded.videoPublicId = r.public_id;
      rollbackIds.push(r.public_id);
    }

    if (pptFile?.buffer?.length) {
      const r = await uploadBuffer(pptFile.buffer, {
        folder: "upload_section_subsections/ppt",
        resource_type: "raw",
      });
      uploaded.pptUrl = r.secure_url;
      uploaded.pptPublicId = r.public_id;
      rollbackIds.push(r.public_id);
    }

    if (pdfFile?.buffer?.length) {
      const r = await uploadBuffer(pdfFile.buffer, {
        folder: "upload_section_subsections/pdf",
        resource_type: "raw",
      });
      uploaded.pdfUrl = r.secure_url;
      uploaded.pdfPublicId = r.public_id;
      rollbackIds.push(r.public_id);
    }

    for (const img of imageFiles) {
      if (!img.buffer?.length) continue;
      const r = await uploadBuffer(img.buffer, {
        folder: "upload_section_subsections/images",
        resource_type: "image",
      });
      uploaded.images.push({ url: r.secure_url, publicId: r.public_id });
      rollbackIds.push(r.public_id);
    }

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
          pdfUrl: doc.pdfUrl,
          images: doc.images,
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

  const hasAny =
    Boolean(videoFile?.buffer?.length) ||
    Boolean(pptFile?.buffer?.length) ||
    Boolean(pdfFile?.buffer?.length) ||
    imageFiles.some((f) => f.buffer?.length);

  if (!hasAny) {
    return res.status(400).json({
      message:
        "Provide at least one new file (video, PPT, PDF, or images) to update this subsection.",
    });
  }

  if (videoFile?.size > MAX_VIDEO) {
    return res.status(400).json({ message: "Video must be 40MB or smaller." });
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
      const r = await uploadBuffer(videoFile.buffer, {
        folder: "upload_section_subsections/video",
        resource_type: "video",
      });
      doc.videoUrl = r.secure_url;
      doc.videoPublicId = r.public_id;
      rollbackIds.push(r.public_id);
    }

    if (pptFile?.buffer?.length) {
      if (doc.pptPublicId) {
        cloudinary.uploader.destroy(doc.pptPublicId, { resource_type: "raw" }).catch(() => {});
      }
      const r = await uploadBuffer(pptFile.buffer, {
        folder: "upload_section_subsections/ppt",
        resource_type: "raw",
      });
      doc.pptUrl = r.secure_url;
      doc.pptPublicId = r.public_id;
      rollbackIds.push(r.public_id);
    }

    if (pdfFile?.buffer?.length) {
      if (doc.pdfPublicId) {
        cloudinary.uploader.destroy(doc.pdfPublicId, { resource_type: "raw" }).catch(() => {});
      }
      const r = await uploadBuffer(pdfFile.buffer, {
        folder: "upload_section_subsections/pdf",
        resource_type: "raw",
      });
      doc.pdfUrl = r.secure_url;
      doc.pdfPublicId = r.public_id;
      rollbackIds.push(r.public_id);
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
