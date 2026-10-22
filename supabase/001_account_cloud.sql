-- Run in the project's Supabase SQL Editor. No service key belongs in the app.
begin;
create table if not exists public.masarak_account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 2000000),
  updated_at timestamptz not null default now()
);
alter table public.masarak_account_data enable row level security;
revoke all on public.masarak_account_data from anon, authenticated;
grant select, insert, update, delete on public.masarak_account_data to authenticated;
grant usage on schema public to authenticated;
drop policy if exists masarak_account_select on public.masarak_account_data;
drop policy if exists masarak_account_insert on public.masarak_account_data;
drop policy if exists masarak_account_update on public.masarak_account_data;
drop policy if exists masarak_account_delete on public.masarak_account_data;
create policy masarak_account_select on public.masarak_account_data for select to authenticated using ((select auth.uid()) = user_id);
create policy masarak_account_insert on public.masarak_account_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy masarak_account_update on public.masarak_account_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy masarak_account_delete on public.masarak_account_data for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_masarak_account(p_snapshot jsonb, p_expected_revision bigint default null)
returns setof public.masarak_account_data
language plpgsql security invoker set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_snapshot->>'version' is distinct from '1' or jsonb_typeof(p_snapshot->'plan') is distinct from 'array' then
    raise exception 'invalid_snapshot' using errcode = '22023';
  end if;
  if p_snapshot->'cv' is not null and p_snapshot->'cv' <> 'null'::jsonb and (
    split_part(p_snapshot->'cv'->>'path', '/', 1) is distinct from actor::text or
    (p_snapshot->'cv'->>'path') !~ '^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\.(pdf|docx)$'
  ) then raise exception 'invalid_cv_owner' using errcode = '42501'; end if;
  if p_expected_revision is null then
    return query insert into public.masarak_account_data(user_id, snapshot)
      values(actor, p_snapshot) on conflict(user_id) do nothing returning *;
  else
    return query update public.masarak_account_data set snapshot=p_snapshot, revision=revision+1, updated_at=now()
      where user_id=actor and revision=p_expected_revision returning *;
  end if;
  if not found then raise exception 'sync_conflict' using errcode = '40001'; end if;
end $$;
revoke all on function public.save_masarak_account(jsonb, bigint) from public, anon;
grant execute on function public.save_masarak_account(jsonb, bigint) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('masarak-cvs', 'masarak-cvs', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists masarak_cv_select on storage.objects;
drop policy if exists masarak_cv_insert on storage.objects;
drop policy if exists masarak_cv_update on storage.objects;
drop policy if exists masarak_cv_delete on storage.objects;
create policy masarak_cv_select on storage.objects for select to authenticated using (bucket_id='masarak-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy masarak_cv_insert on storage.objects for insert to authenticated with check (bucket_id='masarak-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy masarak_cv_update on storage.objects for update to authenticated using (bucket_id='masarak-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='masarak-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy masarak_cv_delete on storage.objects for delete to authenticated using (bucket_id='masarak-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text);
notify pgrst, 'reload schema';
commit;
