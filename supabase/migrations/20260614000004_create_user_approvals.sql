-- Create user_approvals table with strict RLS and admin-only RPC operations
-- Addresses: missing table (PGRST205) + browser-side admin privilege escalation

-- Create user_approvals table in public schema
create table if not exists public.user_approvals (
  id uuid default gen_random_uuid() primary key,
  email varchar(255) unique not null,
  approved boolean default false not null,
  is_admin boolean default false not null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.user_approvals enable row level security;

-- Helper: is the current authenticated user an admin?
-- Checks for a row in user_approvals where email matches the caller's JWT email
-- and is_admin = true. SECURITY DEFINER so it can read user_approvals
-- regardless of the caller's RLS context.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_approvals
    where is_admin = true
      and lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- RLS Policies
-- SELECT: a user may read their own approval row; admins may read all rows.
create policy "Users can view their own approval status."
  on public.user_approvals
  for select using (
    lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin()
  );

-- INSERT: a user may only insert their own approval row (e.g. on signup).
-- is_admin defaults to false so self-signup cannot grant admin.
create policy "Users can insert their own approval row."
  on public.user_approvals
  for insert with check (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- UPDATE / DELETE: no direct policies — all mutations go through
-- security-definer RPCs that verify is_admin() internally.
-- (No FOR UPDATE / FOR DELETE policies => blocked at RLS level.)

-- Trigger: keep updated_at in sync on row update
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_approvals_set_updated_at
  before update on public.user_approvals
  for each row execute function public.handle_updated_at();

-- Index for email lookups
create index if not exists user_approvals_email_idx on public.user_approvals(lower(email));

-- ---------------------------------------------------------------------------
-- Admin RPCs (SECURITY DEFINER). Only callable by admins (is_admin() = true).
-- These replace the previous browser-side .update() / .delete() calls that
-- relied solely on client-side email checks (bypassable with the anon key).
-- ---------------------------------------------------------------------------

-- Set a user's approval status. Only admins may call this.
create or replace function public.admin_set_user_approval(p_email text, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin privileges required.'
      using errcode = '42501';
  end if;

  if lower(p_email) = lower(auth.jwt() ->> 'email') then
    raise exception 'You cannot change your own approval status via this RPC.'
      using errcode = '42501';
  end if;

  update public.user_approvals
  set approved = p_approved, approved_by = auth.uid()
  where lower(email) = lower(p_email);

  if not found then
    raise exception 'User % not found.', p_email
      using errcode = 'P0002';
  end if;
end;
$$;

-- Delete a user approval row. Only admins may call this.
create or replace function public.admin_delete_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin privileges required.'
      using errcode = '42501';
  end if;

  if lower(p_email) = lower(auth.jwt() ->> 'email') then
    raise exception 'You cannot delete your own admin account.'
      using errcode = '42501';
  end if;

  delete from public.user_approvals
  where lower(email) = lower(p_email);

  if not found then
    raise exception 'User % not found.', p_email
      using errcode = 'P0002';
  end if;
end;
$$;

-- One-time admin bootstrap: claim admin status for the given email.
-- Succeeds only if NO admin currently exists (first-run claim). This is callable
-- by any authenticated user, so the real admin MUST claim first after deploy.
-- Subsequent admins must be granted by an existing admin via direct DB access.
create or replace function public.claim_first_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
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
