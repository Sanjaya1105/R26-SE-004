const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const Course = require("../models/course.model");

function parseKeywords(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function uploadImageBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "upload_section_course_thumbnails",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

const createCourse = async (req, res) => {
  const courseName = (req.body.courseName || "").trim();
  const description = (req.body.description || "").trim();
  const keywords = parseKeywords(req.body.keywords || "");
  const educatorId = req.user?.id ? String(req.user.id).trim() : "";

  if (!educatorId || !mongoose.Types.ObjectId.isValid(educatorId)) {
    return res.status(400).json({ message: "Invalid educator session." });
  }

  if (!courseName) {
    return res.status(400).json({ message: "Course name is required." });
  }

  if (!req.file?.buffer) {
    return res.status(400).json({ message: "Thumbnail is required." });
  }

  let uploadResult;
  try {
    uploadResult = await uploadImageBuffer(req.file.buffer);
  } catch (error) {
    console.error("Cloudinary thumbnail upload failed:", error.message);
    return res.status(502).json({ message: "Failed to upload thumbnail." });
  }

  const thumbnailUrl = uploadResult.secure_url;

  try {
    const course = await Course.create({
      educatorId,
      courseName,
      thumbnailUrl,
      keywords,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Course saved successfully",
      data: {
        id: course._id,
        courseName: course.courseName,
        thumbnailUrl: course.thumbnailUrl,
        keywords: course.keywords,
        description: course.description,
        educatorId: course.educatorId,
        createdAt: course.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    if (uploadResult?.public_id) {
      cloudinary.uploader.destroy(uploadResult.public_id).catch(() => {});
    }
    return res.status(500).json({ message: "Failed to save course." });
  }
};

module.exports = { createCourse };
