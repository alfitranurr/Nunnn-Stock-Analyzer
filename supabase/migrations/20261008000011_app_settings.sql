-- Pengaturan aplikasi yang dibaca semua pengunjung tetapi hanya bisa diubah admin.
-- Dipakai untuk jumlah emiten resmi BEI (situs BEI memblokir akses otomatis, jadi angkanya diisi admin).
-- Idempotent: aman dijalankan ulang.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_settings enable row level security;

-- Baca: semua orang (angka publik, tidak sensitif). Tulis: tidak ada policy, hanya lewat RPC di bawah.
drop policy if exists "app_settings readable by everyone" on public.app_settings;
create policy "app_settings readable by everyone"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create or replace function public.admin_set_app_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah pengaturan.' using errcode = '42501';
  end if;
  if p_key not in ('idx_listed_official') then
    raise exception 'Pengaturan tidak dikenal: %', p_key using errcode = '22023';
  end if;
  if jsonb_typeof(p_value) <> 'object' then
    raise exception 'Nilai harus berupa objek JSON.' using errcode = '22023';
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.jwt() ->> 'email')
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.admin_set_app_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_app_setting(text, jsonb) to authenticated;
