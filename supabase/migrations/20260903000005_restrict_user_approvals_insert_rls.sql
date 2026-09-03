-- Fix F3-01: Mass assignment / privilege escalation on user_approvals INSERT
--
-- Problem: policy "Users can insert their own approval row." only checked that
-- email matched the caller JWT. An attacker could insert a row with
-- approved=true / is_admin=true and bypass the approval + admin bootstrap.
--
-- Mitigation:
--   1. Replace the permissive INSERT policy with one that forces
--      approved=false AND is_admin=false on self-insert.
--   2. Add a SECURITY DEFINER trigger as defense in depth that forces pending
--      on any insert performed by a non-admin (covers accidental future policy
--      loosening).

-- 1. Drop the permissive insert policy
drop policy if exists "Users can insert their own approval row."
  on public.user_approvals;

-- 2. Restrict insert: caller may only insert their own row as PENDING
create policy "Users can insert own approval row (pending only)."
  on public.user_approvals
  for insert
  with check (
    lower(email) = lower(auth.jwt() ->> 'email')
    and approved = false
    and is_admin = false
  );

-- 3. Defense in depth: trigger that forces pending on any non-admin insert
create or replace function public.force_pending_on_nonadmin_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.approved := false;
    new.is_admin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists user_approvals_force_pending on public.user_approvals;
create trigger user_approvals_force_pending
  before insert on public.user_approvals
  for each row execute function public.force_pending_on_nonadmin_insert();
