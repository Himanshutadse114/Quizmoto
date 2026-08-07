# SCORM World — Implementation Progress

**Feature flags (production):** `SCORM_LMS=OFF`, `SCORM_AI_AUTHOR=OFF`  
**Last updated:** 2026-08-07

## Phase map (4 phases = Waves 0–3)

| Phase | Wave | Focus | Status |
| --- | --- | --- | --- |
| Phase 1 | Wave 0 | Foundations: flags, models, validator, unpack, jobs | **COMPLETE** |
| Phase 2 | Wave 1 | Library, courses, invites, SCORM 1.2 runtime, player UI, dashboard entry | **COMPLETE** |
| Phase 3 | Wave 2 | Real-time roster sockets + AI PDF/PPT → SCORM author | Not started |
| Phase 4 | Wave 3 | Hardening, retakes, security audit, ops runbook | Not started |

## Multi-user + host tracking (v1)

- Each learner gets an **independent** `ScormRegistration` + `ScormCmiState` when they accept the invite.
- Concurrent launches of the same course are supported (no shared session lock).
- Host **Course Detail** page shows a **live roster** (poll 8s): name, status, lesson_status, score, total time, last commit.
- Runtime commits update `lastLessonStatus`, `lastScoreRaw`, `lastTotalTime`, `lastCommitAt` on the registration.

## SCORM 1.2 compliance (v1)

- LMSInitialize / LMSFinish / LMSGetValue / LMSSetValue / LMSCommit
- LMSGetLastError / LMSGetErrorString / LMSGetDiagnostic
- Core CMI: lesson_status, score.raw/min/max, session_time, total_time, lesson_location, exit, entry, suspend_data, student_id/name
- Resume via suspend_data / incomplete status
- Content served via auth’d proxy with iframe sandbox

## Wave 1 checklist

| ID | Task | Status |
| --- | --- | --- |
| W1-T01 | packages upload/list/delete API | Done |
| W1-T02 | courses CRUD + publish + preview | Done |
| W1-T03 | registrations accept + revoke | Done |
| W1-T04 | ScormRuntimeService (CMI 1.2) | Done |
| W1-T05 | runtime routes | Done |
| W1-T06 | content proxy | Done |
| W1-T07 | /api/scorm mounted | Done |
| W1-T08 | Client: Home / Library / CourseDetail / Player / Learn | Done |
| W1-T09 | Dashboard “SCORM WORLD” button | Done |
| W1-T10 | App.jsx routes | Done |
| W1-T11 | Quiz regression (flag OFF) | Required before enable |

## How to enable (staging only)

```bash
SCORM_LMS=true
STORAGE_DRIVER=s3
S3_BUCKET=quizmoto-scorm
SCORM_PROCESS_INLINE=1   # optional on free Render without separate worker
```

Keep `SCORM_LMS` off in production until you verify upload → publish → multi-learner → host roster.
