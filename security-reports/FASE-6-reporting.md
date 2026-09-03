# Security Report — Fase 6: Reporting (ATT&CK + CVSS + Roadmap)

**Project**: Nunnn Stock Analyzer · **Date**: 2026-09-03
**Skills**: 45 (MITRE ATT&CK coverage), 46 (CVSS prioritization + remediation roadmap)

---

## Skill 46 — CVSS v3.1 Prioritization

| ID | Finding | CVSS v3.1 | Score | Severity | Exploitability |
|----|---------|-----------|-------|----------|----------------|
| **F3-01** | Mass assignment: insert `is_admin:true` bypass RLS → privilege escalation | AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H | 9.9 | **CRITICAL** | High (anon key publik + JWT user) |
| **F2-14** | SSRF fetch arbitrary URL dari POST body `link` | AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N | 9.1 | **CRITICAL** | High (no auth + public endpoint) |
| **F1-01** | Next.js 16.2.6 proxy bypass CVE (GHSA-6gpp-xcg3-4w24) + 8 advisory | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H | 9.8 | **CRITICAL** | High (CVE publik) |
| **F1-03/F3-02** | No JWT validation AI endpoints (cookie-only gate, bypassable) | AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:H | 7.6 | **HIGH** | High (cookie fake + CVE) |
| **F3-06** | No rate limiting on AI endpoints | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H | 7.5 | **HIGH** | High (anonymous) |
| **F1-02** | xlsx prototype pollution (direct dep) | AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L | 5.3 | MEDIUM | Low (xlsx tidak dipakai di src) |
| **F1-04** | 6 transitive high vuln (DoS-type) | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L | 5.3 | MEDIUM | Low |
| **F1-05/F2-10/F2-11** | No security headers (CSP/HSTS/X-Frame) | AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N | 4.7 | MEDIUM | Medium (clickjacking/XSS aid) |
| **F2-08** | No symbol format whitelist | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L | 3.7 | LOW | Low |
| **F2-06** | Client-side admin email gating | AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N | 4.1 | MEDIUM | Low (RPC server-side mitigates) |
| **F3-07** | No API key rotation/scoping | — | — | MEDIUM | — |
| **F1-06/F2-02** | No CSRF Origin check / no Cache-Control | AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:L | 3.1 | LOW | Low |
| **F4-01** | keepalive error.message leak | AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N | 5.3 | MEDIUM | High |
| **F2-01** | innerHTML error msg (dev-only) | AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N | 4.4 | MEDIUM | Low |
| **F2-07** | claim_first_admin TOCTOU race | AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N | 6.3 | MEDIUM | Low (first-deploy only) |
| **F5-01** | Actions not pinned SHA | — | — | LOW | — |

**Positive findings (no action)**: F2-03 CORS aman, F2-04 no open redirect, F2-12 no path traversal, F2-13 HPP aman, F3-05 RLS solid, F3-08 JWT managed no alg-confusion, 0 secret di git history, 0 install-scripts, server keys server-side.

---

## Skill 45 — MITRE ATT&CK Coverage Mapping

Kontrol yang ada vs gap (enterprise ATT&CK):

| ATT&CK Tactic | Technique | Kontrol ada | Gap |
|---------------|-----------|-------------|-----|
| Initial Access (TA0001) | T1078 Valid Accounts | Supabase Auth ✅ | RLS mass-assign bypass (F3-01) |
| Initial Access | T1199 Trusted Dependency | npm lockfile | xlsx vuln (F1-02), 6 transitive |
| Execution (TA0002) | T1059 Command/Script | React no eval ✅ | innerHTML dev-only (F2-01) |
| Persistence (TA0003) | T1098 Account Manipulation | RPC admin ✅ | self-grant admin (F3-01) |
| Privilege Escalation (TA0004) | T1078.004 Cloud Accounts | is_admin() RPC ✅ | F3-01 critical |
| Defense Evasion (TA0005) | T1562 Impair Defenses | — | proxy bypass (F1-01) |
| Credential Access (TA0006) | T1552 Unsecured Credentials | env server-only ✅ | no rotation (F3-07) |
| Discovery (TA0007) | T1580 Cloud Infra Discovery | — | SSRF internal (F2-14) |
| Collection (TA0009) | T1530 Data from Cloud | RLS ✅ | SSRF exfil (F2-14) |
| Impact (TA0040) | T1499 Endpoint DoS | — | no rate limit (F3-06) |
| Exfiltration (TA0010) | T1567 Exfil over Web | — | SSRF data return (F2-14) |

**Coverage summary**: Auth ✅ / RLS ✅ (kecuali 1) / SAST ❌ (belum run) / secret-scan ✅ (config ready) / rate-limit ❌ / security headers ❌ / code signing ❌ (workflow ready).

**Gap terbesar**: T1078 (valid account abuse via F3-01), T1199 (dep vuln), T1499 (DoS via no rate limit), T1567 (SSRF exfil).

---

## Remediation Roadmap (Sprint-based)

