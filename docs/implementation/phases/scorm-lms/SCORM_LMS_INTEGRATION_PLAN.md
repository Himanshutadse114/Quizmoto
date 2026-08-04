# SCORM LMS Integration Plan — Quizmoto Addition

**Module:** SCORM Learning Management (additive to live quiz)  
**Status:** PLANNED — NOT STARTED  
**Date:** 2026-08-05  
**Depends on:** Phase 0–3 PASSED; live quiz path unchanged  
**Source assets:** `policy-to-scorm-engine/` (policy → AI slides/quiz → SCORM ZIP)  
**Feature flags (proposed):** `SCORM_LMS` (default **OFF**), `SCORM_AI_AUTHOR` (default **OFF**)

---

## 1. Goal

Add a **SCORM-compliant course layer** to Quizmoto so hosts can:

1. **Create** learning modules (from policy/PPT via AI, or upload existing SCORM packages)
2. **Publish** courses and **invite** learners (link / email / PIN-style invite)
3. **Launch** SCORM content in a tracked player
4. **Track** progress in real time (completion, success, score, time, suspend data)
5. Operate in a way comparable to **SCORM Cloud–style** registration + runtime, without replacing the existing live quiz product

This is an **addition**. Live Kahoot-style sessions, reports, and Phase 2/3 infrastructure stay intact. SCORM is a parallel product surface behind a feature flag.

---

## 2. What Already Exists

### 2.1 Quizmoto core (keep)

| Area | State |
|------|--------|
| Host Google auth + JWT | Working |
| Live quiz sessions (Socket.IO) | Working |
| Reports (PDF/Excel) | Working (Phase 3) |
| Object storage abstraction | Working (`Local` / optional S3) |
| Job queue + worker | Working (reports; reusable for SCORM unpack) |
| Postgres production posture | Working |

### 2.2 `policy-to-scorm-engine/` (integrate, do not leave standalone-only)

Standalone Vite app that:

- Accepts policy PDF / PPTX (and related uploads)
- Uses **Gemini** to produce `PolicyAnalysis` (title, summary, slides, quiz)
- Builds a **SCORM package ZIP** via `jszip` (`imsmanifest.xml`, player HTML, `scorm_api_wrapper.js`, assets)
- Lets author edit slides/quiz before download

**Gaps vs a real LMS:**

- No server-side package store
- No multi-user invitations
- No registration / attempt model
- No durable CMI tracking (local wrapper only inside ZIP)
- No Quizmoto auth, roles, or admin UI
- No SCORM **upload** path for third-party packages
- No real-time host dashboard for learners in a course

---

## 3. Product Scope (SCORM Cloud–like)

### In scope (this module)

| Capability | Description |
|------------|-------------|
| **Author — AI path** | Host uploads policy/PPT → AI analysis → editable preview → export SCORM 1.2 package into Quizmoto library |
| **Author — Upload path** | Host uploads existing SCORM 1.2 (and optionally 2004 3rd/4th) ZIP; validate manifest; store package |
| **Course library** | CRUD courses: title, description, package, status (draft / published / archived) |
| **Invitations** | Create enrollment/registration; invite by link, email list, or shareable code |
| **Launch** | Learner opens registration → player iframe/sandbox with injected SCORM Runtime API |
| **Runtime API** | Server-backed SCORM 1.2 data model (`cmi.*`) with commit/finish; optional SCORM 2004 subset later |
| **Real-time tracking** | Host sees live status: not started / incomplete / completed / passed / failed, score, time |
| **Attempt history** | Per learner: attempts, last commit, suspend_data, interactions (best-effort) |
| **Compliance target** | **SCORM 1.2** first (widest content support); document 2004 as Phase B |

### Out of scope (later)

- Full SCORM 2004 sequencing & navigation (SN) engine
- xAPI / cmi5 as primary (optional bridge later)
- Marketplace / paid content
- Replacing live quiz sessions with SCORM
- Offline native mobile player
- LTI 1.3 (can be a follow-on)

---

## 4. Architecture Target

```text
┌─────────────────────────────────────────────────────────────────┐
│ Quizmoto Client (React)                                         │
│  Host: Courses · Upload/AI Author · Invites · Live tracking     │
│  Learner: My courses · Launch player                            │
└────────────┬───────────────────────────────┬────────────────────┘
             │ REST + JWT                    │ Socket.IO (tracking)
             ▼                               ▼
┌────────────────────────────┐    ┌─────────────────────────────┐
│ API (Express)              │    │ Socket namespace /scorm        │
│  /api/scorm/packages       │    │  registration progress      │
│  /api/scorm/courses        │    │  host dashboard updates     │
│  /api/scorm/registrations  │    └─────────────────────────────┘
│  /api/scorm/runtime        │
└────────────┬───────────────┘
             │
     ┌───────┴────────┬──────────────────┐
     ▼                ▼                  ▼
 PostgreSQL      Object Storage      Job Worker
 packages        SCORM ZIP blobs     unpack/validate
 courses         extracted players   AI author jobs
 registrations   (optional cache)
 cmi_state
 attempts
```

