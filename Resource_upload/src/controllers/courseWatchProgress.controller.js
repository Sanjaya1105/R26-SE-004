const mongoose = require("mongoose");
const CourseSubSection = require("../models/courseSubSection.model");
const CourseWatchProgress = require("../models/courseWatchProgress.model");
const { isLessonReadyForStudents } = require("../utils/lessonVisibility");
const {
  MAX_VIDEO_SEC,
  normalizeIntervals,
  coveredSeconds,
} = require("../utils/watchIntervals");

function userIdFromRequest(req) {
  return req.user?.id ? String(req.user.id).trim() : "";
}

function serializeLessons(lessons) {
  const map = {};
  for (const lesson of Array.isArray(lessons) ? lessons : []) {
    const id = String(lesson.subsectionId || "");
    if (!id) continue;
    const durationSec = Math.max(0, Number(lesson.durationSec) || 0);
    const intervals = normalizeIntervals(lesson.intervals, durationSec || MAX_VIDEO_SEC);
    const watchedSec = Math.min(
      durationSec || coveredSeconds(intervals),
      coveredSeconds(intervals)
    );
    map[id] = {
      durationSec,
      intervals,
      watchedSec: Math.round(watchedSec * 100) / 100,
    };
  }
  return map;
}

async function loadReadyVideoLessons(courseId) {
  const subs = await CourseSubSection.find({ courseId })
    .select("videoUrl videoDurationSec knowledgeStatus")
    .lean();

  return (subs || []).filter(
    (sub) =>
      isLessonReadyForStudents(sub.knowledgeStatus) && Boolean(sub.videoUrl)
  );
}

function buildSummary(videoLessons, lessonMap) {
  let totalSec = 0;
  let watchedSec = 0;

  for (const sub of videoLessons) {
    const id = String(sub._id);
    const stored = lessonMap[id] || {};
    const durationSec = Math.max(
      0,
      Number(stored.durationSec) || Number(sub.videoDurationSec) || 0
    );
    if (durationSec <= 0) continue;
    totalSec += durationSec;
    watchedSec += Math.min(durationSec, Number(stored.watchedSec) || 0);
  }

  const percent = totalSec > 0 ? (watchedSec / totalSec) * 100 : 0;
  return {
    watchedSec: Math.round(watchedSec * 100) / 100,
    totalSec: Math.round(totalSec * 100) / 100,
    percent: Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10,
    lessons: lessonMap,
  };
}

const getWatchProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = userIdFromRequest(req);

  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: "Invalid course id." });
  }

  try {
    const videoLessons = await loadReadyVideoLessons(courseId);
    if (!userId) {
      return res.status(200).json({
        success: true,
        data: buildSummary(videoLessons, {}),
      });
    }

    const doc = await CourseWatchProgress.findOne({
      userId,
      courseId,
    }).lean();

    return res.status(200).json({
      success: true,
      data: buildSummary(videoLessons, serializeLessons(doc?.lessons)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load watch progress." });
  }
};

const upsertWatchProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = userIdFromRequest(req);
  const subsectionId = String(req.body?.subsectionId || "").trim();

  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: "Invalid course id." });
  }
  if (!subsectionId || !mongoose.Types.ObjectId.isValid(subsectionId)) {
    return res.status(400).json({ message: "Invalid subsection id." });
  }

  const durationSec = Math.min(
    MAX_VIDEO_SEC,
    Math.max(0, Number(req.body?.durationSec) || 0)
  );
  const incomingIntervals = normalizeIntervals(req.body?.intervals, durationSec);

  try {
    const sub = await CourseSubSection.findById(subsectionId)
      .select("courseId videoUrl videoDurationSec knowledgeStatus")
      .lean();

    if (!sub || String(sub.courseId) !== String(courseId)) {
      return res.status(404).json({ message: "Lesson not found." });
    }
    if (!isLessonReadyForStudents(sub.knowledgeStatus) || !sub.videoUrl) {
      return res.status(404).json({ message: "Lesson video is not available." });
    }

    if (
      durationSec >= 1 &&
      (!Number(sub.videoDurationSec) || Number(sub.videoDurationSec) <= 0)
    ) {
      await CourseSubSection.updateOne(
        { _id: sub._id, $or: [{ videoDurationSec: { $exists: false } }, { videoDurationSec: { $lte: 0 } }] },
        { $set: { videoDurationSec: durationSec } }
      );
    }

    const videoLessons = await loadReadyVideoLessons(courseId);
    const resolvedDuration = durationSec || Number(sub.videoDurationSec) || 0;

    if (!userId) {
      const lessonMap = {
        [subsectionId]: {
          durationSec: resolvedDuration,
          intervals: incomingIntervals,
          watchedSec:
            Math.round(
              Math.min(resolvedDuration || coveredSeconds(incomingIntervals), coveredSeconds(incomingIntervals)) *
                100
            ) / 100,
        },
      };
      return res.status(200).json({
        success: true,
        stored: false,
        data: buildSummary(videoLessons, lessonMap),
      });
    }

    const existing = await CourseWatchProgress.findOne({ userId, courseId });
    const lessons = Array.isArray(existing?.lessons)
      ? existing.lessons.map((lesson) => ({
          subsectionId: lesson.subsectionId,
          durationSec: lesson.durationSec,
          intervals: lesson.intervals,
        }))
      : [];

    const index = lessons.findIndex(
      (lesson) => String(lesson.subsectionId) === subsectionId
    );
    const previous = index >= 0 ? lessons[index] : null;
    const mergedIntervals = normalizeIntervals(
      [...(previous?.intervals || []), ...incomingIntervals],
      resolvedDuration || MAX_VIDEO_SEC
    );
    const nextLesson = {
      subsectionId,
      durationSec: Math.max(Number(previous?.durationSec) || 0, resolvedDuration),
      intervals: mergedIntervals,
    };

    if (index >= 0) {
      lessons[index] = nextLesson;
    } else {
      lessons.push(nextLesson);
    }

    await CourseWatchProgress.findOneAndUpdate(
      { userId, courseId },
      { $set: { userId, courseId, lessons } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      stored: true,
      data: buildSummary(videoLessons, serializeLessons(lessons)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to save watch progress." });
  }
};

module.exports = {
  getWatchProgress,
  upsertWatchProgress,
};
