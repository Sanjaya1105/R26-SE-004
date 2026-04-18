const express = require("express");
const multer = require("multer");
const ensureGatewayAccess = require("../middleware/gatewayAuth.middleware");
const verifyTeacherJwt = require("../middleware/verifyTeacherJwt.middleware");
const { createCourse } = require("../controllers/course.controller");

const router = express.Router();

const uploadThumbnail = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Thumbnail must be an image file."));
    }
    cb(null, true);
  },
});

router.post(
  "/courses",
  ensureGatewayAccess,
  verifyTeacherJwt,
  (req, res, next) => {
    uploadThumbnail.single("thumbnail")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Thumbnail must be 2MB or smaller." });
      }
      return res.status(400).json({ message: err.message || "Invalid thumbnail upload." });
    });
  },
  createCourse
);

module.exports = router;
