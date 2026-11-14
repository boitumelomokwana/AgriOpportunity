# Additional features and changes

This document lists everything added or changed while integrating the NextStep SA
Expo app with the authoritative `AgriOpportunity_Supabase` database.

**Ground rules followed**

- The existing database was treated as authoritative. No migration creates,
  replaces, truncates or renames an existing table. Migrations `001`–`010` are
  unchanged; new work lives in additive migrations `011`–`013`.
- Existing users, profiles, opportunities, organisations, relationships, UUIDs,
  functions and policies are preserved.
- Existing screens and visual design are reused. Screens were rewired to real
  data rather than rebuilt.
- There is **no mock data in runtime code**. The files under
  `APP/FRONTEND/src/data/` still exist for type fixtures, but nothing under
  `src/app`, `src/state` or `src/services` imports them.

---

## 1. Database additions

### 1.1 `011_platform_extensions.sql` — additive schema

| Area | Addition | Why |
|---|---|---|
| Profiles | `avatar_url`, `phone`, `date_of_birth`, `city`, `institution`, `study_year`, `employment_status`, `bio`, `onboarding_completed`, `profile_completed_at`, `last_active_at`, `preferences jsonb`, `notification_preferences jsonb` | Richer student profile and persisted preferences without touching existing columns. |
| Notifications | Replaced `notifications_type_check` with a wider list: `deadline_reminder`, `opportunity_reported`, `organization_update` | Reminder and moderation notifications can be stored. Existing rows remain valid. |
| `saved_searches` | New table: name, query, `filters jsonb`, `notify_new` | Students can persist discovery filters. Unique per user + lower(name). |
| `opportunity_reports` | New table: reason, details, status, resolver fields | Students can flag expired / incorrect / broken / scam listings. One open report per user per opportunity. |
| `application_status_history` | New append-only table | Application timeline, written by trigger. |
| `deadline_reminders` | New table: `days_before` (1–60), `sent_at` | Per-user closing-date reminders; unique per user/opportunity/offset. |
| Organisations | `logo_url`, `cover_url`, `employee_count`, `founded_year`, `tags`, `is_verified`, `verified_at`, `verified_by`, `last_verified_at` | Verification and presentation data used by the app and admin screens. |
| Opportunities | `is_featured`, `source_checked_at`, `last_verified_at`, `quality_score`, `search_vector tsvector` + GIN index | Featured ordering, moderation tracking and full-text search. |
| Backfill | One-time `update ... set search_vector = to_tsvector(...)` for existing rows | Old opportunities become searchable immediately; the trigger keeps them current. |

A stored `tsvector` column plus trigger is used instead of a generated column,
because generated columns are not compatible with `REPLICA IDENTITY FULL` /
Realtime publications on every supported Postgres version.

### 1.2 `012_extended_functions.sql` — database functions

| Function | Purpose |
|---|---|
| `profile_completion(profiles)` / `my_profile_completion()` | Recalculated profile completion score. |
| `bump_last_active()` | Updates `profiles.last_active_at`. |
| `record_opportunity_view(uuid, text)` | Deduplicated view tracking. |
| `match_opportunity_score(uuid)` | Server-side match score (35/25/20/10/10). |
| `recommended_opportunities(limit, offset, open_only)` | Ranked recommendations for the signed-in student. |
| `search_opportunities(query, category, province, limit, offset)` | Full-text + filter search over published opportunities. |
| `set_deadline_reminder(uuid, integer)` | Creates/replaces a reminder. |
| `dispatch_deadline_reminders(limit)` | Service-role job helper that creates reminder notifications. |
| `admin_analytics()` | Dashboard counts and trends. |
| `opportunity_quality_report()` | Data-quality counts for administrators. |
| `review_report(uuid, text, text)` | Moves a report through open/reviewing/resolved/dismissed. |
| `set_organization_status(uuid, text, text)` | Approve / suspend / reject a company; role-checked. |
| `verify_organization(uuid, boolean)` | Verify/unverify a company; role-checked. |
| `admin_list_users(search, limit, offset)` | Super-Admin-only user list with safe fields. |

