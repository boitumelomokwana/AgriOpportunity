# AgriOpportunity - Database package

Database layer only (Supabase / PostgreSQL), to be combined with another backend.

## Contents
- `supabase/schema.sql`  - tables, indexes, triggers and RLS policies
- `src/lib/supabase.ts`  - browser client (anon key)
- `src/lib/supabaseAdmin.ts` - server-only client (service-role key)
- `src/lib/db-types.ts`  - TypeScript row types
- `.env.example`         - required environment variables (no real keys)

## Setup
1. Create a Supabase project (or get access to the shared one).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Copy `.env.example` to `.env.local` and fill in the keys.
4. `npm i @supabase/supabase-js` and copy `src/lib/*` into the backend project.

## Tables
**profiles** - id (= auth user id), full_name, email, province, qualification,
field_of_study, interests (text[]), created_at, updated_at.

**opportunities** - id, title, provider, category, province, qualification,
closing_date, description, tags (text[]), requirements (jsonb), sector,
source_name, source_url, source_type, application_url, verification_status,
published, created_at, updated_at.

## Workflow rules the app relies on
- New opportunities are inserted as `verification_status = 'pending'`, `published = false`.
- Admin approves -> `'approved'`, then publishes -> `published = true`.
- The public only sees rows where `published = true` and status is approved/verified (RLS).
- Writes to `opportunities` go through the backend with the service-role key.

## Known mismatch to fix
The admin API sets status `'approved'`, but `useOpportunities` in `src/lib/hooks.ts`
queries `verification_status = 'verified'`. Published items will not appear in the app
until one side is changed (e.g. make the query use `.in('verification_status', ['approved','verified'])`).

## Security
Never share `.env.local` - it holds the service-role key. Only share `.env.example`.
