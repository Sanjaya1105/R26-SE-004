const express = require("express");
const multer = require("multer");
const ensureGatewayAccess = require("../middleware/gatewayAuth.middleware");
const verifyTeacherJwt = require("../middleware/verifyTeacherJwt.middleware");
const {
  createCourse,
  listPublicCourses,
  getPublicCourseDetail,
  listMyCourses,
  getCourseForEdit,
  updateCourse,
  deleteCourse,
} = require("../controllers/course.controller");
const {
  createCourseSections,
  createSingleSection,
} = require("../controllers/courseSection.controller");

const router = express.Router();

router.get("/public/courses", ensureGatewayAccess, listPublicCourses);
router.get(
  "/public/courses/:courseId",
  ensureGatewayAccess,
  getPublicCourseDetail
);

router.get(
  "/courses/mine",
  ensureGatewayAccess,
  verifyTeacherJwt,
  listMyCourses
);

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

router.get(
  "/courses/:courseId/for-edit",
  ensureGatewayAccess,
  verifyTeacherJwt,
  getCourseForEdit
);

router.patch(
  "/courses/:courseId",
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
  updateCourse
);

router.delete(
  "/courses/:courseId",
  ensureGatewayAccess,
  verifyTeacherJwt,
  deleteCourse
);

router.post(
  "/courses/:courseId/section",
  ensureGatewayAccess,
  verifyTeacherJwt,
  createSingleSection
);

router.post(
  "/courses/:courseId/sections",
  ensureGatewayAccess,
  verifyTeacherJwt,
  createCourseSections
);

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
