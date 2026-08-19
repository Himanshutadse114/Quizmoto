const { expect } = require('chai');
const {
    renderSmartSvg,
    fallbackSpec
} = require('../services/scorm/ScormSvgScenePlanner');
const { renderSmartSvg: render } = require('../services/scorm/ScormSmartSvgRenderer');

// Note: tests may import from renderer directly
