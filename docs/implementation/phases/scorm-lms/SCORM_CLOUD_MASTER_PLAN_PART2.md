# Quizmoto SCORM World — Master Implementation Plan (Part 2)

Continues [PART1](./SCORM_CLOUD_MASTER_PLAN_PART1.md). Full long-form combined document is also available in project artifacts as `SCORM_CLOUD_ALTERNATIVE_MASTER_PLAN.md` (~30 page print).

---

## CMI Element Support Matrix (v1)

| Element | Get | Set | Notes |
| --- | --- | --- | --- |
| cmi.core.student_id | Y | N | From registration |
| cmi.core.student_name | Y | N | From registration |
| cmi.core.lesson_location | Y | Y | Cap ~1000 chars |
| cmi.core.lesson_status | Y | Y | Enum validated |
| cmi.core.entry | Y | N | ab-initio / resume |
| cmi.core.score.raw/min/max | Y | Y | Numeric |
| cmi.core.total_time | Y | N | Aggregated |
| cmi.core.session_time | Y | Y | Folded on commit |
| cmi.core.exit | Y | Y | suspend/normal/... |
| cmi.suspend_data | Y | Y | Cap 64KB |
| cmi.interactions.* | Y | Y | Best-effort JSON |

### Error codes (subset)

0 No error · 101 General · 201 Invalid argument · 301 Not initialized · 351 Not implemented · 402 Invalid set value · 403 Read only · 405 Incorrect data type

---

## Runtime Pseudocode

```text
Initialize(regId):
  validate token; open attempt; load CMI state
  entry = resume if incomplete/suspend else ab-initio
  return true

SetValue(el, val):
  require initialized; validate element & type; buffer write

Commit:
  fold session_time into total_time; persist; stateVersion++
  emit registration_updated to course room

Finish:
  Commit; finalize exit; mark attempt finished; maybe complete registration
```

## Unpack Job Pseudocode

```text
handleValidateUnpack(packageId):
  load zip from R2; enforce size limits
  safeUnzip (reject .. paths)
  find imsmanifest.xml; resolve launch href
  put each file under content/ prefix
  set package ready or failed with reason
```

## Player API Injection (outline)

```javascript
window.API = {
  LMSInitialize: () => call('initialize'),
  LMSFinish: () => call('finish'),
  LMSGetValue: (el) => call('get', { el }),
  LMSSetValue: (el, v) => call('set', { el, v }),
  LMSCommit: () => call('commit'),
  LMSGetLastError: () => lastError.code,
  LMSGetErrorString: (c) => strings[c] || '',
  LMSGetDiagnostic: (c) => diag[c] || ''
};
// call() uses Bearer registration JWT to /api/scorm/runtime/:regId/*
```

---

## Limits (free tier)

| Limit | Value |
| --- | --- |
| Max ZIP upload | 40 MB default |
| Max uncompressed | 150 MB |
| Max files in ZIP | 2000 |
| Max suspend_data | 64 KB |
| Max AI source PDF | 15 MB |
| Unpack timeout | 120 s |
| AI job timeout | 180 s |

---

## Acceptance Tests

| ID | Assertion |
| --- | --- |
| AT-Upload-01 | Valid 1.2 fixture → status ready ≤60s |
| AT-Invite-01 | Invite link works in private window |
| AT-Runtime-01 | Finish → completed + score on roster |
| AT-Resume-01 | Relaunch restores location/suspend_data |
| AT-Flag-01 | Flag off hides button and /api/scorm |
| AT-AI-01 | PDF author package launches under runtime |
| AT-Quiz-Regression-01 | Live quiz critical suite green with SCORM on |

---

## Per-Task Acceptance (summary)

**Wave 0:** flags default false; models additive; validator rejects zip-slip; unpack to R2; tests green  
**Wave 1:** upload→course→invite→play→persist; dashboard button; e2e + quiz regression  
**Wave 2:** socket live roster; AI author to library; AI flag isolation  
**Wave 3:** retakes; security checklist; ops runbook; tracker update  

---

## Implementation Principles

1. Quiz first — no live-path regressions  
2. Flags default OFF  
3. R2 for bytes, Postgres for state  
4. Small mergeable waves  
5. Tests before production enable  
6. Treat SCORM HTML as hostile  
7. Idempotent jobs  
8. Observable, user-readable failures  
9. Secrets only in Render env  
10. Progress docs each wave  

---

## Dependency Graph

```text
W0 flags → models → keys → validator → unpack
  → W1 upload → library/courses → invites → runtime → player → roster + button
    → W2 sockets + AI author
      → W3 hardening
```

---

## Operator Pilot Runbook

1. Confirm R2 env on Render  
2. Deploy main  
3. Set SCORM_LMS=true (staging first)  
4. Upload fixture pack  
5. Publish + self-invite + complete  
6. Verify roster  
7. On failure: SCORM_LMS=false; capture `[scorm]` logs  

---

## Support Playbook

| Symptom | Cause | Fix |
| --- | --- | --- |
| 413 on upload | Body too large | Shrink pack / raise limit |
| no_manifest | Bad ZIP | Re-export package |
| Blank player | Bad entryHref / proxy | Check meta + network |
| Stuck incomplete | SCO never sets status | Different package / check API errors |
| Roster not live | Socket issue | Polling fallback |
| AI job fails | No GEMINI_API_KEY | Set key; check worker |

---

## Host Dashboard IA

```text
Host Dashboard
├── Live Quiz (primary)
│   ├── My Quizzes / Host Session / Reports
└── SCORM World (add-on) ← Open SCORM World button
    ├── Overview / Library / Courses / Author from PDF
    └── Course Roster & Tracking
```

---

## Open Decisions (recommended defaults)

| Decision | Recommendation |
| --- | --- |
| SCORM version v1 | 1.2 only runtime |
| Max upload | 40 MB |
| Guest learners | Allowed via invite |
| AI editor | MVP generate-first; full editor Wave 2 |
| Content delivery | Authenticated proxy v1 |
| Button copy | Open SCORM World |

---

## Sign-Off

| Role | Yes/No | Date |
| --- | --- | --- |
| Product — SCORM World add-on | | |
| Engineering — Wave 0 start | | |
| Runtime scope SCORM 1.2 only | | |
| Storage Cloudflare R2 | | |
| AI author in Wave 2 | | |

**Approved to start Wave 0 only:** _______________

---

## Revision

| Ver | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-08-05 | Master plan SCORM Cloud alternative add-on |
| 1.1 | 2026-08-05 | Split PART1/PART2 for repo; full text in artifacts |

*End of Part 2 — Quizmoto SCORM World Master Plan*