### Design rules

1. **Feature flag `SCORM_LMS=false` by default** — zero impact on live quiz until enabled.
2. Live quiz sockets and SCORM sockets stay **namespaced / isolated**.
3. SCORM package bytes live in **ObjectStorage** (reuse Phase 3), not in git or SQLite blobs.
4. Runtime commits are **idempotent** and versioned (`stateVersion` or `commitSeq`) to avoid lost updates.
5. Player content is served from a **controlled origin/path** (or signed URL) to reduce XSS risk; still treat SCORM HTML as untrusted.
6. AI author path reuses Gemini logic from `policy-to-scorm-engine` but runs **server-side** (key never in browser for production).

---

## 5. SCORM Compliance Plan

### 5.1 Phase A — SCORM 1.2 (mandatory)

Implement LMS Runtime API equivalent to:

| API | Behavior |
|-----|----------|
| `LMSInitialize("")` | Open attempt if allowed; load suspend data |
| `LMSFinish("")` | Persist final state; mark finished |
| `LMSGetValue(el)` | Read CMI element |
| `LMSSetValue(el, val)` | Write CMI element (validated) |
| `LMSCommit("")` | Flush to DB; emit real-time event |
| `LMSGetLastError` / `LMSGetErrorString` / `LMSGetDiagnostic` | Standard codes |

**Core CMI elements (minimum):**

- `cmi.core.lesson_status` — not attempted | incomplete | completed | passed | failed | browsed
- `cmi.core.score.raw` / `min` / `max`
- `cmi.core.session_time` / `cmi.core.total_time`
- `cmi.core.lesson_location`
- `cmi.core.exit` / `cmi.core.entry`
- `cmi.suspend_data`
- `cmi.core.student_id` / `student_name` (from registration)
- Optional: `cmi.interactions.*` (best-effort store)

**Package validation on upload:**

- ZIP contains `imsmanifest.xml` at root or one level down
- Manifest has organization + resource with `adlcp:scormtype="sco"` (or equivalent 1.2)
- Entry resource `href` resolved and present in ZIP
- Reject path traversal (`..`) and oversized packages (configurable max MB)

### 5.2 Phase B — SCORM 2004 (optional follow-on)

- Runtime API `Initialize` / `GetValue` / `SetValue` / `Commit` / `Terminate`
- Data model `cmi.completion_status`, `cmi.success_status`, `cmi.score.scaled`, etc.
- Sequencing deferred unless product requires it

### 5.3 Player injection model

1. Extract package to storage key prefix `scorm/packages/{packageId}/...`
2. Learner launch URL loads Quizmoto **shell** that:
   - Injects `window.API` (SCORM 1.2) and optionally `window.API_1484_11` (2004)
   - Iframes the SCO entry point from a content URL
3. `API` methods proxy to `/api/scorm/runtime/:registrationId/*` with learner JWT/session token

---

## 6. Data Model (PostgreSQL / Sequelize)

Additive tables only — no changes required to `GameSession` live-quiz tables.

| Model | Purpose |
|-------|---------|
| **ScormPackage** | Stored ZIP metadata: id, hostId, title, version, standard (`scorm_1_2` / `scorm_2004`), storageKey, entryHref, manifestHash, byteSize, status |
| **ScormCourse** | Published course: id, hostId, packageId, title, description, inviteCode, status (`draft`/`published`/`archived`) |
| **ScormRegistration** | Learner enrollment: id, courseId, learnerUserId (nullable for guest token), learnerEmail, learnerName, inviteToken, status |
| **ScormAttempt** | One launch/attempt: id, registrationId, attemptNo, startedAt, finishedAt |
| **ScormCmiState** | Latest CMI snapshot per registration (or per attempt): lesson_status, score_raw, total_time, lesson_location, suspend_data, entry, exit, rawJson, stateVersion |
| **ScormCmiCommit** | Optional append-only commit log for audit / replay |
| **ScormInvite** | Batch invites: courseId, emails[], expiresAt, createdBy |

Reuse existing **User** (host) and optional player identity where it fits. Guest learners can complete via signed invite token without full Google host account.

---

## 7. API Surface (draft)

All under `/api/scorm`, behind `SCORM_LMS` flag and host auth unless noted.

### Packages

