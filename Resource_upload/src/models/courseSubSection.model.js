const mongoose = require("mongoose");

const imageEntrySchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const courseSubSectionSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    order: { type: Number, default: 0 },
    videoUrl: { type: String, default: "" },
    videoPublicId: { type: String, default: "" },
    pptUrl: { type: String, default: "" },
    pptPublicId: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    pdfPublicId: { type: String, default: "" },
    images: { type: [imageEntrySchema], default: [] },
    pptText: { type: String, default: "" },
    pdfText: { type: String, default: "" },
    transcriptText: { type: String, default: "" },
    transcriptPreview: { type: String, default: "" },
    transcriptChunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseSubSectionSchema.index({ sectionId: 1, order: 1 });

module.exports = mongoose.model(
  "CourseSubSection",
  courseSubSectionSchema,
  "course_subsection"
);
