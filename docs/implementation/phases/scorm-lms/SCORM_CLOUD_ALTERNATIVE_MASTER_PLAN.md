# Quizmoto SCORM World — Master Implementation Plan

**Status:** Complete planning document (multi-part)  
**Date:** 2026-08-05  
**Product:** Live Quiz remains primary; SCORM World is a SCORM Cloud–style add-on  

## Documents in this folder

| Doc | Description |
| --- | --- |
| [SCORM_CLOUD_MASTER_PLAN_PART1.md](./SCORM_CLOUD_MASTER_PLAN_PART1.md) | Vision, architecture, data model, APIs, Waves 0–3, UI, security |
| [SCORM_CLOUD_MASTER_PLAN_PART2.md](./SCORM_CLOUD_MASTER_PLAN_PART2.md) | CMI matrices, pseudocode, acceptance tests, runbooks, sign-off |
| [SCORM_LMS_INTEGRATION_PLAN.md](./SCORM_LMS_INTEGRATION_PLAN.md) | Shorter executive summary |

## One-line summary

SCORM World is a **flag-gated** (`SCORM_LMS`, default OFF) SCORM Cloud alternative: upload packages, AI-create courses from PDF/PPT, publish on our platform, invite with links, track progress in real time — entered from the host dashboard via **Open SCORM World**. Packages live on **Cloudflare R2**; progress in Postgres. Live quiz is unchanged.

## Waves

1. **Wave 0** — Flags, models, R2 unpack/validate (no UI)  
2. **Wave 1** — Upload, courses, invites, SCORM 1.2 runtime, player, dashboard button  
3. **Wave 2** — Live roster sockets + AI author (policy-to-scorm)  
4. **Wave 3** — Hardening, retakes, optional 2004  

## Storage (already configured)

```bash
STORAGE_DRIVER=s3
S3_BUCKET=quizmoto-scorm
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

## Next step

Operator approval → **start Wave 0** (W0-T01 feature flags).