| Method | Path | Notes |
|--------|------|-------|
| POST | `/packages/upload` | multipart SCORM ZIP → validate → store |
| POST | `/packages/from-policy` | AI author job (async if large): returns `jobId` |
| GET | `/packages` | Host’s packages |
| GET | `/packages/:id` | Metadata |
| DELETE | `/packages/:id` | Soft-delete + storage cleanup job |

### Courses

| Method | Path | Notes |
|--------|------|-------|
| POST | `/courses` | Create from package |
| PATCH | `/courses/:id` | Update metadata / publish |
| GET | `/courses` | Host list |
| GET | `/courses/:id` | Detail + counts |
| GET | `/courses/by-code/:inviteCode` | Public resolve (limited fields) |

### Registrations & invites

| Method | Path | Notes |
|--------|------|-------|
| POST | `/courses/:id/invites` | emails[] or generate link |
| POST | `/registrations/accept` | token → registration |
| GET | `/courses/:id/registrations` | Host roster + live status |
| GET | `/my/registrations` | Learner view |

### Runtime (learner)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/runtime/:registrationId/initialize` | LMSInitialize |
| POST | `/runtime/:registrationId/set` | LMSSetValue batch or single |
| GET | `/runtime/:registrationId/get` | LMSGetValue |
| POST | `/runtime/:registrationId/commit` | LMSCommit |
| POST | `/runtime/:registrationId/finish` | LMSFinish |

### Real-time (Socket.IO)

- Namespace: `/scorm` (or room prefix `scorm:course:{id}`)
- Events: `registration_updated`, `attempt_started`, `commit`, `finished`
- Host joins `scorm:course:{courseId}`; learners join `scorm:reg:{registrationId}`

---

## 8. Client UX (Quizmoto UI)

### Host

1. **Courses** nav item (visible when `SCORM_LMS` on)
2. **Library** — packages list; Upload SCORM; Create from policy (opens author wizard)
3. **Author wizard** — port of `policy-to-scorm-engine` App flows into Quizmoto routes (upload → preview/edit → generate package → save to library)
4. **Course detail** — publish, invite link, roster table with live status chips
5. **Live tracking panel** — updates via socket without refresh

### Learner

1. Open invite link → name/email if needed → **Start course**
2. Full-screen **SCORM Player** shell (API injected + SCO iframe)
3. Resume support via `suspend_data` + `lesson_location`
4. Exit returns to “My courses” summary

### Mobile

- Host roster responsive (same patterns as session presence)
- Player: responsive iframe; warn if SCO is desktop-only

---

## 9. Integration of `policy-to-scorm-engine`

| Component | Integration approach |
|-----------|----------------------|
| `scormGenerator.ts` | Move/adapt to `server/services/scorm/ScormPackageBuilder.js` (or shared package); generate ZIP server-side |
| `geminiService.ts` | Move API key usage to **server** `PolicyAnalysisService`; client only uploads file |
| `FileUploader` / App UI | Re-home under `client/src/pages/Scorm/Author/*` with Quizmoto auth + design system |
| Templates / themes | Keep; store chosen templateId on package metadata |
| Standalone folder | Keep as reference until UI port complete; then mark deprecated or thin wrapper |

**Job types (reuse Phase 3 queue):**

- `SCORM_VALIDATE_UNPACK`
- `SCORM_AI_AUTHOR` (policy → analysis → package)
- `SCORM_PACKAGE_DELETE`

---

## 10. Security

| Risk | Mitigation |
|------|------------|
| Malicious SCORM HTML/JS | Sandbox iframe (`sandbox` attributes as strict as practical); separate content origin if possible; no host JWT in iframe URL query |
| ZIP bombs / path traversal | Size limits, entry count limits, reject `..`, max uncompressed ratio |
| Runtime spoofing | Registration-scoped tokens; server validates element names and value lengths |
| Gemini key exposure | Server-only; rate-limit author endpoint |
| Invite leakage | Expiring tokens; host can revoke registration |
| XSS into host app | Never `dangerouslySetInnerHTML` SCO content into host DOM |

---

## 11. Phased Task Breakdown

### Wave 0 — Foundations (flag OFF)

| ID | Task | Priority |
|----|------|----------|
| **S0-T01** | Feature flag `SCORM_LMS` + route guards | P0 |
| **S0-T02** | Sequelize models + migrations (additive) | P0 |
| **S0-T03** | Package storage paths on ObjectStorage | P0 |
| **S0-T04** | SCORM ZIP validate + unpack worker job | P0 |

### Wave 1 — Upload + Library + Runtime 1.2

