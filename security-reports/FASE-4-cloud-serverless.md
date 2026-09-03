# Security Report — Fase 4: Cloud & Serverless

**Project**: Nunnn Stock Analyzer · **Date**: 2026-09-03
**Skills**: 41 (serverless function review), 42 (serverless hardening), 43 (CSPM / Supabase config)

---

## Skill 41 — Serverless Function Security Review

**Route handlers** (Vercel serverless): `/api/keepalive`, `/api/ticker`, `/api/dividend`, `/api/news`, `/api/news/summary`, `/api/market-summary`, `/api/analysis/{fundamentals,news,technical}`.

| Risk | Detail | Severity |
|------|--------|----------|
| **Unbounded input** | `symbol`/`q`/`title`/`link` tanpa length limit. `title` di POST summary bisa panjang tak terbatas → memory. `link` → SSRF (F2-14). | **HIGH** |
| **No authz** | Hanya proxy gate (F1-03). keepalive + semua API publik. | **HIGH** |
| **SSRF via fetch** | `fetchArticleText(arbitrary link)` (F2-14) | **HIGH** |
| **Secret di runtime env** | GEMINI/GROQ/OPENAI key di `process.env` (server-only) ✅ tapi no rotation (F3-07) | MEDIUM |
| **Timeout abuse** | `AbortSignal.timeout(6000)` ada di fetchArticleText ✅. Tapi route handler sendiri tidak set maxDuration — Vercel default 10s (hobby). OK. | LOW |
| **Error info leak** | `keepalive/route.ts:27` return `error.message` ke client → leak DB error detail. `console.error` log ok. | LOW |
| **No runtime env leak** | Tidak ada `NEXT_PUBLIC_` untuk server key ✅ | INFO |

**F4-01 (LOW)**: `keepalive/route.ts:27` ekspos `error.message` Supabase ke response → info disclosure ( tabel ada/RLS). Remediasi: return generic message, log detail server-side.

**F4-02 (MEDIUM)**: Tidak ada `maxDuration` / `memory` config di `vercel.json` atau route segment config. Vercel default OK untuk hobby, tapi AI endpoint (Gemini/Groq) bisa lambat → timeout 504. Remediasi: set `export const maxDuration = 30` di route AI + vercel.json function config.

---

## Skill 42 — Serverless Hardening

**`vercel.json` saat ini** hanya `crons`. Tidak ada `functions` config (memory, maxDuration), tidak ada `regions`, tidak ada `headers`, tidak ada `cleanUrls`.

**F4-03 (MEDIUM)**: Rekomendasi `vercel.json` hardening (lihat `security-reports/recommended-vercel.json`):
- Set `maxDuration` per function (AI: 30s, lain: 10s)
- `regions`: pilih region terdekat (sin1 / hnd1 untuk Indonesia)
- `headers`: security headers global (backup next.config.ts)
- `crons`: sudah ada ✅
- `function` memory: 1024MB untuk AI route

**F4-04 (LOW)**: Edge vs Node runtime — `proxy.ts` default Node runtime (Next 16 default). Untuk auth gate cepat di CDN, pertimbangkan Edge runtime. Tapi Next 16 docs: proxy default Node, `runtime` config throw error di proxy. Ikuti default.

---

## Skill 43 — Cloud Security Posture Management (Supabase)

Audit konfigurasi Supabase (berbasis migration SQL + env, bukan akses dashboard langsung — butuh `supabase` CLI / dashboard untuk verifikasi penuh):

| Control | Status | Evidence |
|---------|--------|----------|
| RLS enable semua table | ✅ | 5 migration: avg_down_plans, portfolio_holdings, portfolio_cash, compounding_plans, ipo_plans, user_approvals semua `enable row level security` |
| RLS policy quality | ⚠️ | user_approvals INSERT too permissive (F3-01); lainnya solid |
| service_role key usage | ✅ | tidak ada di code (hanya anon key) |
| Public schema exposure | ⚠️ | semua table di `public` schema (default Supabase). RLS protect, tapi schema terlihat via REST. OK jika RLS on. |
| Storage bucket | ? | tidak ada migration storage. Cek dashboard: bucket private vs public. |
| Auth provider | ✅ | Google OAuth (di .env.local) |
| Network restriction | ? | Supabase free tier: tidak ada IP allowlist. Anon key publik → andal RLS. |

**F4-05 (HIGH, dup F3-01)**: user_approvals RLS permissive → privilege escalation. Fix paling prioritas.

**F4-06 (MEDIUM)**: Tidak verifikasi apakah ada table/view lain di Supabase yang belum di-migrate (RLS off). Rekomendasi: jalankan `supabase db dump` + query `pg_tables` untuk list table & `relrowsecurity` flag. Pastikan 100% table RLS-on.

**F4-07 (LOW)**: Storage bucket tidak diaudit (tidak ada migration). Cek Supabase dashboard: bucket harus private jika simpan data user; RLS policy pada `storage.objects`.

---

## Fase 4 Findings Matriks

| # | Skill | Severity | Finding |
|---|-------|----------|---------|
| F4-05 | 43 | HIGH | user_approvals RLS permissive (dup F3-01) |
| F4-03 | 42 | MEDIUM | No vercel.json function hardening |
| F4-02 | 41 | MEDIUM | No maxDuration on AI routes |
| F4-06 | 43 | MEDIUM | Unverified other tables RLS status |
| F4-07 | 43 | LOW | Storage bucket not audited |
| F4-01 | 41 | LOW | keepalive error.message leak |
| F4-04 | 42 | LOW | Edge runtime consideration |

Files: `security-reports/recommended-vercel.json`
