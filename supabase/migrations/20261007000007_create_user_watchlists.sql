-- Watchlist per pengguna (satu baris per user, daftar saham disimpan berurutan sebagai JSON)

create table if not exists public.user_watchlists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 20),
  updated_at timestamptz default now() not null
);

alter table public.user_watchlists enable row level security;

create policy "Users can view their own watchlist." on public.user_watchlists
  for select using (auth.uid() = user_id);

create policy "Users can insert their own watchlist." on public.user_watchlists
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own watchlist." on public.user_watchlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own watchlist." on public.user_watchlists
  for delete using (auth.uid() = user_id);
