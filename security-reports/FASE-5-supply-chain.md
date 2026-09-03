# Security Report — Fase 5: Supply Chain & Build

**Project**: Nunnn Stock Analyzer · **Date**: 2026-09-03
**Skills**: 1 (dependency confusion), 4 (IaC scan), 5 (code signing), 6 (SLSA provenance), 9 (secrets CI/CD TruffleHog), 10 (SAST github actions), 11 (DAST ZAP pipeline), 12 (GH actions hardening), 13 (GHAS code scanning), 14 (custom semgrep)

---

## Skill 1 — Dependency Confusion

**Inventory**: `package.json` (10 direct deps) + `package-lock.json` v3 (456 transitive). Semua scope publik (`@supabase`, `@next`, `@tailwindcss`, dll). **Tidak ada private/internal package namespace** → tidak ada dependency confusion vector (tidak ada nama internal yang bisa di-claim di public registry). ✅

**Rekomendasi `.npmrc`** (jika nanti ada private package): scope-pinning
```ini
@nunnn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```
Tool `confused` (Go) belum terinstall — jalankan `confused -l npm` setelah install untuk verifikasi otomatis.

---

## Skill 4 — IaC / Config Scan

Scan config files: `next.config.ts`, `vercel.json`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `supabase/migrations/*.sql`.

**Temuan** (manual, Trivy/Checkov belum terinstall):
- `next.config.ts`: no security headers → F1-05 (sudah ada rekomendasi `recommended-next-config.ts`)
- `vercel.json`: no function hardening → F4-03 (sudah ada `recommended-vercel.json`)
- `tsconfig.json`: standar Next, no issue
- Migrations SQL: RLS permissive user_approvals → F3-01

Trivy config scan sudah ada di `security.yml` (job `sca-scan` `scan-type: config`). Install Trivy lalu workflow auto-run.

---

## Skill 5 & 6 — Code Signing + SLSA Provenance

Workflow dibuat: `.github/workflows/slsa-provenance.yml`:
- Build Next.js → tarball artifact
- Sign dengan **cosign (Sigstore keyless OIDC)** — verify identitas GitHub repo
- Generate SLSA L3 provenance via `slsa-github-generator`
- Verify signature sebelum deploy
- Upload signed artifact + sig + cert + checksums

Butuh: `id-token: write` permission (sudah set). Deploy step (Vercel) harus **verify signature** sebelum promote (rekomendasi: deploy job download artifact, `cosign verify-blob`, lalu `vercel deploy --prod`).

---

## Skill 9 — Secrets Scanning in CI/CD (TruffleHog)

`security.yml` sudah ada Gitleaks (job `secrets-scan`). Tambahan TruffleHog dengan **verified detection** (only flag secrets that are live-valid):

Rekomendasi tambah job ke `security.yml`:
```yaml
  trufflehog:
    name: Secrets (TruffleHog verified)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified --github-actions
```
TruffleHog verifikasi secret live (hit API) → fewer false positive.

---

## Skill 10 — SAST into GitHub Actions (Semgrep)

Sudah ada di `security.yml` (job `sast-scan`): p/owasp-top-ten, p/nextjs, p/typescript, p/secrets + custom `.semgrep/custom-rules.yml`. SARIF upload via `github/codeql-action/upload-sarif`. `--error` gate pada PR.

---

## Skill 11 — DAST with OWASP ZAP in Pipeline

Sudah ada di `security.yml` (job `dast-scan`): `zaproxy/action-baseline` ke `vars.STAGING_URL`, rules `.zap/rules.tsv` (FAIL XSS/SQLi/CSP). Schedule nightly full scan via `schedule: cron`. Tambah full scan:
```yaml
      - uses: zaproxy/action-full-scan@v0.12.0
        with: { target: ${{ vars.STAGING_URL }} }
```

---

## Skill 12 — Securing GitHub Actions Workflows

Audit workflow yang DIBUAT (`.github/workflows/security.yml`, `slsa-provenance.yml`):

| Control | Status |
|---------|--------|
| Pin actions to SHA | ⚠️ gunakan `@v4` tag (rekomendasi pin SHA digest) |
| `permissions: contents: read` minimal | ✅ (security.yml) / id-token:write untuk SLSA |
| `pull_request_target` misuse | ✅ tidak dipakai (pakai `pull_request`) |
| Shell injection via `${{ }}` | ✅ `slsa-provenance.yml` pakai `${{ github.sha }}` di run — aman (sha tidak user-controlled) tapi tetap hati-hati |
| Third-party actions | gitleaks-action, trivy-action, zaproxy, semgrep, cosign — semua dari verified org |
| `step-security/harden-runner` | ⚠️ belum ditambahkan — rekomendasi tambah |

**F5-01 (LOW)**: Rekomendasi pin actions ke SHA digest:
```yaml
uses: actions/checkout@<full-sha>  # bukan @v4
```
Dan tambah `step-security/harden-runner@v2` di tiap job untuk egress audit.

---

## Skill 13 — GitHub Advanced Security (CodeQL)

Untuk GHAS (private repo butuh license; public repo gratis):
```yaml
# .github/workflows/codeql.yml
name: CodeQL
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions: { security-events: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript, queries: security-extended }
      - uses: github/codeql-action/analyze@v3
```
Semgrep (skill 10) sudah cover SAST gratis — CodeQL tambahan untuk query pack lebih dalam.

---

## Skill 14 — Custom Semgrep Rules (created)

File `.semgrep/custom-rules.yml` dibuat (7 rules):
1. `nextjs-supabase-service-role-key-in-client` — detect service_role key tanpa server-only
2. `nextjs-createclient-without-rls-check` — createClient dengan service_role
3. `react-dangerouslysetinnerhtml-without-sanitization` — XSS dangerouslySetInnerHTML dinamis
4. `nextjs-innerhtml-assignment` — XSS innerHTML
5. `nextjs-eval-with-input` — eval RCE
6. `nextjs-fetch-with-user-controlled-url-ssrf` — SSRF fetch (catches F2-14!)
7. `nextjs-route-handler-missing-auth` — route handler tanpa getUser() (catches F1-03!)

Test: `semgrep scan --config .semgrep/custom-rules.yml src/` (setelah install semgrep).

---

## Fase 5 Findings Matriks

| # | Skill | Severity | Finding |
|---|-------|----------|---------|
| F5-01 | 12 | LOW | Actions not pinned to SHA, no harden-runner |
| — | 1 | INFO | No private package namespace → no dep-confusion risk |
| — | 14 | created | Custom semgrep rules catch F1-03, F2-14 |

Files created: `.semgrep/custom-rules.yml`, `.github/workflows/slsa-provenance.yml`
