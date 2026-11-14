# AgriOpportunity — Supabase database

This folder contains the additive migration set for the authoritative
`AgriOpportunity_Supabase` project plus SQL verification tests and optional demo
seeds.

> **Status:** migrations `001`–`013` and both SQL test suites were executed
> successfully on a throwaway local PostgreSQL 18 cluster. They have **not** been
> pushed to the hosted Supabase project because no project credentials were
> supplied. Treat the hosted push as pending approval.

Nothing is dropped or rewritten. Every migration uses `IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS` or creates new objects, so existing users, profiles,
opportunities, organisations, relationships and IDs are preserved. Back up the
hosted database before `db push`.

## Folder layout

```
supabase/
  config.toml                         local Supabase CLI configuration
  migrations/
    001_user_management.sql           profiles extensions, user_interests
    002_company_management.sql        organizations, organization_members
    003_opportunity_management.sql    categories (seeded), opportunities, opportunity_views
    004_student_management.sql        applications, bookmarks, notifications
    005_admin_roles.sql               admin_roles, admin_logs, system_settings, helpers
    006_company_api.sql               company_api_keys, api_submissions, api_logs,
                                      api_rate_limits, sync configs
    007_realtime.sql                  realtime publication + REPLICA IDENTITY FULL
    008_rls_policies.sql              RLS for every existing table
    009_database_functions.sql        review/API-key/submission/stats functions
    010_database_triggers.sql         status sync, audits, notification guards
    011_platform_extensions.sql       profile fields, saved searches, reports,
                                      application history, reminders, org/search fields
    012_extended_functions.sql        matching, search, reminder, admin RPCs
    013_extended_rls_triggers.sql     RLS for new tables, search/history triggers
  tests/
    verify_setup.sql                  schema, policy and workflow smoke test
    extended_features_test.sql        end-to-end feature/RLS/workflow test
  seed/
    demo_data.sql                     FAKE companies + opportunities (dev only)
    remove_demo_data.sql              removes those rows
    demo_admins.sql                   3 FAKE admin logins, one per role (dev only)
    remove_demo_admins.sql            removes them
    demo_users.sql                    10 FAKE students + activity (dev only)
    remove_demo_users.sql             removes them
    DEMO_LOGINS.md                    demo credentials
```

All seed files are strictly development fixtures. The integrated app never
loads them at runtime.

## Apply the migrations

### Hosted Supabase (after approval)

```bash
supabase link --project-ref <project-ref>
supabase migration list          # see what is already applied
supabase db push                 # applies 001-013 in order
```

Then run the verification SQL in the Supabase SQL editor:

```
supabase/tests/verify_setup.sql        -- expect: ALL CHECKS PASSED
supabase/tests/extended_features_test.sql
```

### Local PostgreSQL

The migrations only need a minimal `auth` schema stub because they reference
`auth.users`. On a real Supabase database that schema already exists.

## Data model additions

- **Students:** `profiles` gains optional personal fields, JSON `preferences` and
  `notification_preferences`, completion tracking and `last_active_at`.
- **Discovery:** `saved_searches`, `deadline_reminders`, `opportunity_reports`.
- **Applications:** `application_status_history` is append-only and written by
  trigger whenever an application status changes.
- **Organisations:** verification fields (`is_verified`, `verified_at`,
  `verified_by`) and presentation fields (`logo_url`, `cover_url`, `tags`, …).
- **Opportunities:** `is_featured`, moderation timestamps, `quality_score` and a
  stored `search_vector` with a GIN index.

## Opportunity workflow

```
pending ──approve──> approved ──publish──> published
   └────reject─────> rejected
```

`opportunities.status` is the single source of truth. The legacy columns
`published` and `verification_status` are kept for compatibility and synchronised
by trigger in both directions. Published rows are stored as
`verification_status = 'verified'`.

Administrators use:

```sql
select public.review_opportunity(
  '<opportunity-uuid>',
  'approve' | 'reject' | 'publish' | 'unpublish',
  'optional reason'
);
```

Company API submissions always start as `pending`.

## Roles

| Role | Capabilities |
|---|---|
| `super_admin` | everything: users, admins, companies, API keys, categories, settings, logs, review/publish |
| `opportunity_admin` | view submissions, approve/reject/publish, edit opportunities |
| `content_admin` | categories, organisation information, edit **published** opportunities (cannot change status) |

