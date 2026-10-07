/**
 * Phase 3 job type constants.
 * Keep names stable — workers and API clients depend on them.
 */

const JOB_TYPES = Object.freeze({
    REPORT_PDF: 'REPORT_PDF',
    REPORT_EXCEL: 'REPORT_EXCEL',
    SCORM_VALIDATE_UNPACK: 'SCORM_VALIDATE_UNPACK',
    SCORM_AI_AUTHOR: 'SCORM_AI_AUTHOR',
    SCORM_PACKAGE_DELETE: 'SCORM_PACKAGE_DELETE'
});

const JOB_STATUS = Object.freeze({
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed'
});

module.exports = { JOB_TYPES, JOB_STATUS };