All functions are `security definer` with an explicit `search_path`, and
`EXECUTE` is revoked from `public`/`anon` where appropriate. The database, not
the UI, decides whether the caller may perform the action.

### 1.3 `013_extended_rls_triggers.sql` — RLS, triggers, realtime

- Row-level security enabled on `saved_searches`, `opportunity_reports`,
  `application_status_history` and `deadline_reminders`.
- Policies: students read/write only their own saved searches and reminders;
  reports are insertable by their author and readable/reviewable by the
  appropriate admin roles; application history is readable by its owner (and by
  admins through existing opportunity policies).
- Trigger `opportunities_search_vector` keeps `search_vector` current on
  insert/update of the searchable columns.
- Trigger `applications_history` records every status change into
  `application_status_history`.
- Trigger `profiles_track_completion` keeps the completion score and
  `profile_completed_at` in step with profile edits.
- `updated_at` triggers added for `saved_searches` and `opportunity_reports`.
- New tables are added to the `supabase_realtime` publication where the live UI
  benefits (`opportunity_reports`); existing realtime tables (`opportunities`,
  `notifications`, `applications`, `organizations`, `categories`) stay enabled.
  Bookmarks are intentionally **not** in the publication because they are cheap
  to refetch and would multiply events.

### 1.4 Status workflow (unchanged contract, now enforced)

`pending → approved → published`, with `pending → rejected` available.
`status` is the source of truth. The legacy columns `published` and
`verification_status` are kept and synchronised by trigger in both directions,
so older code and existing data keep working. Published rows map to
`verification_status = 'verified'`.

---

## 2. Frontend additions

### 2.1 Data layer

| File | What it does |
|---|---|
| `src/lib/supabase.ts` | Single Supabase client, env validation, clear configuration error. No mock fallback. |
| `src/lib/errors.ts` | Converts Supabase/network errors into readable messages. |
| `src/lib/mappers.ts` | Maps database rows into the existing UI types (`Opportunity`, `UserProfile`, etc.) so screens did not have to be rebuilt. |
| `src/constants/categories.ts` | Category chips and search suggestions shared by discovery screens. |
| `src/services/authService.ts` | Sign in, sign up (with profile metadata), sign out, password reset, password change, session listener. |
| `src/services/profileService.ts` | Profile fetch/update, self-heals a missing profile row, keeps `profiles.interests` and `user_interests` in sync. |
| `src/services/opportunityService.ts` | Published-only fetching, detail fetch, view tracking, transparent matching, filters, sorting, database search. |
| `src/services/bookmarkService.ts` | Real bookmarks table (list/add/remove). |
| `src/services/applicationService.ts` | Application tracker CRUD plus status history. |
| `src/services/notificationService.ts` | List, mark-one-read, mark-all-read. |
| `src/services/discoveryService.ts` | Saved searches, deadline list, reminders, listing reports. Uses local-date comparison for closing dates. |
| `src/services/organizationService.ts` | Register/edit a company, list listings, generate/revoke API keys, list API submissions. Partial edits only send supplied fields. |
| `src/services/adminService.ts` | Admin dashboard, review queue, approve/reject/publish, organisation status/verification, reports, users, role lookup. |

### 2.2 State

- `AuthProvider` owns the Supabase session, profile, admin role, configuration
  error and a 700 ms debounced profile save with optimistic updates and
  rollback/error toast on failure.
- `AppProvider` is the single source of opportunity data. It:
  - loads published opportunities from the database;
  - refetches (debounced) on realtime changes to opportunities, notifications,
    applications and organisations;
  - refreshes on app foreground (`AppState`);
  - exposes optimistic bookmark/application/reminder/saved-search actions with
    rollback and honest error toasts.
- Realtime subscription failures (offline/proxy) are logged and never crash the
  app; pull-to-refresh and foreground refresh still work.

