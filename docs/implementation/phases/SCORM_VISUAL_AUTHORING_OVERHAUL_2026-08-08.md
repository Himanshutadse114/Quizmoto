# Quizmoto SCORM Visual Authoring Overhaul

**Date:** 2026-08-08  
**Repository:** `Himanshutadse114/Quizmoto`  
**Branch:** `main`  
**Status:** **IMPLEMENTED — visual-first authoring foundation complete; production visual QA still required**  
**Audience:** engineering, QA, product, deployment/operations

---

## 1. Purpose

This document records the completed redesign of Quizmoto's AI-authored SCORM module experience.

The previous authoring flow could convert a PDF/PPT into SCORM, but the learning output was visually repetitive: most learning screens were effectively a title, explanatory paragraph, key-point list, and quiz. The redesign changes the architecture from a text-slide generator into a **visual learning experience generator**.

The target architecture is now:

```text
PDF / PPT
   │
   ▼
Gemini instructional analysis
   │
   ▼
Semantic learning blueprint
(layout + short screen copy + visual title + interaction + quiz)
   │
   ▼
Quizmoto visual experience enrichment
   │
   ├──────────────► Python SVG/vector engine
   │                     │
   │                     ▼
   │              animated SVG assets
   │
   ▼
HTML/CSS/JS learner experience
   │
   ├──────────────► interactive visual exploration
   ├──────────────► knowledge checks
   ├──────────────► SCORM 1.2 interaction tracking
   └──────────────► score / completion / resume behavior
   │
   ▼
SCORM 1.2 ZIP
```

The objective is not to imitate PowerPoint. The objective is to automatically generate a course that feels intentionally designed for e-learning.

---

## 2. Executive status

| Area | Status |
|------|--------|
| Visual-first AI learning blueprint | **Done** |
| Multiple semantic learning layouts | **Done** |
| Deterministic vector/SVG generation | **Done** |
| Python SVG pipeline | **Done** |
| SVG animation layer | **Done** |
| Interactive visual exploration | **Done** |
| Richer quiz feedback | **Done** |
| SCORM 1.2 `cmi.interactions` quiz tracking | **Done** |
| Visual Studio editing surface | **Done** |
| Visual Author v2 | **Done** |
| Theme-aware SVG generation | **Done** |
| HTML fallback if Python visual generation fails | **Done** |
| Existing SCORM launch/tracking compatibility | **Preserved** |
| Voice / TTS | **Explicitly deferred / removed** |
| Final real-course visual QA | **Required before production sign-off** |

---

## 3. Scope and non-goals

### In scope

- Make AI-authored SCORM courses visually richer and less repetitive.
- Make the AI choose an instructional layout based on meaning.
- Generate diagrams and vector assets locally during package creation.
- Package all visuals inside the SCORM ZIP.
- Add purposeful lightweight animation.
- Add visual exploration and reveal interactions.
- Preserve existing SCORM runtime, session, completion, scoring, and resume behavior.
- Give authors explicit control over visual layout and theme.
- Allow existing AI-authored packages to be reopened and visually rebuilt.
- Keep a safe fallback path if Python visual generation is unavailable.

### Explicitly not in scope for this implementation

- Voice narration / text-to-speech.
- Paid/cloud TTS services.
- Photorealistic AI image generation.
- Full Storyline-style freeform animation timelines.
- Full SCORM 2004 sequencing/navigation implementation.
- Full xAPI LRS implementation.
- Replacing the established Quizmoto SCORM runtime.

The temporary voice/TTS prototype was removed and should remain deferred until the visual quality is accepted.

---

## 4. Core design principles

The redesign follows these principles:

1. **Meaning determines layout.** A workflow should look like a workflow, not a generic bullet slide.
2. **On-screen copy stays short.** The visual is part of the explanation.
3. **The AI describes intent; Quizmoto renders it.** Gemini does not generate arbitrary HTML.
4. **Visuals are deterministic and controlled.** The rendering engine owns layout, spacing, colors, accessibility, and behavior.
5. **Assets are portable.** Generated SCORM packages do not depend on remote image services at learner runtime.
6. **Animation must support learning.** No random PowerPoint-style effects.
7. **Existing SCORM behavior must not regress.** Presentation upgrades are layered over the proven runtime.
8. **Fallback is mandatory.** A missing Python runtime must not make package generation unusable.

