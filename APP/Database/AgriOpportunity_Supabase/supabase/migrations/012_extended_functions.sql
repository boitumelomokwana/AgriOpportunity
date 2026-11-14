-- =====================================================================
-- 012_extended_functions.sql
-- Read/write helpers used by the integrated frontend and backend.
--
-- Every function is SECURITY DEFINER with a pinned search_path and an
-- explicit role check where the action is privileged. Grants are at the
-- bottom of the file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profile completeness (0-100), computed from the row itself so it can
-- be used in SELECTs without extra queries.
-- ---------------------------------------------------------------------
create or replace function public.profile_completion(p public.profiles)
returns integer
language sql immutable
as $$
  select least(100, (
      case when nullif(trim(coalesce(p.full_name, '')), '')       is not null then 15 else 0 end +
      case when nullif(trim(coalesce(p.email, '')), '')           is not null then 5  else 0 end +
      case when nullif(trim(coalesce(p.phone, '')), '')           is not null then 5  else 0 end +
      case when nullif(trim(coalesce(p.province, '')), '')        is not null then 10 else 0 end +
      case when nullif(trim(coalesce(p.qualification, '')), '')   is not null then 10 else 0 end +
      case when nullif(trim(coalesce(p.field_of_study, '')), '')  is not null then 10 else 0 end +
      case when nullif(trim(coalesce(p.institution, '')), '')     is not null then 5  else 0 end +
      case when nullif(trim(coalesce(p.employment_status, '')), '') is not null then 5 else 0 end +
      case when p.date_of_birth is not null                       then 5  else 0 end +
      case when coalesce(array_length(p.interests, 1), 0) > 0     then 15 else 0 end +
      case when jsonb_array_length(coalesce(p.preferences -> 'careerFields', '[]'::jsonb)) > 0
                                                                  then 10 else 0 end +
      case when nullif(trim(coalesce(p.avatar_url, '')), '')      is not null then 5  else 0 end
  ))
$$;

create or replace function public.my_profile_completion()
returns integer
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public.profile_completion(p) from public.profiles p
                   where p.id = auth.uid()), 0)
$$;

-- ---------------------------------------------------------------------
-- Activity + view tracking
-- ---------------------------------------------------------------------
create or replace function public.bump_last_active()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;

create or replace function public.record_opportunity_view(
  p_opportunity_id uuid,
  p_source text default 'app')
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.opportunities
                 where id = p_opportunity_id and status = 'published') then
    return;
  end if;

  insert into public.opportunity_views (opportunity_id, user_id, source)
  values (p_opportunity_id, v_uid, left(coalesce(p_source, 'app'), 40));

  if v_uid is not null then
    update public.profiles set last_active_at = now() where id = v_uid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Transparent matching
