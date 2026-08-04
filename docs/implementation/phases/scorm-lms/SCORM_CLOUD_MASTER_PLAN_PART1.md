# Quizmoto SCORM World — Master Implementation Plan (Part 1)

See PART2 for matrices, pseudocode, and sign-off. Full combined plan also lives in project artifacts.

**Status:** AUTHORIZED PLANNING DOCUMENT  
**Date:** 2026-08-05  
**Product positioning:** Live Quiz (Quizmoto core) remains primary; **SCORM World** is a first-class add-on and SCORM Cloud–style alternative  
**Source assets:** `policy-to-scorm-engine/`, Phase 0–3 Quizmoto stack, Cloudflare R2  
**Feature flags:** `SCORM_LMS` (default OFF), `SCORM_AI_AUTHOR` (default OFF)

---

## 0. Executive Summary

Quizmoto today is a live, real-time quiz platform (Kahoot-style). This plan adds **SCORM World**: a full learning-content layer where hosts can upload SCORM packages, generate SCORM courses from PDF/PPT via AI, publish courses on our own platform, invite learners with links, run content in a standards-compliant player, and track completion, score, and progress in real time.

This is **not** a replacement for live quiz. It is an **add-on**. The host dashboard gains **Open SCORM World** that switches the host into the course/LMS experience while leaving live sessions, reports, and Phase 2/3 infrastructure intact.

Target outcome: a practical **SCORM Cloud alternative** — own platform, invite links, tracking, package library, and AI-assisted authoring from policy documents — runnable on free-tier infrastructure (Render + Cloudflare R2 + Postgres).

---

## 1. Product Vision

### 1.1 North star

A host can: (1) create or upload a SCORM course, (2) publish it on Quizmoto, (3) share an invite link, (4) watch learners progress live, (5) export completion evidence — without a third-party SCORM Cloud subscription.

### 1.2 Primary vs add-on

| Surface | Role | Users | Realtime |
| --- | --- | --- | --- |
| Live Quiz (core) | Primary product | Host + players in a session | Socket.IO game events |
| SCORM World (add-on) | Course LMS / SCORM Cloud alternative | Host authors + invited learners | Socket.IO progress events |

### 1.3 Host dashboard entry

On the main Quizmoto **host dashboard** (post-login home), add:

- Button label: **Open SCORM World**
- Secondary text: “Courses, SCORM packages, invites & tracking”
- Behavior: navigates to `/scorm` when `SCORM_LMS=true`; if flag OFF, button hidden

Live quiz CTAs remain primary and visually dominant.

---

## 2. Competitive Scope vs SCORM Cloud

### 2.1 Must-have parity (v1)

| SCORM Cloud capability | Quizmoto SCORM World v1 |
| --- | --- |
| Upload SCORM package | Yes — SCORM 1.2 primary |
| Import / library | Yes — host-owned package library |
| Create registration / invite | Yes — link + optional email list |
| Launch course in player | Yes — injected LMS API + iframe SCO |
| Track completion & score | Yes — CMI state in Postgres |
| Resume / suspend_data | Yes |
| Dispatch / share link | Yes — signed invite tokens |
| Course dashboard / roster | Yes — live updates via socket |
| Sandbox / testing launch | Yes — host preview registration |

### 2.2 Differentiator

| Capability | v1 |
| --- | --- |
| AI: PDF/PPT → SCORM package | Yes (flagged) — port policy-to-scorm-engine server-side |
| Direct build SCORM & deploy here | Yes — package lands in library |
| Same login as live quiz host | Yes |
| Free-tier deploy path | Yes — Render + R2 + Postgres |

### 2.3 Non-goals for v1

- Full SCORM 2004 Sequencing & Navigation engine
- xAPI/cmi5 as primary protocol
- LTI 1.3 tool provider
- Multi-tenant SaaS billing UI
- Replacing live quiz sessions with SCORM
- Native offline mobile players

---

## 3. User Journeys

### 3.1 Host — Upload existing SCORM

1. Dashboard → Open SCORM World → Library → Upload package (ZIP)
2. System validates imsmanifest, unpacks to R2, shows package card
3. Create Course from package → Publish
4. Copy invite link → share
5. Open course roster → watch status/score live

### 3.2 Host — Create from PDF/PPT (AI author)

1. SCORM World → Create from document
2. Upload PDF or PPTX → detail level & theme
3. Server Gemini analysis (async) → review slides + quiz
4. Generate SCORM 1.2 → stored in library
5. Publish + invite

### 3.3 Learner — Invite link

1. Opens invite URL → name/email if required → Start course
2. Player shell; SCO in sandboxed iframe
3. Progress commits to server; resume on return
4. Finish → summary; host roster updates

### 3.4 Host — Preview / QA

“Preview as learner” creates a private registration for the host before inviting real users.

---

## 4. Architecture

```text
Host Dashboard: [Live Quiz]  [Open SCORM World]
                      |
         +------------+------------+
         v                         v
   Live Quiz App              SCORM World UI /scorm/*
         |                         |
         |                    REST /api/scorm/*
         |                    Socket /scorm
         |                         |
         |                   Express + Worker
         |                         |
   Postgres (sessions)      Postgres (SCORM tables)
         |                         |
         |                  Cloudflare R2 (packages)
```

### Design rules

