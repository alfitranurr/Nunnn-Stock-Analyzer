-- Riwayat transaksi portofolio (beli/jual) dan realized P/L (tab "Riwayat & Realized" di halaman Portofolio).
-- Baris beli dicatat saat menambah/beli lagi saham; baris jual dicatat dari tombol Jual beserta
-- harga rata-rata saat dijual dan untung/rugi bersih setelah fee jual.
-- Idempotent: aman dijalankan ulang.

create table if not exists public.portfolio_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker varchar(10) not null,
  side text not null check (side in ('buy', 'sell')),
  lot integer not null check (lot > 0),
  price numeric not null check (price > 0),
  -- Fee transaksi (%) yang dipakai menghitung hasil bersih; null bila tidak dicatat (beli).
  fee_pct numeric check (fee_pct is null or (fee_pct >= 0 and fee_pct <= 10)),
  -- Harga rata-rata posisi sesaat sebelum dijual (hanya jual).
  avg_cost numeric check (avg_cost is null or avg_cost >= 0),
  -- Untung/rugi bersih = hasil jual setelah fee − modal (lot × 100 × avg_cost); hanya jual.
  realized_pl numeric,
  traded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists portfolio_transactions_user_time_idx
  on public.portfolio_transactions (user_id, traded_at desc);

alter table public.portfolio_transactions enable row level security;

drop policy if exists "Users can view their own transactions." on public.portfolio_transactions;
create policy "Users can view their own transactions." on public.portfolio_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own transactions." on public.portfolio_transactions;
create policy "Users can insert their own transactions." on public.portfolio_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own transactions." on public.portfolio_transactions;
create policy "Users can delete their own transactions." on public.portfolio_transactions
  for delete using (auth.uid() = user_id);