---

## 5. AI learning blueprint

### 5.1 Previous conceptual schema

The old authoring model was approximately:

```json
{
  "title": "...",
  "content": "long explanatory paragraph",
  "keyPoints": ["...", "...", "..."],
  "imageQuery": "..."
}
```

This does not provide enough information to construct a designed learning experience.

### 5.2 Current visual schema

The visual-first flow works with richer screen metadata:

```json
{
  "title": "How a Phishing Attack Works",
  "content": "A short explanation written for on-screen reading.",
  "keyPoints": [
    "Malicious email arrives",
    "Learner follows the link",
    "Fake sign-in page opens",
    "Credentials are captured"
  ],
  "layout": "process",
  "visualTitle": "Phishing Attack Flow",
  "imageQuery": "phishing flow",
  "interaction": {
    "type": "step_explore",
    "prompt": "Explore each stage to reinforce the sequence."
  }
}
```

Quiz questions may also include an explanation:

```json
{
  "question": "What should you do with an unexpected sign-in link?",
  "options": [
    "Open it immediately",
    "Open the service independently",
    "Forward it to colleagues",
    "Disable the browser"
  ],
  "correctAnswer": 1,
  "explanation": "Open the trusted service directly rather than following an unverified link."
}
```

### 5.3 AI writing rules

`server/services/scorm/PolicyAnalysisService.js` now asks Gemini to behave as an instructional designer and visual learning architect rather than a document summarizer.

Current target screen-copy ranges:

| Detail level | Learning screens | Approx. on-screen words |
|--------------|------------------|-------------------------|
| Detailed | 8–12 | 45–75 |
| Condensed | 5–7 | 30–55 |
| Summary | 3–4 | 20–40 |

Key points should preferably remain under approximately 14 words so they fit cleanly inside diagrams/cards.

---

## 6. Supported visual layouts

The engine currently supports eight semantic layouts.

| Layout | Intended use |
|--------|--------------|
| `cards` | Independent concepts, tips, controls, principles |
| `process` | Steps, attack flows, procedures, workflows |
| `timeline` | Phases, sequence over time, journeys |
| `comparison` | Safe vs unsafe, recommended vs risky behavior |
| `hub` | Categories/components around a central concept |
| `spotlight` | Critical warning, takeaway, required action |
| `matrix` | Likelihood/impact, risk/severity concepts |
| `cycle` | Continuous/repeating processes and lifecycles |

If an older analysis object has no explicit layout, `ScormExperiencePackageBuilder` infers one from the screen title/content and falls back to a varied layout sequence.

This is important for backwards compatibility: old AI-authored analysis JSON does not have to be regenerated before it can benefit from the visual engine.

---

## 7. Python vector engine

### 7.1 Why Python is used

Python is used during **authoring/package generation**, not as the learner runtime.

The final SCORM course remains standard HTML/CSS/JavaScript.

Python generates portable SVG assets such as:

- process/flow diagrams;
- timelines;
- hub-and-spoke diagrams;
- comparison boards;
- card-based infographics;
- risk matrices;
- cyclic diagrams;
- spotlight/security visuals.

### 7.2 Dependency strategy

The visual generator intentionally uses the Python standard library rather than introducing a large graphics stack.

This keeps deployment significantly lighter than adding libraries such as PyTorch or a browser-based design engine.

### 7.3 Generator chain

The current vector pipeline is layered:

```text
generate_scorm_visuals.py
        │
        ▼
generate_scorm_visuals_v2.py
(animation wrapper)
        │
        ▼
generate_scorm_visuals_v3.py
(theme embedding)
```

Responsibilities:

