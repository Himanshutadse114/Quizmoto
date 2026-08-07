# SCORM World — Implementation Progress

**Feature flags (production):** `SCORM_LMS=OFF`, `SCORM_AI_AUTHOR=OFF`  
**Last updated:** 2026-08-07

## Phase map (4 phases = Waves 0–3)

| Phase | Wave | Focus | Status |
| --- | --- | --- | --- |
| Phase 1 | Wave 0 | Foundations: flags, models, validator, unpack, jobs | **COMPLETE** |
| Phase 2 | Wave 1 | Library, courses, invites, SCORM 1.2 runtime, player UI, dashboard entry | **Backend COMPLETE — Client UI next** |
| Phase 3 | Wave 2 | Real-time roster sockets + AI PDF/PPT → SCORM author | Not started |
| Phase 4 | Wave 3 | Hardening, retakes, security audit, ops runbook | Not started |

## Wave 0 checklist

| ID | Task | Status |
| --- | --- | --- |
| W0-T01 | featureFlags | Done |
| W0-T02 | Sequelize models scorm_* | Done |
| W0-T03 | storageKeys R2 conventions | Done |
| W0-T04 | ScormZipValidator | Done |
| W0-T05 | Job handlers | Done |
| W0-T06 | Unit tests | Done |
| W0-T07 | R2 smoke (operator) | Pending |
| W0-T08 | Progress doc | Done |

## Operator commands

```bash
cd server
npm install
npm test
npx mocha tests/ScormZipValidator.test.js --exit
```

Keep `SCORM_LMS` off in production until Wave 1 UI acceptance.
