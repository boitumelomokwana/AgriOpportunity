# AgriOpportunity - Supabase database (migrations)

Built from your project brief, on top of the **existing** `profiles` and
`opportunities` tables. Nothing is dropped; every migration uses
`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so they are safe to run on the
database that already holds your users and opportunities.

> **Status: written but not yet executed.** I had no PostgreSQL available to run
> these files. Run them on a **staging/dev Supabase project first**, then run
> `supabase/tests/verify_setup.sql`. Back up production before `db push`.

## Folder layout
```
supabase/
  migrations/
    001_user_management.sql        profiles (extended), user_interests
    002_company_management.sql     organizations, organization_members
    003_opportunity_management.sql categories (seeded), opportunities (extended), opportunity_views
    004_student_management.sql     applications, bookmarks, notifications
    005_admin_roles.sql            admin_roles, admin_logs, system_settings, role helper functions
    006_company_api.sql            company_api_keys, api_submissions, api_logs, api_rate_limits, sync configs
    007_realtime.sql               adds tables to the supabase_realtime publication
    008_rls_policies.sql           Row Level Security for every table
    009_database_functions.sql     review / API-key / submission / stats functions
    010_database_triggers.sql      attaches triggers (status sync, audit, notifications, guards)
  tests/
    verify_setup.sql               rolled-back smoke test of the rules below
  seed/
    demo_data.sql                  FAKE test data (5 companies, 10 opportunities, API logs)
    remove_demo_data.sql           deletes only the demo data
    demo_admins.sql                3 FAKE admin logins (one per role) + sample audit log, dev only
    remove_demo_admins.sql         deletes them
    demo_users.sql                 10 FAKE students (+ bookmarks, applications, notifications), dev only
    remove_demo_users.sql          deletes them
    DEMO_LOGINS.md                 all demo emails and passwords
```
Note: `company_api_keys`, `api_submissions`, `api_logs` are in **006** (as your file list
requires) rather than 002.

## Apply with the Supabase CLI (VS Code terminal)
```bash
supabase init                       # only if there is no supabase/ folder yet
supabase link --project-ref <ref>
supabase migration list             # check what is already applied
supabase db push                    # applies 001-010 in order
```
Then in the SQL editor run `supabase/tests/verify_setup.sql` (expect `ALL CHECKS PASSED`).

## Demo data (optional, dev/staging only)
Run `supabase/seed/demo_data.sql` after the migrations. It adds 5 fake companies and 10 fake
opportunities (7 published, 1 approved, 1 pending, 1 rejected) across several provinces and
categories, plus a few API log rows for the dashboard. Everything is tagged `[DEMO]` / `DEMO-nnn`,
notifications are paused while it loads, and `remove_demo_data.sql` deletes it again.
`demo_admins.sql` adds three fake admin logins (password `DemoAdmin#2026`, dev only, never production):
`demo.super@`, `demo.opps@`, `demo.content@agriopportunity.test`. `demo_users.sql` adds 10 fake students
(`student01@` to `student10@agriopportunity.test`). All logins are listed in `supabase/seed/DEMO_LOGINS.md`.

## Create the three administrators
1. In Supabase Dashboard -> Authentication, create (or reuse) the three users.
2. In the SQL editor:
```sql
select public.bootstrap_admin('super@yourdomain.co.za',   'super_admin');
select public.bootstrap_admin('opps@yourdomain.co.za',    'opportunity_admin');
select public.bootstrap_admin('content@yourdomain.co.za', 'content_admin');
```
Your current `ADMIN_EMAIL` account should become the Super Admin. After that, only a
Super Admin can change roles (`assign_admin_role`), and the last active Super Admin cannot be removed.

| Role | Can do |
|---|---|
| super_admin | everything: users, admins, companies, API keys, categories, settings, logs, review/publish |
| opportunity_admin | view submissions, approve / reject / publish, edit opportunities |
| content_admin | categories, organisation info, edit **published** opportunities (cannot change status) |

Enforced in the database (RLS + guard triggers), not just in the UI.

## Opportunity workflow
`pending -> approved -> published` (or `rejected`). Company submissions always start `pending`.
`status` is the source of truth. The old columns `published` / `verification_status` are kept and
kept in sync by a trigger, so the current frontend and admin API keep working. This also fixes the
old mismatch where the admin API wrote `approved` but the app only loaded `verified`
(published rows are now stored as `verified`).

