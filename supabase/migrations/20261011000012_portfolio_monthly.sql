-- Jurnal performa bulanan portofolio (tab "Target & Performa" di halaman Portofolio).
-- Satu baris per pengguna per bulan: modal awal, total akhir (nilai portofolio terakhir yang tercatat
-- di bulan itu), dan setoran/penarikan bersih agar untung tidak tercampur dana baru.
-- Idempotent: aman dijalankan ulang.

create table if not exists public.portfolio_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  start_value numeric not null check (start_value >= 0),
  end_value numeric not null check (end_value >= 0),
  -- Positif = setoran dana baru, negatif = penarikan.
  net_flow numeric not null default 0,
  first_recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.portfolio_monthly enable row level security;

drop policy if exists "Users can view their own monthly performance." on public.portfolio_monthly;
create policy "Users can view their own monthly performance." on public.portfolio_monthly
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own monthly performance." on public.portfolio_monthly;
create policy "Users can insert their own monthly performance." on public.portfolio_monthly
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own monthly performance." on public.portfolio_monthly;
create policy "Users can update their own monthly performance." on public.portfolio_monthly
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own monthly performance." on public.portfolio_monthly;
create policy "Users can delete their own monthly performance." on public.portfolio_monthly
  for delete using (auth.uid() = user_id);
