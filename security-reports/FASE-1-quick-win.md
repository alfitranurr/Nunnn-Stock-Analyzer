# Security Report — Fase 1: Quick Win

**Project**: Nunnn Stock Analyzer (Next.js 16.2.6 + React 19 + Supabase + Vercel)
**Date**: 2026-09-03
**Skills executed**: 7 (DevSecOps pipeline), 8 (Gitleaks secret scan), 2 (malicious npm), 3 (SCA/Snyk via npm audit), 22 (security headers), 21 (sensitive data exposure)

---

## Tools availability

| Tool | Status | Impact |
|------|--------|--------|
| node / npm | installed | npm audit run |
| python / docker | installed | available for guarddog/trivy via container |
| gitleaks, semgrep, trivy, snyk, guarddog, confused, osv-scanner, ZAP, Burp, Postman, jwt_tool, testssl, supabase CLI | NOT installed |

Konfigurasi workflow dibuat siap pakai; tool diinstall sesuai prasyarat `SECURITY_PROMPTS.md` untuk eksekusi penuh.

---

## Skill 7 — DevSecOps CI/CD Pipeline (created)

Files created:
- `.github/workflows/security.yml` — Gitleaks (secret) + Semgrep (SAST: p/owasp-top-ten, p/nextjs, p/typescript) + Trivy (SCA fs + config + SBOM CycloneDX) + OWASP ZAP baseline (DAST ke `vars.STAGING_URL`, nightly) + security-gate job. SARIF upload ke GitHub code scanning.
- `.pre-commit-config.yaml` — Gitleaks + Semgrep pre-commit hooks.
- `.zap/rules.tsv` — FAIL untuk XSS, SQLi, CSP missing, clickjacking, RCE, CSRF.
- `.gitleaks.toml` — custom rules untuk Supabase anon key/JWT, Supabase URL, Google OAuth secret (GOCSPX-), Gemini (AIza), Groq (gsk_), NEXT_PUBLIC env.

**Action items (manual)**:
1. Install tools: `npm i -g snyk supabase`; `pip install pre-commit semgrep guarddog`; install gitleaks/trivy/ZAP dari prasyarat.
2. `pre-commit install && pre-commit run --all-files`
3. Set GitHub repo variable `STAGING_URL` ke Vercel preview URL.
4. Branch protection: require status checks (Secrets Detection, SAST, SCA, Security Gate) sebelum merge ke main.

---

## Skill 8 — Secret Scanning (Gitleaks)

**Git history scan** (manual via git pickaxe `-S` untuk nilai secret GOCSPX-, gsk_lsXV, AIza, project ref `xpmpqimgurizoetsqxyj`): **0 temuan** — secret tidak pernah ter-commit.

**`.env.local` status**: tidak di-track git (gitignored via `.env*` di `.gitignore:34`). ✅

**Tracked-files secret scan** (grep GOCSPX-, gsk_, AIza, eyJhbGci, supabase.co, service_role): hanya `placeholder.supabase.co` (safe placeholder di `src/lib/supabase.ts:33` & `src/proxy.ts:22`) dan contoh README `your-project-id.supabase.co`. ✅ Tidak ada secret asli di repo.

**Peringatan — secret di `.env.local`** (lokal, bukan di repo, tapi tetap risiko jika laptop/CI ter-compromise):
- `GOOGLE_CLIENT_SECRET=GOCSPX-...` — OAuth client secret
- `GEMINI_API_KEY=AQ.Ab8R...` — Gemini API key
- `GROQ_API_KEY=gsk_lsXV...` — Groq API key

Rekomendasi: rotasi ketiga key ini jika pernah ter-expose; simpan di Vercel env (server-only, bukan NEXT_PUBLIC); tambahkan ke `.gitleaks.toml` (sudah dibuat) untuk cegah commit di masa depan.

---

## Skill 2 — Malicious npm packages (GuardDog)

**Install-script scan** (node script parse `package-lock.json` v3, 457 packages): **0 package dengan `install`/`preinstall`/`postinstall` scripts**. ✅ Tidak ada vektor trojanized-package via lifecycle scripts.

Cross-check OSV manual via `npm audit` (lihat Skill 3). GuardDog heuristik (typosquatting, obfuscation, exec-base64, serialize-environment, shady-links) butuh `guarddog` terinstall untuk triage penuh — jalankan `guarddog npm verify package-lock.json` setelah install.

---

## Skill 3 — SCA / Dependency Scanning (npm audit)

**Hasil**: 8 vulnerabilities **HIGH**, 0 critical/moderate/low di direct + transitive deps.

| Package | Severity | Advisory | Fix |
|---------|----------|----------|-----|
| **next** (16.2.6, direct) | **HIGH** | **GHSA-6gpp-xcg3-4w24** Middleware/Proxy bypass (CWE-285); **GHSA-m99w-x7hq-7vfj** DoS Server Actions; **GHSA-89xv-2m56-2m9x** SSRF Server Actions custom server; **GHSA-p9j2-gv94-2wf4** SSRF rewrites; GHSA-955p-x3mx-jcvp unauth disclosure Server Function endpoints; +3 cache/DoS | **upgrade next@16.3.4** |
| **xlsx** (0.18.5, direct) | **HIGH** | **GHSA-...** Prototype Pollution (SheetJS) — `xlsx` deprecated, no fix di npm | ganti ke `xlsx` v0.20.x (cdn) atau `@e965/xlsx` community fork; sanitize input |
| brace-expansion | HIGH | DoS exponential | via `npm audit fix` |
| browserslist | HIGH | Unbounded memory growth | via `npm audit fix` |
| js-yaml | HIGH | Quadratic DoS merge key | via `npm audit fix` |
| nanoid | HIGH | non-secure generator loop | via `npm audit fix` |
| postcss | HIGH | XSS unescaped `</style>` | via next upgrade |
| sharp | HIGH | libvips CVE | via next upgrade |

