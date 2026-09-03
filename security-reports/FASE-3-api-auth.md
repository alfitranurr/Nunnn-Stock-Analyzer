# Security Report — Fase 3: API & Auth Security

**Project**: Nunnn Stock Analyzer · **Date**: 2026-09-03
**Skills**: 30 (OWASP API Top 10), 31 (API auth), 32 (BOLA), 33 (mass assignment), 34 (rate limiting), 35 (API key), 36 (Postman), 37 (JWT), 39 (OAuth2), 40 (TLS)

---

## ⚠️ CRITICAL — Skill 33 Mass Assignment / Privilege Escalation

**F3-01 (CRITICAL)**: `user_approvals` INSERT RLS policy tidak membatasi kolom `approved`/`is_admin`.

Policy (`supabase/migrations/20260614000004_create_user_approvals.sql:47-51`):
```sql
create policy "Users can insert their own approval row."
  on public.user_approvals
  for insert with check ( lower(email) = lower(auth.jwt() ->> 'email') );
```
`WITH CHECK` hanya validasi `email` cocok JWT — **tidak** mencegah set `approved=true` atau `is_admin=true`.

**Exploit** (anonymous, pakai anon key publik + JWT user sendiri):
```http
POST https://xpmpqimgurizoetsqxyj.supabase.co/rest/v1/user_approvals
Authorization: Bearer <user_jwt>
apikey: <anon_key>
Content-Type: application/json

{ "email": "attacker@email.com", "approved": true, "is_admin": true }
```
→ RLS pass (email match) → **attacker self-approve + self-grant admin**. Sistem approval & admin bootstrap (`claim_first_admin`) **sepenuhnya di-bypass**. Bahkan tanpa `is_admin`, `approved:true` saja sudah bypass gate approval.

Client code (`auth-modal.tsx:106`, `page.tsx:262,280`) tidak set `is_admin` di insert, tapi attacker bisa langsung pakai REST API.

**Remediasi** (SQL, lihat `security-reports/fix-user-approvals-rls.sql`):
```sql
drop policy "Users can insert their own approval row." on public.user_approvals;
create policy "Users can insert own approval row (pending only)."
  on public.user_approvals for insert
  with check (
    lower(email) = lower(auth.jwt() ->> 'email')
    and approved = false
    and is_admin = false
  );
-- tambah trigger force pending pada insert non-admin
```

---

## Skill 31 — API Authentication Weaknesses

**F3-02 (HIGH, dup F1-03)**: Route handlers `/api/news/summary`, `/api/analysis/*` tidak panggil `supabase.auth.getUser()`. Auth hanya proxy gate (cookie presence, bypassable + CVE GHSA-6gpp-xcg3-4w24). Anonymous bisa hit AI endpoint.

