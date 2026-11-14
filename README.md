# NextStep SA / AgriOpportunity

NextStep SA helps South African learners, students and graduates find
agricultural bursaries, learnerships, internships, graduate programmes and jobs.
This repository contains the Expo app, the company API and the authoritative
Supabase database migration set.

## Repository layout

```
APP/
  FRONTEND/   Expo Router app (React Native + web)
  BACKEND/    Express company API (service-role Supabase client)
  Database/
    AgriOpportunity_Supabase/   authoritative migrations, tests and demo seeds
    AgriOpportunity_Database/   legacy local database assets
ADDITIONAL_FEATURES.md          every feature/change made during integration
graphify-out/                   code graph output (analysis aid)
```

## How the pieces fit

- **Expo app** → Supabase Auth + anon key + RLS for all student data and
  published opportunities.
- **Company API** → service-role key, company API keys, validation, rate limits,
  then `submit_company_opportunity` in the database. Companies can never publish
  directly; submissions start as `pending`.
- **Database** → source of truth. `opportunities.status` drives
  `pending → approved → published` or `pending → rejected`; legacy columns are
  synchronised by trigger. Admin roles and RLS are enforced in SQL.

## Quick start

1. **Database** — apply migrations `001`–`013` to the Supabase project (after
   approval), then run the verification SQL:

   ```powershell
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   In the SQL editor run
   `APP/Database/AgriOpportunity_Supabase/supabase/tests/verify_setup.sql`
   and expect `ALL CHECKS PASSED`, then run
   `supabase/tests/extended_features_test.sql`.

2. **Frontend**

   ```powershell
   Set-Location APP\FRONTEND
   Copy-Item .env.example .env      # fill in Supabase URL + anon key
   cmd /c "npm install"
   cmd /c "npx expo start"
   ```

3. **Backend**

   ```powershell
   Set-Location APP\BACKEND
   Copy-Item .env.example .env      # fill in Supabase URL + service-role key
   cmd /c "npm install"
   cmd /c "npm start"
   ```

   Then check `http://localhost:3000/health` and `/ready`.

The complete Windows PowerShell walkthrough, including how to create the first
administrator and a company API key, is provided with the integration report.

## Documentation

- [ADDITIONAL_FEATURES.md](ADDITIONAL_FEATURES.md) — every added feature,
  migration, security control and known limitation.
- [APP/FRONTEND/README.md](APP/FRONTEND/README.md) — frontend setup and data flow.
- [APP/BACKEND/README.md](APP/BACKEND/README.md) — company API contract.
- [APP/Database/AgriOpportunity_Supabase/README.md](APP/Database/AgriOpportunity_Supabase/README.md)
  — migrations, roles, workflow and tests.

## Status

Migrations and SQL tests pass on local PostgreSQL 18; frontend and backend
type/syntax checks pass; backend HTTP error paths were smoke-tested. Deployment
to the hosted Supabase project is pending project credentials and approval.
See the report for the exact completed / tested / pending split.
