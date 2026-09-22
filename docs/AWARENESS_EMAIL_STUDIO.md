# Awareness Email Studio

## Purpose

Awareness Email Studio lets an LMSGEN tenant create polished educational email communications with AI, edit only the copy, export the result as an EML file or send it through the platform's existing mail configuration.

The AI does not generate raw email HTML. It returns structured copy and an image prompt. LMSGEN owns the eight email-safe layouts and renders the final HTML itself. This keeps the template stable, prevents accidental markup edits and gives consistent preview, export and delivery behaviour.

## Completed phases

### Phase 1 — Foundation
- Tenant-scoped persistent awareness templates.
- Eight fixed layout varieties.
- Structured OpenAI copy generation.
- AI hero-image generation through the existing OpenAI image client.
- Existing local/S3-compatible object storage for generated images.
- Random 256-bit public image tokens for email-client image loading.
- HTML escaping and HTTP/HTTPS-only CTA links.

### Phase 2 — Authoring
- New **Awareness Emails** LMSGEN navigation item.
- Topic, audience, learning goal, tone, CTA URL and organisation context inputs.
- AI-selected style or manual selection from eight layouts.
- Saved-template library.
- Text-only editor for subject, preheader, headline, body, learning points, CTA, footer and image alt text.
- Protected HTML preview.

### Phase 3 — Export and send
- MIME/RFC 5322 EML export.
- Generated image embedded by CID in EML and SMTP delivery.
- Brevo delivery using a tokenised persistent image URL.
- Existing platform SMTP/Brevo settings are reused.
- Each recipient is delivered separately to avoid address disclosure.
- Maximum 50 unique recipients per send request.

### Phase 4 — Hardening
- Renderer tests for all eight layouts.
- User text is always HTML-escaped.
- No script or iframe markup is generated.
- Authoring endpoints require super-admin, admin or co-admin roles.
- Tenant ownership is checked for every saved template.
- Private template APIs use no-store responses.
- Public images use long random tokens and immutable caching.
- AI instructions explicitly forbid credential requests, deceptive phishing lures and invented URLs.

## Layouts

1. Editorial Hero
2. Split Feature
3. Checklist Focus
4. Signal Card
5. Story Spotlight
6. Myth & Fact
7. Action Brief
8. Minimal Note

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

## Existing configuration reused

- `OPENAI_API_KEY`
- Optional `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`
- Existing SMTP environment variables or `BREVO_API_KEY` + `MAIL_FROM`
- Existing `STORAGE_DRIVER` / `S3_*` variables
- `APP_BASE_URL`, `PUBLIC_FRONTEND_URL` or `FRONTEND_URL` should point to the public LMSGEN origin for Brevo hero images

## Email compatibility approach

The renderer uses a 600–620 px table-based structure, inline critical styles, a very small responsive media query, plain-text alternatives and conservative HTML. Important learning content is always real HTML text rather than text burned into the generated image.
