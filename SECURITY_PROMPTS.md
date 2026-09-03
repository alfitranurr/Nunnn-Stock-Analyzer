# Security Prompts — Nunnn Stock Analyzer

Daftar prompt siap pakai untuk menjalankan skill cybersecurity (dari [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)) ke project ini.

## Konteks Project

- **Stack**: Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS 4
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Dependencies**: npm (`package.json` + `package-lock.json`)
- **Deploy**: Vercel (serverless functions)
- **Env**: `.env.local` berisi Supabase URL & anon/service keys
- **Skills location**: `.opencode/skills/` (46 skill terinstall)

## Cara Pakai

1. Jalankan opencode di repo ini (skill di `.opencode/skills/` auto-load).
2. Copy prompt dari daftar di bawah, paste ke chat.
3. AI akan load skill yang cocok via `skill` tool dan eksekusi workflow.

> **Catatan**: Skill butuh tools eksternal (gitleaks, semgrep, trivy, snyk, guarddog, burpsuite, dll). Install dulu sesuai prerequisite di tiap skill. Jalankan di environment yang Anda own/authorized.

---

## A. Supply Chain & Dependency Security

### 1. detecting-dependency-confusion
**Relevan**: Project pakai npm dengan dependencies publik + potensi private packages.
```
Jalankan skill detecting-dependency-confusion ke project ini. Inventaris semua
manifest npm (package.json, package-lock.json). Jalankan `confused -l npm` untuk
cari dependency yang claimable di public registry. Triage hasil, konfirmasi
claimability via registry API, dan rekomendasikan .npmrc scope-pinning untuk
namespace internal. Laporkan temuan dengan severity & remediasi.
```

### 2. detecting-malicious-npm-packages
**Relevan**: npm install otomatis jalankan lifecycle scripts — risiko trojanized package.
```
Jalankan skill detecting-malicious-npm-packages. Triage semua dependency di
package-lock.json (v3) — ekstrak name@version, scan dengan GuardDog (npm scan &
verify package.json). Fokus heuristik: install-script, serialize-environment,
exec-base64, obfuscation, typosquatting, shady-links. Cross-check lockfile
versus OSV. Laporkan verdict per package (benign/suspicious/malicious) + IOC.
```

### 3. performing-sca-dependency-scanning-with-snyk
**Relevan**: Deteksi CVE di dependencies (next, supabase-js, xlsx, framer-motion).
```
Jalankan skill performing-sca-dependency-scanning-with-snyk. Scan package.json &
package-lock.json dengan Snyk (--severity-threshold=high --fail-on=upgradable).
Identifikasi vulnerable direct & transitive deps, berikan fix version, buat
.snyk policy file untuk ignore yang tidak exploitable. Sertakan license
compliance check.
```

### 4. implementing-infrastructure-as-code-security-scanning
**Relevan**: Scan config Vercel/Next/TS untuk misconfiguration.
```
Jalankan skill implementing-infrastructure-as-code-security-scanning. Scan
next.config.ts, vercel.json, tsconfig.json, postcss.config.mjs, eslint.config.mjs
dengan Trivy config scan & Checkov. Deteksi misconfiguration (exposed env,
permissive CORS, disable security headers). Laporkan temuan + remediasi.
```

### 5. implementing-code-signing-for-artifacts
**Relevan**: Sign build artifact sebelum deploy ke Vercel.
```
Jalankan skill implementing-code-signing-for-artifacts. Rancang workflow
code-signing untuk build Next.js (npm run build output) sebelum deploy Vercel.
Rekomendasikan tool (Sigstore/cosign), integrasi GitHub Actions, dan
verifikasi signature saat deploy. Hasilkan konfigurasi siap pakai.
```

### 6. verifying-build-provenance-with-slsa-sigstore
**Relevan**: Supply-chain integrity build artifact.
```
Jalankan skill verifying-build-provenance-with-slsa-sigstore. Generate SLSA
provenance untuk build Next.js + Vercel. Konfigurasi SLSA provenance generator
di GitHub Actions, attach provenance ke artifact, dan verifikasi sebelum
deploy. Sertakan template workflow.
```

---

## B. DevSecOps / CI-CD / Secret Scanning

