# Quizmoto SCORM World — Platform Shell & Learner Progress Tracking

**Date:** 2026-08-08  
**Repository:** `Himanshutadse114/Quizmoto`  
**Branch:** `main`  
**Status:** Implemented; CI/deployment verification required

---

## 1. Objective

This phase converts SCORM World from a collection of pages with top-level action buttons into a structured learning-operations platform and upgrades learner tracking from score/status only to progress-aware tracking.

The admin experience is now organized into:

- Overview
- Courses
- Learner Tracking
- Reports
- Package Library
- AI Author
- Visual Studio

Learner launch routes remain outside the administration shell.

---

## 2. Platform shell

### File

`client/src/pages/Scorm/ScormPlatformShell.jsx`

### Navigation model

Desktop uses a persistent left sidebar. Mobile uses a drawer. A sticky top bar provides page context and primary actions.

```text
SCORM World
├── Overview
├── Courses
├── Learner Tracking
├── Reports
├── Package Library
├── AI Author
└── Visual Studio
```

The shell also provides:

- Create Course action
- Upload action
- Back to Live Quiz Dashboard
- SCORM runtime/tracking status indicator

### Routing

Administrative routes are nested under `/scorm`:

```text
/scorm
/scorm/courses
/scorm/courses/:id
/scorm/tracking
/scorm/reports
/scorm/library
/scorm/author
/scorm/visual-studio
```

Learner-facing routes remain separate:

```text
/scorm/learn/:inviteCode
/scorm/player/:registrationId
```

This prevents learner launches from inheriting the administration sidebar/layout.

---

## 3. Overview dashboard

`client/src/pages/Scorm/Home.jsx` is now a platform dashboard instead of a button collection.

It displays:

- course count;
- package count;
- learner count;
- in-progress learners;
- completed learners;
- average measurable progress;
- recent courses;
- latest learner activity;
- platform/tracking health;
- direct links to AI Author, Visual Studio and Reports.

---

## 4. Courses workspace

### Route

`/scorm/courses`

### File

`client/src/pages/Scorm/Courses.jsx`

Features:

- course portfolio view;
- published/draft filters;
- search by course/invite code;
- total learner count;
- completed learner count;
- average progress per course;
- direct navigation to each course workspace.

---

## 5. Learner Tracking workspace

### Route

`/scorm/tracking`

### File

`client/src/pages/Scorm/Tracking.jsx`

The tracking table now exposes:

- Learner
- Course
- Completion percentage
- Last known learning location
- Score
- Total learning time
- Last activity timestamp

Filters support:

- course;
- completion status;
- in-progress;
- not started;
- progress unavailable;
- text search.

Tracking refreshes every 20 seconds. Course workspaces also continue to use the existing SCORM real-time/socket update mechanism and reload the enriched tracking rows when an update arrives.

---

## 6. Completion percentage model

SCORM 1.2 does not define a universal percentage-complete field, so Quizmoto uses a layered, standards-aware strategy.

### 6.1 Finished courses

If lesson status is `completed`, `passed`, or `failed`, progress is 100%.

### 6.2 SCORM 2004

When a package writes:

```text
cmi.progress_measure
```

Quizmoto converts the standard 0–1 value into 0–100%.

Example:

```text
cmi.progress_measure = 0.625
→ 62.5%
```

### 6.3 Quizmoto-authored SCORM 1.2 packages

Quizmoto's generated courses already save the current part through:

```text
cmi.core.lesson_location
```

The package also stores its editable analysis in `content.json` / `analysisJson`, allowing Quizmoto to know the number of authored parts:

```text
1 introduction
+ learning screens
+ knowledge checks
+ 1 completion screen
```

Completion is derived as:

```text
currentPart / (totalParts - 1) × 100
```

This means a learner who closes the course halfway through can be shown at approximately 50%, even if they have no score yet.

### 6.4 Third-party SCORM 1.2

A third-party SCORM 1.2 package may not provide enough information for an honest completion percentage.

If it reports neither:

- a usable progress measure; nor
- a location that can be mapped to known package structure,

Quizmoto returns:

```text
progressAvailable = false
progressPercent = null
```

The UI shows **Progress unavailable** rather than inventing `0%` or another estimate.

---

## 7. Last known location

`server/services/scorm/ScormProgressService.js` converts saved location information into a human-readable label.

For Quizmoto-authored modules, numeric locations are mapped to:

- Introduction
- actual learning-screen title
- Knowledge check N
- Completion screen

Example:

```text
lesson_location = 2
analysis slides = [
  "Recognise the threat",
  "Verify the message",
  "Report safely"
]

→ Last location: Verify the message
```

For external packages, an explicit location string is shown directly where possible.

---

