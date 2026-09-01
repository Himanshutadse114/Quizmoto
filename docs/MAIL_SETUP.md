# LMSGEN outbound email setup

LMSGEN sends application email through SMTP. The defaults in the code and Render blueprint match GoDaddy Professional Email, while every SMTP value remains configurable through environment variables.

## Backend environment variables

Set these on whichever backend is currently serving LMSGEN (for example the active Koyeb service or the Render backend):

- `MAIL_ENABLED=true`
- `MAIL_HOST=smtpout.secureserver.net`
- `MAIL_PORT=465`
- `MAIL_SECURE=true`
- `MAIL_USER=<full mailbox address on lmsgen.in>`
- `MAIL_PASS=<mailbox password>`
- `MAIL_ADMIN_TO=<address that receives access/admin notifications>`
- `APP_BASE_URL=https://lmsgen.in`

`MAIL_FROM` is optional. If omitted, LMSGEN sends from `MAIL_USER`. `MAIL_REPLY_TO` is optional. If the chosen mailbox is hosted by a provider other than GoDaddy Professional Email, override `MAIL_HOST`, `MAIL_PORT` and `MAIL_SECURE` with that provider's SMTP settings.

Do not commit mailbox passwords or SMTP credentials to GitHub.

## Mail flows handled by the application

- Six-digit OTP delivery for login, password-reset and email-verification workflows through `/api/scorm/otp/request` and `/api/scorm/otp/verify`.
- Direct course-assignment email when a learner registration is created outside a campaign.
- Campaign invitation email when a campaign changes to active. Email-code campaigns include the learner-specific access code.
- Tenant Admin invitation when a tenant Admin membership is created or an existing member is promoted to Admin.
- Co-admin and Analytics Viewer invitations/role notifications when workspace membership is added or changed.
- New access-request acknowledgement to the requester and notification to the configured platform Admin.
- Access-approved and access-revoked notifications when request status changes.

Non-critical notification failures are logged and never roll back the underlying tenant, course or campaign operation. OTP delivery is strict: if SMTP delivery fails, the OTP request fails and the code record is removed.

## Operational SMTP checks

An authenticated Tenant Admin or Super Admin can check the configured SMTP connection with:

- `GET /api/scorm/mail/status`
- `POST /api/scorm/mail/test` to send an actual test message. The request may contain `{ "to": "address@example.com" }`; otherwise the signed-in Admin email is used.

The public `GET /api/scorm/otp/status` route reports only whether mail credentials are configured. It never exposes credentials.

## DNS note

The exported `lmsgen.in` zone contains GoDaddy SPF, DKIM and mail records, but it also contains Google Workspace and Microsoft 365 MX records. Inbound mail should use one intended provider. If GoDaddy Professional Email is the intended provider, remove the unrelated Google and Microsoft MX records after confirming no mailbox depends on them. Keep SPF, DKIM and DMARC aligned with the active provider.
