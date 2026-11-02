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