## 8. Backend tracking API

### Files

- `server/services/scorm/ScormProgressService.js`
- `server/routes/scorm/tracking.js`
- `server/routes/scorm/index.js`

### Endpoints

```text
GET /api/scorm/tracking/summary
GET /api/scorm/tracking/course/:courseId
```

The summary endpoint returns:

```text
overview
courses[]
learners[]
```

Overview metrics include:

- courses;
- learners;
- completed;
- in progress;
- not started;
- progress unavailable;
- average progress across learners with measurable progress.

Host-preview registrations are excluded from learner metrics.

---

## 9. No database migration required

The implementation deliberately derives progress from the existing CMI state instead of adding a new persisted percentage column.

Existing data already includes:

- `ScormCmiState.lessonLocation`
- `ScormCmiState.rawMapJson`
- `ScormCmiState.lessonStatus`
- `ScormRegistration.lastLessonStatus`
- `ScormRegistration.lastScoreRaw`
- `ScormRegistration.lastTotalTime`
- `ScormRegistration.lastCommitAt`

This avoids a production schema migration solely for a derived metric.

---

## 10. Course workspace upgrade

`client/src/pages/Scorm/CourseDetail.jsx` now uses the enriched tracking endpoint.

Per-course metrics:

- learners;
- in progress;
- completed;
- average measurable progress;
- unavailable-progress count.

Roster columns:

- learner;
- completion progress bar;
- last location;
- lesson status;
- score;
- total time;
- last activity;
- revoke action.

Unsupported progress is explicitly shown as unavailable rather than 0%.

---

## 11. Regression tests

Added:

`server/tests/ScormProgressService.test.js`

Coverage includes:

- authored numeric location → percentage;
- SCORM 2004 `cmi.progress_measure` → percentage;
- completed/passed course → 100%;
- third-party SCORM 1.2 without progress signal → `null`;
- authored location → meaningful screen title;
- `progressAvailable` serialization behavior.

---

## 12. Key files

| File | Role |
|------|------|
| `client/src/pages/Scorm/ScormPlatformShell.jsx` | Professional SCORM admin shell |
| `client/src/pages/Scorm/Home.jsx` | Platform overview dashboard |
| `client/src/pages/Scorm/Courses.jsx` | Course management workspace |
| `client/src/pages/Scorm/Tracking.jsx` | Global learner progress tracking |
| `client/src/pages/Scorm/CourseDetail.jsx` | Course-level learner operations |
| `client/src/App.jsx` | Nested admin routes and separate learner routes |
| `server/services/scorm/ScormProgressService.js` | Progress/location derivation |
| `server/routes/scorm/tracking.js` | Tracking APIs |
| `server/routes/scorm/index.js` | Tracking route mount |
| `server/services/scorm/ScormRuntimeService.js` | Existing CMI state source |
| `server/services/scorm/ScormVisualPackageBuilder.js` | Generated course lesson-location writes |
| `server/tests/ScormProgressService.test.js` | Progress derivation regression tests |

---

## 13. QA checklist

### Platform shell

- [ ] Sidebar displays on desktop.
- [ ] Mobile drawer opens/closes correctly.
- [ ] Overview/Courses/Tracking/Reports/Library/Author/Visual Studio routes work.
- [ ] Learner launch pages do not show the admin sidebar.

### Quizmoto-authored progress

- [ ] Launch a generated course.
- [ ] Move to approximately the middle of the course.
- [ ] Close the player before the quiz.
- [ ] Tracking dashboard shows a partial percentage.
- [ ] Last location is the learning-screen title where the learner stopped.
- [ ] Relaunch resumes through the existing runtime behavior.

### SCORM 2004

- [ ] Test a package that writes `cmi.progress_measure`.
- [ ] Confirm 0–1 is shown as 0–100%.

### Third-party SCORM 1.2

- [ ] Test a package that reports no measurable progress.
- [ ] Confirm UI shows `Progress unavailable`, not a fabricated 0%.
- [ ] Score/status/time still display normally.

### Completion

- [ ] Completed/passed/failed attempts show 100% completion.
- [ ] Course average ignores unavailable progress rows rather than treating them as zero.

---

## 14. Follow-up opportunities

The platform foundation is now suitable for future additions such as:

- cohorts/groups;
- due dates;
- assignments;
- overdue learner alerts;
- certificates;
- retake policy controls;
- learner detail timeline;
- interaction-level tracking UI;
- progress included in PDF/Excel reports;
- course completion funnels;
- organization/team filters.

These should be layered on top of the current platform structure rather than returning to page-level action-button navigation.

---

*Created 2026-08-08 as the implementation handoff for the SCORM World platform-shell and learner-progress tracking phase.*