Enforced by RLS and guard triggers in the database, not only in the UI.

Create the first administrators in the SQL editor:

```sql
select public.bootstrap_admin('super@yourdomain.co.za',   'super_admin');
select public.bootstrap_admin('opps@yourdomain.co.za',    'opportunity_admin');
select public.bootstrap_admin('content@yourdomain.co.za', 'content_admin');
```

Only a Super Admin can subsequently change roles (`assign_admin_role`), and the
last active Super Admin cannot be removed.

## Company API contract

The Express service in `APP/BACKEND` uses the service-role key and calls the
database functions below for every request:

1. `verify_company_api_key(key)` → `{ key_id, organization_id, scopes }` or `null`
2. `check_api_rate_limit(key_id)` → allowance + reset time
3. validate the payload, then
   `submit_company_opportunity(org_id, key_id, event, payload, source, opportunity_id)`
4. best-effort insert into `api_logs`

| Endpoint | Event | Notes |
|---|---|---|
| `POST /api/company/opportunities` | `created` | repeated `external_reference` is treated as an update / `unchanged` |
| `GET /api/company/opportunities` | — | scoped to the key's organisation; supports `status`, `limit`, `offset` |
| `PUT /api/company/opportunities/:id` | `updated` | ownership enforced in SQL; material changes return to review |
| `DELETE /api/company/opportunities/:id` | `withdrawn` | soft delete with reason and audit history |
| webhook | `created` / `updated` / `withdrawn` | same key, `p_source = 'webhook'` |
| scheduled pull | `created` / `updated` | `due_sync_organizations()` + `mark_sync_result()` |

Payload fields: `external_reference`, `title`, `description`, `category`,
`opportunity_type`, `location`, `province`, `is_remote`, `requirements`,
`eligibility_criteria`, `application_url`, `closing_date` (`YYYY-MM-DD`),
`tags`.

Returned `action`: `created`, `updated`, `returned_to_review`, `unchanged`,
`withdrawn`. Changes to title, description, application URL, requirements,
eligibility or category on an approved/published record send it back to
`pending`; closing date, location and tags update in place.

Duplicate rule: unique per **(`organization_id`, `external_reference`)** across
all channels, so the same opportunity arriving by API, webhook and sync stays one
record. `submission_source` records the channel that last touched it.

API keys are shown once by `generate_company_api_key` (Super Admin), stored only
as a SHA-256 hash, and formatted `agri_<8hex>_<48hex>`. Revoke with
`revoke_company_api_key`. Scheduled-sync credentials belong in Supabase Vault
(`vault_secret_id`), never in a table column.

## Realtime

Tables in the `supabase_realtime` publication: `opportunities`,
`notifications`, `applications`, `organizations`, `categories` and
`opportunity_reports`. `REPLICA IDENTITY FULL` is set for the tables that need
full row payloads.

The app also refetches on foreground and pull-to-refresh, because Realtime only
delivers a row when the subscriber is allowed to see the new version. An
unpublish may therefore not reach anonymous clients through Realtime alone.

Bookmarks are deliberately excluded from the publication; they are cheap to
refetch and would multiply events.

## Row-level security

- Students can only read/write their own bookmarks, applications, saved
  searches, reminders, notifications and application history.
- Published opportunities are readable by everyone; non-published rows only by
  the owning organisation and appropriate administrators.
- Admin RPCs check `admin_roles` and raise `42501` for unauthorised callers.
- Company API keys cannot be selected by browser clients; only privileged
  functions expose key metadata.

## Testing

`tests/verify_setup.sql` checks tables, columns, policies, role helpers, status
synchronisation and the review workflow inside a rolled-back transaction.

`tests/extended_features_test.sql` exercises, end to end:

- profile creation and completion;
- transparent matching scores;
- full-text search;
- saved searches and reminders;
- opportunity reports and moderation;
- application history;
- admin analytics/quality reports/user listing;
- company API key generation and submission;
- RLS denials for cross-user access.

Both suites completed successfully on local PostgreSQL 18. They must be re-run
against the hosted project after `db push`.

## Environment

The database itself needs no custom environment variables. The clients use:

**Frontend (`APP/FRONTEND/.env`)**

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000/api
```

**Backend (`APP/BACKEND/.env`)**

```env
PORT=3000
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CORS_ORIGINS=*
```

Never place the service-role key in the Expo app or commit any `.env` file.