1. `SCORM_LMS=false` by default
2. Separate Sequelize models; no GameSession coupling
3. Socket namespace isolation
4. Package bytes in R2 only in production
5. SCORM HTML untrusted (iframe sandbox)
6. AI author server-side Gemini only
7. Reuse Phase 3 JobQueue

### R2 layout

```text
scorm/packages/{packageId}/package.zip
scorm/packages/{packageId}/content/...
scorm/packages/{packageId}/meta.json
```

### Free Render

| Constraint | Mitigation |
| --- | --- |
| Ephemeral disk | R2 only for packages |
| Body size | Max 25–50 MB upload |
| Sleep | R2 + DB persist |

---

## 5. SCORM Compliance

### Phase A — SCORM 1.2 (v1 mandatory)

| Method | Server mapping |
| --- | --- |
| LMSInitialize | POST /runtime/:regId/initialize |
| LMSFinish | POST /runtime/:regId/finish |
| LMSGetValue | GET /runtime/:regId/get |
| LMSSetValue | POST /runtime/:regId/set |
| LMSCommit | POST /runtime/:regId/commit |
| LMSGetLastError / ErrorString / Diagnostic | Per-session error state |

Core CMI: lesson_status, score.raw/min/max, session_time, total_time, lesson_location, exit, entry, suspend_data, student_id/name, interactions (best-effort).

Package validation: imsmanifest present, no zip-slip, entry href exists, size limits.

### Phase B — SCORM 2004 subset (post-v1)

API_1484_11 + completion_status/success_status; sequencing deferred.

---

## 6. Data Model

Additive tables: ScormPackage, ScormCourse, ScormRegistration, ScormAttempt, ScormCmiState, ScormCmiCommit (optional), ScormInviteBatch.

No changes to GameSession.

---

## 7. API Surface

Base `/api/scorm` (flag-gated).

**Packages:** upload, from-document, list, get, delete, job status  
**Courses:** CRUD, publish, by invite code, preview  
**Registrations:** invites, accept, roster, revoke, my registrations  
**Runtime:** initialize, get, set, commit, finish  
**Content:** proxy `GET /content/:packageId/*`

---

## 8. Real-time Tracking

Socket namespace `/scorm`; room `scorm:course:{courseId}`; event `registration_updated`. Poll fallback 15s.

---

## 9. Client Routes

- `/scorm` — home
- `/scorm/library` — packages
- `/scorm/author` — AI wizard
- `/scorm/courses/:id` — detail, invite, roster
- `/scorm/learn/:inviteCode` — learner landing
- `/scorm/player/:registrationId` — player shell

Dashboard: `Open SCORM World` → `/scorm`.

---

## 10. policy-to-scorm-engine Integration

| Component | Destination |
| --- | --- |
| geminiService | server PolicyAnalysisService (key server-side) |
| scormGenerator | server ScormPackageBuilder → R2 |
| App editor UX | client pages/Scorm/Author/* |

Jobs: SCORM_VALIDATE_UNPACK, SCORM_AI_AUTHOR, SCORM_PACKAGE_DELETE.

---

## 11. Security

Registration JWTs, hashed invite tokens, rate limits, iframe sandbox, no host JWT in SCO URLs, R2 bucket-scoped keys, disclose AI document processing to hosts.

---

## 12. Feature Flags

| Flag / Env | Default |
| --- | --- |
| SCORM_LMS | false |
| SCORM_AI_AUTHOR | false |
| SCORM_PUBLIC_INVITES | true |
| SCORM_MAX_UPLOAD_MB | 40 |
| STORAGE_DRIVER | s3 (prod) |
| GEMINI_API_KEY | unset until Wave 2 |

---

## 13. Phase-Wise Waves

### Wave 0 — Foundations
W0-T01 flags · W0-T02 models · W0-T03 R2 keys · W0-T04 validator · W0-T05 unpack job · W0-T06 tests · W0-T07 R2 smoke · W0-T08 progress doc

### Wave 1 — Library, courses, invites, runtime, player
W1-T01 upload API · W1-T02 library UI · W1-T03 courses · W1-T04 invites · W1-T05 runtime service · W1-T06 routes · W1-T07 player · W1-T08 content · W1-T09 roster · W1-T10 dashboard button · W1-T11 fixture · W1-T12 e2e · W1-T13 quiz regression

### Wave 2 — Realtime + AI author
W2-T01 sockets · W2-T02 live roster · W2-T03 PolicyAnalysisService · W2-T04 PackageBuilder · W2-T05 AI job · W2-T06 author UI · W2-T07 AI flag · W2-T08 preview · W2-T09 CSV · W2-T10 tests

### Wave 3 — Hardening
W3-T01 retakes · W3-T02 interactions UI · W3-T03 2004 subset · W3-T04 load/indexes · W3-T05 security audit · W3-T06 ops runbook · W3-T07 completion report

---

## 14–16. Testing, Rollout, Rollback

Automated unit/integration/e2e + quiz regression every wave. Deploy flag OFF first; enable staging; then production. Rollback = `SCORM_LMS=false`.

---

## 17–21. Risks, Metrics, Docs, Calendar, Kickoff

See PART2 for full matrices. Calendar hint: Wave 0 (3–5d), Wave 1 (10–14d), Wave 2 (8–12d), Wave 3 (5–8d). Kickoff requires R2 env, 1.2-only agreement, max upload MB, guest invite policy.

---

*Continue in SCORM_CLOUD_MASTER_PLAN_PART2.md*
