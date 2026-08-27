function isLessonReadyForStudents(status) {
  const value = String(status || "ready").trim();
  return value !== "processing" && value !== "rebuilding" && value !== "failed";
}

function isLessonPreparing(status) {
  const value = String(status || "").trim();
  return value === "processing" || value === "rebuilding";
}

module.exports = {
  isLessonReadyForStudents,
  isLessonPreparing,
};