### 7. implementing-devsecops-security-scanning
**Relevan**: Setup pipeline security lengkap (SAST+DAST+SCA+secret) di GitHub Actions.
```
Jalankan skill implementing-devsecops-security-scanning. Buat GitHub Actions
workflow (.github/workflows/security.yml) untuk project Next.js ini: Gitleaks
(secret), Semgrep (SAST p/owasp-top-ten + p/nextjs), Trivy (SCA fs + IaC +
container), OWASP ZAP baseline (DAST ke staging Vercel). Sertakan security gate
job, branch protection rules, dan .pre-commit-config.yaml.
```

### 8. implementing-secret-scanning-with-gitleaks
**Relevan**: .env.local berisi Supabase keys — cegah commit & scan history.
```
Jalankan skill implementing-secret-scanning-with-gitleaks. Setup Gitleaks:
pre-commit hook (.pre-commit-config.yaml), GitHub Actions workflow, dan
.gitleaks.toml custom rule untuk Supabase keys (SUPABASE_URL, anon key,
service_role key). Scan full git history, buat baseline .gitleaks-baseline.json,
dan remediasi secret yang ter-expose (rotation + git-filter-repo).
```

### 9. implementing-secrets-scanning-in-ci-cd
**Relevan**: Layer tambahan secret scanning di pipeline.
```
Jalankan skill implementing-secrets-scanning-in-ci-cd. Integrasikan secret
scanning tambahan (TruffleHog dengan verified detection) di CI/CD sebagai
pelengkap Gitleaks. Konfigurasi scan PR diff + full history, SARIF upload ke
GitHub code scanning. Sertakan workflow YAML.
```

### 10. integrating-sast-into-github-actions-pipeline
**Relevan**: SAST khusus Next.js/TS via Semgrep di GitHub Actions.
```
Jalankan skill integrating-sast-into-github-actions-pipeline. Integrasikan
Semgrep SAST ke GitHub Actions untuk repo Next.js+TS ini. Gunakan ruleset
p/nextjs, p/owasp-top-ten, p/typescript. Konfigurasi --error pada PR,
non-blocking pada main, SARIF upload, dan PR annotation. Sertakan custom rule
untuk React 19 dangerous patterns (dangerouslySetInnerHTML).
```

### 11. integrating-dast-with-owasp-zap-in-pipeline
**Relevan**: DAST ke staging Vercel URL.
```
Jalankan skill integrating-dast-with-owasp-zap-in-pipeline. Integrasikan OWASP
ZAP baseline scan ke GitHub Actions, target = Vercel preview/staging URL.
Konfigurasi .zap/rules.tsv (FAIL untuk XSS, SQLi, CSP missing), jadwalkan
nightly full scan, dan upload report sebagai artifact. Sertakan workflow.
```

### 12. securing-github-actions-workflows
**Relevan**: Workflow GitHub Actions Anda sendiri harus aman (secret injection, PR runs).
```
Jalankan skill securing-github-actions-workflows. Audit semua workflow di
.github/workflows/ untuk risiko: untrusted checkout, PR trigger dengan
secrets, `pull_request_target` misuse, shell injection via `${{ }}`,
third-party actions tidak pinned. Rekomendasikan pinned SHA, permissions:
contents: read, dan step-security/harden-runner.
```

### 13. implementing-github-advanced-security-for-code-scanning
**Relevan**: GHAS code scanning + CodeQL untuk TypeScript/React.
```
Jalankan skill implementing-github-advanced-security-for-code-scanning. Setup
GitHub Advanced Security code scanning dengan CodeQL untuk repo Next.js+TS
ini. Konfigurasi codeql.yml workflow (javascript-typescript queries),
autobuild, SARIF upload. Sertakan custom query pack bila perlu.
```

### 14. implementing-semgrep-for-custom-sast-rules
**Relevan**: Custom rule untuk pattern Supabase client-side yang berbahaya.
```
Jalankan skill implementing-semgrep-for-custom-sast-rules. Buat custom Semgrep
rules untuk project ini: (1) detect penggunaan service_role key di client
component (bukan server), (2) detect createClient tanpa RLS, (3) detect
dangerouslySetInnerHTML tanpa sanitasi, (4) detect eval/setTimeout dengan
input. Simpan di .semgrep/custom-rules.yml, test terhadap src/.
```

---

## C. Web Application Security (OWASP Top 10)

### 15. testing-for-xss-vulnerabilities
**Relevan**: React 19 app — DOM-based XSS via dangerouslySetInnerHTML, location.hash.
```
Jalankan skill testing-for-xss-vulnerabilities ke project ini. Map semua input
reflected (search, query param) & stored (analisis stock, user profile bila ada).
Scan src/ untuk sink DOM: dangerouslySetInnerHTML, innerHTML, eval, document.write,
jQuery.html. Trace source (location.hash, search, postMessage) ke sink. Uji payload
per output context. Test CSP bypass di next.config.ts headers. Laporkan finding
dengan severity, file:line, PoC payload, & remediasi (DOMPurify, output encoding,
CSP).
```

