-- Fix F2-07: TOCTOU race in claim_first_admin
--
-- Problem: two concurrent callers could both observe admin_count = 0 and both
-- insert themselves as admin before the other's commit is visible.
--
-- Fix: acquire a transaction-scoped advisory lock so only one caller can
-- execute the check-and-insert sequence at a time.

create or replace function public.claim_first_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  -- Serialize admin-claim attempts: only one transaction can run this body at a time.
  -- The lock is automatically released when the surrounding transaction ends.
  perform pg_advisory_xact_lock(hashtext('claim_first_admin'));

  select count(*) into admin_count from public.user_approvals where is_admin = true;
  if admin_count > 0 then
    raise exception 'An admin already exists. Ask an existing admin to grant you access.'
      using errcode = '42501';
  end if;

  -- Upsert the row: if it exists (self-inserted on signup) promote it;
  -- otherwise insert it. The caller must match p_email to avoid spoofing.
  if lower(p_email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'You can only claim admin for your own email.'
      using errcode = '42501';
  end if;

  insert into public.user_approvals (email, approved, is_admin)
  values (lower(p_email), true, true)
  on conflict (email) do update
  set approved = true, is_admin = true, approved_by = auth.uid();
end;
$$;