Use `select public.review_opportunity(id, 'approve' | 'reject' | 'publish' | 'unpublish', reason)`
from the admin dashboard (or call it with `supabase.rpc`).

## Company API - how the backend should use the database
The Next.js route (service-role key, server only) does, per request:

1. `verify_company_api_key(key)` -> `{key_id, organization_id, scopes}` or `null` (401)
2. `check_api_rate_limit(key_id)` -> `{allowed, remaining, reset_at}` (429 when not allowed)
3. Validate the body, then call `submit_company_opportunity(org_id, key_id, event, payload, source, opportunity_id)`
4. Insert one row into `api_logs` (method, endpoint, status, duration, ip)

| Endpoint | event | notes |
|---|---|---|
| `POST /api/company/opportunities` | `created` | repeat of a known `external_reference` is treated as an update / `unchanged` |
| `GET /api/company/opportunities` | - | `select` where `organization_id = <org from key>` |
| `PUT /api/company/opportunities/:id` | `updated` | pass `:id` as `p_opportunity_id`; ownership is enforced inside the function |
| `DELETE /api/company/opportunities/:id` | `withdrawn` | sets `rejected` + reason "Withdrawn by organisation" |
| webhook | `created/updated/withdrawn` | `p_source = 'webhook'`, authenticated with the same API key |
| scheduled pull | `created/updated` | `due_sync_organizations()` lists who is due; `p_source = 'scheduled_sync'`; then `mark_sync_result()` |

Payload fields: `external_reference`, `title`, `description`, `category`, `opportunity_type`,
`location`, `province`, `is_remote`, `requirements`, `eligibility_criteria`, `application_url`, `closing_date` (YYYY-MM-DD), `tags`.

Returned `action`: `created`, `updated`, `returned_to_review`, `unchanged`, `withdrawn`.
A change to title, description, application URL, requirements, eligibility or category on an
approved/published item sends it back to `pending`; closing date, location, tags etc. update in place.

Duplicate rule: unique per **(organization_id, external_reference)** across all channels, so the same
opportunity arriving by API, webhook and sync is one record. `submission_source` records which channel last touched it.
(This is slightly stricter than your three-field wording on purpose.)

API keys: shown once by `generate_company_api_key` (Super Admin), stored only as a SHA-256 hash,
never selectable from the browser. Format `agri_<8hex>_<48hex>`. Revoke with `revoke_company_api_key`.
Scheduled sync credentials belong in Supabase Vault (`vault_secret_id`), never in a table column.

## Realtime - why the site was not updating, and the fix
Three causes, usually together:
1. **The tables were not in the `supabase_realtime` publication** -> 007 fixes this (opportunities, notifications, applications, organizations, categories) and sets `REPLICA IDENTITY FULL`.
2. **`useOpportunities` in `hooks.ts` fetches once** (`useEffect(..., [])`) and never subscribes.
3. **Next.js caching** of server-rendered data. Keep Explore/Dashboard as client-side fetches (or `export const dynamic = 'force-dynamic'`).

Frontend subscription pattern (add to `useOpportunities`, with `loadOpportunities` extracted so it can be re-called):
```ts
useEffect(() => {
  const refetch = () => loadOpportunities();
  const channel = supabase
    .channel('opportunities-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, refetch)
    .subscribe();
  const onVisible = () => document.visibilityState === 'visible' && refetch();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    supabase.removeChannel(channel);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, []);
```
Also change the query from `.eq('published', true).eq('verification_status','verified')` to `.eq('status', 'published')`.
Notifications: subscribe to `notifications` filtered with `filter: 'user_id=eq.<uid>'`.
Limitation: Realtime only sends an event if the *new* row is visible to the subscriber, so an
**unpublish** may not reach anonymous clients; the refetch-on-focus above covers that.

## Assumptions to check
* `opportunities.id` is a `uuid` (003 stops with a clear error if it is not).
* The new `organizations` start empty; existing `opportunities.provider` text is untouched and not auto-converted into companies.
* `profiles.interests` is still what the current Profile screen writes; matching for notifications reads both it and `user_interests`.
* Bookmarks are now a table (`bookmarks`); the frontend still keeps them in memory until it is switched over.
