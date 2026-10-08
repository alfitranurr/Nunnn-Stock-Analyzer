-- =============================================================================
-- Perbaikan skema untuk database yang tertinggal migrasi (mis. produksi per 8 Okt 2026):
-- tabel user_approvals versi lama hanya berisi id, email, approved, created_at,
-- sehingga migrasi 000004 tidak bisa dijalankan ulang (CREATE TABLE IF NOT EXISTS
-- dilewati, fungsi is_admin() gagal dibuat, CREATE POLICY bentrok).
--
-- File ini IDEMPOTENT: aman dijalankan berkali-kali, juga di database yang sudah lengkap.
-- Isinya setara dengan migrasi 000004–000008. Jalankan seluruh isi file sekaligus di
-- Supabase Dashboard → SQL Editor.
--
-- Setelah dijalankan: login dengan email admin (NEXT_PUBLIC_ADMIN_EMAIL). Aplikasi otomatis
-- memanggil claim_first_admin() untuk menjadikan akun itu admin pertama. Lakukan segera,
-- karena klaim admin pertama berlaku untuk pengguna login mana pun yang lebih dulu memanggilnya.
-- =============================================================================

begin;

-- ─── 1. user_approvals: tabel & kolom yang hilang (000004) ───
create table if not exists public.user_approvals (
  id uuid default gen_random_uuid() primary key,
  email varchar(255) unique not null,
  approved boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.user_approvals add column if not exists is_admin boolean not null default false;
alter table public.user_approvals add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.user_approvals add column if not exists updated_at timestamptz not null default now();

-- ON CONFLICT (email) di claim_first_admin membutuhkan indeks unik pada kolom email.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'public.user_approvals'::regclass
      and i.indisunique
      and i.indnatts = 1
      and a.attname = 'email'
  ) then
    create unique index user_approvals_email_unique on public.user_approvals (email);
  end if;
end $$;

create index if not exists user_approvals_email_idx on public.user_approvals (lower(email));

alter table public.user_approvals enable row level security;

-- ─── 2. Fungsi (000004, 000005, 000006) ───
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

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.admin_set_user_approval(p_email text, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin privileges required.' using errcode = '42501';
  end if;
  if lower(p_email) = lower(auth.jwt() ->> 'email') then
    raise exception 'You cannot change your own approval status via this RPC.' using errcode = '42501';
  end if;
  update public.user_approvals
  set approved = p_approved, approved_by = auth.uid()
  where lower(email) = lower(p_email);
  if not found then
    raise exception 'User % not found.', p_email using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin privileges required.' using errcode = '42501';
  end if;
  if lower(p_email) = lower(auth.jwt() ->> 'email') then
    raise exception 'You cannot delete your own admin account.' using errcode = '42501';
  end if;
  delete from public.user_approvals where lower(email) = lower(p_email);
  if not found then
    raise exception 'User % not found.', p_email using errcode = 'P0002';
  end if;
end;
$$;

-- Versi yang diperkuat (lihat 000010): menolak pemanggil tanpa login dan tidak terpengaruh trigger force_pending.
create or replace function public.claim_first_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  admin_count integer;
begin
  if auth.uid() is null or caller_email = '' then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if lower(p_email) <> caller_email then
    raise exception 'You can only claim admin for your own email.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim_first_admin'));
  select count(*) into admin_count from public.user_approvals where is_admin = true;
  if admin_count > 0 then
    raise exception 'An admin already exists. Ask an existing admin to grant you access.' using errcode = '42501';
  end if;

  -- Sisipkan bila belum ada, lalu promosikan lewat UPDATE (trigger insert tidak berlaku untuk UPDATE).
  if not exists (select 1 from public.user_approvals where lower(email) = caller_email) then
    insert into public.user_approvals (email, approved, is_admin) values (caller_email, false, false);
  end if;

  update public.user_approvals
  set approved = true, is_admin = true, approved_by = auth.uid()
  where lower(email) = caller_email;
end;
$$;

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

-- Fungsi admin hanya untuk pengguna yang login (anon tidak perlu memanggilnya sama sekali).
revoke execute on function public.claim_first_admin(text) from public, anon;
revoke execute on function public.admin_set_user_approval(text, boolean) from public, anon;
revoke execute on function public.admin_delete_user(text) from public, anon;
grant execute on function public.claim_first_admin(text) to authenticated;
grant execute on function public.admin_set_user_approval(text, boolean) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;

-- ─── 3. Trigger ───
drop trigger if exists user_approvals_set_updated_at on public.user_approvals;
create trigger user_approvals_set_updated_at
  before update on public.user_approvals
  for each row execute function public.handle_updated_at();

drop trigger if exists user_approvals_force_pending on public.user_approvals;
create trigger user_approvals_force_pending
  before insert on public.user_approvals
  for each row execute function public.force_pending_on_nonadmin_insert();

-- ─── 4. Policy user_approvals: hapus semua policy lama (nama apa pun), buat ulang yang benar ───
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_approvals' loop
    execute format('drop policy %I on public.user_approvals', p.policyname);
  end loop;
end $$;

create policy "Users can view their own approval status."
  on public.user_approvals
  for select using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

create policy "Users can insert own approval row (pending only)."
  on public.user_approvals
  for insert with check (
    lower(email) = lower(auth.jwt() ->> 'email')
    and approved = false
    and is_admin = false
  );
-- UPDATE / DELETE sengaja tanpa policy: hanya lewat RPC admin di atas.

-- ─── 5. user_watchlists (000007) ───
create table if not exists public.user_watchlists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 20),
  updated_at timestamptz default now() not null
);

alter table public.user_watchlists enable row level security;

drop policy if exists "Users can view their own watchlist." on public.user_watchlists;
drop policy if exists "Users can insert their own watchlist." on public.user_watchlists;
drop policy if exists "Users can update their own watchlist." on public.user_watchlists;
drop policy if exists "Users can delete their own watchlist." on public.user_watchlists;

create policy "Users can view their own watchlist." on public.user_watchlists
  for select using (auth.uid() = user_id);
create policy "Users can insert their own watchlist." on public.user_watchlists
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own watchlist." on public.user_watchlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own watchlist." on public.user_watchlists
  for delete using (auth.uid() = user_id);

-- ─── 6. ipo_plans: kolom simulasi E-IPO (000008) ───
alter table public.ipo_plans
  add column if not exists retail_demand_pct numeric check (retail_demand_pct >= 0 and retail_demand_pct <= 100),
  add column if not exists queue_pct numeric check (queue_pct >= 0 and queue_pct <= 100);
alter table public.ipo_plans drop constraint if exists ipo_plans_oversubscription_check;
alter table public.ipo_plans add constraint ipo_plans_oversubscription_check check (oversubscription >= 0);

commit;

-- Muat ulang cache skema PostgREST agar kolom/fungsi baru langsung terlihat oleh API.
notify pgrst, 'reload schema';