- `generate_scorm_visuals.py` — core SVG layout generation.
- `generate_scorm_visuals_v2.py` — adds SVG animation CSS.
- `generate_scorm_visuals_v3.py` — embeds the selected Quizmoto theme variables directly into the SVG.

### 7.4 Output

A generated package can contain:

```text
assets/
  visuals/
    visual-001-process.svg
    visual-002-hub.svg
    visual-003-comparison.svg
    visual-004-matrix.svg
    visual-005-cycle.svg
    visual-manifest.json
```

The manifest records the slide index, layout, file, and ZIP path.

---

## 8. Why theme values are embedded inside SVG files

SVGs are loaded by the learner page as external image assets.

An external SVG loaded with `<img>` does **not** inherit CSS custom properties from the surrounding HTML document. Therefore a visual using `var(--qm-primary)` would otherwise fall back to its default color rather than the selected course theme.

The final visual pipeline explicitly embeds theme variables into every generated SVG.

Current theme mapping:

| Template | Primary | Accent | Soft |
|----------|---------|--------|------|
| Orange Corporate | `#f97316` | `#fdba74` | `#fff1e6` |
| Amber Classic | `#b45309` | `#fde68a` | `#fef3c7` |
| Green Growth | `#059669` | `#6ee7b7` | `#d1fae5` |
| Pink Modern | `#db2777` | `#f9a8d4` | `#fce7f3` |

`server/services/scorm/ScormVisualThemeFinalizer.js` is the entry point that attaches the selected visual theme before final package construction.

---

## 9. Animation model

Animations are embedded in the generated SVG, keeping them portable and independent of third-party runtime libraries.

Current effects include:

- sequential node entrance;
- path drawing using stroke dash animation;
- central hub scale/fade entrance;
- spotlight pulse;
- staggered timing through `--delay`;
- reduced-motion fallback.

Representative animation classes:

```text
.qm-node
.qm-path
.qm-center
.qm-pulse
```

Accessibility rule:

```css
@media (prefers-reduced-motion: reduce) {
  /* animations are disabled and all information remains visible */
}
```

Animation is intentionally used to communicate sequence and focus rather than as decoration.

---

## 10. Interactive learner experience

`ScormExperiencePackageBuilder.js` enriches each learning screen with interaction metadata and then upgrades the generated learner HTML.

Current interaction types include:

| Layout family | Default interaction |
|---------------|---------------------|
| Process / Timeline / Cycle | `step_explore` |
| Hub / Cards / Matrix | `hotspot_explore` |
| Comparison | `compare_reveal` |
| Spotlight | `focus_reveal` |

The learner experience includes:

- visual panel;
- short instructional copy;
- numbered/selectable learning points;
- selected-point detail display;
- explored count;
- interaction prompt;
- responsive layout;
- no requirement for an external JavaScript library.

These interactions are deliberately non-blocking. A learner is encouraged to explore, but an unvisited visual point does not currently prevent navigation or course completion.

---

## 11. Knowledge checks and SCORM interaction tracking

`server/services/scorm/ScormExperienceFinalizer.js` adds SCORM 1.2 interaction tracking for quiz answers.

For each quiz question it attempts to write:

```text
cmi.interactions.N.id
cmi.interactions.N.type
cmi.interactions.N.student_response
cmi.interactions.N.result
cmi.interactions.N.correct_responses.0.pattern
```

Quiz type is recorded as `choice`.

If the AI blueprint includes `explanation`, the learner receives an instructional explanation after answering rather than only generic correct/incorrect feedback.

Interaction tracking is additive. It does not replace the existing course score/completion logic.

---

## 12. SCORM runtime behavior intentionally preserved

The visual overhaul does **not** replace the established SCORM runtime.

The generated experience continues to preserve the existing course behavior including:

- `LMSInitialize`;
- `LMSSetValue` / `LMSGetValue` wrapper usage;
- periodic `LMSCommit`;
- session time;
- lesson location/progress;
- raw score;
- min/max score;
- lesson status;
- suspend/normal exit handling;
- `LMSFinish`;
- existing Quizmoto launch/player shell behavior.

This separation is intentional:

