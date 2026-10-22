-- Ownership/CAS checks against the deployed schema. Every fixture and update is rolled back.
-- Requires at least one real registered user; does not create users or send email.
begin;
do $$
declare actor uuid;
begin
  select id into actor from auth.users order by created_at limit 1;
  if actor is null then raise exception 'Create a Masarak account before running the ownership checks.'; end if;
  perform set_config('masarak.verify_owner', actor::text, true);
  if not (select relrowsecurity from pg_class where oid='public.masarak_account_data'::regclass) then raise exception 'RLS must be enabled'; end if;
  if has_table_privilege('anon','public.masarak_account_data','SELECT') or has_table_privilege('anon','public.masarak_account_data','INSERT') then raise exception 'Anonymous table access is forbidden'; end if;
  if (select public from storage.buckets where id='masarak-cvs') is distinct from false then raise exception 'CV bucket must be private'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='masarak_account_data' and policyname not in ('masarak_account_select','masarak_account_insert','masarak_account_update','masarak_account_delete')) then raise exception 'Review unexpected account policies before proceeding'; end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname not in ('masarak_cv_select','masarak_cv_insert','masarak_cv_update','masarak_cv_delete')) then raise exception 'Review other Storage policies: permissive policies combine with OR'; end if;
  insert into public.masarak_account_data(user_id,snapshot) values(actor,'{"version":1,"personal":null,"skills":null,"plan":[],"cv":null}') on conflict(user_id) do nothing;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('masarak.verify_owner'), true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('masarak.verify_owner'),'role','authenticated')::text, true);
do $$
declare prior bigint; after_save bigint;
begin
  select revision into prior from public.masarak_account_data where user_id::text=current_setting('masarak.verify_owner');
  if prior is null then raise exception 'Owner cannot read their own row'; end if;
  select revision into after_save from public.save_masarak_account('{"version":1,"personal":null,"skills":null,"plan":[],"cv":null}',prior);
  if after_save <> prior+1 then raise exception 'Revision did not advance'; end if;
  begin
    perform public.save_masarak_account('{"version":1,"personal":null,"skills":null,"plan":[],"cv":null}',prior);
    raise exception 'A stale writer was accepted';
  exception when serialization_failure then null;
  end;
  insert into storage.objects(bucket_id,name) values('masarak-cvs',current_setting('masarak.verify_owner')||'/verify-ownership.pdf');
end $$;

-- B has no auth.users row: authenticated SELECT must still be unable to see A's rows.
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text, true);
do $$
declare changed bigint;
begin
  if exists(select 1 from public.masarak_account_data where user_id::text=current_setting('masarak.verify_owner')) then raise exception 'Another account can read owner data'; end if;
  if exists(select 1 from storage.objects where bucket_id='masarak-cvs' and name=current_setting('masarak.verify_owner')||'/verify-ownership.pdf') then raise exception 'Another account can read CV metadata'; end if;
  update public.masarak_account_data set revision=revision+1 where user_id::text=current_setting('masarak.verify_owner');
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Another account can update owner data'; end if;
  delete from public.masarak_account_data where user_id::text=current_setting('masarak.verify_owner');
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Another account can delete owner data'; end if;
  begin
    insert into public.masarak_account_data(user_id,snapshot) values(current_setting('masarak.verify_owner')::uuid,'{"version":1,"personal":null,"skills":null,"plan":[],"cv":null}');
    raise exception 'Another account can insert under the owner ID';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'Cloud ownership and stale-write checks passed. All test changes were rolled back.' as result;