### 2.3 Screens wired to real data

Existing screens were preserved and connected:

- Welcome / auth (login, register, password reset)
- Home dashboard
- Explore (filters, sort, save, open)
- Search (query + saved searches)
- Filters modal (category, province/national, education, closing window, work
  mode, open-only)
- Matches (transparent score and reasons)
- Saved
- Alerts (real notifications, read/unread, deep links)
- Profile (edit personal details, interests, preferences, avatar URL)
- Settings (notification preferences, password change, sign out, org/admin
  links)
- Opportunity detail (apply link, save, tracker, reminder, report)
- Applications (tracker with statuses and notes)
- Admin dashboard

New screens:

| Route | Purpose |
|---|---|
| `/deadlines` | Saved/tracked/reminded opportunities closing in the next 45 days, grouped into this week and later. |
| `/organization` | Register a company, edit details, view listings, see API key/submission status. |
| `/admin` | Role-aware overview, review queue, organisations, reports and users. |

### 2.4 Matching (transparent, deterministic)

Weights match the database function:

| Signal | Points |
|---|---|
| Interest / category match | 35 |
| Field-of-study keyword match | 25 |
| Province or National | 20 |
| Qualification / education | 10 |
| Still open | 10 |

Every score is accompanied by plain-language reasons. No hidden ranking model.

### 2.5 Bug fixes made during the audit

- Guest users no longer see notification toggles that cannot be saved; they get
  a sign-in prompt instead.
- The duplicate "Hide expired entries" toggle was removed. It did the same thing
  as "Open opportunities only" and, because both defaulted to true, made the
  open-only switch appear broken.
- The "National listings" chip now reflects its state and explains that no
  province selection includes national listings.
- External application links without a scheme are normalised, and a failure to
  open the browser is reported instead of becoming an unhandled rejection.
- Organisation registration numbers are mapped, displayed and editable instead
  of being silently dropped.
- Deadline dates are compared in local time, avoiding an off-by-one day for
  users east of UTC.
- Admin report listing no longer uses an invalid PostgREST embed
  (`opportunity_reports.user_id` references `auth.users`, not `profiles`).
- Admin tabs and actions are hidden for roles that cannot use them; the
  database still enforces every action.
- Realtime channel errors are handled; they no longer surface as unhandled
  WebSocket failures.
- Profile save errors surface as a toast without discarding the optimistic edit.

---

## 3. Company API backend

`APP/BACKEND` was rebuilt as an Express 5 service using a service-role Supabase
client. The old SQLite `dist` build is no longer used.

### 3.1 Endpoints

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/api/company/opportunities` | Create; starts `pending`. Duplicate `external_reference` is treated as an update. |
| `GET` | `/api/company/opportunities` | List only this key's organisation. Supports `status`, `limit`, `offset`; returns `meta.total`/`has_more`. |
| `GET` | `/api/company/opportunities/:id` | Fetch one listing owned by the organisation. |
| `PUT` | `/api/company/opportunities/:id` | Partial update. Material changes on an approved/published listing return it to review. |
| `DELETE` | `/api/company/opportunities/:id` | Withdraw (soft delete + history). Never hard-deletes. |
| `GET` | `/health` | Liveness; no database call. |
| `GET` | `/ready` | Readiness; checks Supabase configuration and a real query. |

### 3.2 Security and behaviour

- API keys use the format `agri_<8 hex>_<48 hex>`. Only the SHA-256 hash is
  stored; the plaintext key is shown once.
- Keys are verified in the database (`verify_company_api_key`), not in memory.
- Per-key rate limits are stored in the database (`check_api_rate_limit`) and
  exposed through `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
  and `Retry-After`.
- Scopes (`opportunities:read`, `opportunities:write`) are checked per route.
- Writes go through `submit_company_opportunity`, so ownership, validation and
  the review workflow remain enforced even if the HTTP service is bypassed.
