# Awareness Email Template Gallery

## Product direction

Awareness Emails is a curated template-library product, not an AI template generator.

The Super Admin owns the **Central Template Library**. Professionally designed HTML email templates can be uploaded as ZIP files together with their local image folders. LMSGEN recognises the HTML and referenced images, stores the images in the configured Cloudflare R2/S3-compatible object storage and rewrites the email HTML to stable public asset URLs.

Users browse the Central Template Gallery and must add a template to **My Library** before they can edit, send or export it.

## User flow

1. Browse the Central Template Gallery.
2. Preview any available template.
3. Select **Add to My Library**.
4. Open the imported copy in the visual editor.
5. Edit text directly inside the email.
6. Click any image to replace or remove it.
7. Save the customised copy.
8. Send it through the platform or export it as an EML file.

Central Gallery items cannot be sent or exported directly.

## Super Admin flow

1. Open Awareness Emails.
2. Use **Add Template ZIP**.
3. Upload a ZIP containing one or more HTML templates and their local image folders.
4. LMSGEN detects every HTML file in the archive.
5. Each local image referenced by an HTML template is validated and stored in object storage.
6. The HTML is rewritten to the stored image URLs and saved in the Central Library.
7. The Super Admin can hide or restore a Central Library item without breaking previously imported user copies.

A single ZIP can contain multiple template folders.

## Seeded templates

The repository file `Educational-email-Templete.zip` is automatically seeded into the Central Library on first use. The eight seeded templates are:

1. Data Privacy Newsletter
2. Mobile App Threats
3. Internet Security Best Practices
4. Social Media Threats
5. Ransomware: Don’t Hand Over the Keys
6. Social Engineering: Trust Is the Target
7. Modern Threats
8. AI Scams & Deepfakes

Seeding is idempotent using stable seed keys, so restarting the service does not create duplicates.

## Editing model

The imported email HTML remains the source of truth. LMSGEN does not rebuild the design into its own layout system.

Text editing uses a visual content-editable iframe so the original structure and inline email styling remain intact.

Image editing is intentionally limited to replacement or removal. Replacement images are uploaded to the user template’s own object-storage area and the HTML is updated to the new stored image URL.

This keeps the original layout protected while still allowing practical customisation.

## Delivery and export

Only templates inside My Library can be sent or exported.

- SMTP delivery embeds stored template images by CID.
- EML export embeds stored template images by CID.
- Brevo delivery uses the stable public asset URLs.
- Each recipient is sent separately to prevent address disclosure.
- Maximum 50 unique recipients per send request.
- Existing learner-roster recipients can be selected from the editor.

## Storage layout

Central Library assets:

`awareness/library/<central-template-id>/<asset-id>.<ext>`

User replacement assets:

`awareness/user/<host-id>/<user-template-id>/<asset-id>.<ext>`

Supported image formats are JPEG, PNG, WebP and GIF. Individual images are limited to 8 MB.

## ZIP rules

- ZIP size: maximum 35 MB.
- Template HTML: maximum 750 KB each.
- Maximum 50 HTML templates per ZIP.
- Relative image references are resolved from the HTML file location.
- Local image paths are uploaded to object storage.
- Unsafe archive paths are rejected.
- Script, iframe, object, embed and form markup is removed from saved email HTML.

## Main API

Central Library:

- `GET /api/scorm/awareness-gallery/central`
- `GET /api/scorm/awareness-gallery/central/:id`
- `POST /api/scorm/awareness-gallery/central/upload` — Super Admin
- `PATCH /api/scorm/awareness-gallery/central/:id` — Super Admin
- `POST /api/scorm/awareness-gallery/central/:id/import`

My Library:

- `GET /api/scorm/awareness-gallery/mine`
- `GET /api/scorm/awareness-gallery/mine/:id`
- `PUT /api/scorm/awareness-gallery/mine/:id`
- `POST /api/scorm/awareness-gallery/mine/:id/image`
- `DELETE /api/scorm/awareness-gallery/mine/:id`
- `POST /api/scorm/awareness-gallery/mine/:id/send`
- `POST /api/scorm/awareness-gallery/mine/:id/export-eml`

Public image delivery:

- `GET /api/scorm/awareness-template-assets/:scope/:token/:assetId`

## Configuration

Existing platform configuration is reused:

- `STORAGE_DRIVER=s3`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT`
- AWS/R2 access key and secret
- Existing SMTP variables or `BREVO_API_KEY` + `MAIL_FROM`

Awareness-gallery configuration:

- `AWARENESS_ASSET_BASE_URL=https://api.lmsgen.in`
- `AWARENESS_SEED_REFERENCE_TEMPLATES=true`

No OpenAI key is required for the Awareness Email Template Gallery.