-- Returns {score, reasons:[text]} and explains every point awarded.
--   35  category / interest match
--   25  field-of-study keyword match
--   20  province (or nationwide)
--   10  education requirement compatible
--   10  still open
-- ---------------------------------------------------------------------
create or replace function public.match_opportunity_score(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_o        public.opportunities%rowtype;
  v_p        public.profiles%rowtype;
  v_uid      uuid := auth.uid();
  v_score    integer := 0;
  v_reasons  text[] := '{}';
  v_token    text;
  v_text     text;
  v_interest text;
  v_hit      boolean;
begin
  select * into v_o from public.opportunities where id = p_opportunity_id;
  if not found or v_o.status <> 'published' then
    return jsonb_build_object('score', 0, 'reasons', jsonb_build_array('This opportunity is not open.'));
  end if;

  if v_uid is null then
    return jsonb_build_object('score', 0,
      'reasons', jsonb_build_array('Sign in to see how well this fits your profile.'));
  end if;

  select * into v_p from public.profiles where id = v_uid;

  -- 1. category / declared interest
  select exists (
    select 1
    from unnest(coalesce(v_p.interests, '{}')) as i
    where lower(trim(i)) in (lower(v_o.category), lower(coalesce(v_o.opportunity_type, '')))
    union all
    select 1
    from public.user_interests ui
    where ui.user_id = v_uid
      and lower(ui.interest) in (lower(v_o.category), lower(coalesce(v_o.opportunity_type, '')))
  ) into v_hit;

  if v_hit then
    v_score := v_score + 35;
    v_reasons := array_append(v_reasons, 'Matches your interest in ' || v_o.category);
  end if;

  -- 2. field of study / keywords
  v_text := lower(coalesce(v_o.title, '') || ' ' || coalesce(v_o.description, '') || ' ' ||
                  coalesce(v_o.category, '') || ' ' || coalesce(v_o.opportunity_type, '') || ' ' ||
                  array_to_string(coalesce(v_o.tags, '{}'), ' '));
  v_hit := false;
  foreach v_token in array regexp_split_to_array(lower(coalesce(v_p.field_of_study, '')), '[^a-z0-9]+')
  loop
    if length(v_token) >= 4
       and v_token not in ('with', 'and', 'the', 'for', 'from', 'this', 'that', 'your', 'bachelor', 'degree', 'diploma') then
      if position(v_token in v_text) > 0 then
        v_hit := true;
        exit;
      end if;
    end if;
  end loop;
  if v_hit then
    v_score := v_score + 25;
    v_reasons := array_append(v_reasons, 'Related to your field of study');
  end if;

  -- 3. province
  if v_o.is_remote
     or lower(coalesce(v_o.province, 'nationwide')) in ('nationwide', 'national', '')
     or lower(coalesce(v_p.province, '')) = lower(coalesce(v_o.province, '')) then
    v_score := v_score + 20;
    if lower(coalesce(v_o.province, 'nationwide')) in ('nationwide', 'national', '') then
      v_reasons := array_append(v_reasons, 'Open nationwide');
    elsif v_o.is_remote then
      v_reasons := array_append(v_reasons, 'Can be done remotely');
    else
      v_reasons := array_append(v_reasons, 'Located in ' || v_o.province);
    end if;
  end if;

  -- 4. qualification compatibility (deliberately forgiving)
  if lower(coalesce(v_o.qualification, 'not specified')) in ('not specified', 'any', 'all')
     or nullif(trim(coalesce(v_p.qualification, '')), '') is null
     or position(lower(v_p.qualification) in lower(coalesce(v_o.qualification, ''))) > 0
     or position(lower(coalesce(v_o.qualification, '')) in lower(v_p.qualification)) > 0 then
    v_score := v_score + 10;
    v_reasons := array_append(v_reasons, 'Education requirements look compatible');
  end if;

  -- 5. still open
  if v_o.closing_date is null or v_o.closing_date >= current_date then
    v_score := v_score + 10;
    if v_o.closing_date is not null then
      v_reasons := array_append(v_reasons, 'Closes ' || to_char(v_o.closing_date, 'DD Mon YYYY'));
    end if;
  end if;

  if v_score = 0 then
    v_reasons := array_append(v_reasons, 'Add your interests and province to improve this score');
  end if;

  return jsonb_build_object('score', least(v_score, 100), 'reasons', to_jsonb(v_reasons));
end;
$$;

create or replace function public.recommended_opportunities(
  p_limit integer default 20,
  p_offset integer default 0,
  p_include_expired boolean default false)
returns table (opportunity_id uuid, score integer, reasons jsonb)
language sql stable security definer
set search_path = public
as $$
  with scored as (
    select o.id,
           (public.match_opportunity_score(o.id) ->> 'score')::integer as score,
           public.match_opportunity_score(o.id) -> 'reasons' as reasons,
           o.published_at
    from public.opportunities o
    where o.status = 'published'
      and (p_include_expired or o.closing_date is null or o.closing_date >= current_date)
  )
  select id, score, reasons
  from scored
  order by score desc nulls last, published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;

-- ---------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------
create or replace function public.search_opportunities(
  p_query text default null,
  p_category text default null,
  p_province text default null,
  p_limit integer default 30,
  p_offset integer default 0)
returns setof public.opportunities
language sql stable security definer
set search_path = public
as $$
  select o.*
  from public.opportunities o
  where o.status = 'published'
    and (nullif(trim(coalesce(p_query, '')), '') is null
         or o.search_vector @@ websearch_to_tsquery('english', p_query)
         or o.title ilike '%' || p_query || '%'
         or o.provider ilike '%' || p_query || '%')
    and (nullif(trim(coalesce(p_category, '')), '') is null
         or lower(o.category) = lower(p_category))
    and (nullif(trim(coalesce(p_province, '')), '') is null
         or lower(o.province) = lower(p_province)
         or lower(o.province) in ('nationwide', 'national'))
  order by
    case when nullif(trim(coalesce(p_query, '')), '') is null then 0
         else ts_rank(o.search_vector, websearch_to_tsquery('english', p_query)) end desc,
    o.is_featured desc,
    o.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;

-- ---------------------------------------------------------------------
-- Deadline reminders
-- ---------------------------------------------------------------------
create or replace function public.set_deadline_reminder(
  p_opportunity_id uuid,
  p_days_before integer default 7)
returns public.deadline_reminders
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.deadline_reminders;
  v_closing date;
begin
  if auth.uid() is null then
    raise exception 'Sign in to set a reminder' using errcode = '42501';
  end if;
  if p_days_before < 1 or p_days_before > 60 then
    raise exception 'days_before must be between 1 and 60';
  end if;

  select closing_date into v_closing
  from public.opportunities
  where id = p_opportunity_id and status = 'published';

  if v_closing is null then
    raise exception 'Only open opportunities with a closing date can be reminded';
  end if;
  if v_closing < current_date then
    raise exception 'This opportunity has already closed';
  end if;

  insert into public.deadline_reminders (user_id, opportunity_id, days_before)
  values (auth.uid(), p_opportunity_id, p_days_before)
  on conflict (user_id, opportunity_id, days_before)
  do update set sent_at = null
  returning * into v_row;

  return v_row;
end;
$$;

-- Backend job: create the notification rows that are due today.
create or replace function public.dispatch_deadline_reminders(p_limit integer default 500)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with due as (
    select r.id, r.user_id, r.opportunity_id, r.days_before, o.title, o.provider, o.closing_date
    from public.deadline_reminders r
    join public.opportunities o on o.id = r.opportunity_id
    where r.sent_at is null
      and o.status = 'published'
      and o.closing_date is not null
      and o.closing_date >= current_date
      and o.closing_date - r.days_before <= current_date
      and coalesce((select (p.notification_preferences ->> 'closingDates')::boolean
                    from public.profiles p where p.id = r.user_id), true) is not false
    order by o.closing_date
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
    for update of r skip locked
  ), inserted as (
    insert into public.notifications (user_id, type, title, message, opportunity_id)
    select due.user_id, 'deadline_reminder',
           'Closing soon: ' || due.title,
           coalesce(due.provider, '') || ' closes on ' || to_char(due.closing_date, 'DD Mon YYYY') ||
           ' (' || due.days_before || ' day' || case when due.days_before = 1 then '' else 's' end || ' left)',
           due.opportunity_id
    from due
    returning 1
  ), updated as (
    update public.deadline_reminders r
    set sent_at = now()
    from due
    where r.id = due.id
    returning 1
  )
  select count(*) into v_count from inserted;

  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------
create or replace function public.admin_analytics()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'users_total', (select count(*) from public.profiles),
    'users_new_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'students_total', (select count(*) from public.profiles p
                       where not exists (select 1 from public.admin_roles a where a.user_id = p.id)),
    'suspended_users', (select count(*) from public.profiles where is_suspended),
    'organizations_total', (select count(*) from public.organizations),
    'organizations_pending', (select count(*) from public.organizations where status = 'pending'),
    'organizations_verified', (select count(*) from public.organizations where is_verified),
    'opportunities_total', (select count(*) from public.opportunities),
    'opportunities_pending', (select count(*) from public.opportunities where status = 'pending'),
    'opportunities_pending_7d', (select count(*) from public.opportunities
                                 where status = 'pending' and created_at < now() - interval '7 days'),
    'opportunities_published', (select count(*) from public.opportunities where status = 'published'),
    'opportunities_closing_7d', (select count(*) from public.opportunities
                                 where status = 'published' and closing_date between current_date and current_date + 7),
    'applications_total', (select count(*) from public.applications),
    'applications_30d', (select count(*) from public.applications where created_at > now() - interval '30 days'),
    'bookmarks_total', (select count(*) from public.bookmarks),
    'views_30d', (select count(*) from public.opportunity_views where viewed_at > now() - interval '30 days'),
    'api_requests_30d', (select count(*) from public.api_logs where created_at > now() - interval '30 days'),
    'open_reports', (select count(*) from public.opportunity_reports where status = 'open'),
    'top_categories', coalesce((
      select jsonb_agg(x) from (
        select o.category as name, count(*) as count
        from public.opportunities o
        where o.status = 'published'
        group by o.category
        order by count(*) desc
        limit 8
      ) x), '[]'::jsonb),
    'top_provinces', coalesce((
      select jsonb_agg(x) from (
        select o.province as name, count(*) as count
        from public.opportunities o
        where o.status = 'published'
        group by o.province
        order by count(*) desc
        limit 9
      ) x), '[]'::jsonb),
    'application_funnel', coalesce((
      select jsonb_object_agg(s.status, s.count) from (
        select a.status, count(*) as count
        from public.applications a
        group by a.status
      ) s), '{}'::jsonb),
    'top_opportunities', coalesce((
      select jsonb_agg(x) from (
        select o.id, o.title, o.provider, count(v.id) as views
        from public.opportunities o
        left join public.opportunity_views v on v.opportunity_id = o.id
        where o.status = 'published'
        group by o.id, o.title, o.provider
        order by count(v.id) desc, o.published_at desc
        limit 8
      ) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.opportunity_quality_report()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'published_without_application_url', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title))
      from public.opportunities o
      where o.status = 'published' and nullif(trim(coalesce(o.application_url, '')), '') is null
      limit 50), '[]'::jsonb),
    'published_and_past_closing', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'closing_date', o.closing_date))
      from public.opportunities o
      where o.status = 'published' and o.closing_date < current_date
      limit 50), '[]'::jsonb),
    'stale_source_check', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'last_verified_at', o.last_verified_at))
      from public.opportunities o
      where o.status = 'published'
        and (o.last_verified_at is null or o.last_verified_at < now() - interval '90 days')
      limit 50), '[]'::jsonb),
    'duplicate_titles', coalesce((
      select jsonb_agg(jsonb_build_object('title', d.title, 'count', d.count))
      from (select lower(trim(title)) as title, count(*) as count
            from public.opportunities
            group by lower(trim(title))
            having count(*) > 1
            limit 50) d), '[]'::jsonb),
    'zero_view_published', coalesce((
      select count(*) from public.opportunities o
      where o.status = 'published'
        and not exists (select 1 from public.opportunity_views v where v.opportunity_id = o.id)), 0)
  );
