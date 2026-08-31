// Compatibility entry point retained because the existing SCORM author route
// imports this historical filename. The implementation now renders images with
// fal.ai FLUX Schnell and never calls Replicate or Vertex image generation.
module.exports = require('./FalAiCourseMediaService');
