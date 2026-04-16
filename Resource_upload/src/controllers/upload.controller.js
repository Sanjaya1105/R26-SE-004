const cloudinary = require("../config/cloudinary");
const UploadEntry = require("../models/uploadEntry.model");

const healthCheck = (req, res) => {
  res.json({
    message: "Resource_upload server is running",
    database: "upload_section",
  });
};

const createNameEntry = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a string",
      });
    }

    const savedEntry = await UploadEntry.create({ name: name.trim() });

    return res.status(201).json({
      success: true,
      message: "Name saved successfully",
      data: {
        id: savedEntry._id,
        name: savedEntry.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save name",
    });
  }
};

const createNameWithVideo = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a string",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Video file is required",
      });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "upload_section_videos",
          resource_type: "video",
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const savedEntry = await UploadEntry.create({
      name: name.trim(),
      videoUrl: uploadResult.secure_url,
      videoPublicId: uploadResult.public_id,
    });

    return res.status(201).json({
      success: true,
      message: "Video uploaded and saved successfully",
      data: {
        id: savedEntry._id,
        name: savedEntry.name,
        videoUrl: savedEntry.videoUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload video",
    });
  }
};

module.exports = {
  healthCheck,
  createNameEntry,
  createNameWithVideo,
};
