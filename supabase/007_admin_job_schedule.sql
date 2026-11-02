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