end;
$$;

create or replace function public.review_report(
  p_report_id uuid,
  p_status text,
  p_note text default null)
returns public.opportunity_reports
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.opportunity_reports;
begin
  if not public.can_review_opportunities() then
    raise exception 'Only Super Admin or Opportunity Admin can review reports' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid report status: %', p_status;
  end if;

  update public.opportunity_reports
  set status = p_status,
      resolution_note = p_note,
      resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() else null end,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
      updated_at = now()
  where id = p_report_id
  returning * into v_row;

  if v_row.id is null then raise exception 'Report not found' using errcode = 'P0002'; end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'report.' || p_status, 'opportunity_report', p_report_id::text,
          jsonb_build_object('opportunity_id', v_row.opportunity_id, 'note', p_note));

  if v_row.user_id is not null then
    insert into public.notifications (user_id, type, title, message, opportunity_id)
    values (v_row.user_id, 'opportunity_reported', 'Your report was reviewed',
            'A moderator marked your report as ' || p_status || '.', v_row.opportunity_id);
  end if;

  return v_row;
end;
$$;

create or replace function public.set_organization_status(
  p_org_id uuid,
  p_status text,
  p_reason text default null)
returns public.organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.organizations;
  v_old text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can approve or suspend companies' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'suspended', 'rejected') then
    raise exception 'Invalid organisation status: %', p_status;
  end if;

  select status into v_old from public.organizations where id = p_org_id for update;
  if v_old is null then raise exception 'Organisation not found' using errcode = 'P0002'; end if;

  update public.organizations
  set status = p_status,
      suspended_reason = case when p_status in ('suspended', 'rejected') then p_reason else null end,
      approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when p_status = 'approved' then now() else approved_at end,
      api_enabled = case when p_status = 'approved' then api_enabled else false end
  where id = p_org_id
  returning * into v_row;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'organization.status_changed', 'organization', p_org_id::text,
          jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));

  insert into public.notifications (user_id, type, title, message)
  select m.user_id, 'organization_update',
         'Company status updated',
         v_row.name || ' is now ' || p_status || '.'
  from public.organization_members m
  where m.organization_id = p_org_id and m.role in ('owner', 'manager');

  return v_row;
