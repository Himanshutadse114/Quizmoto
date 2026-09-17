# LMSGEN Publica wildcard subdomains on the free infrastructure

This configuration serves customer links such as
`https://acme.lmsgen.in/publica/security-guide` without adding a third Render
custom domain. The existing apex, `www`, API, email and Render services remain
in place.

## Architecture

- `lmsgen.in` and `www.lmsgen.in` continue to use the existing Render frontend.
- `api.lmsgen.in` continues to use the existing Render backend.
- A proxied Cloudflare wildcard DNS record sends otherwise-unassigned first-level
  subdomains to the `lmsgen-publica-edge` Worker.
- The Worker fetches the existing Render frontend using its valid
  `onrender.com` hostname while the browser retains the branded LMSGEN hostname.

## One-time dashboard setup

1. Add `lmsgen.in` to a free Cloudflare account.
2. Allow Cloudflare to scan the existing GoDaddy records. Before changing name
   servers, compare every imported record with GoDaddy. In particular, retain
   all MX, SPF, DKIM, DMARC, BIMI, `www`, `api` and root records.
3. In GoDaddy, replace only the domain name servers with the two Cloudflare name
   servers shown for the zone. Do not delete the domain or its DNS records.
4. Wait until Cloudflare marks the zone **Active**.
5. In Cloudflare DNS, keep the existing root, `www` and `api` records **DNS only**
   initially. Add this new record:

   | Type | Name | Target | Proxy |
   | --- | --- | --- | --- |
   | CNAME | `*` | `kahoot-awareness-frontend.onrender.com` | Proxied |

6. In Cloudflare, set **SSL/TLS > Overview** to **Full**.
7. From `infra/publica-edge-worker`, run `npm install`, `npx wrangler login`,
   and `npm run deploy`. Wrangler attaches the route `*.lmsgen.in/*`.
8. Test a non-production name first:
   `https://publica-check.lmsgen.in/publica-library/test`.
   A Publica not-found screen is acceptable; a DNS or TLS error is not.
9. Test `https://www.lmsgen.in`, `https://api.lmsgen.in/api/health`, sign-in,
   one live Quizmoto session and email delivery before enabling customer
   subdomains in sales.

## Rollback

If wildcard requests fail, disable the Worker route or change the `*` record to
DNS only. The root, `www`, API and mail records are independent and should not be
removed during rollback.
