# SCORM LMS Progress

**Last updated:** 2026-08-08

## Wave status

| Wave | Status | Notes |
|------|--------|-------|
| Wave 0 Foundations | DONE | Flags, models, R2 keys, unpack |
| Wave 1 Library + runtime + player | DONE | Upload, courses, invites, CMI 1.2+2004 map, same-origin play, multi-user roster |
| Wave 2 Realtime + AI author | IN PROGRESS | **policy-to-scorm-engine integrated** (server PolicyAnalysis + PackageBuilder + Author UI) |
| Wave 3 Hardening | PARTIAL | R2 full-prefix delete, xAPI statements endpoint |

## policy-to-scorm-engine integration (2026-08-08)

Source folder: `policy-to-scorm-engine/` (kept as reference).

| Component | Destination |
|-----------|-------------|
| geminiService.ts | `server/services/scorm/PolicyAnalysisService.js` (server-side Gemini key) |
| scormGenerator.ts | `server/services/scorm/ScormPackageBuilder.js` → SCORM 1.2 ZIP |
| Author UX | `client/src/pages/Scorm/Author.jsx` at `/scorm/author` |
| API | `POST /api/scorm/author/analyze`, `POST /api/scorm/author/generate` |

### Env required for AI path

```
SCORM_LMS=true
SCORM_AI_AUTHOR=true
GEMINI_API_KEY=your_key
# optional: GEMINI_MODEL=gemini-2.0-flash
```

Upload path works without `SCORM_AI_AUTHOR`.

## Player notes

- Same-origin `/api/scorm/play/:regId` injects `window.API` + `API_1484_11` via JSON-safe boot.
- Exit closes popup and notifies opener.
- Package delete removes full R2 prefix `scorm/packages/{id}/`.

## Next

1. Redeploy backend + frontend
2. Set `SCORM_AI_AUTHOR=true` + `GEMINI_API_KEY`
3. Test Create from policy → library → course → invite
4. Socket live roster polish (Wave 2 remaining)

## Plan pointer

See `LEFTOVER_WAVES_AND_PLATFORM_PLAN.md` for Wave 2/3 leftovers, policy edit→import, mobile, favicon.