**F3-03 (MEDIUM)**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` publik di bundle (by design) + `NEXT_PUBLIC_SUPABASE_URL` → siapa pun bisa akses Supabase REST direct. Proteksi hanya RLS. Kombinasi dengan F3-01 = privilege escalation. Pastikan semua table RLS enabled (sudah ✅) dan tidak ada table `public` tanpa RLS.

**F3-04 (LOW)**: `/api/keepalive` (`route.ts:20`) query `user_approvals` tanpa auth check — endpoint publik (cron). Tidak ekspos data sensitif (count only?). Verifikasi response tidak leak email/row.

---

## Skill 32 — BOLA / IDOR

**F3-05 (INFO/SAFE)**: RLS `auth.uid() = user_id` solid di avg_down_plans, portfolio_holdings, portfolio_cash, compounding_plans, ipo_plans. BOLA via Supabase REST di-block. ✅
Satu-satunya BOLA vector = F3-01 (user_approvals self-grant).

---

## Skill 34 — Rate Limiting & Throttling

**F3-06 (HIGH)**: **Tidak ada rate limiting** di route handler manapun. AI endpoint (`/api/news/summary`, `/api/analysis/*`) compute/cost-heavy (Gemini/Groq call). Kombinasi F1-03 (no auth) + no rate limit → anonymous attacker burn kuota AI tak terbatas.

**Remediasi**: implement Upstash Ratelimit via Vercel Edge middleware (lihat `security-reports/rate-limit-example.ts`):
- `/api/news/summary`, `/api/analysis/*`: 10 req/jam per-user (atau per-IP untuk anon)
- `/api/ticker`: 60 req/menit per-IP
- Semua API: global IP-based 100 req/menit

---

## Skill 35 — API Key Security

**F3-07 (MEDIUM)**: `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` di Vercel env (server-only) — tidak ter-expose ke client ✅. Tapi: tidak ada rotation, scoping, per-key rate limit, logging, atau revocation. Jika key leak (mis. log error ekspos), tidak ada mekanisme revoke cepat.

**Remediasi**: 
- Buat key terpisah per environment (dev/staging/prod).
- Set quota/usage limit di Google AI Studio / Groq console.
- Rotate periodik. Monitor usage via provider dashboard.
- Tambah error handler yang tidak log full key (redact).

---

## Skill 37 — JWT Vulnerabilities

**F3-08 (INFO)**: JWT dikelola Supabase Auth (HS256 signed server-side dengan secret Supabase). Anon key adalah JWT tapi **public** (role:anon, exp 2036) — by design, aman selama RLS aktif. Tidak ada custom JWT verification di app (jadi alg-confusion/none-alg TIDAK applicable — app tidak verify JWT sendiri). Setelah F1-03 fix (add `getUser()`), Supabase SDK yang verify. ✅ Tidak ada vektor alg-confusion.

Catatan: `jwt_tool`/`jwt_tool` belum terinstall — brute-force secret Supabase tidak feasible (secret dikelola Supabase, bukan app).

---

## Skill 39 — OAuth2 Implementation

**F3-09 (INFO, butuh runtime)**: Google OAuth via Supabase (managed). `GOOGLE_CLIENT_SECRET` di `.env.local` (local-only). Flow state/PKCE/redirect dikelola Supabase Auth — tidak ada custom callback handler di app. Tidak bisa test tanpa jalankan flow runtime. Rekomendasi: test dengan Burp setelah deploy — verifikasi `state`, `redirect_uri` lock-down, PKCE.

---

## Skill 40 — SSL/TLS Assessment

**F3-10 (INFO, butuh URL)**: TLS dikelola Vercel (auto Let's Encrypt, HSTS). Tidak bisa assess tanpa domain + `testssl.sh`. Vercel default A-grade TLS. Rekomendasi: jalankan `testssl.sh <domain>` + SSL Labs scan setelah deploy; pastikan TLS 1.2+ only, HSTS preload.

---

## Skill 36 — Postman Collection

Skeleton collection dibuat di `security-reports/postman-collection.json` (semua endpoint + test script: auth, BOLA, mass-assignment, rate-limit). Import ke Postman, set env `base_url` + `anon_key` + `user_jwt`. Jalankan dengan Newman di CI:
```
newman run postman-collection.json -e postman-env.json --reporters cli,junit
```

---

## Fase 3 Findings Matriks

| # | Skill | Severity | Finding |
|---|-------|----------|---------|
| F3-01 | 33 | **CRITICAL** | Mass assignment: insert `is_admin:true`/`approved:true` bypass RLS |
| F3-02 | 31 | HIGH | No JWT validation API (dup F1-03) |
| F3-06 | 34 | HIGH | No rate limiting on AI endpoints |
| F3-07 | 35 | MEDIUM | No API key rotation/scoping/monitoring |
| F3-03 | 31 | MEDIUM | Anon key + URL public (RLS-dependent) |
| F3-04 | 31 | LOW | keepalive query user_approvals no auth |
| F3-08 | 37 | INFO | JWT managed by Supabase, no alg-confusion |
| F3-09 | 39 | INFO | OAuth2 managed, butuh runtime test |
| F3-10 | 40 | INFO | TLS managed by Vercel, butuh URL test |
| F3-05 | 32 | INFO | RLS solid, BOLA blocked |

Files: `security-reports/fix-user-approvals-rls.sql`, `security-reports/rate-limit-example.ts`, `security-reports/postman-collection.json`