### 16. performing-csrf-attack-simulation
**Relevan**: Form mutating state (upload xlsx, save analysis) — cek CSRF protection.
```
Jalankan skill performing-csrf-attack-simulation. Identifikasi semua endpoint
mutating (POST/PUT/DELETE) di Next.js route handlers & Supabase RPC. Test CSRF
token presence, SameSite cookie attribute, Origin/Referer validation. Buat PoC
HTML cross-origin. Laporkan temuan + remediasi (csrf token, SameSite=Strict,
Origin check).
```

### 17. testing-cors-misconfiguration
**Relevan**: next.config.ts / Supabase CORS — cek wildcard credentialed.
```
Jalankan skill testing-cors-misconfiguration. Audit CORS config di next.config.ts
(headers), Supabase project settings, dan route handlers. Test: Access-Control-
Allow-Origin dengan wildcard + credentials, null origin, reflection, regex
bypass. Laporkan misconfiguration + remediasi (whitelist explicit origin,
disable credentials bila tidak perlu).
```

### 18. testing-for-open-redirect-vulnerabilities
**Relevan**: Next.js redirect/next param umum di auth flow.
```
Jalankan skill testing-for-open-redirect-vulnerabilities. Cari semua
redirect/response.redirect/next/navigation redirect di src/. Test parameter
redirect, next, returnTo, callbackUrl dengan payload external URL
(//evil.com, https://evil.com, javascript:). Laporkan temuan + whitelist
allowlist redirect.
```

### 19. testing-for-broken-access-control
**Relevan**: Supabase RLS + route handler authorization.
```
Jalankan skill testing-for-broken-access-control. Audit semua route handler &
API route untuk authorization check. Test IDOR pada endpoint analisis stock
(ubah ID di URL), test Supabase RLS policy (query table sebagai user A lihat
data user B), test privilege escalation (anon → authenticated → service_role).
Laporkan temuan + remediasi (RLS policy, middleware auth check, server-side
ownership validation).
```

### 20. testing-for-business-logic-vulnerabilities
**Relevan**: Logika analisis stock — manipulasi input data xlsx.
```
Jalankan skill testing-for-business-logic-vulnerabilities. Analisis flow logika
stock analyzer: upload xlsx, parsing, perhitungan, storage. Test: negative
quantity, overflow, race condition pada save, bypass validasi client-side
via raw API. Laporkan temuan + remediasi (server-side validation, transaction,
rate limit).
```

### 21. testing-for-sensitive-data-exposure
**Relevan**: .env.local Supabase keys, API key di client bundle.
```
Jalankan skill testing-for-sensitive-data-exposure. Scan source & build output
(.next/) untuk secret exposure: NEXT_PUBLIC_ env yang seharusnya private,
Supabase service_role key di client component, API key di bundle. Audit
response headers (Cache-Control pada endpoint sensitif). Laporkan temuan +
remediasi (pindahkan ke server-only, server-side proxy, env rotation).
```

### 22. performing-security-headers-audit
**Relevan**: next.config.ts headers() — CSP, HSTS, X-Frame-Options.
```
Jalankan skill performing-security-headers-audit. Audit response headers di
semua route (landing, dashboard, API). Verifikasi: CSP (script-src 'self',
no unsafe-inline), HSTS, X-Content-Type-Options, X-Frame-Options/COEP,
Referrer-Policy, Permissions-Policy. Laporkan missing/weak header + konfigurasi
next.config.ts headers() yang direkomendasikan.
```

### 23. performing-clickjacking-attack-test
**Relevan**: UI berisi form upload & button analisis — cek framing protection.
```
Jalankan skill performing-clickjacking-attack-test. Test X-Frame-Options /
CSP frame-ancestors di semua page. Buat PoC HTML iframe overlay untuk form
upload xlsx & button "Analyze". Laporkan temuan + remediasi (frame-ancestors
'none', SameSite cookie).
```

### 24. performing-content-security-policy-bypass
**Relevan**: CSP yang Anda set — pastikan tidak ada bypass.
```
Jalankan skill performing-content-security-policy-bypass. Analisis CSP header
di next.config.ts. Cari bypass: unsafe-inline, unsafe-eval, wildcard domain
yang host JSONP, CDN dengan script yang bisa di-abuse, base-uri tidak set,
script-src CDN allowlist terlalu luas. Laporkan bypass + CSP yang hardened.
```

