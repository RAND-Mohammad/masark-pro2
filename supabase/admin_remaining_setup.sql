-- إعداد واحد لاستكمال لوحة الإدارة بعد تطبيق 004_admin_console.sql.
-- شغّليه مرة واحدة فقط في Supabase SQL Editor. يحتوي الترحيلات 005 و006 و007 بالترتيب.
-- لا تشغّلي هذا الملف إذا سبق تطبيق 005 أو 006 أو 007 منفردًا.
-- Run after 001_account_cloud.sql and 004_admin_console.sql.
-- A deleted auth.users row does not instantly invalidate already-issued JWTs.
-- An account deletion lock pauses access on all devices while files are removed;
-- a live auth-row check also prevents old tokens from reading or writing after deletion.
begin;

create table if not exists public.masarak_account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.masarak_account_deletions enable row level security;
revoke all on public.masarak_account_deletions from public, anon, authenticated;
grant select, insert, update, delete on public.masarak_account_deletions to service_role;
grant select on public.masarak_account_deletions to authenticated;
drop policy if exists masarak_account_deletion_status on public.masarak_account_deletions;
create policy masarak_account_deletion_status on public.masarak_account_deletions for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.masarak_authenticated_user_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where id = (select auth.uid()))
    and not exists (select 1 from public.masarak_account_deletions where user_id = (select auth.uid()));
$$;
revoke all on function public.masarak_authenticated_user_exists() from public, anon;
grant execute on function public.masarak_authenticated_user_exists() to authenticated;

drop policy if exists masarak_account_select on public.masarak_account_data;
drop policy if exists masarak_account_insert on public.masarak_account_data;
drop policy if exists masarak_account_update on public.masarak_account_data;
drop policy if exists masarak_account_delete on public.masarak_account_data;
create policy masarak_account_select on public.masarak_account_data for select to authenticated
  using ((select auth.uid()) = user_id and (select public.masarak_authenticated_user_exists()));
create policy masarak_account_insert on public.masarak_account_data for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.masarak_authenticated_user_exists()));
create policy masarak_account_update on public.masarak_account_data for update to authenticated
  using ((select auth.uid()) = user_id and (select public.masarak_authenticated_user_exists()))
  with check ((select auth.uid()) = user_id and (select public.masarak_authenticated_user_exists()));
create policy masarak_account_delete on public.masarak_account_data for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.masarak_authenticated_user_exists()));

