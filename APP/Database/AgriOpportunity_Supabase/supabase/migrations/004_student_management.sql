-- =====================================================================
-- 004_student_management.sql
-- Group D: Student management
--   * applications   (track applications)
--   * bookmarks      (saved opportunities - replaces the in-memory set)
--   * notifications
-- =====================================================================

create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  status         text not null default 'interested'
                   check (status in ('interested', 'applied', 'shortlisted', 'interview',
                                     'offered', 'rejected', 'withdrawn')),
  applied_at     timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists applications_user_idx on public.applications (user_id, updated_at desc);
create index if not exists applications_opp_idx  on public.applications (opportunity_id);

create table if not exists public.bookmarks (
  user_id        uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create index if not exists bookmarks_opp_idx on public.bookmarks (opportunity_id);

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null default 'general'
                   check (type in ('new_opportunity', 'application_update', 'closing_soon', 'system', 'general')),
  title          text not null,
  message        text,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  is_read        boolean not null default false,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

comment on table public.applications   is 'A student''s application tracker. Private to the student.';
comment on table public.bookmarks      is 'Opportunities a student saved. Private to the student.';
comment on table public.notifications  is 'In-app notifications. Created by the system (triggers / service role), read by the student.';