### Sprint 1 — Critical (minggu ini, sebelum deploy)
1. **F3-01** — Apply `security-reports/fix-user-approvals-rls.sql` migration (restrict insert + trigger). **Test**: Postman collection "Mass Assignment" harus 403.
2. **F1-01** — `npm install next@16.3.4` (fix proxy bypass + 8 advisory).
3. **F2-14** — Apply SSRF fix (`security-reports/ssrf-fix-example.ts`): allowlist hostname, block private IP, no redirect follow.
4. **F1-03/F3-02** — Tambah `supabase.auth.getUser()` di setiap AI route handler (news/summary, analysis/news, analysis/fundamentals, analysis/technical). Return 401 if no user.
5. **F3-06** — Install `@upstash/ratelimit` + `@upstash/redis`; apply `security-reports/rate-limit-example.ts` ke AI endpoint.

### Sprint 2 — High (2 minggu)
6. **F1-02** — Ganti `xlsx`: `npm uninstall xlsx; npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (atau remove jika tidak dipakai — tidak diimpor di src).
7. **F1-04** — `npm audit fix` untuk 6 transitive DoS deps.
8. **F1-05** — Apply security headers (`security-reports/recommended-next-config.ts` merge ke `next.config.ts`).
9. **F2-08** — Tambah validasi symbol `^[A-Z]{1,5}(\.JK)?$` di route handler sebelum fetch.
10. **F3-07** — Rotate GEMINI/GROQ/OPENAI key; set quota limit di provider; redact key di error log.

### Sprint 3 — Medium (1 bulan)
11. **F4-03/F4-02** — Merge `recommended-vercel.json` (maxDuration, memory, regions, headers).
12. **F4-01** — Fix keepalive: return generic error, log detail server-side.
13. **F2-01** — `client-bootstrap.tsx:223`: ganti `innerHTML` → `textContent`.
14. **F2-02** — Tambah Origin/Referer check di POST `/api/news/summary`.
15. **F4-06** — Audit semua table Supabase RLS status via `supabase db dump`.
16. **F2-07** — Mitigasi claim_first_admin race (unique constraint / advisory lock).
17. **F5-01** — Pin GitHub Actions ke SHA digest; tambah `step-security/harden-runner`.

### Sprint 4 — Hardening (ongoing)
18. Install tools (gitleaks, semgrep, trivy, snyk, guarddog, ZAP) → enable `security.yml` workflow aktif.
19. `pre-commit install` → jalankan pre-commit hooks lokal.
20. Set GitHub branch protection (require security gate checks).
21. Enable GHAS CodeQL (skill 13) untuk repo public.
22. Runtime pentest ZAP/Burp ke staging URL (skill 25, 11).
23. TLS assessment `testssl.sh` ke domain Vercel (skill 40).
24. OAuth2 flow test dengan Burp (skill 39).
25. Build output scan `.next/` untuk konfirmasi no server-key leak.

---

## Files Created (all security deliverables)

| File | Skill | Purpose |
|------|-------|---------|
| `.github/workflows/security.yml` | 7 | DevSecOps pipeline (Gitleaks+Semgrep+Trivy+ZAP+gate) |
| `.github/workflows/slsa-provenance.yml` | 5,6 | Code signing + SLSA L3 provenance |
| `.pre-commit-config.yaml` | 7 | Gitleaks + Semgrep pre-commit |
| `.gitleaks.toml` | 8 | Custom secret rules (Supabase/Google/Gemini/Groq) |
| `.zap/rules.tsv` | 11 | ZAP FAIL rules (XSS/SQLi/CSP/clickjacking) |
| `.semgrep/custom-rules.yml` | 14 | 7 custom SAST rules (catches F1-03, F2-14) |
| `security-reports/FASE-1-quick-win.md` | 7,8,2,3,22,21 | Phase 1 report |
| `security-reports/FASE-2-web-pentest.md` | 44,25,15-24,26-29 | Phase 2 report |
| `security-reports/FASE-3-api-auth.md` | 30-40 | Phase 3 report |
| `security-reports/FASE-4-cloud-serverless.md` | 41,42,43 | Phase 4 report |
| `security-reports/FASE-5-supply-chain.md` | 1,4,5,6,9-14 | Phase 5 report |
| `security-reports/FASE-6-reporting.md` | 45,46 | This report |
| `security-reports/npm-audit.json` | 3 | Full npm audit JSON |
| `security-reports/recommended-next-config.ts` | 22 | Security headers config |
| `security-reports/recommended-vercel.json` | 42 | Serverless hardening config |
| `security-reports/fix-user-approvals-rls.sql` | 33 | F3-01 remediation SQL |
| `security-reports/ssrf-fix-example.ts` | 29 | F2-14 remediation code |
| `security-reports/rate-limit-example.ts` | 34 | F3-06 remediation code |
| `security-reports/postman-collection.json` | 36 | API security test collection |

---

## Executive Summary

- **3 CRITICAL** (F3-01 privilege escalation, F2-14 SSRF, F1-01 Next.js CVE) — semua bisa dieksploitasi anonymous, fix segera.
- **4 HIGH** (no JWT validation, no rate limit, dep vuln) — fix Sprint 1-2.
- **8 MEDIUM** — fix Sprint 2-3.
- **Positif**: RLS solid (kecuali 1), admin RPC server-side, no secret di git history, no install-scripts, server keys server-side, no open redirect, no path traversal, JWT managed by Supabase.
- **Tooling**: 6 config/workflow files + 1 custom SAST ruleset dibuat siap pakai; install tools eksternal untuk aktifkan scanning penuh.

> ⚠️ Catatan: assessment berbasis static code review. Pentest runtime (ZAP/Burp/DAST), TLS assessment, dan OAuth flow test butuh staging URL + tools terinstall (Sprint 4).
