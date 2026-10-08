-- =============================================================================
-- Perkuat claim_first_admin() dan fungsi admin. Idempotent; jalankan di SQL Editor.
--
-- Masalah yang ditemukan (8 Okt 2026, setelah migrasi 000009):
-- 1. Pemanggil ANONIM bisa memanggil claim_first_admin(email apa pun) selama belum ada admin.
--    Pengecekan `lower(p_email) <> lower(auth.jwt() ->> 'email')` bernilai NULL (bukan TRUE)
--    bila tidak ada JWT, jadi tidak pernah menolak. Akibatnya baris baru bisa disisipkan
--    untuk email sembarang. (Trigger force_pending kebetulan membuatnya tetap "menunggu".)
-- 2. Jalur INSERT di claim_first_admin ikut dipaksa pending oleh trigger
--    force_pending_on_nonadmin_insert, sehingga admin pertama yang belum punya baris
--    tidak pernah benar-benar menjadi admin (temuan audit M-16).
-- 3. Saat pemeriksaan skema, dua baris uji sempat tersisip lewat celah no. 1.
-- =============================================================================

begin;

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

-- Fungsi admin hanya untuk pengguna yang login (anon tidak perlu memanggilnya sama sekali).
revoke execute on function public.claim_first_admin(text) from public, anon;
revoke execute on function public.admin_set_user_approval(text, boolean) from public, anon;
revoke execute on function public.admin_delete_user(text) from public, anon;
grant execute on function public.claim_first_admin(text) to authenticated;
grant execute on function public.admin_set_user_approval(text, boolean) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;

-- Bersihkan baris uji yang sempat tersisip (hanya bila bukan admin).
delete from public.user_approvals
where email in ('probe@invalid.local', 'probe2@invalid.local')
  and is_admin = false;

commit;

notify pgrst, 'reload schema';
