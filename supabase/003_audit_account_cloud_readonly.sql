-- Read-only catalog audit. Run in Supabase SQL Editor for this project.
-- Does not call the save RPC, impersonate users, change grants, or write fixtures.
-- Catalog evidence does NOT replace a two-account runtime RLS test.
begin read only;

select
  to_regclass('public.masarak_account_data') is not null as account_table_exists,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  case when c.oid is not null then has_table_privilege('anon',c.oid,'SELECT') end as anon_can_select,
  case when c.oid is not null then has_table_privilege('anon',c.oid,'INSERT') end as anon_can_insert,
  case when c.oid is not null then has_table_privilege('anon',c.oid,'UPDATE') end as anon_can_update,
  case when c.oid is not null then has_table_privilege('anon',c.oid,'DELETE') end as anon_can_delete,
  case when c.oid is not null then
    has_table_privilege('authenticated',c.oid,'SELECT')
    and has_table_privilege('authenticated',c.oid,'INSERT')
    and has_table_privilege('authenticated',c.oid,'UPDATE')
    and has_table_privilege('authenticated',c.oid,'DELETE')
  end as authenticated_has_crud
from (select to_regclass('public.masarak_account_data') as oid) target
left join pg_class c on c.oid=target.oid;

-- Expect four owner-scoped authenticated policies. Review ALL returned policies:
-- permissive policies combine with OR; extra broad policies can defeat isolation.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='masarak_account_data'
order by policyname;

select
  p.oid is not null as save_rpc_exists,
  p.prosecdef as is_security_definer,
  p.proconfig as function_settings,
  case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end as anon_can_execute,
  case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_can_execute
from (select to_regprocedure('public.save_masarak_account(jsonb,bigint)') as oid) target
left join pg_proc p on p.oid=target.oid;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid=to_regclass('public.masarak_account_data')
order by conname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='masarak-cvs';

-- Include other Storage policies because a broad policy can grant access to this bucket.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='storage' and tablename='objects'
order by policyname;

commit;