### 25. performing-web-application-penetration-test
**Relevan**: Pentest menyeluruh web app.
```
Jalankan skill performing-web-application-penetration-test. Lakukan pentest
menyeluruh pada Nunnn Stock Analyzer (dengan izin): reconnaissance (subdomain,
tech stack), mapping endpoint, test OWASP Top 10 (XSS, SQLi, SSRF, IDOR,
authz, CSRF, misconfig), test Supabase endpoint, test file upload xlsx.
Laporkan per OWASP WSTG format dengan severity, PoC, remediasi.
```

### 26. performing-web-application-vulnerability-triage
**Relevan**: Triage hasil scan multiple tools.
```
Jalankan skill performing-web-application-vulnerability-triage. Triage semua
finding dari skill 15-25: deduplikasi, klasifikasi severity (CVSS), tentukan
exploitability, false-positive screening, prioritization per risk. Hasilkan
report terurut dengan remediation roadmap.
```

### 27. performing-directory-traversal-testing
**Relevan**: File upload xlsx — cek path traversal saat simpan.
```
Jalankan skill performing-directory-traversal-testing. Test semua endpoint
yang handle file (upload xlsx, download report) dengan payload: ../, ..%2f,
..%5c, ..;/, double encoding. Cek apakah filename user-controlled masuk ke
path fs. Laporkan temuan + remediasi (sanitize filename, absolute path
whitelist).
```

### 28. performing-http-parameter-pollution-attack
**Relevan**: Next.js route handlers parse query — HPP bisa bypass validation.
```
Jalankan skill performing-http-parameter-pollution-attack. Test HPP pada
endpoint dengan multiple query param (search, filter stock). Kirim
?param=a&param=b, ?param[]=a&param[]=b. Cek behavior Next.js route handler
& Supabase query builder. Laporkan temuan + remediasi (ambil nilai pertama,
validate array).
```

### 29. performing-ssrf-vulnerability-exploitation
**Relevan**: Bila ada fitur fetch external URL (import stock dari URL).
```
Jalankan skill performing-ssrf-vulnerability-exploitation. Identifikasi endpoint
yang fetch URL eksternal (bila ada import stock dari URL, webhook). Test SSRF:
localhost, 169.254.169.254 (AWS metadata), internal IP, DNS rebinding, blind
SSRF via out-of-band. Laporkan temuan + remediasi (allowlist domain, block
internal IP, no redirect follow).
```

---

## D. API Security (Supabase REST/RPC + Next.js Route Handlers)

### 30. testing-api-security-with-owasp-top-10
**Relevan**: OWASP API Top 10 untuk Supabase REST & Next.js routes.
```
Jalankan skill testing-api-security-with-owasp-top-10. Test semua API endpoint
(Supabase REST, RPC, Next.js route handlers) terhadap OWASP API Top 10:
BOLA, broken auth, excessive data exposure, lack of rate limit, broken
function-level authz, mass assignment, security misconfig, injection, asset
management, insufficient logging. Laporkan per kategori dengan PoC.
```

### 31. testing-api-authentication-weaknesses
**Relevan**: Supabase Auth + custom JWT — cek weak auth.
```
Jalankan skill testing-api-authentication-weaknesses. Test auth semua API
endpoint: anon access ke endpoint authenticated, token expired/tampered,
JWT alg confusion (none, HS256 vs RS256), Supabase anon key abuse untuk
akses service-role endpoint, missing auth check di route handler. Laporkan
+ remediasi.
```

### 32. testing-api-for-broken-object-level-authorization
**Relevan**: BOLA/IDOR pada data stock user — cek RLS.
```
Jalankan skill testing-api-for-broken-object-level-authorization. Test BOLA
pada endpoint yang akses resource by ID (analisis stock, saved portfolio).
Buat 2 user, ambil token A, akses resource milik B. Verifikasi Supabase RLS
policy benar-benar block. Laporkan endpoint vulnerable + remediasi (RLS
policy, server-side ownership check).
```

### 33. testing-api-for-mass-assignment-vulnerability
**Relevan**: Insert/update Supabase table — mass assignment field tersembunyi.
```
Jalankan skill testing-api-for-mass-assignment-vulnerability. Test endpoint
insert/update (insert analisis, update profile) dengan field tambahan:
role, is_admin, user_id, created_at. Cek apakah field teroverwrite. Laporkan
temuan + remediasi (whitelist field, Zod schema validation server-side).
```

