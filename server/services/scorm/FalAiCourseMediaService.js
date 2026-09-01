// Compatibility entry point retained for code that imported the temporary
// fal.ai media service. All SCORM raster image generation now goes through
// Replicate FLUX Schnell via ReplicateCourseMediaService.
const replicate = require('./ReplicateCourseMediaService');

module.exports = {
    ...replicate,
    prepareFalAiCourseMedia: replicate.prepareReplicateCourseMedia
};
