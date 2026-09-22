# Awareness Email Studio

## Purpose

Awareness Email Studio lets an LMSGEN tenant create polished educational email communications with AI, edit only the copy, export the result as an EML file or send it through the platform's existing mail configuration.

The AI never writes arbitrary email HTML. It returns structured copy and visual direction. LMSGEN owns the eight email-safe layouts, chooses the layout-aware image slots and renders the final HTML. This keeps the design stable, prevents accidental markup edits and gives consistent preview, export and delivery behaviour.

## Reference research

The eight layout families were derived from the supplied `Educational-email-Templete.zip`. The archive contains eight distinct editorial approaches rather than simple colour variations:

1. Data Privacy — warm newsletter, hero, feature cards and dark closing band.
2. Mobile App Threats — dark high-risk field briefing, numbered threats, visual field test and bright action band.
3. Internet Security — calm best-practice guide, hero, 2×2 illustrated habit cards and a golden-rule panel.
4. Social Media — black-and-red exposure brief, numbered risks, case-file visual and practical checklist.
5. Ransomware — image-led attack storyboard with alternating attack stages and response guidance.
6. Social Engineering — purple-and-gold human-risk playbook with tactic cards and red-flag guidance.
7. Modern Threats — navy-and-red dossier with visual evidence panels and numbered scenarios.
8. AI Scams & Deepfakes — cinematic threat signal with scenario visuals and verification-first guidance.

Important learning content remains real HTML text. AI images are supporting visuals only, so an unavailable image service does not remove the learning content.

## Completed phases

### Phase 1 — Research and foundation
- Reviewed the Quizmoto/LMSGEN architecture and reused the existing OpenAI, mail, object-storage, authentication and tenant-entitlement services.
- Unpacked and audited all eight supplied reference template families.
- Added tenant-scoped persistent awareness templates.
- Added eight protected, reference-derived email layouts.
- Added HTML escaping and HTTP/HTTPS-only CTA links.
- Added 256-bit public asset tokens for email-client image loading.

### Phase 2 — AI generation and authoring
- Structured OpenAI copy generation.
- AI-selected style or manual selection from eight layout families.
- Layout-aware image generation with 2–5 visual slots depending on the selected design.
- Visual generation runs with bounded concurrency and gracefully supports partial image success.
- Existing local/S3-compatible object storage is reused.
- New **Awareness Emails** LMSGEN navigation item.
- Topic, audience, learning goal, tone, CTA URL and organisation context inputs.
- Saved-template library and protected preview.
- Text-only editing for subject, preheader, headline, body, learning points, CTA, footer and hero alt text.
- Layout and generated visuals cannot be edited through the authoring UI.

### Phase 3 — Export and send
- MIME/RFC 5322 EML export.
- All available generated visuals are embedded by CID in EML and SMTP delivery.
- Brevo delivery uses tokenised persistent image URLs for every available visual.
- Existing platform SMTP/Brevo settings are reused.
- Each recipient is delivered separately to avoid recipient-address disclosure.
- Maximum 50 unique recipients per send request.

### Phase 4 — Hardening
- Renderer coverage for all eight layouts.
- Multiple-image and no-image rendering support.
- User text is HTML-escaped.
- No script or iframe markup is generated.
- Authoring endpoints require super-admin, admin or co-admin roles.
- Tenant ownership is checked for every saved template.
- Private template APIs use no-store responses.
- Public images use long random tokens and immutable caching.
- Awareness generation has a per-user hourly rate limit.
- AI instructions explicitly forbid credential requests, deceptive phishing lures and invented URLs.
- Generated objects are cleaned up when template persistence fails or the template is deleted.

## Layout catalogue

1. Editorial Newsletter
2. High-Risk Brief
3. Best Practices Guide
4. Exposure Field Brief
5. Attack Storyboard
6. Human Risk Playbook
7. Modern Threat Dossier
8. AI Threat Signal

## Main API

- `GET /api/scorm/awareness-templates/catalog`
- `GET /api/scorm/awareness-templates`
- `POST /api/scorm/awareness-templates/generate`
- `GET /api/scorm/awareness-templates/:id`
- `PUT /api/scorm/awareness-templates/:id`
- `DELETE /api/scorm/awareness-templates/:id`
- `GET /api/scorm/awareness-templates/:id/preview`
- `POST /api/scorm/awareness-templates/:id/export-eml`
- `POST /api/scorm/awareness-templates/:id/send`
- `GET /api/scorm/awareness-assets/:token`
- `GET /api/scorm/awareness-assets/:token/:slot`

## Existing configuration reused

- `OPENAI_API_KEY`
- Optional `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`
- Existing SMTP environment variables or `BREVO_API_KEY` + `MAIL_FROM`
- Existing `STORAGE_DRIVER` / `S3_*` variables
- `APP_BASE_URL`, `PUBLIC_FRONTEND_URL` or `FRONTEND_URL` should point to the public LMSGEN origin for Brevo images

## Awareness-specific optional configuration

- `AWARENESS_MAX_AI_IMAGES` — maximum visuals generated per email, clamped to 1–5 and defaulting to 5.
- `AWARENESS_IMAGE_CONCURRENCY` — concurrent image requests, clamped to 1–3 and defaulting to 2.
- `AI_AWARENESS_HOURLY_LIMIT` — authenticated generation requests per user per hour, defaulting to 12.

## Email compatibility approach

The renderer uses a fixed 600 px table-based structure, inline critical styles, a small responsive stacking media query, plain-text alternatives and conservative HTML. The layout remains understandable when images are blocked by an email client because headings, scenarios, actions and learning points are real text rather than text burned into images.
