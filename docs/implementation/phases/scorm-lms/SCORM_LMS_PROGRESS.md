# SCORM World — Implementation Progress

**Feature flags (production):** `SCORM_LMS=OFF`, `SCORM_AI_AUTHOR=OFF`  
**Last updated:** 2026-08-07

## Phase map (4 phases = Waves 0–3)

| Phase | Wave | Focus | Status |
| --- | --- | --- | --- |
| Phase 1 | Wave 0 | Foundations: flags, models, validator, unpack, jobs | **COMPLETE** |
| Phase 2 | Wave 1 | Library, courses, invites, SCORM 1.2 runtime, player UI, dashboard entry | **Backend COMPLETE — Client UI in progress** |
| Phase 3 | Wave 2 | Real-time roster sockets + AI PDF/PPT → SCORM author | Not started |
| Phase 4 | Wave 3 | Hardening, retakes, security audit, ops runbook | Not started |

## Wave 0 checklist

| ID | Task | Status |
| --- | --- | --- |
| W0-T01 | featureFlags | Done |
| W0-T02 | Sequelize models scorm_* | Done |
| W0-T03 | storageKeys R2 conventions | Done |
| W0-T04 | ScormZipValidator | Done |
| W0-T05 | ScormUnpackService + job handlers | Done |
| W0-T06 | Unit tests | Pending |
| W0-T07 | R2 smoke (operator) | Pending |
| W0-T08 | Progress doc | Done |

## Wave 1 checklist

| ID | Task | Status |
| --- | --- | --- |
| W1-T01 | packages upload/list/delete API | Done |
| W1-T02 | courses CRUD + publish + preview | Done |
| W1-T03 | registrations accept + revoke | Done |
| W1-T04 | ScormRuntimeService (CMI 1.2) | Done |
| W1-T05 | runtime routes | Done |
| W1-T06 | content proxy | Done |
| W1-T07 | /api/scorm mounted in index.js | Done |
| W1-T08 | Client: Home / Library / CourseDetail / Player / Learn | Next |
| W1-T09 | Dashboard “Open SCORM World” button | Next |
| W1-T10 | App.jsx routes | Next |
| W1-T11 | Quiz regression (flag OFF) | Required before enable |

## How to enable (staging only)

```bash
SCORM_LMS=true
STORAGE_DRIVER=s3   # or local for dev
S3_BUCKET=quizmoto-scorm
# + R2 endpoint / keys already set on Render
SCORM_PROCESS_INLINE=1   # optional on free Render without separate worker
```

Keep `SCORM_LMS` off in production until Wave 1 client + regression pass.
