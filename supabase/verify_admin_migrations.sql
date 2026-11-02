-- Read-only verification for admin migrations 004-007.
-- Run after applying the migrations. Every column should return true.
select
  to_regclass('public.masarak_admin_audit_events') is not null as admin_console_004,
  to_regclass('public.masarak_account_deletions') is not null as account_erasure_005,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'masarak_admin_learning_resources'
      and column_name = 'link_check_status'
  ) as resource_link_check_006,
  to_regclass('public.masarak_admin_job_schedules') is not null as jobs_schedule_007;