**Remediation prioritas**:
1. `npm install next@16.3.4` — fix 9 advisory Next.js (termasuk **proxy bypass** yang langsung mempengaruhi auth gate `src/proxy.ts`).
2. `npm audit fix` untuk transitive deps.
3. Ganti `xlsx` — prototype pollution pada library parse upload user. Patch: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` atau validasi/limit struktur workbook sebelum parse.

Full JSON: `security-reports/npm-audit.json`.

---

## Skill 22 — Security Headers Audit

**`next.config.ts`**: TIDAK ada `headers()` config. **Tidak ada CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy** di semua route.

| Header | Status | Rekomendasi |
|--------|--------|-------------|
| Content-Security-Policy | ❌ MISSING | Set di `next.config.ts` headers() |
| Strict-Transport-Security | ❌ MISSING | Vercel set HSTS otomatis di domain managed, tapi custom domain perlu eksplisit |
| X-Content-Type-Options | ❌ MISSING | `nosniff` |
| X-Frame-Options / frame-ancestors | ❌ MISSING | `DENY` (atau via CSP frame-ancestors 'none') |
| Referrer-Policy | ❌ MISSING | `strict-origin-when-cross-origin` |
| Permissions-Policy | ❌ MISSING | disable camera, microphone, geolocation |

**Rekomendasi konfigurasi `next.config.ts`** (lihat file `security-reports/recommended-next-config.ts`).

---

## Skill 21 — Sensitive Data Exposure

**Server-only keys** (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`): hanya diakses di route handlers (`src/app/api/news/summary/route.ts:221-223`, `src/app/api/analysis/news/route.ts:408-410`) — **server-side, TIDAK ter-bundle ke client**. ✅ Tidak ada `NEXT_PUBLIC_` prefix → tidak ekspos ke browser.

**Public env** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`): sengaja public (anon key aman dengan RLS). ✅ Sesuai desain Supabase.

**Build output scan `.next/`**: butuh `npm run build` + grep; rekomendasi jalankan `grep -r "gsk_\|GOCSPX-\|AIza" .next/` setelah build untuk konfirmasi tidak ada leak server key ke bundle.

**Cache-Control**: API route sensitif (`/api/news/summary`, `/api/analysis/*`) tidak set `Cache-Control: no-store` — risiko cache di CDN/intermediate. Rekomendasi: set `Cache-Control: no-store` di response header route handler.

---

## CRITICAL FINDING (lintas skill 3 + 19 + 31)

**Broken function-level authorization pada AI endpoints**:
- `src/proxy.ts` adalah satu-satunya auth gate untuk `/api/news/summary` & `/api/analysis/:path*` — hanya cek **keberadaan cookie** `sb-*-auth-token`, TIDAK validasi JWT (`proxy.ts:25-30`).
- Route handlers `/api/news/summary`, `/api/analysis/news`, `/api/analysis/fundamentals`, `/api/analysis/technical` **TIDAK memanggil `supabase.auth.getUser()`** — tidak ada verifikasi JWT server-side.
- CVE **GHSA-6gpp-xcg3-4w24** (Next.js ≤16.2.10) memungkinkan **proxy/middleware bypass** → attacker anonymous bisa langsung hit AI endpoint & burn kuota Gemini/Groq.
- Bahkan tanpa CVE, cookie presence check bisa di-bypass dengan cookie palsu (nilai sembarang `sb-xxx-auth-token=anything`).

**Remediasi**:
1. `npm install next@16.3.4` (fix proxy bypass).
2. Tambahkan validasi JWT server-side di setiap route handler:
   ```ts
   import { supabase } from '@/lib/supabase';
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   ```
3. Implement rate limiting per-user (lihat skill 34).

---

## Fase 1 Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| F1-01 | HIGH | Next.js 16.2.6 proxy bypass + 8 advisory lain | remediasi: upgrade 16.3.4 |
| F1-02 | HIGH | xlsx prototype pollution (direct dep, upload user) | remediasi: ganti library |
| F1-03 | HIGH | Broken authz AI endpoints (no JWT validation, cookie-only gate) | remediasi: add getUser() |
| F1-04 | MEDIUM | 6 transitive high vuln (DoS-type) | remediasi: npm audit fix |
| F1-05 | MEDIUM | No security headers (CSP, HSTS, X-Frame, dst) | remediasi: add headers() |
| F1-06 | LOW | No Cache-Control no-store on sensitive API | remediasi: set header |
| F1-07 | INFO | 0 install-scripts / 0 secret di git history | ✅ good |
| F1-08 | INFO | Server keys server-side only, not in client bundle | ✅ good |

Files created: `.github/workflows/security.yml`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `.zap/rules.tsv`, `security-reports/npm-audit.json`, `security-reports/recommended-next-config.ts`.