```text
Existing runtime contract
        │
        └── preserved

Visual / interaction experience
        │
        └── upgraded around the runtime
```

---

## 13. Visual Author v2

The active `/scorm/author` route now imports:

```text
client/src/pages/Scorm/AuthorVisual.jsx
```

The older `Author.jsx` file remains in the repository for reference/rollback, but it is no longer the routed authoring surface.

Visual Author v2 is designed to preserve the richer visual schema end to end rather than stripping the AI output back to title/content/keyPoints.

Primary responsibilities:

- PDF/PPT upload;
- AI analysis;
- course title/summary editing;
- visual layout editing;
- visual metadata preservation;
- quiz editing including explanations;
- theme selection;
- SCORM generation;
- direct handoff to Visual Studio after generation.

---

## 14. Visual Studio

Route:

```text
/scorm/visual-studio
```

File:

```text
client/src/pages/Scorm/VisualStudio.jsx
```

Visual Studio is the author-side refinement surface for AI-authored packages.

It allows an administrator to work screen by screen rather than editing raw JSON.

Current capabilities include:

- screen list/navigation;
- layout selection;
- visual title editing;
- interaction prompt editing;
- theme selection;
- learner-style visual preview;
- package rebuild/save flow.

The SCORM World home screen links to this visual authoring workflow.

---

## 15. Package-building stack

The visual authoring stack is intentionally layered rather than implemented as one monolithic builder.

```text
ScormVisualThemeFinalizer
        │
        ▼
ScormExperienceFinalizer
        │
        ▼
ScormExperiencePackageBuilder
        │
        ├── enrich semantic layouts/interactions
        │
        ├── ScormVisualAssetService
        │       │
        │       └── Python SVG generator
        │
        └── ScormVisualPackageBuilder
                │
                └── base learner HTML / SCORM ZIP
```

### Roles

#### `ScormVisualPackageBuilder.js`
Base visual HTML/CSS/JS course renderer and SCORM ZIP builder.

#### `ScormExperiencePackageBuilder.js`
Adds semantic enrichment, Python visual assets, interactive exploration UI, content metadata, and fallback behavior.

#### `ScormExperienceFinalizer.js`
Adds SCORM quiz interaction tracking and final interaction metadata.

#### `ScormVisualThemeFinalizer.js`
Injects the selected visual theme before the visual asset generation/finalization chain.

#### `ScormVisualAssetService.js`
Runs the Python generator in a temporary job directory, loads generated SVG assets, and cleans temporary files.

---

## 16. Package-generation flow

The active server author route is:

```text
POST /api/scorm/author/analyze
POST /api/scorm/author/generate
```

`server/routes/scorm/author.js` currently imports the final package builder from:

```text
server/services/scorm/ScormVisualThemeFinalizer.js
```

High-level flow:

```text
1. User uploads PDF/PPT
2. Gemini returns visual learning blueprint
3. User reviews/edits blueprint
4. User chooses theme
5. Server enriches layout + interaction metadata
6. Python creates themed animated SVG assets
7. HTML learner experience is built
8. SCORM tracking/interaction layer is finalized
9. Assets are added to imsmanifest.xml
10. content.json stores editable visual metadata
11. ZIP is stored in package library
12. Package is unpacked/validated through existing SCORM pipeline
```

---

## 17. Generated SCORM package structure

Representative structure:

```text
course.zip
├── imsmanifest.xml
├── index.html
├── scorm_api_wrapper.js
├── content.json
├── logo.<ext>                         # optional
└── assets/
    └── visuals/
        ├── visual-001-process.svg
        ├── visual-002-hub.svg
        ├── visual-003-comparison.svg
        ├── visual-004-matrix.svg
        └── visual-manifest.json
```

`content.json` is important because Quizmoto uses it to preserve editable AI-author metadata when the package is reopened.

---

## 18. Python execution and configuration

`ScormVisualAssetService.js` searches for Python in this order:

```text
SCORM_VISUAL_PYTHON_CMD
REPORT_PYTHON_CMD
/usr/bin/python3
python3
python
```

