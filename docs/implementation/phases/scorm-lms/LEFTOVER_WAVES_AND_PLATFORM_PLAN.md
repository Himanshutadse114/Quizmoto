# Leftover Waves + Platform Plan

**Date:** 2026-08-08  
**Product:** Quizmoto (Live Quiz primary) + SCORM World (add-on)  
**Status:** Wave 0–1 done · Wave 2 mid · Wave 3 partial

---

## 1. Where we are

| Area | Status |
|------|--------|
| Live quiz core | Production; countdown sync server ticks shipped |
| SCORM Wave 0 Foundations | **Done** |
| SCORM Wave 1 Library / runtime / player / multi-user | **Done** |
| SCORM Wave 2 Realtime + AI author | **In progress** (~70–80%) |
| SCORM Wave 3 Hardening | **Partial** |
| Mobile friendliness | Partially done (viewport, many `sm:`/`md:` layouts) — gaps remain |
| Favicon | **Q mark SVG** (this plan) |

---

## 2. Leftover Wave 2 (finish)

**Goal:** Policy → AI analysis → **editable draft** → generate SCORM → library → course → invite works end-to-end on Render.

| ID | Task | Priority | Notes |
|----|------|----------|-------|
| **W2-E01** | **Editable AI draft** | P0 | After analyze: edit title, slides (title/content/keyPoints), quiz (question/options/correctAnswer), theme |
| **W2-E02** | Persist draft optionally | P1 | Save draft JSON on server (host-scoped) so refresh does not lose work |
| **W2-E03** | Generate → package library | P0 | Already: `POST /author/generate` builds SCORM 1.2 ZIP + unpack |
| **W2-E04** | One-click **Create course** from new package | P0 | From Author “done” screen and Library |
| **W2-E05** | Re-import / re-generate | P1 | Edit analysis again and overwrite package or create new version |
| **W2-E06** | Socket live roster polish | P1 | Host course detail updates on commit/finish without refresh |
| **W2-E07** | Env checklist | P0 | `SCORM_LMS`, `SCORM_AI_AUTHOR`, `GEMINI_API_KEY` on Render |

### Policy → edit → LMS import (target UX)

```text
Host opens /scorm/author
  → Upload PDF or PPTX
  → Analyze (Gemini server-side)
  → Preview & EDIT slides + quiz  ← required
  → Choose theme
  → Generate SCORM 1.2 package
  → Lands in Package library (ready)
  → Create course → Publish → Invite link
  → Learners launch; host tracks roster
```

**Acceptance**

1. Host can change slide text and quiz answers before generate.  
2. Generated ZIP validates (`imsmanifest.xml`, SCO entry) and plays under Quizmoto runtime.  
3. Score/status appear on host roster for concurrent learners.  
4. Same package can be used for a new course without re-upload.

---

## 3. Leftover Wave 3 (hardening)

| ID | Task | Priority | Notes |
|----|------|----------|-------|
| **W3-T01** | Retake policy (allow / deny / max attempts) | P1 | Registration-level |
| **W3-T02** | Completions CSV export | P1 | Host course detail |
| **W3-T03** | Interactions best-effort UI | P2 | If SCO writes interactions |
| **W3-T04** | Security pass | P0 | Rate limits, ZIP size, path traversal (already partial) |
| **W3-T05** | Ops runbook | P1 | Flags, R2, Gemini key, rollback = flags OFF |
| **W3-T06** | Live quiz countdown client listeners | P0 | Ensure GameView + PlayerGame handle `countdown_tick` |
| **W3-T07** | Mobile QA pass | P0 | See §4 |
| **W3-T08** | Favicon + PWA meta | P1 | Q letter mark |

**Still out of scope (document, do not build now)**

- Full SCORM 2004 Sequencing & Navigation engine  
- Full commercial LRS  
- LTI 1.3  

---

## 4. Platform-wide mobile friendliness

**Already present**

- Viewport meta + `mobile-web-app-capable`  
- Tailwind responsive classes on Dashboard, many host/player screens  
- Session management mobile work earlier  

**Gaps to close (checklist)**

| Surface | Work |
|---------|------|
| Host Dashboard | Touch targets ≥ 44px; no horizontal overflow; quiz cards stack |
| Host Lobby / GameView | Countdown and options readable on 360px width; sticky footer actions |
| Player Join / Lobby / Game | Large answer buttons; safe-area padding (`env(safe-area-inset-*)`) |
| Reports | Tables scroll horizontally; download buttons full-width on small screens |
| SCORM World Home / Library / Author | Stack forms; file picker usable on iOS |
| SCORM Player popup | Prefer full-screen on mobile; fallback same-tab if popup blocked |
| Live quiz + SCORM | Test iOS Safari + Android Chrome |

**Definition of done**

- Primary flows usable at **375×667** without horizontal scroll.  
- No critical control only reachable via hover.  
- Keyboard on mobile does not hide primary CTA without scroll.

---

## 5. Favicon (letter Q)

| Asset | Path |
|-------|------|
| Primary | `/favicon.svg` — purple tile + gold italic **Q** |
| Alternate | `/favicon-q.svg` |
| HTML | `client/index.html` links icon + apple-touch-icon |

Theme colors: purple `#46178f`, gold `#f2a900` (Quizmoto brand).

---

## 6. Suggested order of work

1. **Favicon** — done in this change set.  
2. **Redeploy backend** (countdown ticks + SCORM author routes).  
3. **W2-E01** expand Author UI editing (quiz options, key points).  
4. **W2-E03/E04** verify generate → library → course on staging.  
5. **W3-T06** confirm host/player `countdown_tick` listeners if not already on main.  
6. **Mobile QA pass** host + player + SCORM.  
7. **W3** retakes, CSV, runbook, sign-off.

---

## 7. Env flags (staging)

```text
SCORM_LMS=true
SCORM_AI_AUTHOR=true
GEMINI_API_KEY=...
STORAGE_DRIVER=s3
# keep NEW_SESSION_ENGINE and REPORTS_ASYNC as currently configured
```

---

## 8. Success criteria (module + platform)

1. Policy document → editable module → SCORM package in library → published course with multi-user tracking.  
2. Live quiz 3-2-1 host/player aligned via server ticks.  
3. Mobile: dashboard, play, and SCORM author usable on phone.  
4. Favicon shows **Q** in browser tab.  
5. Feature flags can disable SCORM / AI without breaking live quiz.
