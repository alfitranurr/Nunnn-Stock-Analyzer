-- Berita tersimpan per pengguna (tombol Simpan di halaman Berita & Sentimen).
-- Satu baris per user; daftar berita disimpan berurutan (terbaru di depan) sebagai JSON, maks 200.
-- Idempotent: aman dijalankan ulang.

create table if not exists public.user_saved_news (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  updated_at timestamptz default now() not null
);

alter table public.user_saved_news enable row level security;

drop policy if exists "Users can view their own saved news." on public.user_saved_news;
create policy "Users can view their own saved news." on public.user_saved_news
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved news." on public.user_saved_news;
create policy "Users can insert their own saved news." on public.user_saved_news
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved news." on public.user_saved_news;
create policy "Users can update their own saved news." on public.user_saved_news
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved news." on public.user_saved_news;
create policy "Users can delete their own saved news." on public.user_saved_news
  for delete using (auth.uid() = user_id);