drop policy if exists masarak_cv_select on storage.objects;
drop policy if exists masarak_cv_insert on storage.objects;
drop policy if exists masarak_cv_update on storage.objects;
drop policy if exists masarak_cv_delete on storage.objects;
create policy masarak_cv_select on storage.objects for select to authenticated
  using (bucket_id = 'masarak-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.masarak_authenticated_user_exists()));
create policy masarak_cv_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'masarak-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.masarak_authenticated_user_exists()));
create policy masarak_cv_update on storage.objects for update to authenticated
  using (bucket_id = 'masarak-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.masarak_authenticated_user_exists()))
  with check (bucket_id = 'masarak-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.masarak_authenticated_user_exists()));
create policy masarak_cv_delete on storage.objects for delete to authenticated
  using (bucket_id = 'masarak-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.masarak_authenticated_user_exists()));

-- Preserve learning catalogue history while allowing an administrator account
-- to be erased. Audit actor_id already uses ON DELETE SET NULL.
alter table public.masarak_admin_learning_resources alter column updated_by drop not null;
alter table public.masarak_admin_learning_resources
  drop constraint if exists masarak_admin_learning_resources_updated_by_fkey;
alter table public.masarak_admin_learning_resources
  add constraint masarak_admin_learning_resources_updated_by_fkey
  foreign key (updated_by) references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
commit;

-- Run after 004_admin_console.sql and 005_account_erasure.sql.
begin;

alter table public.masarak_admin_learning_resources
  add column link_check_status text not null default 'not_checked'
    check (link_check_status in ('not_checked', 'reachable')),
  add column link_checked_at timestamptz;

-- Existing manually approved URLs were not checked by the server, so require
-- an actual reachability check before publishing them again.
update public.masarak_admin_learning_resources
set is_visible = false,
    link_status = 'needs_review',
    reviewed_at = null,
    link_check_status = 'not_checked',
    link_checked_at = null
where is_visible = true;

alter table public.masarak_admin_learning_resources
  add constraint masarak_admin_learning_resources_link_check_consistent
    check (
      (link_check_status = 'not_checked' and link_checked_at is null)
      or (link_check_status = 'reachable' and link_checked_at is not null)
    ),
  add constraint masarak_admin_learning_resources_publishable_link
    check (
      is_visible = false
      or (
        link_status = 'reviewed'
        and reviewed_at is not null
        and link_check_status = 'reachable'
        and link_checked_at is not null
      )
    );

create or replace function public.masarak_admin_save_learning_resource_v2(
  p_resource_id text,
  p_payload jsonb,
  p_is_visible boolean,
  p_link_status text,
  p_link_check_status text,
  p_link_checked_at timestamptz,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if p_resource_id !~ '^[a-z0-9][a-z0-9-]{1,79}$'
    or jsonb_typeof(p_payload) <> 'object'
    or p_link_status not in ('needs_review', 'reviewed')
    or p_link_check_status not in ('not_checked', 'reachable')
    or (p_link_check_status = 'not_checked' and p_link_checked_at is not null)
    or (p_link_check_status = 'reachable' and p_link_checked_at is null)
    or (p_is_visible and (
      p_link_status <> 'reviewed'
      or p_link_check_status <> 'reachable'
      or p_link_checked_at is null
    )) then
    raise exception 'Invalid admin resource data';
  end if;

  insert into public.masarak_admin_learning_resources (
    resource_id, payload, is_visible, link_status, reviewed_at,
    link_check_status, link_checked_at, updated_by, updated_at
  ) values (
    p_resource_id, p_payload, p_is_visible, p_link_status,
    case when p_link_status = 'reviewed' then now() else null end,
    p_link_check_status, p_link_checked_at, p_actor, now()
  )
  on conflict (resource_id) do update set
    payload = excluded.payload,
    is_visible = excluded.is_visible,
    link_status = excluded.link_status,
    reviewed_at = excluded.reviewed_at,
    link_check_status = excluded.link_check_status,
    link_checked_at = excluded.link_checked_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.masarak_admin_audit_events (actor_id, action, target_id, details)
  values (
    p_actor, 'learning_resource_saved', p_resource_id,
    jsonb_build_object(
      'visible', p_is_visible,
      'link_status', p_link_status,
      'link_check_status', p_link_check_status
    )
  );
end;
$$;

revoke all on function public.masarak_admin_save_learning_resource_v2(text, jsonb, boolean, text, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.masarak_admin_save_learning_resource_v2(text, jsonb, boolean, text, text, timestamptz, uuid)
  to service_role;

notify pgrst, 'reload schema';
commit;

-- Run after 004_admin_console.sql, 005_account_erasure.sql, and 006_admin_resource_link_check.sql.
-- The schedule is readable and writable only by the server's service role.
begin;

create table if not exists public.masarak_admin_job_schedules (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  interval_hours smallint not null default 6 check (interval_hours in (6, 12, 24)),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.masarak_admin_job_schedules enable row level security;
revoke all on public.masarak_admin_job_schedules from public, anon, authenticated;
grant select, insert, update on public.masarak_admin_job_schedules to service_role;

insert into public.masarak_admin_job_schedules (id, enabled, interval_hours)
values (1, true, 6)
on conflict (id) do nothing;

alter table public.masarak_admin_audit_events
  drop constraint if exists masarak_admin_audit_events_action_check;
alter table public.masarak_admin_audit_events
  add constraint masarak_admin_audit_events_action_check
    check (action in ('learning_resource_saved', 'jobs_refresh_requested', 'jobs_schedule_updated'));

notify pgrst, 'reload schema';
commit;