Useful environment variables:

| Variable | Purpose |
|----------|---------|
| `SCORM_VISUAL_PYTHON_CMD` | Explicit Python binary for visual generation |
| `REPORT_PYTHON_CMD` | Existing Python command also accepted as fallback |
| `SCORM_VISUAL_TIMEOUT_MS` | Vector generation process timeout; default 30000 ms |
| `SCORM_VISUAL_TMP_DIR` | Temporary directory for visual generation jobs |
| `SCORM_AI_AUTHOR` | Enables AI author route |
| `GEMINI_API_KEY` | Required for document analysis/generation |
| `SCORM_LMS` | Existing SCORM feature flag / deployment control |

No TTS environment variables are required because voice functionality has been removed/deferred.

---

## 19. Failure and fallback behavior

Visual generation must degrade safely.

### If Python is available

```text
AI blueprint
   ↓
Python themed/animated SVGs
   ↓
interactive learner layout
```

### If Python fails or is unavailable

```text
AI blueprint
   ↓
Python generation failure logged
   ↓
HTML visual renderer remains active
   ↓
SCORM package generation continues
```

The fallback is deliberate. A visual-generation problem should not make the authoring feature unusable.

The generated `content.json` records whether the experience used the Python SVG path or HTML fallback where applicable.

---

## 20. Backwards compatibility

The visual engine supports older analysis JSON.

If a screen does not contain a supported `layout`, Quizmoto infers one using semantic cues such as:

- `step`, `workflow`, `flow` → process;
- `phase`, `stage`, `journey` → timeline;
- `safe`, `unsafe`, `versus`, `compare` → comparison;
- `components`, `categories`, `pillars` → hub;
- `warning`, `critical`, `takeaway` → spotlight;
- `likelihood`, `impact`, `severity` → matrix;
- `cycle`, `continuous`, `repeat` → cycle.

This prevents old editable packages from becoming incompatible with the new authoring system.

---

## 21. Accessibility and responsive behavior

The learner experience includes:

- responsive single/two-column layouts;
- readable text-first fallback when a visual asset is unavailable;
- SVG `role="img"` and accessible label output;
- `prefers-reduced-motion` handling;
- semantic buttons for learning-point exploration;
- visible quiz feedback;
- no critical information hidden exclusively in animation.

Real-device accessibility/mobile QA is still required before production sign-off.

---

## 22. Key files

### Backend / authoring intelligence

| File | Responsibility |
|------|----------------|
| `server/services/scorm/PolicyAnalysisService.js` | AI instructional/visual blueprint |
| `server/routes/scorm/author.js` | Analyze/generate API and package-library integration |
| `server/services/scorm/ScormVisualThemeFinalizer.js` | Selected theme injection |
| `server/services/scorm/ScormExperienceFinalizer.js` | SCORM quiz interaction tracking/finalization |
| `server/services/scorm/ScormExperiencePackageBuilder.js` | Semantic enrichment, interactive layer, visual asset bundling |
| `server/services/scorm/ScormVisualAssetService.js` | Python execution/temp asset management |
| `server/services/scorm/ScormVisualPackageBuilder.js` | Base visual course renderer/SCORM package builder |

### Python visual engine

| File | Responsibility |
|------|----------------|
| `server/utils/generate_scorm_visuals.py` | Core vector diagram generation |
| `server/utils/generate_scorm_visuals_v2.py` | SVG animation wrapper |
| `server/utils/generate_scorm_visuals_v3.py` | Theme-aware SVG wrapper |

### Frontend

| File | Responsibility |
|------|----------------|
| `client/src/pages/Scorm/AuthorVisual.jsx` | Active visual-first AI Author |
| `client/src/pages/Scorm/VisualStudio.jsx` | Visual course refinement studio |
| `client/src/pages/Scorm/Home.jsx` | SCORM World entry/navigation |
| `client/src/App.jsx` | Active `/scorm/author` and `/scorm/visual-studio` routes |
| `client/src/pages/Scorm/useAuthorEditLoad.js` | Existing package analysis/edit loading |

