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
