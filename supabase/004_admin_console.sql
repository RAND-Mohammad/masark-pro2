create table if not exists public.masarak_admin_learning_resources (
  resource_id text primary key check (resource_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  is_visible boolean not null default false,
  link_status text not null default 'needs_review' check (link_status in ('needs_review', 'reviewed')),
  reviewed_at timestamptz,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check ((is_visible = false) or (link_status = 'reviewed' and reviewed_at is not null))
);

create table if not exists public.masarak_admin_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('learning_resource_saved', 'jobs_refresh_requested')),
  target_id text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.masarak_admin_learning_resources enable row level security;
alter table public.masarak_admin_audit_events enable row level security;
revoke all on public.masarak_admin_learning_resources from anon, authenticated;
revoke all on public.masarak_admin_audit_events from anon, authenticated;
grant select, insert, update, delete on public.masarak_admin_learning_resources to service_role;
grant select, insert on public.masarak_admin_audit_events to service_role;
grant usage, select on sequence public.masarak_admin_audit_events_id_seq to service_role;

create or replace function public.masarak_admin_save_learning_resource(
  p_resource_id text,
  p_payload jsonb,
  p_is_visible boolean,
  p_link_status text,
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
    or (p_is_visible and p_link_status <> 'reviewed') then
    raise exception 'Invalid admin resource data';
  end if;

  insert into public.masarak_admin_learning_resources (
    resource_id, payload, is_visible, link_status, reviewed_at, updated_by, updated_at
  ) values (
    p_resource_id, p_payload, p_is_visible, p_link_status,
    case when p_link_status = 'reviewed' then now() else null end,
    p_actor, now()
  )
  on conflict (resource_id) do update set
    payload = excluded.payload,
    is_visible = excluded.is_visible,
    link_status = excluded.link_status,
    reviewed_at = excluded.reviewed_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.masarak_admin_audit_events (actor_id, action, target_id, details)
  values (
    p_actor, 'learning_resource_saved', p_resource_id,
    jsonb_build_object('visible', p_is_visible, 'link_status', p_link_status)
  );
end;
$$;

revoke all on function public.masarak_admin_save_learning_resource(text, jsonb, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.masarak_admin_save_learning_resource(text, jsonb, boolean, text, uuid) to service_role;
