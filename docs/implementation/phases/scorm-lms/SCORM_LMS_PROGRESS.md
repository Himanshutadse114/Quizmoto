# SCORM LMS Progress

**Last updated:** 2026-08-08

## Wave status

| Wave | Status | Notes |
|------|--------|-------|
| Wave 0 Foundations | **DONE** | Flags, models, R2 keys, unpack |
| Wave 1 Library + runtime + player | **DONE** | Upload, courses, invites, CMI 1.2+2004 map, same-origin play, multi-user roster |
| Wave 2 Realtime + AI author | **DONE** | Policy analyze → full edit → generate → library → create course; live roster sockets |
| Wave 3 Hardening | PARTIAL | R2 full-prefix delete, xAPI statements endpoint |

## Wave 2 completion (2026-08-08)

| Item | Status |
|------|--------|
| W2-E01 Editable AI draft (title, summary, slides, keyPoints, quiz, theme) | Done |
| W2-E02 Local draft persist (localStorage) | Done |
| W2-E03 Generate → package library | Done |
| W2-E04 One-click Create course / Create & publish | Done |
| W2-E06 Socket live roster (`join_scorm_course` + commit/finish emit) | Done |
| W2-E07 Env: `SCORM_LMS`, `SCORM_AI_AUTHOR`, `GEMINI_API_KEY` | Host must set on Render |

### policy-to-scorm-engine

| Component | Destination |
|-----------|-------------|
| geminiService | `server/services/scorm/PolicyAnalysisService.js` |
| scormGenerator | `server/services/scorm/ScormPackageBuilder.js` |
| Author UX | `client/src/pages/Scorm/Author.jsx` |
| Realtime | `server/services/scorm/ScormRealtime.js` + socket `join_scorm_course` |

### Env

```
SCORM_LMS=true
SCORM_AI_AUTHOR=true
GEMINI_API_KEY=your_key
STORAGE_DRIVER=s3
```

## Player notes

- Same-origin `/api/scorm/play/:regId` injects `window.API` + `API_1484_11`.
- Exit closes popup and notifies opener.
- Package delete removes full R2 prefix `scorm/packages/{id}/`.

## Next (Wave 3)

1. Redeploy backend + frontend
2. Mobile QA pass
3. Retakes, completions CSV, ops runbook
4. Live quiz countdown client listeners verification