end;
$$;

create or replace function public.verify_organization(
  p_org_id uuid,
  p_verified boolean default true)
returns public.organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.organizations;
begin
  if not public.can_manage_content() then
    raise exception 'Super Admin or Content Admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Organisation not found' using errcode = 'P0002';
  end if;

  update public.organizations
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = case when p_verified then auth.uid() else null end
  where id = p_org_id
  returning * into v_row;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'organization.verification_changed', 'organization', p_org_id::text,
          jsonb_build_object('is_verified', p_verified));

  return v_row;
end;
$$;

-- Super Admin: user directory with role + suspension state.
create or replace function public.admin_list_users(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0)
returns table (
  id uuid, full_name text, email text, province text, qualification text,
  is_suspended boolean, admin_role text, interest_count bigint,
  created_at timestamptz, last_active_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin only' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, p.email, p.province, p.qualification,
         p.is_suspended, a.role,
         (select count(*) from public.user_interests ui where ui.user_id = p.id),
         p.created_at, p.last_active_at
  from public.profiles p
  left join public.admin_roles a on a.user_id = p.id
  where nullif(trim(coalesce(p_query, '')), '') is null
     or p.full_name ilike '%' || p_query || '%'
     or p.email ilike '%' || p_query || '%'
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke all on function public.profile_completion(public.profiles)        from public, anon;
revoke all on function public.my_profile_completion()                    from public, anon;
revoke all on function public.bump_last_active()                         from public, anon;
revoke all on function public.record_opportunity_view(uuid, text)        from public;
revoke all on function public.match_opportunity_score(uuid)              from public, anon;
revoke all on function public.recommended_opportunities(integer, integer, boolean) from public, anon;
revoke all on function public.search_opportunities(text, text, text, integer, integer) from public;
revoke all on function public.set_deadline_reminder(uuid, integer)       from public, anon;
revoke all on function public.dispatch_deadline_reminders(integer)       from public, anon, authenticated;
revoke all on function public.admin_analytics()                          from public, anon;
revoke all on function public.opportunity_quality_report()               from public, anon;
revoke all on function public.review_report(uuid, text, text)            from public, anon;
revoke all on function public.set_organization_status(uuid, text, text)  from public, anon;
revoke all on function public.verify_organization(uuid, boolean)         from public, anon;
revoke all on function public.admin_list_users(text, integer, integer)   from public, anon;

grant execute on function public.profile_completion(public.profiles)      to authenticated, service_role;
grant execute on function public.my_profile_completion()                  to authenticated, service_role;
grant execute on function public.bump_last_active()                       to authenticated;
grant execute on function public.record_opportunity_view(uuid, text)      to anon, authenticated, service_role;
grant execute on function public.match_opportunity_score(uuid)            to authenticated, service_role;
grant execute on function public.recommended_opportunities(integer, integer, boolean) to authenticated, service_role;
grant execute on function public.search_opportunities(text, text, text, integer, integer)
  to anon, authenticated, service_role;
grant execute on function public.set_deadline_reminder(uuid, integer)     to authenticated, service_role;
grant execute on function public.dispatch_deadline_reminders(integer)     to service_role;
grant execute on function public.admin_analytics()                        to authenticated, service_role;
grant execute on function public.opportunity_quality_report()             to authenticated, service_role;
grant execute on function public.review_report(uuid, text, text)          to authenticated, service_role;
grant execute on function public.set_organization_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.verify_organization(uuid, boolean)       to authenticated, service_role;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated, service_role;
