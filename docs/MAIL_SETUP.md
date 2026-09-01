# LMSGEN outbound email setup

LMSGEN sends application email through the GoDaddy Professional Email SMTP service.

## Render environment variables

Set these on the `kahoot-awareness-backend` service:

- `MAIL_ENABLED=true`
- `MAIL_HOST=smtpout.secureserver.net`
- `MAIL_PORT=465`
- `MAIL_SECURE=true`
- `MAIL_USER=<full GoDaddy mailbox address, for example noreply@lmsgen.in>`
- `MAIL_PASS=<mailbox password>`
- `MAIL_ADMIN_TO=<address that receives access/admin notifications>`
- `APP_BASE_URL=https://lmsgen.in`

`MAIL_FROM` is optional. If omitted, LMSGEN sends from `MAIL_USER`. `MAIL_REPLY_TO` is optional.

Do not commit mailbox passwords or SMTP credentials to GitHub.

## Mail flows now handled by the application

- Six-digit OTP delivery for login, password-reset and email-verification workflows through `/api/scorm/otp/request` and `/api/scorm/otp/verify`.
- Direct course-assignment email when a learner registration is created outside a campaign.
- Campaign invitation email when a campaign changes to active. Email-code campaigns include the learner-specific access code.
- Tenant Admin invitation when a tenant Admin membership is created.
- Co-admin and Analytics Viewer team invitation when a workspace member is added.
- New access-request acknowledgement to the requester and notification to the configured platform Admin.
- Access-approved and access-revoked notifications when request status changes.

Non-critical notification failures are logged and never roll back the underlying tenant, course or campaign operation. OTP delivery is strict: if SMTP delivery fails, the OTP request fails and the code record is removed.

## DNS note

The exported `lmsgen.in` zone contains GoDaddy SPF, DKIM and mail records, but it also contains Google Workspace and Microsoft 365 MX records. Inbound mail should use one intended provider. If GoDaddy Professional Email is the intended provider, remove the unrelated Google and Microsoft MX records after confirming no mailbox depends on them. Keep the GoDaddy SPF/DKIM/DMARC records aligned with the active provider.
