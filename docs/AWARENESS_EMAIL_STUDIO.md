# Awareness Email Template Gallery

## Product direction

Awareness Emails is a curated template-library product, not an AI template generator.

The Super Admin owns the **Central Template Library**. Professionally designed HTML email templates can be uploaded as ZIP files together with their local image folders. LMSGEN recognises the HTML and referenced images, stores the images in the configured Cloudflare R2/S3-compatible object storage and rewrites the email HTML to stable public asset URLs.

Users browse the Central Template Gallery and must add a template to **My Library** before they can edit, send or export it.

## Managed template service

The product is intentionally curated rather than AI-generated. LMSGEN/Innvikta can create client-specific templates outside the platform, package them as HTML + images and publish them into the Central Library. This supports security awareness, internal communication, HR campaigns, compliance communication and marketing-style employee campaigns while keeping the visual quality fully controlled.

The library therefore acts as both a software feature and a managed design service: once a custom template is published, the client can reuse it, customise its wording and images, send it through the platform or export it without rebuilding the design.

## User flow

1. Browse the Central Template Gallery.
2. Preview any available template.
3. Select **Add to My Library**. The template is added to the My Library card grid and does not automatically open.
4. From My Library, choose **Preview**, **Edit**, **Send** or **Export**.
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

Seeding is idempotent using stable seed keys, so restarting the service does not create duplicates. The reference ZIP is bundled under the backend `seed-assets` directory so Docker/Render deployments can seed the same eight templates in production.

## Editing model

The imported email HTML remains the source of truth. LMSGEN does not rebuild the design into its own layout system.

Text editing uses a visual content-editable iframe so the original structure and inline email styling remain intact.

Image editing is intentionally limited to replacement or removal. Replacement images are uploaded to the user template’s own object-storage area and the HTML is updated to the new stored image URL. Existing text edits are saved before an image replacement and superseded user-owned image objects are cleaned up automatically.

This keeps the original layout protected while still allowing practical customisation.

## Delivery and export

Only templates inside My Library can be sent or exported. My Library keeps the same gallery-card presentation as the Central Library but adds usage actions for the tenant.

- SMTP delivery embeds stored template images by CID.
- EML export embeds stored template images by CID.
- Brevo delivery uses the stable public asset URLs.
- Each recipient is sent separately to prevent address disclosure.
- Maximum 50 unique recipients per send request.
- Existing learner-roster recipients can be selected from the Send dialog.\n- The Send action becomes available once at least one valid recipient is entered. If SMTP/Brevo is not configured, the dialog shows a clear mail-setup warning instead of silently looking disabled.

## Storage layout

Central Library assets:

`awareness/library/<central-template-id>/<asset-id>.<ext>`

User replacement assets:

`awareness/user/<host-id>/<user-template-id>/<asset-id>.<ext>`

Supported image formats are JPEG, PNG, WebP and GIF. Individual images are limited to 8 MB.

## Recommended ZIP format

For the cleanest import, use one folder per template:

```text
Template Name/
├── email.html
├── thumbnail.jpg
└── images/
    ├── hero.png
    ├── card-1.png
    ├── card-2.png
    └── ...
```

Thumbnail guidance:
- Recommended file name: `thumbnail.jpg`
- Recommended size: **1200 × 675 px** (16:9)
- Also recognised: `thumbnail.png`, `thumbnail.webp`, `cover.*`, `preview.*` and `images/thumbnail.*`
- If no thumbnail is supplied, LMSGEN automatically creates a 16:9 thumbnail from the first template image
- Super Admin can replace the thumbnail later from the Central Gallery card

The HTML can be named `email.html`, `template.html` or any other `.html`/ `.htm` file. Relative image paths are resolved from that HTML file.

## ZIP rules

- ZIP size: maximum 35 MB.
- Template HTML: maximum 750 KB each.
- Maximum 50 HTML templates per ZIP.
- Relative image references are resolved from the HTML file location.\n- Local `<img src>`, HTML `background` attributes and CSS `url(...)` image references are recognised and uploaded to object storage.
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
- `AWARENESS_SEED_REFERENCE_TEMPLATES=true`\n- Optional `AWARENESS_REFERENCE_ZIP_PATH` to override the bundled seed archive

No OpenAI key is required for the Awareness Email Template Gallery.
