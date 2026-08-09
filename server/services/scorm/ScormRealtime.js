/**
 * Lightweight Socket.IO bridge for SCORM host roster live updates.
 */
let io = null;

function setIO(instance) {
  io = instance || null;
}

function courseRoom(courseId) {
  return `scorm_course_${courseId}`;
}

/**
 * @param {object} payload
 * @param {string} payload.courseId
 * @param {object} payload.registration - partial registration fields for UI merge
 * @param {string} [payload.event] - 'commit' | 'finish' | 'initialize'
 */
function emitRegistrationUpdate(payload) {
  if (!io || !payload?.courseId) return;
  try {
    io.to(courseRoom(payload.courseId)).emit('scorm_registration_update', {
      courseId: payload.courseId,
      event: payload.event || 'commit',
      isPreview: payload.registration?.isPreview === true,
      registration: payload.registration || null,
      serverTime: Date.now()
    });
  } catch (_) {
    /* non-fatal */
  }
}

module.exports = {
  setIO,
  courseRoom,
  emitRegistrationUpdate
};
