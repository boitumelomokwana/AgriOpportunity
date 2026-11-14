# AgriOpportunities company API

Express service that lets approved companies submit opportunities to the
authoritative Supabase database. All writes go through the security-definer
function `public.submit_company_opportunity`, so ownership, validation and the
review workflow stay enforced in the database even if this service is bypassed.

```
POST   /api/company/opportunities        create (status starts as pending)
GET    /api/company/opportunities        list this company's opportunities
GET    /api/company/opportunities/:id    fetch one of this company's listings
PUT    /api/company/opportunities/:id    update (material changes return to review)
DELETE /api/company/opportunities/:id    withdraw (soft delete + audit history)
GET    /health                           liveness (no database call)
GET    /ready                            readiness (checks Supabase)
```

> **Verified locally:** `npm run check` passes; `/health` returns 200,
> `/ready` returns 503 with a clear message while credentials are empty, and
> 400/401/404/503 responses use the documented JSON envelope. The service has
> **not** been run against a real Supabase project because no credentials were
> supplied.

## Setup

1. Copy `.env.example` to `.env` and fill in:

   ```env
   PORT=3000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   CORS_ORIGINS=*
   ```

   The service-role key bypasses RLS. Keep it on the server; never put it in the
   Expo app or commit it.

2. Install and run (Windows PowerShell):

   ```powershell
   cmd /c "npm install"
   cmd /c "npm start"
   ```

3. Check the service:

   ```powershell
   Invoke-RestMethod http://localhost:3000/health
   Invoke-RestMethod http://localhost:3000/ready
   ```

## Authentication

Every `/api/company/opportunities` request needs an active company API key:

```http
Authorization: Bearer agri_<8 hex>_<48 hex>
```

`X-API-Key: <key>` is accepted as an alternative. Keys are created by a Super
Admin for an **approved** organisation, displayed once, and stored only as a
SHA-256 hash. The database verifies that the key is active, unexpired, the
organisation is approved and API access is enabled, then applies the
fixed-window rate limit (`api_rate_limit_per_minute`, default 60/minute).

Rate-limit headers are returned on every request: `RateLimit-Limit`,
`RateLimit-Remaining`, `RateLimit-Reset`; a 429 response also includes
`Retry-After`.

## List your opportunities

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/company/opportunities?status=pending&limit=25&offset=0" `
  -Headers @{ Authorization = "Bearer $key" }
```

`status` accepts `pending`, `approved`, `published` or `rejected`. `limit` is
1–100 (default 25) and `offset` starts at 0. The response includes pagination
metadata:

```json
{
  "data": [ { "id": "…", "title": "…", "status": "pending" } ],
  "meta": { "limit": 25, "offset": 0, "total": 1, "has_more": false }
}
```

Only rows whose `organization_id` belongs to the supplied key are returned.

## Create a listing

```powershell
$key = "agri_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$body = @{
  title                = "Junior Agronomist"
  description          = "Field support role for recent agriculture graduates."
  category             = "Job"
  province             = "Gauteng"
  location             = "Pretoria"
  qualification        = "Degree"
  closing_date         = "2026-12-15"
  application_url      = "https://example.co.za/careers/junior-agronomist"
  eligibility_criteria = "South African citizen; agriculture degree."
  tags                 = @("agriculture", "graduate")
  is_remote            = $false
  external_reference   = "CAREERS-2026-014"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/company/opportunities `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType "application/json" `
  -Body $body
```

Allowed payload fields:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | required on create, max 300 |
| `description` | string | required on create, max 20,000 |
| `application_url` | string | must be `http(s)://` |
| `closing_date` | string | `YYYY-MM-DD` |
| `category` | string | matched against `categories`, unknown becomes `Other` |
| `opportunity_type`, `sector`, `location`, `province`, `qualification` | string | metadata |
| `eligibility_criteria` | string | max 5,000 |
| `tags` | string[] | max 20 items, 50 characters each |
| `requirements` | object | booleans: `studyLevel`, `careerField`, `experience` |
| `is_remote` | boolean | |
| `external_reference` | string | idempotency key from your system |

Unknown properties are ignored. A repeated `external_reference` updates the
existing listing instead of creating a duplicate.

## Workflow

New submissions always start as `pending`. A Super Admin or Opportunity Admin
approves them, then publishes them. Material edits (title, description,
application URL, requirements, eligibility, category) send an
`approved`/`published` listing back to `pending`; the response action is
`returned_to_review`. Withdrawing marks the listing `rejected` with
`withdrawn_at` set and keeps all audit history.

Responses:

```json
{
  "data": {
    "ok": true,
    "action": "created",
    "opportunity_id": "…",
    "status": "pending"
  }
}
```

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "closing_date must be a real date in YYYY-MM-DD format."
  }
}
```

Common status codes: `400` malformed request, `401` missing/invalid key, `403`
missing scope or unapproved organisation, `404` unknown or unowned listing,
`422` validation failure, `429` rate limited, `503` server not configured.

## Update / withdraw

```powershell
# Update
Invoke-RestMethod -Method Put `
  -Uri "http://localhost:3000/api/company/opportunities/$id" `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType "application/json" `
  -Body (@{ closing_date = "2026-12-31" } | ConvertTo-Json)

# Withdraw
Invoke-RestMethod -Method Delete `
  -Uri "http://localhost:3000/api/company/opportunities/$id" `
  -Headers @{ Authorization = "Bearer $key" }
```

## Operations

- Every request is recorded in `public.api_logs` (method, endpoint, status,
  duration, IP/user agent, request id) and every submission in
  `public.api_submissions` with its outcome.
- `/health` is safe for load balancers and does not require credentials.
- `/ready` reports `503` until Supabase credentials are configured and reachable.
- The service never publishes automatically and never deletes opportunities.
- Security headers on every response: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer` and `X-Request-Id`. CORS origins come from
  `CORS_ORIGINS` (comma-separated, or `*`).
- Expected 5xx responses (not configured / database unreachable) are logged as a
  single line; unexpected errors log a stack trace.
- Logging to `api_logs` is best-effort and never changes the response sent to the
  client.
- Withdrawing is always a soft delete; audit rows are retained.