### 34. implementing-api-rate-limiting-and-throttling
**Relevan**: Cegah abuse endpoint analisis stock (compute-heavy).
```
Jalankan skill implementing-api-rate-limiting-and-throttling. Implementasikan
rate limiting di Next.js route handlers & middleware: per-IP, per-user,
per-endpoint. Rekomendasikan solusi (Upstash Ratelimit, Vercel Edge
Middleware, @upstash/ratelimit). Sertakan konfigurasi untuk endpoint
compute-heavy (analisis stock). Hasilkan kode siap pakai.
```

### 35. implementing-api-key-security-controls
**Relevan**: Bila ada API key untuk akses service (Alpha Vantage, Yahoo Finance).
```
Jalankan skill implementing-api-key-security-controls. Rancang management API
key untuk stock data provider: generate, rotate, revoke, scope, storage di
Supabase Vault / Vercel env. Implementasi header validation, rate limit per
key, logging. Laporkan arsitektur + kode.
```

### 36. performing-api-security-testing-with-postman
**Relevan**: Automasi test API via Postman collection.
```
Jalankan skill performing-api-security-testing-with-postman. Buat Postman
collection untuk semua endpoint (Supabase REST, RPC, Next.js routes) dengan
test script: auth, BOLA, mass assignment, rate limit, input validation.
Ekspor collection & Newman run di CI. Sertakan environment variables.
```

---

## E. Auth / Crypto (JWT, OAuth, TLS)

### 37. testing-for-json-web-token-vulnerabilities
**Relevan**: Supabase Auth pakai JWT — cek alg confusion, weak secret.
```
Jalankan skill testing-for-json-web-token-vulnerabilities. Test JWT Supabase
Auth: alg confusion (none, HS256 dengan public key RS256), weak secret
bruteforce (jwt_tool), expired token acceptance, missing signature
verification, claim injection (sub, role). Laporkan temuan + remediasi.
```

### 38. implementing-jwt-signing-and-verification
**Relevan**: Buat JWT custom yang aman bila perlu.
```
Jalankan skill implementing-jwt-signing-and-verification. Rancang JWT custom
(bila dibutuhkan di middleware Next.js): algoritma (RS256/EdDSA), key
management (Vercel env / Supabase Vault), claim design (sub, role, exp, jti),
verifikasi di Edge Middleware. Sertakan kode implementasi jose library.
```

### 39. testing-oauth2-implementation-flaws
**Relevan**: Bila pakai OAuth provider (Google/GitHub via Supabase).
```
Jalankan skill testing-oauth2-implementation-flaws. Test flow OAuth Supabase:
state validation, redirect_uri validation, PKCE presence, code reuse, token
leakage via referrer, open redirect pada callback. Laporkan temuan +
remediasi.
```

### 40. performing-ssl-tls-security-assessment
**Relevan**: Domain Vercel — cek TLS config.
```
Jalankan skill performing-ssl-tls-security-assessment. Assess TLS domain
Vercel (dan custom domain bila ada): protokol (disable TLS 1.0/1.1), cipher
suite, HSTS, certificate chain, OCSP stapling, forward secrecy. Gunakan
testssl.sh/ssllabs. Laporkan grade + remediasi.
```

---

## F. Cloud / Serverless (Supabase + Vercel)

### 41. performing-serverless-function-security-review
**Relevan**: Vercel serverless functions Next.js.
```
Jalankan skill performing-serverless-function-security-review. Review semua
Next.js route handlers & server actions untuk risk serverless: secret di
runtime env, timeout abuse, cold-start info leak, unbounded input, missing
authz, SSRF via fetch. Laporkan temuan + remediasi.
```

### 42. securing-serverless-functions
**Relevan**: Hardening konfigurasi serverless.
```
Jalankan skill securing-serverless-functions. Rancang hardening untuk
serverless function di Vercel: least-privilege env var, function timeout,
memory limit, concurrency, Vercel Edge vs Node runtime, isolate secret per
function. Sertakan vercel.json config + best practice.
```

### 43. implementing-cloud-security-posture-management
**Relevan**: Audit konfigurasi Supabase project (database, auth, storage).
```
Jalankan skill implementing-cloud-security-posture-management. Audit Supabase
project config: database public schema exposure, storage bucket public ACL,
auth provider enabled, RLS enable per table, service_role key usage, network
restriction. Rekomendasikan CSPM tool (Supabase advisor, Prowler bila pakai
AWS). Laporkan misconfig + remediasi.
```