### Testing / CI

| File | Responsibility |
|------|----------------|
| `server/tests/ScormExperiencePackageBuilder.test.js` | Visual layout/enrichment regression tests |
| `.github/workflows/ci.yml` | Client build + server tests + E2E pipeline |
| `playwright.config.js` | Cross-platform Playwright server startup |

---

## 23. Tests added for the visual architecture

`server/tests/ScormExperiencePackageBuilder.test.js` currently covers key semantic behavior including:

- preserving explicitly selected supported layouts;
- inferring layouts from learning content;
- adding visual/interaction metadata without dropping source content;
- preserving explicit AI interaction instructions.

These tests protect the learning blueprint/enrichment contract.

Additional browser-level visual assertions should be added after the first production-quality visual baseline is accepted.

---

## 24. CI corrections completed during this phase

The existing workflow previously executed:

```text
npm run build
```

from the repository root even though the root `package.json` did not define a build script.

The workflow was corrected so CI now installs the relevant dependency sets and is intended to execute the actual verification sequence:

```text
root dependencies
      ↓
server dependencies
      ↓
client dependencies
      ↓
Playwright browsers
      ↓
client build
      ↓
server unit tests
      ↓
Playwright E2E
```

`playwright.config.js` was also changed from the Windows-specific:

```text
set NODE_ENV=test
```

to a cross-platform `cross-env` startup command.

**Important:** the latest CI result should always be checked before release. At the time this implementation was completed, the corrected pipeline had been started and was progressing through dependency/browser setup; this document does not treat a still-running workflow as a passed production gate.

---

## 25. Deployment requirements

### Required for AI authoring

- `SCORM_AI_AUTHOR=true`
- valid `GEMINI_API_KEY`
- existing SCORM feature/runtime configuration

### Required for best visual output

- Python 3 available in the backend runtime; or
- `SCORM_VISUAL_PYTHON_CMD` configured to a working Python 3 executable.

The current SVG pipeline does not require heavy Python packages.

### If Python is missing

The HTML visual fallback keeps course generation functional, but the generated course will not contain the richer Python-produced SVG diagrams.

Therefore production should verify Python availability rather than relying permanently on fallback.

---

## 26. Operator / QA smoke test

Use a real cybersecurity PDF/PPT rather than synthetic placeholder content.

### Authoring

1. Open **SCORM World → Create from policy**.
2. Upload a PDF or PPTX.
3. Generate a **Detailed** module.
4. Confirm AI output contains varied visual layouts.
5. Edit at least one layout and one visual title.
6. Generate the package.
7. Open it in **Visual Studio**.
8. Change the theme and rebuild.

### Package inspection

1. Download the ZIP.
2. Verify `imsmanifest.xml` exists.
3. Verify `content.json` exists.
4. Verify `assets/visuals/` contains SVG files.
5. Verify visual files use the selected theme rather than always default orange.

### Learner experience

1. Launch through the normal Quizmoto learner flow.
2. Verify process/timeline/hub/comparison/matrix/cycle screens render correctly.
3. Verify SVG animations play.
4. Verify `prefers-reduced-motion` still leaves all information visible.
5. Click learning-point exploration controls.
6. Complete quiz questions.
7. Verify explanations appear where present.
8. Verify final score/completion is saved.
9. Leave/relaunch and verify existing resume behavior is not broken.

### Runtime/tracking

Verify that quiz answers write interaction data where supported by the LMS/runtime and that existing score/completion fields still persist.

---

## 27. Known limitations

The visual-first architecture is complete, but the following limitations should be understood.

### 27.1 Visual quality still needs real-course tuning

The architecture can generate significantly richer modules, but actual typography density, diagram labeling, and spacing need to be evaluated using multiple real documents.

### 27.2 Deterministic vectors, not AI illustrations

The current system creates controlled diagrams/infographics. It does not generate photorealistic or bespoke scene artwork.

This is intentional for portability, consistency, and cost.

### 27.3 Interaction library is still bounded