- Payload validation: required fields on create, length limits, UUID checks,
  `YYYY-MM-DD` dates, tag arrays, requirements object, URL checks, pagination
  bounds.
- Consistent envelopes: success `{ "data": ... }`; failure
  `{ "error": { "code", "message", "details?" } }`.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Request-Id`. CORS origins are configurable.
- Every company request is best-effort logged to `api_logs` (method, endpoint,
  status, duration, IP, user agent, key/org id). A logging failure never breaks
  the response.
- Expected 5xx responses (not configured / database unreachable) log one line,
  not a stack trace; unexpected errors still log the stack.

### 3.3 Verified locally

With empty Supabase credentials (no real project available):

- `GET /health` → `200`, `supabase_configured: false`
- `GET /ready` → `503`, `database: "not_configured"`
- `POST /api/company/opportunities` → `503`, `server_not_configured`
- `GET /api/company/unknown` → `404`, `not_found`
- Invalid JSON → `400`, `invalid_json`
- `GET /api/company/opportunities` without a key → `401`, `missing_api_key`

---

## 4. Security summary

- RLS is enabled on every student-owned table. Students cannot read another
  student's bookmarks, applications, saved searches, reminders or notifications.
- Admin actions are role-checked in SQL through helper functions and guard
  triggers. UI hiding is a convenience, not the security boundary.
- Company API keys are hashed, scoped, rate-limited, revocable and never
  selectable from the browser.
- Service-role credentials exist only in the backend environment, never in the
  Expo app.
- The Expo app uses only the anon key and relies on Auth + RLS.
- Validation happens in the API and again inside the database function.
- Audit trails: `admin_logs`, `api_logs`, `application_status_history`,
  `api_submissions`.

---

## 5. Configuration and operations

- `APP/FRONTEND/.env.example` — `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`.
- `APP/BACKEND/.env.example` — `PORT`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`.
- `APP/Database/AgriOpportunity_Supabase/supabase/config.toml` — local Supabase
  CLI configuration.
- `APP/Database/AgriOpportunity_Supabase/supabase/tests/verify_setup.sql` —
  schema/RLS/workflow smoke test.
- `APP/Database/AgriOpportunity_Supabase/supabase/tests/extended_features_test.sql`
  — end-to-end test of matching, search, saved searches, reports, reminders,
  admin functions, RLS and the company submission workflow.
- READMEs updated for the database, frontend, backend and repository root.

---

## 6. Tests actually run

| Check | Result |
|---|---|
| Full migration chain `001`–`013` on a throwaway local PostgreSQL 18 cluster | Passed (`ALL_MIGRATIONS_OK`) |
| `verify_setup.sql` | Passed (`ALL CHECKS PASSED`) |
| `extended_features_test.sql` | Passed end to end |
| Frontend `tsc --noEmit` | Passed |
| Backend `npm run check` | Passed |
| Backend HTTP smoke tests (health/ready/404/400/401/503) | Passed |

Not run, because no real Supabase project credentials were supplied:

- `supabase link` / `supabase db push` against the real project.
- Auth, RLS and realtime behaviour against the hosted project.
- Company API against real API keys.

The local PostgreSQL cluster had a minimal `auth` schema stub and grants, so the
migrations and SQL tests are validated for PostgreSQL compatibility, not as a
substitute for testing on the hosted Supabase instance.

---

## 7. Known limitations / pending work

- **Real Supabase deployment is blocked** until a project URL, anon key,
  service-role key and project ref are provided, with approval to push.
- Password reset sends the email, but the mobile app does not yet handle the
  reset deep link end to end.
- Push notifications are not implemented; in-app notifications and deadline
  reminders are. `dispatch_deadline_reminders` is ready for a scheduled job.
- `npx expo install` fails under the current npm 12 policy
  (`EALLOWSCRIPTS`); use plain `npm install`.
- The old SQLite backend build is obsolete and is not part of the new service.
- Mock fixture files remain on disk for type/reference purposes but are not
  imported by runtime code.