---

## G. Threat Modeling & Vulnerability Management

### 44. performing-threat-modeling-with-owasp-threat-dragon
**Relevan**: Threat model sebelum pentest.
```
Jalankan skill performing-threat-modeling-with-owasp-threat-dragon. Buat
threat model untuk Nunnn Stock Analyzer: komponen (Next.js client, Vercel
serverless, Supabase Postgres/Auth/Storage), data flow (upload xlsx,
analisis, persist), trust boundary. Identifikasi threat per STRIDE.
Hasilkan diagram Threat Dragon + mitigasi.
```

### 45. implementing-mitre-attack-coverage-mapping
**Relevan**: Peta kontrol ke ATT&CK.
```
Jalankan skill implementing-mitre-attack-coverage-mapping. Map semua kontrol
security yang ada (CSP, RLS, rate limit, auth, secret scan) ke MITRE ATT&CK
technique. Identifikasi gap coverage. Hasilkan ATT&CK Navigator layer +
rekomendasi kontrol tambahan.
```

### 46. prioritizing-vulnerabilities-with-cvss-scoring
**Relevan**: Prioritize semua finding dari skill lain.
```
Jalankan skill prioritizing-vulnerabilities-with-cvss-scoring. Ambil semua
finding dari skill 1-45, hitung CVSS v3.1 vector per finding, prioritisasi
berdasarkan CVSS + exploitability + asset criticality. Hasilkan remediation
roadmap (Sprint 1 critical, Sprint 2 high, dst).
```

---

## Urutan Eksekusi yang Disarankan

1. **Fase 1 — Quick win (1-2 jam)**: Skill 7, 8, 2, 3, 22, 21
   - Setup CI security pipeline, scan secret, scan dependency, audit header
2. **Fase 2 — Web app pentest (1-2 hari)**: Skill 44 → 25 → 15,16,17,18,19,20,23,24,27,28,29 → 26
   - Threat model dulu, pentest menyeluruh, test per OWASP, triage
3. **Fase 3 — API & Auth (1-2 hari)**: Skill 30,31,32,33,34,35,36,37,39,40
   - Test API Supabase, JWT, OAuth, TLS
4. **Fase 4 — Cloud & Serverless (1 hari)**: Skill 41,42,43
   - Hardening serverless & Supabase config
5. **Fase 5 — Supply chain & Build (1 hari)**: Skill 1,4,5,6,9,10,11,12,13,14
   - Dependency confusion, code signing, SLSA, GitHub Actions security
6. **Fase 6 — Reporting**: Skill 45,46
   - ATT&CK coverage + CVSS prioritization + roadmap

## Prasyarat Tools

Install tools berikut sebelum menjalankan prompt:

| Tool | Skill yang butuh | Install |
|------|-------------------|---------|
| Node.js + npm | Semua | https://nodejs.org |
| Go 1.20+ | confused, gitleaks, osv-scanner | https://go.dev/dl/ |
| Python 3.10+ | guarddog, dep-scan, pre-commit | https://python.org |
| Git | gitleaks, git-filter-repo | https://git-scm.com |
| Docker | semgrep, trivy, zap, guarddog | https://docker.com |
| Snyk CLI | skill 3 | `npm i -g snyk` |
| Gitleaks | skill 7,8,9 | https://github.com/gitleaks/gitleaks/releases |
| Semgrep | skill 7,10,14 | `pip install semgrep` |
| Trivy | skill 4,7 | https://aquasecurity.github.io/trivy/ |
| GuardDog | skill 2 | `pip install guarddog` |
| OWASP ZAP | skill 7,11 | https://www.zaproxy.org/ |
| Burp Suite | skill 15,25 | https://portswigger.net/burp |
| Postman + Newman | skill 36 | https://postman.com |
| testssl.sh | skill 40 | https://testssl.sh/ |
| jwt_tool | skill 37 | https://github.com/ticarpi/jwt_tool |
| git-filter-repo | skill 8 | `pip install git-filter-repo` |
| Supabase CLI | skill 43 | `npm i -g supabase` |

## Catatan Legal

Skill offensive (pentest, exploit, C2) hanya untuk sistem yang Anda **own** atau
punya **izin tertulis**. Repo ini milik Anda — aman untuk testing. Vercel/Supabase
production: bila shared/production, minta izin terlebih dahulu.
