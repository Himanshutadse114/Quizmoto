# LMSGEN outbound email setup

LMSGEN sends application email through Brevo's transactional email HTTPS API by default. This avoids SMTP-port restrictions on free hosting while keeping the existing LMSGEN email templates and notification flows.

SMTP remains available as a fallback provider when `MAIL_PROVIDER=smtp` is explicitly configured.

## Production environment variables

Set these on the backend that serves `api.lmsgen.in`:

- `MAIL_ENABLED=true`
- `MAIL_PROVIDER=brevo`
- `BREVO_API_KEY=<Brevo production API key>`
- `MAIL_FROM=training@lmsgen.in`
- `MAIL_FROM_NAME=LMSGen`
- `MAIL_ADMIN_TO=<address that receives access/admin notifications>`
- `APP_BASE_URL=https://www.lmsgen.in`

`MAIL_REPLY_TO` is optional.

The Brevo API key must be stored only in the deployment environment. Do not commit it to GitHub.

The sender domain `lmsgen.in` and the sender `LMSGen <training@lmsgen.in>` must remain authenticated/verified in Brevo.

## Mail flows handled by the application

- Six-digit OTP delivery for password reset and email verification through `/api/scorm/otp/request` and `/api/scorm/otp/verify`.
- Direct course-assignment email when a learner registration is created outside a campaign.
- Campaign invitation email when a campaign changes to active. Email-code campaigns include the learner-specific access code/passkey.
- Tenant Admin invitation when a Tenant Admin membership is created or an existing member is promoted to Admin.
- Co-admin and Analytics Viewer invitations/role notifications when workspace membership is added or changed.
- New access-request acknowledgement to the requester and notification to the configured platform Admin.
- Access-approved and access-revoked notifications when request status changes.

Non-critical notification failures are logged and never roll back the underlying tenant, course or campaign operation. OTP delivery is strict: if email delivery fails, the OTP request fails and the OTP record is removed.

## Super Admin email checks

The Super Admin page includes an Email delivery diagnostics panel using the same provider as production mail.

Backend endpoints:

- `GET /api/scorm/mail/status` verifies the configured provider. For Brevo this validates the API key through the Brevo HTTPS API.
- `POST /api/scorm/mail/test` sends an actual delivery test.
- Send `{ "to": "address@example.com", "kind": "campaign" }` to test the campaign invitation template and a sample Email + access-code passkey.

The diagnostics response never exposes the Brevo API key or mailbox passwords.

## SMTP fallback

If LMSGEN is later hosted somewhere that permits outbound SMTP and SMTP is preferred, set:

- `MAIL_PROVIDER=smtp`
- `MAIL_HOST=<smtp host>`
- `MAIL_PORT=<smtp port>`
- `MAIL_SECURE=true|false`
- `MAIL_USER=<smtp username>`
- `MAIL_PASS=<smtp password>`
- `MAIL_FROM=<verified sender>`

## DNS note

Brevo domain authentication uses its own verification and DKIM records. Existing inbound-mail MX records do not need to be moved to Brevo. Keep only one DMARC TXT record at `_dmarc` and keep the authenticated Brevo DKIM selectors in place.