| ID | Task | Priority |
|----|------|----------|
| **S1-T01** | POST upload package API + host library UI | P0 |
| **S1-T02** | Course CRUD + publish | P0 |
| **S1-T03** | Registration + invite link | P0 |
| **S1-T04** | SCORM 1.2 Runtime API (initialize/get/set/commit/finish) | P0 |
| **S1-T05** | Player shell + API injection + iframe launch | P0 |
| **S1-T06** | Host roster + basic progress | P0 |
| **S1-T07** | Acceptance tests: upload sample SCO, complete, persist status | P0 |

### Wave 2 — Real-time + AI author

| ID | Task | Priority |
|----|------|----------|
| **S2-T01** | Socket namespace `/scorm` live tracking events | P0 |
| **S2-T02** | Host live tracking dashboard | P0 |
| **S2-T03** | Port policy→AI→package author into Quizmoto (server Gemini) | P1 |
| **S2-T04** | `SCORM_AI_AUTHOR` flag + async job | P1 |
| **S2-T05** | Attempt history + export CSV of completions | P1 |

### Wave 3 — Hardening (SCORM Cloud parity polish)

| ID | Task | Priority |
|----|------|----------|
| **S3-T01** | Interactions storage + report view | P2 |
| **S3-T02** | Multi-attempt policy (allow / deny retake) | P2 |
| **S3-T03** | SCORM 2004 runtime subset (optional) | P2 |
| **S3-T04** | Content CDN / signed URLs | P2 |
| **S3-T05** | Load test commits + large package limits | P1 |
| **S3-T06** | Completion report + rollback plan | P0 |

---

## 12. Acceptance Criteria (module done when)

1. Host can upload a standard SCORM 1.2 package and see it in the library.
2. Host can create a course, publish it, and generate an invite link.
3. Learner can open invite, launch content, and progress is stored after Commit/Finish.
4. Refresh/resume restores `lesson_location` / `suspend_data` correctly.
5. Host roster shows status/score without page reload (real-time).
6. Policy→AI→SCORM path produces a package that launches under the same runtime.
7. With `SCORM_LMS=false`, no SCORM routes registered / no nav leakage; live quiz unaffected.
8. Automated tests cover validate/unpack, runtime state machine, and invite accept.

---

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SCORM content variance | High | Start with 1.2; maintain sample pack suite |
| XSS from packages | High | iframe sandbox + CSP; no privileged cookies on content origin |
| AI cost / latency | Medium | Async jobs; size limits; flag OFF by default |
| Scope creep (full 2004 SN) | High | Explicit Phase B; not required for v1 |
| Coupling to live quiz | Medium | Separate models, routes, socket namespace, flag |

---

## 14. Relationship to Existing Phases

| Phase | Relationship |
|-------|----------------|
| Phase 2 Session Engine | **Independent** — SCORM does not use GameSession state machine |
| Phase 3 Jobs / Storage / Metrics | **Reuse** — unpack/AI jobs, object storage, structured logs |
| Live quiz product | **Unchanged** — additive navigation only when flag ON |

---

## 15. Proposed Folder Layout (when implementation starts)

```text
server/
  models/scorm/          # ScormPackage, ScormCourse, ...
  services/scorm/        # Validate, Runtime, PackageBuilder, PolicyAnalysis
  routes/scorm/          # packages, courses, registrations, runtime
  jobs/handlers/scorm*   # unpack, AI author
client/src/
  pages/Scorm/
    Library.jsx
    CourseDetail.jsx
    Author/               # ported policy-to-scorm UI
    PlayerShell.jsx
    MyCourses.jsx
docs/implementation/phases/scorm-lms/
  SCORM_LMS_INTEGRATION_PLAN.md    ← this file
  SCORM_LMS_PROGRESS.md            (to be created at kickoff)
  SCORM_RUNTIME_1_2.md             (element matrix)
```

---

## 16. Kickoff Checklist (before coding)

- [ ] Confirm SCORM **1.2-only** for v1 (recommended)
- [ ] Confirm max upload size (suggest **100 MB** default)
- [ ] Confirm Gemini key available server-side for AI author
- [ ] Confirm invite model: authenticated learners only vs guest link
- [ ] Add `SCORM_LMS=false` to production env explicitly
- [ ] Operator approves Wave 0 start

---

## 17. Summary

Quizmoto gains an **optional SCORM LMS module**: upload or AI-author packages, organize courses, invite learners, run SCORM 1.2 content with a real LMS runtime, and track progress in real time—without disturbing the live quiz engine. The existing `policy-to-scorm-engine` becomes the **authoring pipeline** inside Quizmoto, not a separate product.

**Next step after plan approval:** implement **Wave 0** (flag, models, storage, validate/unpack job) only, then Wave 1 runtime + player.
