-- Simulasi E-IPO versi SEOJK 25/SEOJK.04/2025: simpan juga porsi pesanan ritel dan posisi antrean.
-- Kolom boleh null agar baris lama tetap valid; aplikasi memakai nilai default bila kosong.

alter table public.ipo_plans
  add column if not exists retail_demand_pct numeric check (retail_demand_pct >= 0 and retail_demand_pct <= 100),
  add column if not exists queue_pct numeric check (queue_pct >= 0 and queue_pct <= 100);

-- Tingkat pesanan penjatahan terpusat bisa di bawah 1× (undersubscribed).
alter table public.ipo_plans drop constraint if exists ipo_plans_oversubscription_check;
alter table public.ipo_plans add constraint ipo_plans_oversubscription_check check (oversubscription >= 0);