Current interactions focus on exploration/reveal patterns and quiz questions. The following can be future additions:

- drag and drop;
- matching;
- ordering/sequencing;
- real coordinate-based visual hotspots;
- branching scenarios;
- simulated email/WhatsApp/browser screens;
- richer remediation paths.

### 27.4 Exploration is not currently completion-gated

The learner can continue without selecting every visual point. This avoids introducing an unexpected behavioral regression. A configurable completion gate can be added later.

### 27.5 Voice intentionally absent

No narration is generated or bundled. Voice should be revisited only after the visual experience is approved.

### 27.6 Legacy author file remains

`client/src/pages/Scorm/Author.jsx` remains in the repository, but `/scorm/author` currently routes to `AuthorVisual.jsx`.

Do not modify the legacy editor assuming it is the active UI without checking `client/src/App.jsx`.

---

## 28. Recommended next development sequence

The architecture should not be rewritten again unless testing reveals a fundamental issue.

Recommended sequence:

### Step 1 — visual QA baseline

Generate 5–10 real courses covering:

- phishing;
- data privacy;
- ransomware;
- password/MFA;
- social engineering;
- USB/removable media;
- AI/deepfake awareness;
- compliance/policy content.

Record which screens look excellent and which layouts need density/spacing fixes.

### Step 2 — polish existing layouts

Prioritize:

- text wrapping;
- long title handling;
- 3/4/5/6-node composition;
- mobile spacing;
- matrix labels;
- timeline collision prevention;
- comparison column balance;
- consistent iconography.

### Step 3 — richer cybersecurity-native templates

Add specialized deterministic visuals such as:

- phishing email anatomy;
- browser/login-page warning signs;
- attack chain;
- identity compromise flow;
- data classification pyramid;
- incident reporting workflow;
- QR scam flow;
- mobile/smishing message screen.

### Step 4 — richer interactions

Only after static visual quality is strong:

- scenario decisions;
- click-the-warning-sign hotspots;
- matching;
- ordering;
- categorization;
- branching consequence screens.

### Step 5 — narration research

Revisit voice separately after visual acceptance. Narration should not be allowed to block or destabilize the visual authoring pipeline.

---

## 29. Release acceptance criteria

Before declaring the visual author production-ready, all of the following should be true:

- [ ] Corrected CI pipeline is green.
- [ ] Client production build passes.
- [ ] Server unit suite passes.
- [ ] Playwright critical paths pass.
- [ ] New AI-authored package contains visual SVG assets when Python is available.
- [ ] Package generation still succeeds when Python is deliberately unavailable.
- [ ] All four themes render correctly inside SVG assets.
- [ ] At least six layout types have been validated with real content.
- [ ] Mobile/375px module navigation is usable.
- [ ] SCORM resume behavior remains correct.
- [ ] Score/completion remains correct.
- [ ] Quiz `cmi.interactions` data does not break LMS commits.
- [ ] Existing uploaded third-party SCORM packages are unaffected.
- [ ] Existing Quizmoto AI-authored package can be reopened/rebuilt.
- [ ] No voice/TTS dependency remains in the active flow.

---

## 30. Implementation milestone summary

The completed work changes the product direction from:

```text
Document → text slides → quiz → SCORM
```

into:

```text
Document
  → instructional blueprint
  → semantic layouts
  → Python/vector diagrams
  → purposeful animation
  → visual exploration
  → tracked knowledge checks
  → editable Visual Studio
  → portable SCORM package
```

This architecture should now be treated as the foundation for future Quizmoto SCORM authoring work.

Future effort should focus primarily on **visual quality, cybersecurity-specific templates, and interaction depth**, rather than replacing the core pipeline.

---

## 31. Related documentation

- `docs/implementation/phases/PLATFORM_FIXES_AND_STATUS_2026-08-08.md`
- `docs/implementation/phases/PLATFORM_STATUS_ALL_WAVES.md`
- `docs/implementation/phases/scorm-lms/`

---

*Implementation document created 2026-08-08 for the Quizmoto visual-first SCORM authoring overhaul.*
