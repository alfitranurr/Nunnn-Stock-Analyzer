# Dokumentasi Teknis Lengkap: Nunnn Stock Analyzer

> Dokumen rujukan untuk seluruh menu, fitur, arsitektur, logika kalkulasi, API, data, konfigurasi, keamanan, dan hasil audit kode.
> Kondisi kode: commit `f2c68f1` (branch `main`, 2026-10-07). Audit awal dibuat pada `3c29703` (2026-10-02); temuan yang sudah diperbaiki sejak itu ditandai ✅ (lihat [§12.1](#121-status-perbaikan)).
> Referensi kode memakai format `path:baris` dan bisa diklik di VSCode atau GitHub.
>
> Status temuan:
> - **Terverifikasi**: dicek langsung di kode.
> - **Perlu verifikasi runtime**: kesimpulan dari membaca kode, belum dibuktikan dengan menjalankan aplikasi.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur](#2-arsitektur)
3. [Tech Stack & Dependensi](#3-tech-stack--dependensi)
4. [Struktur Direktori](#4-struktur-direktori)
5. [Bedah Menu & Fitur](#5-bedah-menu--fitur)
6. [Logika Kalkulasi & Rumus](#6-logika-kalkulasi--rumus)
7. [Referensi API](#7-referensi-api)
8. [Data & Penyimpanan](#8-data--penyimpanan)
9. [Konfigurasi & Environment](#9-konfigurasi--environment)
10. [i18n & Styling](#10-i18n--styling)
11. [Keamanan, CI/CD & Tooling](#11-keamanan-cicd--tooling)
12. [Temuan Audit](#12-temuan-audit)
13. [Utang Teknis & Kualitas Kode](#13-utang-teknis--kualitas-kode)
14. [Roadmap Rekomendasi](#14-roadmap-rekomendasi)
15. [Lampiran](#15-lampiran)

---

## 1. Ringkasan Eksekutif

**Nunnn Stock Analyzer** adalah web app untuk investor saham Indonesia (IDX/BEI). Isinya kalkulator investasi (Average Down, Compounding, Persentase, Dividen, E-IPO), berita pasar dengan rangkuman AI, analisis saham 3-in-1 (fundamental, teknikal, "bandarmology"), portofolio pribadi, dan panel admin untuk menyetujui pengguna.

| Aspek | Nilai |
|---|---|
| Framework | Next.js 16.3.4 (App Router, konvensi `proxy.ts`) + React 19.2.4 |
| Bahasa | TypeScript strict |
| Styling | Tailwind CSS v4, framer-motion, lucide-react, hanya mode gelap |
| Backend | Next.js Route Handlers (9 route), tanpa server actions |
| Data eksternal | Yahoo Finance (endpoint tidak resmi), Google News RSS, Gemini → Groq → OpenAI |
| Auth & DB | Supabase (Auth + Postgres + RLS); ada mode **Demo/Lokal** berbasis localStorage |
| Rate limit | Upstash Redis (opsional; tidak aktif bila env tidak diisi) |
| Deploy | Vercel (region `sin1`, cron harian) |
| Ukuran | 102 file ter-track git, sekitar 21,5k LOC di `src/`, 10 menu, 9 API route, 6 tabel DB |
| Test | **Tidak ada** |

### 5 temuan paling kritis

1. **Menu Analisis dan Rangkuman AI kemungkinan selalu 401 di produksi.** Klien Supabase menyimpan sesi di localStorage, sedangkan `proxy.ts` mewajibkan cookie `sb-*-auth-token`. Lihat [C-01](#c-01).
2. **Rate limit AI (10/jam) ikut membatasi route fundamental dan teknikal.** Ditambah auto-refresh 60 detik, Analisis bisa terkunci 429 dalam beberapa menit. Lihat [C-02](#c-02).
3. **Data sintetis ditampilkan seolah data nyata.** Contohnya broker summary, foreign flow, harga fallback 5000, serta fundamental, dividen, dan berita fallback, semuanya tanpa penanda. Ini berisiko untuk keputusan investasi. Lihat [H-01](#h-01).
4. **Persetujuan admin hanya dicek di browser.** Server (`requireUser`) dan RLS tidak memeriksa `approved`. Lihat [H-02](#h-02).
5. **Belum ada test maupun CI kualitas** (lint, type-check, build). Workflow SLSA juga tidak valid. Lihat [H-07](#h-07).

---

## 2. Arsitektur

### 2.1 Pola aplikasi: satu halaman dengan tab state

- Hanya ada **satu route halaman**, yaitu [src/app/page.tsx](src/app/page.tsx) (`'use client'`, 1133 baris).
- Menu tidak dipisah per route. Setiap menu adalah tab yang dipilih lewat state `currentTab` ([page.tsx:52](src/app/page.tsx#L52)) dan disimpan di `sessionStorage['nunnn_stock_active_tab']` ([page.tsx:141-158](src/app/page.tsx#L141-L158)).
- **Semua tab selalu ter-mount.** Tab yang tidak aktif hanya disembunyikan dengan CSS (`block`/`hidden`) di dalam wrapper animasi framer-motion ([page.tsx:613-1041](src/app/page.tsx#L613-L1041)). Efek sampingnya: state tiap tab bertahan saat berpindah tab, tetapi efek dan fetch semua tab ikut jalan saat halaman dibuka.
- `page.tsx` memegang state global: `user`, sesi auth, CRUD rencana Avg Down, toast, tombol scroll-to-top, serta modal logout dan hapus. State ini diteruskan ke komponen lewat props. Tidak ada state library.

### 2.2 Pohon provider ([src/app/layout.tsx](src/app/layout.tsx))

```
<html lang="id" class="dark">
  ClientBootstrap        ← polyfill randomUUID/storage, bersihkan token Supabase basi, overlay error (dev)
    LanguageProvider     ← context i18n (id/en), disimpan di localStorage
      ThemeProvider      ← next-themes, forcedTheme="dark"
        {children}       ← page.tsx (Dashboard)
```

### 2.3 Alur data

```mermaid
flowchart LR
  B[Browser<br/>page.tsx + tab components] -->|fetch /api/*| P{proxy.ts<br/>cek cookie sb-*}
  P -->|/api/analysis/*, /api/news/summary| R1[Route terproteksi<br/>requireUser + rate limit]
  B -->|/api/ticker, /api/news,<br/>/api/dividend, /api/market-summary| R2[Route publik<br/>rate limit IP]
  R1 --> Y[(Yahoo Finance<br/>chart/quote/quoteSummary)]
  R1 --> G[(Google News RSS)]
  R1 --> AI[(Gemini → Groq → OpenAI)]
  R2 --> Y
  R2 --> G
  R1 & R2 --> U[(Upstash Redis<br/>rate limit)]
  B -->|supabase-js langsung| S[(Supabase Auth + Postgres RLS)]
  B -->|localStorage| L[(Mode Demo/Lokal)]
  B -->|iframe| TV[TradingView]
  CRON[Vercel Cron harian] --> K[/api/keepalive/] --> S
```

Poin penting:
- **CRUD data pengguna** (rencana, portofolio, approval) dilakukan langsung dari browser ke Supabase lewat anon key. Keamanannya bergantung penuh pada RLS.
- **Data pasar dan AI** selalu lewat API route di server, sehingga API key AI tidak sampai ke klien.

### 2.4 Dua mode operasi

| | Mode Demo/Lokal | Mode Supabase |
|---|---|---|
| Aktif bila | `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` kosong atau berisi placeholder ([supabase.ts:7-10](src/lib/supabase.ts#L7-L10)) | Env terisi dengan benar |
| Auth | User simulasi di localStorage (`nunnn_stock_simulated_users`, password di-hash SHA-256 + salt, [crypto.ts](src/lib/crypto.ts)) | Supabase Auth (email/password + Google OAuth) dengan gerbang approval admin |
| Penyimpanan | localStorage | Tabel Supabase (RLS per `user_id`) |
| Proxy | Dilewati ([proxy.ts:34](src/proxy.ts#L34)) | Wajib cookie `sb-*-auth-token` |

### 2.5 Konvensi Next.js 16

- `middleware.ts` diganti **`src/proxy.ts`** (fungsi `proxy` + `config.matcher`).
- [AGENTS.md](AGENTS.md) mengingatkan bahwa API Next.js di versi ini berbeda dari yang umum dikenal. Baca `node_modules/next/dist/docs/` sebelum mengubah kode framework.

---

## 3. Tech Stack & Dependensi

Sumber: [package.json](package.json)

| Paket | Versi | Fungsi |
|---|---|---|
| `next` | ^16.3.4 | Framework |
| `react` / `react-dom` | 19.2.4 | UI |
| `@supabase/supabase-js` | ^2.106.2 | Klien Auth/DB (dipakai di browser) |
| `@supabase/ssr` | ^0.12.5 | Klien server ([supabase-server.ts](src/lib/supabase-server.ts)); `createBrowserClient` **tidak dipakai** |
| `@upstash/ratelimit`, `@upstash/redis` | ^2.0.8, ^1.38.3 | Rate limiting |
| `framer-motion` | ^12.40.0 | Animasi |
| `lucide-react` | ^1.17.0 | Ikon |
| `next-themes` | ^0.4.6 | Tema (dipaksa gelap) |
| `clsx`, `tailwind-merge` | ^2.1.1, ^3.6.0 | Helper `cn()` |
| Dev: `tailwindcss` / `@tailwindcss/postcss` | ^4 | Styling |
| Dev: `typescript` ^5, `eslint` ^9, `eslint-config-next` 16.2.6, `@types/*` | | Tooling |

**Scripts:** `dev`, `build`, `start`, `lint` (`eslint`), `deploy` (`node deploy.js`). Tidak ada `test` maupun `typecheck`.

**Yang tidak dipakai:**
- library chart (semua grafik berupa SVG tulisan tangan, ditambah iframe TradingView)
- state library, form library, React Query
- UI kit
- test framework

> Catatan: README masih menyebut Next 16.2.6, SheetJS (`xlsx`), dan canvas-confetti. Keduanya sudah dihapus (commit `56beb3d`, `dae1fd4`).

---

## 4. Struktur Direktori

```
.
├── .github/workflows/        security.yml, slsa-provenance.yml
├── .semgrep/custom-rules.yml  7 aturan SAST kustom
├── .zap/rules.tsv             aturan ZAP baseline
├── .gitleaks.toml             aturan secret scan kustom
├── .pre-commit-config.yaml    gitleaks + semgrep (belum ter-install di .git/hooks)
├── security-reports/          FASE-1..6, FINAL-REPORT.md, contoh fix (.ts/.json/.sql)
├── supabase/migrations/       7 migrasi SQL (tabel, RLS, RPC, trigger)
├── public/                    aset default Next (tidak dipakai)
├── deploy.js                  sinkron .env.local → Vercel + deploy --prod
├── next.config.ts             CSP & security headers, images.remotePatterns
├── vercel.json                cron, maxDuration per route, region, headers
└── src/
    ├── proxy.ts               (50)   gerbang cookie untuk /api/analysis/* & /api/news/summary
    ├── app/
    │   ├── layout.tsx         (43)   metadata, viewport, providers
    │   ├── page.tsx           (1133) Dashboard: semua tab + auth + CRUD Avg Down
    │   ├── globals.css        (126)  Tailwind v4 @theme tokens, glass-card, dll.
    │   └── api/
    │       ├── analysis/fundamentals/route.ts (425)
    │       ├── analysis/technical/route.ts    (997)  semua indikator teknikal
    │       ├── analysis/news/route.ts         (464)  sentimen per ticker (AI)
    │       ├── news/route.ts                  (118)  feed berita
    │       ├── news/summary/route.ts          (504)  rangkuman AI + SSRF guard
    │       ├── ticker/route.ts                (176)  harga & pencarian ticker
    │       ├── dividend/route.ts              (371)
    │       ├── market-summary/route.ts        (184)  IHSG + top gainers/losers
    │       └── keepalive/route.ts             (36)   ping Supabase (cron)
    ├── components/            23 komponen (lihat §5)
    │   analysis-tab (2374) · compounding-tab (1720) · ipo-tab (1032) · dividend-tab (995)
    │   portfolio-tab (957) · calculator-form (896) · admin-panel-tab (777) · percentage-tab (775)
    │   news-tab (604) · results-display (423) · sidebar (387) · history-table (352)
    │   auth-modal (320) · client-bootstrap (294) · portfolio-snapshot (279) · watchlist-mini (276)
    │   market-summary (215) · quick-search-ticker (177) · stepper-input (150) · confirm-modal (135)
    │   educational-tip-card (117) · trending-news-strip (106) · theme-provider (11)
    └── lib/
        translations.ts (882) · tickers.ts (962, sekitar 940 ticker BEI) · compounding.ts (357)
        e-ipo.ts (261) · calculator.ts (238) · dividend.ts (209) · percentage.ts (121)
        format.ts (116) · rate-limit.ts (86) · language-context.tsx (70) · crypto.ts (48)
        supabase.ts (41) · utils.ts (35) · supabase-server.ts (34) · auth-guard.ts (32)
        types.ts (26) · validators.ts (17)
```

---

## 5. Bedah Menu & Fitur

Ringkasan akses tiap menu:

| # | Menu (ID) | Komponen utama | Akses | Simpan data |
|---|---|---|---|---|
| 0 | Beranda | `page.tsx` + 6 widget | Publik (sebagian widget hanya untuk yang login) | Watchlist (lokal) |
| 1 | Berita & Sentimen | `news-tab.tsx` | Publik; Rangkuman AI wajib login | — |
| 2 | Kalkulator Avg Down | `calculator-form`, `results-display`, `history-table` | Publik | Supabase / lokal |
| 3 | Compounding | `compounding-tab.tsx` | Publik | Supabase / lokal (simpan, muat, hapus) |
| 4 | Persentase | `percentage-tab.tsx` | Publik | Riwayat lokal (5) |
| 5 | Dividen | `dividend-tab.tsx` | Publik | — |
| 6 | E-IPO | `ipo-tab.tsx` | Publik | Muat/hapus saja (tidak ada tombol save) |
| 7 | Analisis Saham Pro | `analysis-tab.tsx` | **Wajib login** | — |
| 8 | Portofolio Saya | `portfolio-tab.tsx` | **Wajib login** | Supabase / lokal |
| 9 | Admin Panel | `admin-panel-tab.tsx` | **Hanya email admin** | Supabase RPC |
| — | Riwayat, Watchlist | — | Nonaktif (badge "Segera") | — |

### 5.0 Sidebar & Navigasi ([sidebar.tsx](src/components/sidebar.tsx))

- **Daftar menu:** [sidebar.tsx:47-60](src/components/sidebar.tsx#L47-L60).
  - Menu `analysis` dan `portfolio` tampil dengan ikon gembok bila belum login.
  - Menu `admin` hanya muncul bila email pengguna sama dengan `NEXT_PUBLIC_ADMIN_EMAIL` (default `admin@nunnnstock.com`, [sidebar.tsx:44](src/components/sidebar.tsx#L44)).
- **Ikon (lucide-react), unik per menu:** Beranda `Home`, Berita `Newspaper`, Avg Down `Calculator`, Compounding `Sprout`, Persentase `Percent`, Dividen `HandCoins`, E-IPO `Rocket`, Analisis `ChartCandlestick`, Portofolio `Briefcase`, Admin `ShieldCheck`, Riwayat `History`, Watchlist `Star`. Badge judul di setiap tab memakai ikon yang sama dengan sidebar.
- **Desktop:**
  - Sidebar fixed yang bisa diciutkan (260px ↔ 80px). Chevron untuk menciutkan baru muncul saat hover.
  - Klik logo membuka Beranda.
  - Pengalih bahasa ID/EN; saat sidebar diciutkan berubah jadi satu tombol toggle.
  - Footer profil berisi email dan tombol logout, atau tombol "Masuk ke Akun".
- **Mobile:** header atas 64px dengan tombol hamburger, lalu drawer geser 280px yang berisi menu, pengalih bahasa, dan area profil.

### 5.1 Beranda ([page.tsx:613-833](src/app/page.tsx#L613-L833))

| Widget | File | Perilaku |
|---|---|---|
| Hero | page.tsx | Badge, judul, deskripsi; CTA login bila belum masuk |
| Quick-nav | page.tsx:660-715 | 5 tombol pintas: Avg Down, Dividen, Compounding, Persentase, E-IPO. Subjudul masih *hardcoded* ID |
| QuickSearchTicker | [quick-search-ticker.tsx](src/components/quick-search-ticker.tsx) | Debounce 350ms ke `/api/ticker?q=` (maks 10 hasil). Navigasi ↑/↓/Enter/Esc, tombol hapus, klik di luar menutup dropdown. Memilih ticker membuka **Analisis** |
| Badge koneksi | page.tsx:729-742 | Hanya saat login: "Terhubung", email, dan mode Cloud/Lokal |
| MarketSummary | [market-summary.tsx](src/components/market-summary.tsx) | Refresh tiap 30 detik. Kartu IHSG (harga, perubahan, high/low, volume, indikator LIVE), Top 5 Gainers, Top 5 Losers. Ada skeleton, kartu error, dan pesan saat kosong |
| PortfolioSnapshot | [portfolio-snapshot.tsx](src/components/portfolio-snapshot.tsx) | Hanya saat login: Total Equity, Market Value, P&L (Rp/%), Buying Power (kas RDN). Angka disingkat T/B/M/K. Tombol "Lihat Detail" ke Portofolio. Dimuat ulang lewat `refreshKey` saat kembali dari tab Portofolio |
| TrendingNewsStrip | [trending-news-strip.tsx](src/components/trending-news-strip.tsx) | 4 berita dari `/api/news?category=saham` dengan waktu relatif |
| WatchlistMini | [watchlist-mini.tsx](src/components/watchlist-mini.tsx) | localStorage `nunnn_stock_watchlist`, maks 5 ticker. Tiap baris menampilkan harga dan % perubahan. Klik membuka Analisis |
| EducationalTipCard | [educational-tip-card.tsx](src/components/educational-tip-card.tsx) | 1 tip acak dari 8 tip dwibahasa |
| Marquee logo | page.tsx:781-825 | 16 logo emiten dari CDN Stockbit, ditutup disclaimer |

### 5.2 Berita & Sentimen ([news-tab.tsx](src/components/news-tab.tsx))

- **Input:**
  - Kotak pencarian (submit memanggil `/api/news?q=`) dengan tombol hapus, dan tombol refresh.
  - 5 kategori yang bisa digeser: Saham Indonesia, Saham Foreign, Ekonomi Domestik, Ekonomi Global, Politik Domestik.
- **Output:** kartu berita berisi judul, badge sumber, tanggal, dan link "Baca Sumber". Sumber data: Google News RSS 7 hari terakhir.
- **Rangkuman AI:**
  - Belum login: tombol menampilkan gembok dan membuka modal login ([news-tab.tsx:422-444](src/components/news-tab.tsx#L422-L444)).
  - Sudah login: panel memanggil `POST /api/news/summary` sekali, lalu hasilnya di-cache di state ([news-tab.tsx:141-190](src/components/news-tab.tsx#L141-L190)).
  - Isi panel: badge mesin yang dipakai (Gemini/Groq/OpenAI atau "Heuristic Engine"), Highlight Utama, Konteks Singkat, Key Findings bernomor, Key Takeaway, dan disclaimer.
  - State: skeleton "AI sedang membaca...", serta pesan error dengan tombol "Coba Lagi".
- **State feed:** 4 kartu skeleton, banner error, dan tampilan kosong dengan tombol "Kembali ke Kategori Utama".
- ⚠️ Dalam kondisi produksi saat ini, Rangkuman AI kemungkinan selalu 401. Lihat [C-01](#c-01).

### 5.3 Kalkulator Average Down

File: [calculator-form.tsx](src/components/calculator-form.tsx), [results-display.tsx](src/components/results-display.tsx), [history-table.tsx](src/components/history-table.tsx), [stepper-input.tsx](src/components/stepper-input.tsx), dan logika di [lib/calculator.ts](src/lib/calculator.ts).

**Form.** Hasil dihitung ulang setiap kali input berubah ([calculator-form.tsx:310](src/components/calculator-form.tsx#L310)).

- **Contoh awal:** GTSI (GTS Internasional), 100 lot @ Rp160, beli 100 lot lagi ([calculator-form.tsx:20](src/components/calculator-form.tsx#L20)). Harga sekarang langsung diambil live saat halaman dibuka.
- **Tombol Reset** di header form mengembalikan semua isian ke contoh awal.
- **Tata letak:** satu kolom di layar sempit; mulai `xl` memakai grid 12 kolom (Step 1 & 2 di baris pertama, Step 3 lebar 8/12 dan Step 4 lebar 4/12 di baris kedua).

1. **Saham & Emiten.**
   - Logo, ticker (maks 5 karakter, hanya huruf/angka), dan nama perusahaan.
   - Nama dari kamus lokal tampil instan; nama & harga dari `/api/ticker` diambil 400 ms setelah berhenti mengetik (≥4 karakter).
2. **Posisi Awal.**
   - Lot Awal, Avg Price, dan Harga Sekarang (dengan tombol isi harga pasar).
   - Checkbox "Avg Price awal sudah termasuk fee beli" (hanya muncul bila fee aktif).
3. **Rencana Beli Baru.**
   - Bisa lebih dari satu tahap. Tiap tahap berisi lot, harga beli (dengan tombol isi harga pasar), dan dana dibutuhkan.
   - **Tahap baru terisi otomatis:** lot sama dengan tahap terakhir, harga 5% di bawahnya dan dibulatkan ke fraksi BEI ([calculator-form.tsx:349](src/components/calculator-form.tsx#L349)).
   - **Peringatan fraksi harga** (kuning) bila harga beli bukan kelipatan fraksi BEI.
   - Di HP, setiap tahap tampil sebagai kartu: baris atas berisi nomor tahap, dana, dan tombol hapus; di bawahnya Lot dan Harga Beli berdampingan.
4. **Broker Fee.**
   - Preset: Stockbit 0,15/0,25, Ajaib 0,15/0,25, IPOT 0,19/0,29, Custom, atau Tanpa Fee ([calculator-form.tsx:84](src/components/calculator-form.tsx#L84)).
   - Custom membuka input % beli dan % jual.

**Tombol −/+ ([StepperInput](src/components/stepper-input.tsx)).** Semua kolom angka punya tombol −/+ di kedua sisi; bisa diklik, ditahan (mengulang otomatis), atau memakai panah ↑/↓ keyboard. Angka tetap bisa diketik manual.

| Kolom | Langkah |
|---|---|
| Lot Awal, Lot per tahap | ±1 lot (minimal 1) |
| Harga Sekarang, Harga Beli | ±1 fraksi BEI lewat `stepIdxPrice` (199 → 200 → 202; harga tidak valid di-snap, 2.755 → 2.760/2.750) |
| Avg Price | ±1 fraksi, desimal dipertahankan |
| Fee custom | ±0,01% (0–10%) |

**Baris aksi** ([calculator-form.tsx:848](src/components/calculator-form.tsx#L848)):
- Ringkasan live: Avg Baru (+ % perubahan), Harga BEP (+ % jarak dari harga sekarang), dan Modal Baru.
- Tombol "Simpan" (cloud) atau "Simpan Lokal"; bila nonaktif, alasannya ditampilkan.
- Data disimpan ke tabel `avg_down_plans` atau localStorage `nunnn_stock_saved_plans` ([page.tsx:375](src/app/page.tsx#L375)).

> ⚠️ Saat disimpan, semua tahap masih digabung jadi satu lot dan satu harga rata-rata tertimbang ([page.tsx:389](src/app/page.tsx#L389)). Rincian per tahap hilang, dan flag `avgPriceAwalIncludesFee` hanya ikut tersimpan di mode lokal. Lihat [M-14](#m-14).

**Hasil ([results-display.tsx](src/components/results-display.tsx)):**
- Tampilan kosong "Menunggu Input Data".
- Baris atas 3 kartu: Emiten (logo, ticker, nama), Modal Baru (+lot/lembar), Total Lot Akhir.
- **SEBELUM vs SESUDAH**: avg price, modal, market value, **Harga BEP (impas setelah fee jual)** dengan keterangan "Butuh naik x%", dan floating P&L (Rp/%). Badge "Berbalik Profit!" beranimasi sekali bila posisi berbalik untung.
- **Rangkuman Perbaikan Posisi**:
  - % perubahan avg price. Bila harga beli baru di atas avg, label berubah menjadi "Harga Rata-Rata Naik" (kuning) dengan catatan bahwa ini sebenarnya average up.
  - % pengurangan floating loss ("100% (Sembuh!)" bila impas/untung; "Floating Loss Membesar" bila justru bertambah).
  - Kalimat jarak ke BEP sebelum vs sesudah, misalnya "harga perlu naik 9,61% (sebelumnya 18,82%)".
  - Bila posisi awal sudah untung, yang tampil pesan "Posisi Portofolio Sehat".
- Format angka mengikuti bahasa (id-ID / en-US).

**Rencana tersimpan ([history-table.tsx](src/components/history-table.tsx)):**
- Kartu berjudul "Rencana Tersimpan" dengan jumlah rencana; semua teks dwibahasa.
- Desktop: tabel Saham, Posisi Awal, Rencana Baru, Estimasi Avg Baru (badge Turun/Naik), Tanggal, Aksi. Mobile: kartu.
- Estimasi memakai `calculateAvgDown` yang sama dengan kalkulator, termasuk fee.
- Tombol "Muat" berlabel; setelah diklik halaman otomatis scroll kembali ke form ([page.tsx:498](src/app/page.tsx#L498)). Hapus memakai modal konfirmasi.
- Peringatan localStorage untuk pengguna yang belum login, dengan link "Masuk ke akun" yang membuka modal login lewat prop `onSignInClick`.
- Aksi "Avg Down" dari tab Portofolio mengisi form ini secara otomatis ([page.tsx:509](src/app/page.tsx#L509)).

### 5.4 Kalkulator Compounding ([compounding-tab.tsx](src/components/compounding-tab.tsx), [lib/compounding.ts](src/lib/compounding.ts))

Ada dua mode: **Rencana Trading** (default) dan **Investasi Jangka Panjang**. Header form berisi tombol Reset, Cetak (`window.print`, desktop), dan **Simpan Rencana**.

**Rencana Trading: Harian / Bulanan / Tahunan**
- Pilihan periode muncul di samping pemilih mode. Setiap periode menyimpan nilainya sendiri (target, durasi, setoran), jadi berpindah periode tidak menghapus isian.
- Default ([compounding-tab.tsx:79](src/components/compounding-tab.tsx#L79)):

  | Periode | Target | Durasi | Batas durasi |
  |---|---|---|---|
  | Harian | 1%/hari | 20 hari | 2.520 hari |
  | Bulanan | 5%/bulan | 12 bulan | 600 bulan |
  | Tahunan | 20%/tahun | 10 tahun | 100 tahun |

- Input: modal awal, target profit per periode (%), durasi (dengan tombol pintas, mis. 1 bln/3 bln/6 bln/1 thn), setoran tambahan per periode, dan broker fee (preset atau custom).
- **Konversi target** di bawah kolom target, misalnya "1%/hari ≈ 23,24%/bulan · ≈ 1.127%/tahun (majemuk, sebelum fee)". Muncul peringatan kuning bila setara lebih dari 100% per tahun.
- Asumsi hari bursa: 21 hari per bulan, 252 per tahun.
- Fee broker dipotong 1× beli + 1× jual setiap periode.
- Kartu ringkasan: Modal Akhir, Profit Bersih (+ return %), Total Disetor, **Total Fee Broker**.

**Investasi Jangka Panjang:**
- Input: modal awal, setoran berkala + frekuensinya (harian/mingguan/bulanan/tahunan), return tahunan % + frekuensi bunga (harian/bulanan/kuartalan/tahunan), jangka waktu (0–100 tahun + 0–11 bulan), inflasi % dan pajak bunga %.
- Kartu ringkasan: Total Saldo Akhir (+ return %), Akumulasi Setoran, Akumulasi Bunga (kotor, + total pajak), dan **Saldo Riil** (disesuaikan inflasi).

**Input angka.** Semua kolom angka memakai tombol −/+:
- Nominal Rupiah: langkah mengikuti besarnya angka (10 juta → ±1 juta; di bawah 1 juta → ±100 ribu).
- Persen: target ±0,1 (harian) / ±0,5 (bulanan) / ±1 (tahunan); return & inflasi & pajak ±0,5; fee ±0,01.
- Persen menerima koma maupun titik sebagai desimal ("0,5" = "0.5").

**Grafik** ([compounding-tab.tsx:1314](src/components/compounding-tab.tsx#L1314)):
- Dimulai dari titik modal awal. Isi: area saldo nominal, garis total setoran, dan garis nilai riil (khusus jangka panjang).
- Bisa di-hover dengan mouse maupun disentuh di HP; tooltip mengikuti titik yang disorot.
- Jangka panjang: titik per tahun bila durasi > 36 bulan, selain itu per bulan.
- Angka besar disingkat Juta/Miliar/Triliun … (EN: Million/Billion/Trillion …).

**Tabel** ([compounding-tab.tsx:1463](src/components/compounding-tab.tsx#L1463)):
- Header tetap terlihat saat di-scroll; jumlah baris ditampilkan.
- Kolom: Periode, Saldo Awal, Setoran, Profit/Bunga, Fee Broker atau Pajak (bila > 0), Saldo Akhir, Saldo Riil (bila inflasi > 0), Return Kumulatif.
- Rencana Trading: Harian bisa dilihat **Per Hari / Rekap Bulanan / Rekap Tahunan**; Bulanan bisa **Per Bulan / Rekap Tahunan**; Tahunan per tahun ([compounding-tab.tsx:711](src/components/compounding-tab.tsx#L711)).
- Jangka panjang: toggle Tahunan/Bulanan.

**Rencana tersimpan** ([compounding-tab.tsx:1533](src/components/compounding-tab.tsx#L1533)):
- Simpan lewat dialog dengan judul otomatis (mis. "Trading Harian 1% × 20 Hari"); bisa dimuat dan dihapus (dengan konfirmasi).
- Disimpan di Supabase `compounding_plans` atau localStorage `nunnn_stock_compounding_plans`. Lihat §8.1 untuk pemetaan kolom rencana trading.
- Ada CSS khusus cetak ([compounding-tab.tsx:806](src/components/compounding-tab.tsx#L806)).

### 5.5 Kalkulator Persentase ([percentage-tab.tsx](src/components/percentage-tab.tsx), [lib/percentage.ts](src/lib/percentage.ts))

| Mode | Input | Output |
|---|---|---|
| Perubahan % | Dari, Ke | % perubahan, selisih, multiplier, % yang dibutuhkan untuk kembali ke awal |
| Naik/Turun % | Nilai dasar, % | Nilai setelah naik/turun, selisih, faktor |
| % dari Nilai | %, Total | Nilai bagian, sisa |
| Berapa % | Bagian, Total | Persentase, sisa % |
| Nilai Awal (reverse) | Nilai akhir, % | Nilai awal, selisih |

**Fitur pendukung:**
- Tombol tukar (khusus mode Perubahan) dan toggle Naik/Turun (mode Naik/Turun dan Nilai Awal).
- Preset 5/10/20/25/50%.
- Hasil langsung tampil saat mengetik, dengan `aria-live`.
- Catatan pemulihan saat turun, misalnya "Turun 50% butuh naik 100%".
- Baris rumus, tombol salin ringkasan ke clipboard, dan tombol simpan.
- Riwayat 5 entri terakhir tanpa duplikat (`nunnn_stock_percentage_history`), dengan tombol "Hapus Semua".

**State error:** basis 0, total 0, penurunan ≥100% yang tidak bisa dibalik, dan input tidak valid.

> ⚠️ Input "0.125" terbaca sebagai 125. Lihat [M-01](#m-01).

### 5.6 Kalkulator Dividen ([dividend-tab.tsx](src/components/dividend-tab.tsx), [lib/dividend.ts](src/lib/dividend.ts))

**Pilih saham:**
- Ticker, logo, dan badge BEI.
- Pencarian dengan debounce ke `/api/ticker?q=`, plus tombol fallback "Pilih {TICKER}".
- Kartu harga live dengan tombol refresh.
- 13 saham dividen populer sebagai pilihan cepat, lengkap dengan yield ([dividend-tab.tsx:38-52](src/components/dividend-tab.tsx#L38-L52)).
- Mengganti ticker akan memanggil `/api/dividend`, yang mengisi nama, harga, dividen per saham setahun, bulan pembayaran, riwayat, dan ringkasan tahunan.

**Parameter:**
- Mode Nominal (Rp) atau Jumlah Lot (keduanya saling sinkron).
- Harga beli dan DPS 1 tahun, dengan baris yield-on-cost.
- Pajak: 0%, 10% (final), atau custom.
- Checkbox DRIP (reinvestasi dividen).

**Output:**
- Rata-rata pendapatan bersih per bulan dan Effective Net Yield.
- Dividen bruto, pajak, dan neto setahun.
- Tabel Jan–Des, dengan bulan pembayaran ditandai Final/Interim.
- Tabel riwayat dividen.
- Proyeksi DRIP 5 tahun (bila DRIP dicentang).

**Tidak ada fitur simpan.** Props `user` dan `onSignInClick` diterima tetapi tidak dipakai, dan state toast tidak pernah di-set.

> ⚠️ Ada teks rusak (mojibake) "â‰ˆ" dan "â†" di [dividend-tab.tsx:608-612](src/components/dividend-tab.tsx#L608-L612) dan [:847](src/components/dividend-tab.tsx#L847). Lihat [L-02](#l-02).

### 5.7 Kalkulator E-IPO ([ipo-tab.tsx](src/components/ipo-tab.tsx), [lib/e-ipo.ts](src/lib/e-ipo.ts))

**Aturan OJK:** accordion berisi tabel golongan I–V, alokasi minimum, 3 tingkat penyesuaian (clawback), dan perbandingan aturan lama 1:2 dengan aturan baru 1:1.

**Input:**
- Ticker (maks 6 karakter; nama dan harga terisi otomatis), nama, dan harga.
- Lot ditawarkan, oversubscription (×), dan jumlah pemesan.
- Pesanan pribadi (lot), dengan baris "Dana dibutuhkan".
- Slider rasio ritel 10–95%.

**Output:**
- 4 kartu: nilai emisi, golongan, alokasi awal, dan alokasi setelah clawback.
- Perbandingan **SEOJK 15/2020 (1:2)** dan **SEOJK 25/2025 (1:1, "Terbaru")**: pool lot, lot ritel/non-ritel, rata-rata jatah, peluang dapat 1 lot.
- Simulasi pribadi:
  - Badge Ritel (≤ Rp100 juta) atau Non-Ritel.
  - Estimasi rata-rata, proporsional, jatah minimal yang dijamin, dan % peluang mendapat lot tambahan.

**Rencana tersimpan:** bisa dimuat dan dihapus (`ipo_plans` atau `nunnn_stock_ipo_plans`). **Tidak ada tombol simpan** di UI.

### 5.8 Analisis Saham Pro ([analysis-tab.tsx](src/components/analysis-tab.tsx), wajib login)

- **Terkunci** bila belum login: ikon perisai dan CTA login ([analysis-tab.tsx:500-523](src/components/analysis-tab.tsx#L500-L523)).
- **Header:**
  - Ticker aktif.
  - Toggle **LIVE**: refresh diam-diam tiap 60 detik ([analysis-tab.tsx:411-417](src/components/analysis-tab.tsx#L411-L417)).
  - Tombol refresh.
  - Pencarian dengan saran: 16 ticker populer ditambah `/api/ticker?q=`.
  - Banner error dan stempel waktu "Diperbarui".
- **Sebelum mencari:** panel hero dengan pilihan cepat Blue Chips (5) dan Growth (6).
- **Pemuatan:** tiga request berurutan (fundamentals → technical → news, [analysis-tab.tsx:364-406](src/components/analysis-tab.tsx#L364-L406)), dengan skeleton penuh saat pertama kali dimuat.

**Kartu Konsensus:**
- Skor gabungan = fundamental 30% + teknikal 35% + bandarmology 20% + narasi berita 15%, lalu −5 bila risiko High atau +2 bila Low ([analysis-tab.tsx:685](src/components/analysis-tab.tsx#L685)).
- Menampilkan rating, daftar pro/kontra, 4 sub-skor, dan meter 5 warna.

**TradingView:** iframe setinggi 540px dengan studi RSI, MACD, dan Pivot.

**Dashboard teknikal:**
- RSI(14) dan MACD.
- Pivot S/R, dengan toggle Standar/Fibonacci.
- SMA/EMA 20 dan 50.
- Multi-timeframe (Weekly/Daily/"Hourly").
- 6 kartu: Bollinger, Stochastic, ADX, ATR + VWAP, OBV, dan Risk (volatilitas, max drawdown, Sharpe).
- Kesimpulan.

**Bandarmology:**
- Status akumulasi/distribusi, net foreign flow, bar MFI, dan tabel top-3 broker beli/jual.
- ⚠️ Broker dan foreign flow adalah data **sintetis**, lihat [H-01](#h-01).

**Sentimen:** badge sentimen, ringkasan AI (dengan label mesin), daftar berita terkait, dan kesimpulan.

**Fundamental:**
- 9 kartu metrik: P/E, PBV, ROE, ROA, DER, Dividend Yield, EPS, NPM, dan Market Cap.
- Grafik batang SVG revenue dan laba bersih (toggle Tahunan/Kuartalan) beserta kesimpulan.

> ⚠️ Warna legenda grafik (emerald/teal, [analysis-tab.tsx:2340-2349](src/components/analysis-tab.tsx#L2340-L2349)) tidak sama dengan warna batang (violet/teal, [:220](src/components/analysis-tab.tsx#L220), [:230](src/components/analysis-tab.tsx#L230)).

### 5.9 Portofolio Saya ([portfolio-tab.tsx](src/components/portfolio-tab.tsx), wajib login)

**Ringkasan:** Total Equity, Modal Diinvestasikan, dan Total Return (Rp/%).

**Holdings:**
- Tombol "Tambah Saham" dan refresh.
- Harga diambil 4 ticker sekaligus secara paralel ([portfolio-tab.tsx:217-262](src/components/portfolio-tab.tsx#L217-L262)). Label "(Menggunakan Avg)" muncul bila harga gagal diambil.
- Desktop: tabel dengan kolom Saham, Lot, Avg, Last, Invested, Market Value, P&L, Aksi. Mobile: tampilan kartu.
- Aksi per baris:
  - **Analisis**: membuka tab Analisis.
  - **Avg Down**: mengisi kalkulator Avg Down secara otomatis.
  - **Ubah**: membuka modal edit.
  - **Hapus**: dengan modal konfirmasi.

**Modal tambah/ubah:** ticker (nama dan harga terisi otomatis; terkunci saat mode edit), nama, lot, dan avg price.

**Penyimpanan:**
- Supabase `portfolio_holdings` dan `portfolio_cash`, atau localStorage `nunnn_stock_portfolio_holdings_{uid}` / `_cash_{uid}`.
- Penggunaan pertama otomatis membuat 2 holding demo ([portfolio-tab.tsx:122-127](src/components/portfolio-tab.tsx#L122-L127)).
- Error ditampilkan dengan `alert()`.

### 5.10 Admin Panel ([admin-panel-tab.tsx](src/components/admin-panel-tab.tsx))

**Sub-tab Persetujuan Pengguna:**
- Statistik total, disetujui, dan pending.
- Pencarian email dan filter Semua/Disetujui/Pending.
- Tabel berisi email (dengan tag "Admin (Anda)"), tanggal daftar, dan status.
- Aksi: Setujui/Tangguhkan (dengan konfirmasi) dan Hapus. Aksi untuk baris milik sendiri dinonaktifkan.
- Semua aksi berjalan lewat RPC `admin_set_user_approval` dan `admin_delete_user`.

**Sub-tab Status Database & Koneksi:**
- Badge status Supabase dan auth.
- Jumlah 5 jenis data lokal.
- Tombol "Reset Data Simulasi": membuat ulang password admin demo dan menampilkannya sekali ([admin-panel-tab.tsx:87-118](src/components/admin-panel-tab.tsx#L87-L118)).

### 5.11 Modal

- **AuthModal** ([auth-modal.tsx](src/components/auth-modal.tsx)):
  - Field email dan password, toggle Masuk/Daftar, dan tombol Google OAuth.
  - Banner "Mode Simulasi (Lokal)" saat Supabase tidak dikonfigurasi.
  - Akun yang baru mendaftar menunggu approval admin; pemberitahuannya lewat `alert`.
  - Semua teks masih *hardcoded* dalam Bahasa Indonesia.
- **ConfirmModal** ([confirm-modal.tsx](src/components/confirm-modal.tsx)): dirender lewat portal, dengan varian danger, warning, dan info.

---

## 6. Logika Kalkulasi & Rumus

### 6.1 Average Down: `calculateAvgDown` ([calculator.ts:97](src/lib/calculator.ts#L97))

```
lembar         = lot × 100
avgAwalRiil    = includeFees && !avgIncludesFee ? avg × (1 + feeBeli) : avg
modalAwal      = lembarAwal × avgAwalRiil
P/L awal       = (includeFees ? MV × (1 − feeJual) : MV) − modalAwal
modalBaru      = Σ tahap (lot×100 × harga × (1 + feeBeli bila includeFees))
avgBaru        = (modalAwal + modalBaru) / (lembarAwal + lembarBaru)
avgReduction%  = (avgAwalRiil − avgBaru) / avgAwalRiil × 100   ← negatif = average up
lossShrunk%    = (PL%awal − PL%akhir) / PL%awal × 100 ; 100 bila berbalik untung, negatif bila loss membesar
hargaBEP       = modal / (lembar × (1 − feeJual bila includeFees))     ← harga jual impas
butuhNaik%     = (hargaBEP − hargaSekarang) / hargaSekarang × 100
```

Contoh default GTSI (100 lot @160, beli 100 lot @135, harga 135, fee Stockbit): avg 160 → 147,60 (−7,75%), BEP 160,40 → 147,97, butuh naik 18,82% → 9,61%.

**Fraksi harga BEI** ([calculator.ts:60-95](src/lib/calculator.ts#L60-L95)):

| Rentang harga | Fraksi |
|---|---|
| < Rp200 | Rp1 |
| Rp200 – < Rp500 | Rp2 |
| Rp500 – < Rp2.000 | Rp5 |
| Rp2.000 – < Rp5.000 | Rp10 |
| ≥ Rp5.000 | Rp25 |

- `getIdxTickSize`, `isValidIdxPrice`, `roundDownToIdxTick`.
- `stepIdxPrice(harga, ±1)`: naik/turun satu fraksi. Turun memakai fraksi rentang di bawahnya (200 → 199, 500 → 498); harga yang tidak valid di-snap ke arah yang dituju.

### 6.2 Compounding jangka panjang: `calculateCompounding` ([compounding.ts:54](src/lib/compounding.ts#L54))

Simulasi dihitung **per bulan**, selama `totalMonths = max(1, tahun×12 + bulan)`.

**Konversi return tahunan ke rate bulanan, sesuai frekuensi compounding:**

| Frekuensi compounding | Rumus `r_monthly` |
|---|---|
| tahunan | (1+r)^(1/12) − 1 |
| kuartalan | (1+r/4)^(1/3) − 1 |
| bulanan | r/12 |
| harian | (1+r/365)^(365/12) − 1 |

**Konversi setoran ke jumlah per bulan:**

| Frekuensi setoran | Setoran per bulan |
|---|---|
| harian | × 30,417 |
| mingguan | × 4,333 |
| bulanan | × 1 |
| tahunan | penuh, hanya di bulan ke-12, 24, … |

**Langkah per bulan:**
1. Bunga = saldo awal bulan × `r_monthly`.
2. Pajak = bunga × tarif pajak.
3. Saldo baru = saldo + setoran + (bunga − pajak). Setoran masuk di akhir bulan, jadi belum berbunga pada bulan itu.
4. Saldo riil = saldo / (1 + i_monthly)^m, dengan i_monthly = (1+inflasi)^(1/12) − 1.

### 6.3 Rencana Trading: `calculateTradingCompounding` ([compounding.ts:246](src/lib/compounding.ts#L246))

Satu fungsi untuk periode harian, bulanan, dan tahunan. Per periode:

```
profit = saldo × r                                       ← r = target % per periode
fee    = saldo × feeBeli + (saldo + profit) × feeJual    ← asumsi seluruh saldo diputar 1× per periode
saldo  = saldo + setoran + (profit − fee)
```

- **Asumsi hari bursa** ([compounding.ts:195-212](src/lib/compounding.ts#L195-L212)): 21 hari per bulan, 252 per tahun. Batas jumlah periode: 2.520 hari, 600 bulan, 100 tahun.
- **Konversi target antar periode** `convertTradingRate` ([compounding.ts:351](src/lib/compounding.ts#L351)): `(1 + r)^(hari_tujuan / hari_asal) − 1`, majemuk dan sebelum fee. Contoh: 1%/hari ≈ 23,24%/bulan ≈ 1.127%/tahun; 5%/bulan ≈ 79,59%/tahun.
- **Rekap** `groupTradingDetails` ([compounding.ts:323](src/lib/compounding.ts#L323)): menggabungkan N periode menjadi satu baris (21 hari → bulan, 252 hari → tahun, 12 bulan → tahun). Kelompok terakhir boleh tidak penuh (mis. 50 hari → 1–21, 22–42, 43–50). Return kumulatif = (saldo akhir − total setoran) / total setoran.

### 6.4 Dividen: `calculateDividend` ([dividend.ts:84](src/lib/dividend.ts#L84))

**Jumlah lembar:**
- Mode lot: lembar = lot × 100.
- Mode nominal: lot = floor(floor(Rp / harga) / 100). `totalInvestmentRp` **tidak dihitung ulang** setelah pembulatan, lihat [M-10](#m-10).

**Dividen dan yield:**
- Bruto = lembar × DPS.
- Pajak = bruto × tarif.
- Net yield = neto / investasi.
- Rata-rata per bulan = neto / 12.

**Rincian bulanan:**
- Neto dibagi rata ke bulan-bulan pembayaran. Defaultnya bulan [4, 12] bila data tidak ada.
- Bila ada 2 kali pembayaran, bulan yang lebih awal diberi label "Final" dan yang lain "Interim".

**DRIP 5 tahun:** tiap tahun, lembar baru = floor(neto / harga beli). Harga dianggap tetap (tidak ada asumsi kenaikan harga maupun DPS).

### 6.5 E-IPO ([e-ipo.ts](src/lib/e-ipo.ts))

**Golongan dan alokasi awal:**

| Golongan | Nilai emisi | Alokasi awal (maks % vs Rp minimal) |
|---|---|---|
| I | ≤ Rp100 M | 20% / Rp10 M |
| II | ≤ Rp250 M | 15% / Rp20 M |
| III | ≤ Rp500 M | 10% / Rp37,5 M |
| IV | ≤ Rp1 T | 7,5% / Rp50 M |
| V | > Rp1 T | 2,5% / Rp75 M |

**Clawback** ([e-ipo.ts:104](src/lib/e-ipo.ts#L104)):

| Oversubscription | Gol. I | II | III | IV | V |
|---|---|---|---|---|---|
| < 2,5× | (tetap) | | | | |
| 2,5–10× | 22,5% | 17,5% | 12,5% | 10% | 5% |
| 10–25× | 25% | 20% | 15% | 12,5% | 7,5% |
| ≥ 25× | 30% | 25% | 20% | 17,5% | 12,5% |

Hasil akhirnya adalah nilai terbesar antara % awal dan % penyesuaian.

**Pembagian pool dan simulasi pribadi:**
- Porsi ritel: aturan lama 1/3 (1:2), aturan baru 1/2 (1:1).
- Rata-rata jatah = pool / jumlah pemesan.
- Peluang dapat 1 lot = min(100, rata-rata × 100).
- Pesanan pribadi:
  - Masuk kategori ritel bila nilainya ≤ Rp100 juta.
  - Estimasi = max(min(pesanan, rata-rata), pesanan / oversubscription).
  - Dijamin = floor(estimasi); sisanya ditampilkan sebagai % peluang lot tambahan.

### 6.6 Persentase ([percentage.ts](src/lib/percentage.ts))

Semua fungsi mengembalikan `{ok:true, ...} | {ok:false, error}`, dengan EPSILON = 1e-12.

| Fungsi | Rumus | Kasus error / catatan |
|---|---|---|
| `percentChange` | (to − from) / \|from\| × 100 | Error bila from = 0. Multiplier = null bila from < 0. returnToStart = (from − to) / \|to\| (null bila to = 0) |
| `applyPercent` | base × (1 ± p/100) | — |
| `percentOf` | total × p/100 | — |
| `whatPercent` | part / total × 100 | `zero-base` bila total = 0 |
| `reversePercent` | final / (1 ± p/100) | `non-positive-factor` bila faktor ≤ EPSILON |

### 6.7 Indikator teknikal ([api/analysis/technical/route.ts](src/app/api/analysis/technical/route.ts))

Data: Yahoo `v8/finance/chart`, harian 6 bulan dan mingguan 1 tahun. Semua indikator dihitung di server dan **tidak di-export**, sehingga belum bisa dites.

| Indikator | Fungsi (baris) | Parameter & catatan |
|---|---|---|
| RSI | `calculateRSI` (20) | Wilder 14. Hasil 50 bila data ≤ periode; **100 bila avgLoss = 0** (seri datar ikut jadi 100, [M-03](#m-03)) |
| MFI | `calculateMFI` (56) | Periode 14. Seed jumlah mentah lalu smoothing Wilder (non-standar). TP sama dihitung sebagai negatif |
| EMA | `calculateEMA` (98) | k = 2/(p+1), seed nilai pertama (bukan SMA) |
| SMA | `calculateSMA` (113) | Rata-rata p terakhir; nilai terakhir bila data kurang |
| MACD | `calculateMACD` (120) | 12/26/9, deteksi crossover, `histRising` |
| Bollinger | `calculateBollingerBands` (171) | SMA20 ± 2σ (populasi), %B, bandwidth |
| Stochastic | `calculateStochastic` (199) | %K 14 (fast), %D = SMA3. Sinyal 80/20 |
| ATR | `calculateATR` (234) | Wilder 14 |
| OBV | `calculateOBV` (260) | Tren 10 bar (`last > first×1,02`); divergensi ±2% |
| "VWAP" | `calculateVWAP` (295) | Typical price berbobot volume untuk 20 bar **harian** (bukan VWAP intraday) |
| ADX/DI | `calculateADX` (314) | Periode 14; >25 Strong, >20 Weak. Smoothing mencampur skala jumlah dan rata-rata |
| Risk | `calculateRiskMetrics` (375) | Volatilitas = σ·√252; max drawdown 6 bulan; Sharpe = mean·252 / vol (rf = 0) |
| Pivot | 714-737 | Classic PP/R1-3/S1-3 dan Fibonacci 0,382/0,618/1,0, dari **bar terakhir** (bisa bar yang masih berjalan) |
| MA | 740-743 | SMA20/50, EMA20/50 |

**Multi-timeframe** ([technical/route.ts:771-807](src/app/api/analysis/technical/route.ts#L771-L807)):
- **Weekly**: harga mingguan dibandingkan SMA20/50 mingguan dan RSI mingguan. Fallback: harga > EMA50.
- **Daily**: harga dibandingkan SMA20 dan tanda histogram MACD.
- **"Hourly"**: dihitung dari RSI dan Stochastic **harian**, jadi labelnya menyesatkan.

**Skor konsensus teknikal** ([technical/route.ts:809-868](src/app/api/analysis/technical/route.ts#L809-L868)):

| Sinyal | Bullish | Bearish |
|---|---|---|
| RSI | <30: +1,5 · 55–70: +0,5 | >70: +1,5 · 30–45: +0,5 |
| MACD | Bullish +1 (crossover +2) | Bearish +1 (crossover +2) |
| Harga vs SMA20 / SMA50 | +0,5 / +1,0 | +0,5 / +1,0 |
| Stochastic | Buy Signal +1,5 · Bullish +0,5 | Sell Signal +1,5 · Bearish +0,5 |
| Bollinger %B | <10: +0,5 | >90: +0,5 |
| ADX Strong | +DI > −DI: +1 | sebaliknya: +1 |
| OBV divergence | Bullish +1 | Bearish +1 |

- Skor = bull / (bull + bear) × 100.
- Rating: ≥75 STRONG BUY, ≥55 BUY, ≤25 STRONG SELL, ≤45 SELL, selain itu NEUTRAL.
- Komentar bobot di kode tidak cocok dengan nilai yang dipakai: komentar "Stochastic weight 1.0" padahal nilainya 1,5, dan "MA weight 1.5" padahal 0,5 + 1,0.

### 6.8 Bandarmology (sintetis) ([technical/route.ts:745-899](src/app/api/analysis/technical/route.ts#L745-L899))

**Input dari bar terakhir:**
- `closePos` = (C − L) / (H − L); bernilai 0,5 bila H = L.
- `volumeRatio` = volume terakhir / rata-rata volume 20 hari.

**Status:**

| Syarat | Status |
|---|---|
| closePos > 0,65 & volRatio > 1,25 | BIG ACCUMULATION |
| closePos > 0,55 & volRatio > 1,0 | ACCUMULATION |
| closePos < 0,35 & volRatio > 1,25 | BIG DISTRIBUTION |
| closePos < 0,45 & volRatio > 1,0 | DISTRIBUTION |

**Foreign net buy:**
- Rumusnya `round(C × Vol × (closePos − 0,5) × 0,65)` ([:763](src/app/api/analysis/technical/route.ts#L763)). Angka ini **rekaan**, bukan data asing sebenarnya.
- Daftar broker dan jumlah lot dibuat dari hash ticker (`getBrokerSelection`/`getDeterministicBrokers`/`getDetailedBrokers`, sekitar baris 423-499).

**Skor bandar:**
- Komponen:
  - MFI >70: bear +1,5; MFI <30: bull +1,5.
  - Status: +1,5, atau +2,5 untuk status BIG.
  - Foreign flow: ±1.
  - Tren OBV: ±0,5.
- Ambang rating sama dengan skor teknikal.

### 6.9 Skor fundamental & skor gabungan ([analysis-tab.tsx:525-827](src/components/analysis-tab.tsx#L525-L827))

**Poin fundamental:**

| Metrik | Poin |
|---|---|
| P/E | <0: −2 · <12: +2 · <22: +1 · lainnya: −1 |
| PBV | <1,2: +2 · <3: +1 · lainnya: −1 |
| ROE | >15: +2 · >8: +1 · ≤0: −2 |
| DER | <80: +1 · >200: −1 |
| NPM | >15: +1 · <0: −1 |

- Normalisasi memakai `minPossible = −5` yang di-*hardcode* ([analysis-tab.tsx:617](src/components/analysis-tab.tsx#L617)). Minimum sebenarnya −7, dan nilainya seharusnya bergantung pada metrik yang tersedia ([M-08](#m-08)).
- Skor narasi: Bullish 80, Bearish 20, Netral 50.
- **Skor gabungan** = 0,30·F + 0,35·T + 0,20·B + 0,15·N, lalu −5 bila risiko High dan +2 bila Low ([analysis-tab.tsx:685](src/components/analysis-tab.tsx#L685)).

### 6.10 Parsing angka ([format.ts](src/lib/format.ts))

`parseFormattedNumber` menerima format ID dan EN sekaligus:
- Hanya koma: "1,250,000" dibaca ribuan; "12,5" dibaca desimal.
- Hanya titik: `/\.\d{3}$/` atau lebih dari satu titik dianggap ribuan. Akibatnya "0.125" → 125 ([M-01](#m-01)).
- Ada koma dan titik: pemisah yang muncul terakhir dianggap desimal.

Helper lain: `formatNumberForInput`, `formatIDR`, `formatPercent`.

---

## 7. Referensi API

Semua route berada di `src/app/api/**/route.ts`. Rate limit IP: 100/menit. Rate limit "AI": 10/jam per `user.id`. Keduanya hanya aktif bila Upstash dikonfigurasi.

| Route | Method & param | Auth | Rate limit | Validasi | Sumber eksternal | Bila gagal |
|---|---|---|---|---|---|---|
| `/api/ticker` | GET `?q=` (cari) / `?symbol=` (harga) | — | IP | `q` ≤ 20 karakter `[A-Za-z0-9.\s-]`; `symbol` lewat `validateTickerSymbol` | Yahoo search ×2, chart | 500 untuk pencarian |
| `/api/market-summary` | GET | — | IP | — | Yahoo chart `^JKSE` + spark (sekitar 940 ticker, batch 20, 5 batch paralel) | **502** |
| `/api/news` | GET `?category=` / `?q=` | — | IP | **`q` tidak divalidasi** | Google News RSS | 200 `{news:[], error}` |
| `/api/news/summary` | POST `{title, source, link}` | Cek same-origin + proxy + `requireUser` | IP + AI | Hanya `title` wajib, **tanpa batas panjang** | Google batchexecute, fetch artikel, Gemini (≤5 model) → Groq → OpenAI | Fallback ringkasan heuristik |
| `/api/analysis/fundamentals` | GET `?symbol=` | proxy + `requireUser` | IP + **AI** | validator | Yahoo v7 quote (revalidate 60), v10 quoteSummary | **Data deterministik palsu** |
| `/api/analysis/technical` | GET `?symbol=` | proxy + `requireUser` | IP + **AI** | validator | Yahoo chart 1d/6mo + 1wk/1y | **Data deterministik, harga 5000** |
| `/api/analysis/news` | GET `?symbol=` | proxy + `requireUser` | IP + AI | validator | Google & Yahoo RSS, Gemini/Groq/OpenAI | Berita fallback buatan + sentimen keyword |
| `/api/dividend` | GET `?symbol=` | — | IP | validator | Yahoo chart + `events=div&range=10y` | Dividen deterministik |
| `/api/keepalive` | GET | **Tidak ada** (tanpa `CRON_SECRET`) | — | — | Supabase `select id from user_approvals limit 1` | 500 generik |

**Proxy** ([proxy.ts:48-50](src/proxy.ts#L48-L50)):
- Matcher: `/api/news/summary` dan `/api/analysis/:path*`.
- Hanya mengecek **keberadaan** cookie `sb-<ref>-auth-token`. JWT tidak divalidasi di proxy; validasinya dilakukan di route lewat `requireUser()`.

**Helper server:**
- [auth-guard.ts](src/lib/auth-guard.ts) `requireUser()`: memanggil `auth.getUser()` lewat `@supabase/ssr` (cookie) dan mengembalikan 401 bila tidak ada user. Status approval **tidak dicek**.
- [rate-limit.ts](src/lib/rate-limit.ts) `applyRateLimit(req, id?)`: IP diambil dari `x-forwarded-for` (fallback `127.0.0.1`).
- [validators.ts](src/lib/validators.ts) `validateTickerSymbol`: uppercase lalu dicocokkan dengan `^[A-Z]{1,5}(\.JK)?$`. Validator ini tidak menghapus `.JK`.

**Timeout & durasi:**
- Hanya fetch di `news/summary` yang memakai timeout (6–8 detik).
- `maxDuration` di [vercel.json](vercel.json): AI 30 detik, analisis 20 detik, dividen/news/market-summary 15 detik, ticker 10 detik.

---

## 8. Data & Penyimpanan

### 8.1 Tabel Supabase ([supabase/migrations/](supabase/migrations/))

Semua tabel memakai RLS dengan aturan "pemilik baris sendiri" (`auth.uid() = user_id`).

| Tabel | Kolom penting | Dipakai oleh |
|---|---|---|
| `avg_down_plans` | ticker, company_name, lot_awal, avg_price_awal, current_price, lot_baru, harga_beli_baru, fee_beli, fee_jual. Semua angka dibatasi CHECK > 0 | page.tsx:335/409/465 |
| `portfolio_holdings` | ticker, company_name, lot ≥ 0, avg_price ≥ 0 | portfolio-tab, portfolio-snapshot |
| `portfolio_cash` | user_id (PK), cash_balance ≥ 0 | portfolio-tab, portfolio-snapshot |
| `compounding_plans` | initial_amount, contribution_amount/frequency, annual_return_rate, compounding_frequency, duration_years/months, inflation_rate, tax_rate | compounding-tab (rencana trading memakai ulang kolom-kolom ini, lihat di bawah) |
| `ipo_plans` | price, total_lots, oversubscription ≥ 1, total_subscribers, retail_ratio 0–100, personal_order_lots | ipo-tab |
| `user_approvals` | email, approved, is_admin, approved_by | page.tsx, auth-modal, admin-panel |

**Pemetaan kolom untuk rencana trading di `compounding_plans`** ([compounding-tab.tsx:475](src/components/compounding-tab.tsx#L475)). Tidak butuh migrasi karena kolomnya `varchar(20)`/`numeric` tanpa batasan nilai:

| Kolom | Rencana Trading | Investasi Jangka Panjang |
|---|---|---|
| `compounding_frequency` | `trading_daily` / `trading_monthly` / `trading_yearly` | `daily` / `monthly` / `quarterly` / `yearly` |
| `contribution_frequency` | periode (`daily` / `monthly` / `yearly`) | frekuensi setoran |
| `annual_return_rate` | target % per periode | return % per tahun |
| `duration_years` / `duration_months` | 0 / jumlah periode | tahun / bulan |
| `tax_rate` / `inflation_rate` | fee beli / fee jual (%) | pajak / inflasi (%) |

Rencana trading harian lama (`trading_daily`) tetap kompatibel.

**Fungsi (RPC) dan trigger:**
- `is_admin()`
- `admin_set_user_approval(p_email, p_approved)`
- `admin_delete_user(p_email)`
- `claim_first_admin(p_email)`: memakai advisory lock untuk mencegah race ([migrasi 000006](supabase/migrations/20260903000006_fix_claim_first_admin_race.sql)).
- `handle_updated_at` (trigger)
- `force_pending_on_nonadmin_insert` (trigger, [migrasi 000005](supabase/migrations/20260903000005_restrict_user_approvals_insert_rls.sql)): memaksa insert dari non-admin bernilai `approved=false, is_admin=false`.

### 8.2 Kunci browser storage

| Kunci | Jenis | Isi |
|---|---|---|
| `nunnn_stock_active_tab` | sessionStorage | Tab aktif |
| `nunnn_stock_language` | localStorage | `id` / `en` |
| `nunnn_stock_saved_plans` | localStorage | Rencana Avg Down (mode lokal) |
| `nunnn_stock_compounding_plans` | localStorage | Rencana Compounding |
| `nunnn_stock_ipo_plans` | localStorage | Rencana E-IPO |
| `nunnn_stock_percentage_history` | localStorage | 5 riwayat persentase |
| `nunnn_stock_watchlist` | localStorage | Maks 5 ticker |
| `nunnn_stock_portfolio_holdings_{uid}` / `_cash_{uid}` | localStorage | Portofolio lokal |
| `nunnn_stock_mock_user` | localStorage | Sesi user demo |
| `nunnn_stock_simulated_users` | localStorage | User demo (hash SHA-256 + salt) |
| `sb-<ref>-auth-token` | localStorage (bawaan supabase-js) | Sesi Supabase. **Bukan cookie**, lihat [C-01](#c-01) |

### 8.3 Alur auth & approval ([page.tsx:161-328](src/app/page.tsx#L161-L328))

1. `supabase.auth.getSession()`. Bila refresh token rusak, kunci `sb-*` dibersihkan.
2. **Bila email = admin:** baca baris `user_approvals`. Bila belum ada, insert pending lalu panggil `rpc('claim_first_admin')`. Bila belum approved atau belum admin, panggil `claim_first_admin` lagi.
3. **Bila bukan admin:** bila tidak ada baris atau `approved=false`, insert pending (bila belum ada), lalu `signOut()` dan tampilkan toast "Akun Anda belum disetujui".
4. Admin menyetujui pengguna dari Admin Panel lewat RPC.

> Pemeriksaan approval ini hanya terjadi di klien. Lihat [H-02](#h-02).

---

## 9. Konfigurasi & Environment

### 9.1 Environment variables

| Variabel | Sisi | Dipakai di | Wajib? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik | supabase.ts, supabase-server.ts, proxy.ts | Tidak (tanpa ini aplikasi masuk mode demo) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Publik | page.tsx:189/251, auth-modal:30, admin-panel:98, sidebar:44 | Default `admin@nunnnstock.com` |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` | Server | analysis/news, news/summary | Tidak (tanpa ini dipakai fallback heuristik) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Server | rate-limit.ts | Tidak (tanpa ini rate limit **mati**) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | — | **Tidak dipakai kode**, hanya ada di `.env.local` | — |
| `NODE_ENV` | Build | next.config.ts, client-bootstrap, page.tsx | Otomatis |

Belum ada `.env.example`.

### 9.2 File konfigurasi

- **[next.config.ts](next.config.ts):**
  - CSP:
    - `script-src 'self' 'unsafe-inline'` (dev menambah `'unsafe-eval'`)
    - `img-src` mengizinkan `assets.stockbit.com`
    - `frame-src` mengizinkan TradingView
    - `connect-src` berisi Supabase dan 3 host AI
  - Header lain: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS preload.
  - `images.remotePatterns` mengizinkan logo Stockbit.
  - ⚠️ `style-src`/`font-src` tidak mengizinkan Google Fonts, lihat [H-04](#h-04).
- **[vercel.json](vercel.json):**
  - Cron `/api/keepalive` setiap hari pukul 00:00 UTC.
  - `maxDuration` dan memori per route; region `sin1`.
  - Security headers yang menduplikasi `next.config.ts` (Permissions-Policy-nya sedikit berbeda), plus `Cache-Control: no-store` untuk `/api/*`.
- **[deploy.js](deploy.js):**
  - Membaca **seluruh** `.env.local`, lalu untuk setiap kunci menjalankan `vercel env remove` + `add` ke production, preview, dan development.
  - Setelah itu menjalankan `vercel --prod`. Lihat [H-06](#h-06).
- **Lainnya:**
  - `tsconfig.json`: strict, alias `@/*` → `src/*`, mengecualikan `security-reports`.
  - `eslint.config.mjs`: next core-web-vitals + TypeScript. `no-unused-vars` = error, `no-explicit-any` dan `exhaustive-deps` = warn. Saat ini lint bersih.
  - `postcss.config.mjs`: `@tailwindcss/postcss`. Tidak ada `tailwind.config` karena Tailwind v4 dikonfigurasi lewat CSS.
  - `cspell.json`: kamus EN + ID.

---

## 10. i18n & Styling

### 10.1 i18n

- **Context:** [language-context.tsx](src/lib/language-context.tsx).
  - `t('section.key')` mengembalikan nama kunci itu sendiri bila terjemahan tidak ada.
  - Bahasa disimpan di localStorage.
- **Kamus:** [translations.ts](src/lib/translations.ts), dengan blok `id` (baris 4-426) dan `en` (427+). Section: common, sidebar, cover, news, calculator, results, percentage, compounding, portfolio, ipo, analysis, admin.
- **Inkonsistensi:**
  - Banyak komponen memakai `language === 'id' ? … : …` langsung di JSX, bukan `t()`.
  - Teks yang masih *hardcoded* ID: `auth-modal.tsx` dan subjudul quick-nav Beranda. (`history-table.tsx` dan halaman Compounding sudah dwibahasa sejak `b9db7a6` / `f2c68f1`.)
  - Kunci terjemahan `exportExcel` dan `saveSim` sudah ada tetapi fitur yang memakainya tidak ada. `printPdf` kini dipakai tombol Cetak di Compounding.

### 10.2 Styling

- **Tailwind v4** dengan token di blok `@theme` di [globals.css:4-20](src/app/globals.css#L4-L20): bullish-green, bearish-red, dan background sidebar/card/input.
- **Kelas kustom:** `.glass-card`, `.glass-input`, `.mesh-bg`, `.text-profit-glow`, `.text-loss-glow`, plus scrollbar kustom.
- **Font:** Plus Jakarta Sans lewat `@import` Google Fonts ([globals.css:1](src/app/globals.css#L1)).
- **Tema:** hanya gelap (`forcedTheme="dark"`), dengan aksen emerald di atas latar `#121518`.
- **Viewport:** `maximumScale: 1, userScalable: false` ([layout.tsx:13-18](src/app/layout.tsx#L13-L18)), sehingga pengguna tidak bisa zoom (masalah aksesibilitas).

---

## 11. Keamanan, CI/CD & Tooling

### 11.1 Workflow GitHub Actions

**[security.yml](.github/workflows/security.yml)**
- Pemicu: push ke main/develop, PR ke main, dan jadwal harian pukul 02:00 UTC.
- Job:
  - `secrets-scan`: gitleaks.
  - `sast-scan`: Semgrep `p/owasp-top-ten` + `p/nextjs`, hasil SARIF.
  - `sca-scan`: Trivy fs dan config, plus SBOM CycloneDX.
  - `dast-scan`: ZAP baseline, hanya saat jadwal atau bila `vars.STAGING_URL` diisi.
  - `security-gate`.
- Semua action di-pin ke SHA, dengan `harden-runner` dalam mode `egress-policy: audit`.
- **Masalah:**
  - Image `semgrep/semgrep:latest` tidak di-pin (baris 42).
  - Hasil Semgrep diakhiri `|| true` (baris 65), sehingga gate tidak pernah gagal karena temuan SAST.
  - Pada run terjadwal tanpa `STAGING_URL`, target ZAP kosong.

**[slsa-provenance.yml](.github/workflows/slsa-provenance.yml)**: **workflow ini tidak valid.**
- Reusable workflow `generator_container_slsa3.yml` dipanggil sebagai *step* `uses:` (baris 53). GitHub Actions tidak mengizinkan ini; reusable workflow harus dipanggil di level *job*.
- Workflow merujuk `steps.build.outputs.digest`, padahal tidak ada step dengan id `build`.
- Generator yang dipakai adalah generator *container*, padahal workflow tidak membangun container image.

**Tidak ada CI kualitas:** lint, `tsc --noEmit`, `next build`, dan test tidak dijalankan pada PR. Error TypeScript baru ketahuan saat build Vercel gagal (commit `d45a9c7`).

### 11.2 Tooling lokal

- `.pre-commit-config.yaml` (gitleaks v8.22.1, semgrep v1.102.0) belum ter-install. `.git/hooks` hanya berisi file sample.
- Tidak ada husky, lint-staged, Prettier, atau `.editorconfig`.
- Tidak ada Dependabot atau Renovate. CodeQL yang disarankan di laporan FASE-5 belum dibuat.

### 11.3 Status temuan [security-reports/FINAL-REPORT.md](security-reports/FINAL-REPORT.md) vs kode sekarang

| Temuan | Status |
|---|---|
| F1-01 upgrade Next | ✅ `^16.3.4` |
| F1-02 hapus xlsx | ✅ |
| F1-03 / F2-05 verifikasi JWT | ⚠️ `requireUser()` sudah dipasang, tetapi sesi tidak dikirim lewat cookie ([C-01](#c-01)) |
| F2-14 SSRF | ⚠️ Baru sebagian, lihat [H-03](#h-03) |
| F2-02 CSRF | ✅ Hanya di `news/summary` |
| F3-01 mass assignment `user_approvals` | ✅ Dengan trigger dan policy (perhatikan [M-16](#m-16)) |
| F2-07 race `claim_first_admin` | ✅ Advisory lock |
| F3-06 rate limit | ⚠️ Kode sudah ada, tetapi Upstash tidak ada di `.env.local` ([H-05](#h-05)) |
| F4-01 kebocoran error keepalive | ✅ Error generik, tetapi endpoint masih tanpa auth ([M-17](#m-17)) |
| F5-01 pin SHA actions | ✅ Workflow SLSA tetap rusak |
| F3-07, F4-06, F4-07 | ⏳ Masih manual atau terbuka |

---

## 12. Temuan Audit

Ringkasan jumlah temuan: **2 Critical · 7 High · 18 Medium · 10 Low**.

Status yang dipakai: **T** = terverifikasi di kode · **R** = perlu verifikasi runtime · **✅** = sudah diperbaiki (lihat [§12.1](#121-status-perbaikan)).

### Critical

<a id="c-01"></a>
**C-01: Sesi Supabase tidak terkirim sebagai cookie, sehingga route terproteksi selalu 401** · Auth · R

- **Lokasi:** [supabase.ts:26](src/lib/supabase.ts#L26), [proxy.ts:25-43](src/proxy.ts#L25-L43), [auth-guard.ts](src/lib/auth-guard.ts).
- **Masalah:** klien browser memakai `createClient` dari `supabase-js`, yang menyimpan sesi di **localStorage**. Sementara itu proxy dan `requireUser()` (lewat `@supabase/ssr`) mencari sesi di **cookie**.
- **Dampak:**
  - Saat Supabase aktif, `/api/analysis/*` dan `/api/news/summary` kemungkinan besar selalu 401. Menu Analisis Saham Pro dan Rangkuman AI jadi tidak berfungsi.
  - Di mode demo, proxy meloloskan request, tetapi `requireUser()` tetap tidak punya sesi yang valid, jadi kemungkinan juga gagal.
- **Rekomendasi:**
  - Ganti klien browser dengan `createBrowserClient` dari `@supabase/ssr`, yang menulis sesi ke cookie.
  - Atau kirim header `Authorization: Bearer <access_token>` dan validasi dengan `supabase.auth.getUser(token)`.
  - Tentukan juga perilaku mode demo secara eksplisit di `requireUser`.

<a id="c-02"></a>
**C-02: Limiter "AI" (10/jam) ikut membatasi fundamental dan teknikal, diperparah auto-refresh 60 detik** · Availability/Cost · T

- **Lokasi:** [rate-limit.ts:70](src/lib/rate-limit.ts#L70); fundamentals dan technical meneruskan `user.id`; [analysis-tab.tsx:411-417](src/components/analysis-tab.tsx#L411-L417).
- **Dampak:**
  - Satu analisis memakai 3 kuota. Dengan LIVE aktif, kuota 10/jam habis sekitar menit ke-3 sampai ke-4, lalu muncul error 429 dan pesan "Gagal memuat data fundamental".
  - Setiap refresh juga memanggil LLM lagi (sampai 5 model Gemini), sehingga biaya API membengkak.
- **Rekomendasi:**
  - Pakai limiter AI hanya untuk route yang memanggil LLM.
  - Cache hasil sentimen per ticker (misalnya 15–30 menit).
  - LIVE cukup me-refresh harga dan teknikal, tanpa memanggil AI.

### High

<a id="h-01"></a>
**H-01: Data sintetis/fallback disajikan sebagai data nyata** · Integritas data · T

- **Lokasi:**
  - [technical/route.ts:423-499](src/app/api/analysis/technical/route.ts#L423-L499): broker summary dari hash ticker.
  - [technical/route.ts:763](src/app/api/analysis/technical/route.ts#L763): foreign flow rekaan.
  - [technical/route.ts:647](src/app/api/analysis/technical/route.ts#L647): harga fallback 5000.
  - `getDeterministicStockData` (fundamentals), dividen deterministik, dan berita fallback buatan.
- **Dampak:** pengguna bisa mengambil keputusan beli/jual berdasarkan angka palsu tanpa tahu angka itu palsu.
- **Rekomendasi:**
  - Tambahkan `isFallback`/`isSynthetic` di setiap response dan tampilkan badge "Data simulasi" di UI.
  - Atau hentikan fallback palsu dan tampilkan error yang jujur.
  - Beri label "Estimasi model, bukan data broker" pada bagian Bandarmology.

<a id="h-02"></a>
**H-02: Approval admin hanya dicek di klien** · Authorization · T

- **Lokasi:** [page.tsx:271-290](src/app/page.tsx#L271-L290), [auth-guard.ts](src/lib/auth-guard.ts), dan RLS tabel data.
- **Dampak:** pengguna yang sudah terdaftar tetapi belum disetujui tetap memegang JWT yang valid. Dengan JWT itu ia bisa memanggil API berbiaya (AI) dan CRUD tabelnya sendiri langsung lewat anon key, karena `signOut()` dilakukan di klien.
- **Rekomendasi:**
  - Cek `user_approvals.approved` di `requireUser()`.
  - Tambahkan syarat approval di policy RLS tabel data, misalnya lewat fungsi `is_approved()`.

<a id="h-03"></a>
**H-03: Celah pada SSRF guard** · SSRF · T

- **Lokasi:** [news/summary/route.ts:204-235](src/app/api/news/summary/route.ts#L204-L235), [:300](src/app/api/news/summary/route.ts#L300).
- **Rincian celah:**
  - `URL.hostname` untuk IPv6 bertanda kurung (`[::1]`), sehingga pengecekan `::1`/`fc`/`fd`/`fe80` tidak pernah cocok.
  - IPv4-mapped IPv6 (`[::ffff:127.0.0.1]`) tidak diblok.
  - DNS tidak di-resolve, sehingga domain yang mengarah ke IP privat tetap lolos.
  - `startsWith('fc'|'fd')` justru memblok domain sah, misalnya `fdic.gov`.
  - `link.includes('news.google.com')` cocok untuk URL apa pun yang sekadar memuat string itu.
- **Rekomendasi:**
  - Buang tanda kurung dari hostname, lalu parse IP dengan benar (IPv4, IPv6, mapped).
  - Resolve DNS dan cek semua alamat hasilnya.
  - Cocokkan host persis `news.google.com`.
  - Batasi panjang `title`, `source`, dan `link`.

<a id="h-04"></a>
**H-04: CSP memblok Google Fonts** · UI/Config · R

- **Lokasi:** [globals.css:1](src/app/globals.css#L1) memuat `fonts.googleapis.com`, sedangkan [next.config.ts:10-12](next.config.ts#L10-L12) hanya punya `style-src 'self' 'unsafe-inline'` dan `font-src 'self'`.
- **Dampak:** di produksi, font Plus Jakarta Sans kemungkinan gagal dimuat dan tampilan jatuh ke `sans-serif`. Ini juga menambah noise pelanggaran CSP.
- **Rekomendasi:** pakai `next/font/google`, yang menyajikan font dari host sendiri tanpa mengubah CSP.

<a id="h-05"></a>
**H-05: Rate limit kemungkinan tidak aktif di produksi** · Abuse/Cost · R

- **Lokasi:** [rate-limit.ts:53](src/lib/rate-limit.ts#L53). `.env.local` tidak berisi `UPSTASH_*`, dan `deploy.js` hanya menyinkronkan isi `.env.local`.
- **Dampak:** route publik (market-summary dengan sekitar 47 panggilan Yahoo per request) dan route AI tidak terlindungi.
- **Rekomendasi:**
  - Pasang Upstash lewat Vercel Marketplace.
  - Saat produksi, tulis log peringatan atau buat aplikasi gagal start bila limiter belum dikonfigurasi.

<a id="h-06"></a>
**H-06: `deploy.js` menyebar semua secret ke semua environment** · Secret management · T

- **Lokasi:** [deploy.js:39-70](deploy.js#L39-L70).
- **Masalah:**
  - Seluruh isi `.env.local`, termasuk `GOOGLE_CLIENT_SECRET` yang tidak dipakai, didorong ke production, preview, dan development.
  - Nama kunci diinterpolasi ke perintah shell (`execSync`, `shell:true`).
  - Variabel di-remove lalu di-add satu per satu, sehingga ada jeda saat variabel kosong.
- **Rekomendasi:**
  - Kelola env lewat dashboard atau `vercel env` secara selektif, dengan daftar kunci yang diizinkan (allowlist).
  - Hapus `GOOGLE_CLIENT_*` dari `.env.local` bila memang tidak dipakai.

<a id="h-07"></a>
**H-07: Tidak ada test dan CI kualitas, workflow SLSA rusak** · Quality · T

- **Rincian:** lihat §11.1. Fungsi kalkulasi finansial berjalan tanpa satu pun test.
- **Rekomendasi:** lihat §14 (Vitest untuk `lib/` dan workflow `ci.yml`). Perbaiki `slsa-provenance.yml`: pakai generator generik di level job, atau hapus workflow ini.

### Medium

| ID | Kategori | Lokasi | Masalah | Rekomendasi |
|---|---|---|---|---|
| <a id="m-01"></a>M-01 | Kalkulasi | [format.ts:40-44](src/lib/format.ts#L40-L44) | Input dengan tepat 3 desimal dibaca sebagai ribuan: "0.125" → 125, "1.125" → 1125, termasuk di mode EN | Tentukan pemisah desimal dari bahasa aktif (ID = koma, EN = titik), jangan ditebak dari pola |
| M-02 | Data | [ticker/route.ts:130-142](src/app/api/ticker/route.ts#L130-L142) | `symbol=BBCA.JK` lolos validator, lalu dibentuk jadi `BBCA.JK.JK`; lookup ke `IDX_TICKERS` juga meleset | Hapus `.JK` di `validateTickerSymbol` |
| <a id="m-03"></a>M-03 | Indikator | [technical/route.ts:48](src/app/api/analysis/technical/route.ts#L48) | RSI = 100 untuk seri datar (avgGain = avgLoss = 0) | Kembalikan 50 bila keduanya 0 |
| M-04 | Indikator | technical/route.ts:277-279 | Tren OBV memakai pengali `×1,02`, sehingga salah arah bila OBV ≤ 0 | Bandingkan selisih terhadap \|first\| |
| M-05 | Indikator | technical/route.ts:76-91, 336-344, 103 | Smoothing MFI/ADX non-standar; seed EMA memakai nilai pertama, bukan SMA | Ikuti definisi standar (Wilder/rolling sum) |
| M-06 | Indikator | technical/route.ts:714-737 | Pivot dihitung dari bar hari ini yang belum selesai saat jam bursa | Pakai sesi terakhir yang sudah selesai |
| M-07 | Label | technical/route.ts:796-807 | Tren "Hourly" dihitung dari data harian | Ganti nama jadi "Short-term" atau ambil data interval 1 jam |
| <a id="m-08"></a>M-08 | Skor | [analysis-tab.tsx:617](src/components/analysis-tab.tsx#L617) | `minPossible = −5` di-*hardcode* (minimum sebenarnya −7, dan bergantung pada metrik yang ada); ROE 0–8 diberi 0 poin tetapi dicatat sebagai "kontra" | Hitung min/max dari metrik yang tersedia |
| M-09 ✅ | Kalkulasi | calculator.ts | ~~`avgPriceReductionPct` memakai avg mentah, bukan `realAvgPriceAwal`~~ | Diperbaiki di `b9db7a6` |
| <a id="m-10"></a>M-10 | Kalkulasi | [dividend.ts:96-102](src/lib/dividend.ts#L96-L102) | Di mode nominal, `totalInvestmentRp` tidak dihitung ulang setelah dibulatkan ke lot, sehingga yield jadi lebih kecil dari seharusnya (komentar kode mengklaim sudah dihitung ulang) | `totalInvestmentRp = totalShares × buyPrice` |
| M-11 | Kalkulasi | [e-ipo.ts:84-98](src/lib/e-ipo.ts#L84-L98) | Harga 0 atau lot 0 menghasilkan Infinity/NaN | Guard input ≤ 0 |
| M-12 | Data | dividend/route.ts:306-313 | Tanggal ex-date diberi label `cumDate`; `paymentDate` hanya salinan tanggal yang sama; tahun diambil dari waktu lokal, tanggal dari UTC | Beri label "Ex-Date", pakai UTC secara konsisten |
| M-13 | Sentimen | analysis/news/route.ts:84-98, 180-184 | Kata kunci dicocokkan sebagai substring ("up" ikut cocok di "Rupiah", "jatuh" di "jatuh tempo"); parsing jawaban LLM cenderung menghasilkan Bullish | Cocokkan per kata utuh; minta output JSON terstruktur |
| <a id="m-14"></a>M-14 | Data | [page.tsx:382-406](src/app/page.tsx#L382-L406) | Rincian tahap pembelian digabung saat disimpan; `avgPriceAwalIncludesFee` tidak tersimpan di Supabase | Tambah kolom `tranches jsonb` dan `avg_includes_fee` |
| M-15 | Performa | market-summary/route.ts:89-170 | Scan sekitar 940 ticker (47 batch, 5 paralel, sekitar 10 putaran) dibandingkan `maxDuration` 15 detik; cek IHSG baru dilakukan setelah semua batch | Cache 30–60 detik, kurangi jumlah ticker, cek IHSG lebih dulu |
| <a id="m-16"></a>M-16 | DB | migrasi 000005/000006 | Trigger `force_pending` bisa menimpa `is_admin` pada jalur insert `claim_first_admin`; saat ini hanya aman karena klien sudah insert baris lebih dulu | Kecualikan fungsi SECURITY DEFINER dari trigger |
| <a id="m-17"></a>M-17 | Security | [keepalive/route.ts](src/app/api/keepalive/route.ts) | Tanpa `CRON_SECRET`, siapa pun bisa memicu query; komentar masih menulis "6 jam" padahal cron berjalan harian | Cek `Authorization: Bearer ${CRON_SECRET}` |
| M-18 | Config | supabase.ts:10 vs proxy.ts:22 | Deteksi "Supabase terkonfigurasi" berbeda (`your-supabase-project` vs `placeholder.supabase.co`) | Satukan dalam satu helper |

Temuan Medium lain yang terkait performa dan robustness:
- Loop Gemini sampai 5 model tanpa timeout bisa melewati `maxDuration` 30 detik.
- 3 fetch di Analisis dijalankan berurutan, padahal bisa `Promise.all`.
- `?q=` di [analysis-tab.tsx:457](src/components/analysis-tab.tsx#L457) tidak di-*encode*.
- Body `news/summary` tanpa batas panjang (risiko prompt injection dan biaya).

### Low / UX

| ID | Lokasi | Masalah |
|---|---|---|
| <a id="l-01"></a>L-01 (sebagian ✅) | [ipo-tab.tsx](src/components/ipo-tab.tsx) | ~~Modal simpan Compounding tidak pernah dibuka~~ (diperbaiki di `f2c68f1`). E-IPO masih tidak punya tombol simpan sama sekali |
| <a id="l-02"></a>L-02 | [dividend-tab.tsx:608-612, 847](src/components/dividend-tab.tsx#L608) | Mojibake "â‰ˆ" (seharusnya ≈) dan "â†" (seharusnya ←/→) |
| L-03 | analysis-tab.tsx:2340-2349 vs 220/230 | Warna legenda grafik fundamental tidak sama dengan warna batang |
| <a id="l-04"></a>L-04 ✅ | history-table.tsx | ~~Selector `[title="Masuk ke Akun"]` gagal di mode EN~~. Diganti prop `onSignInClick` di `b9db7a6` |
| L-05 | layout.tsx:13-18 | `userScalable:false` memblok zoom (aksesibilitas, WCAG 1.4.4) |
| L-06 | next.config.ts:8-13 | CSP masih `'unsafe-inline'` di script-src; host AI di `connect-src` tidak dibutuhkan karena AI dipanggil dari server |
| L-07 (sebagian ✅) | Berbagai file | Teks *hardcoded* ID masih ada di auth-modal dan quick-nav. History-table dan Compounding sudah dwibahasa |
| L-08 | README.md | Usang: versi Next, xlsx, confetti, link LICENSE yang tidak ada, tree salah, env var kurang, endpoint kurang |
| L-09 | dividend-tab.tsx:112 | Props tidak dipakai; state toast tidak pernah di-set |
| L-10 | portfolio-tab.tsx | Error ditampilkan dengan `alert()` padahal sudah ada sistem toast |

### 12.1 Status perbaikan

| Commit | Tanggal | Temuan audit yang ditutup | Perbaikan lain di luar daftar audit |
|---|---|---|---|
| `b9db7a6` | 2026-10-07 | M-09, L-04, sebagian L-07 (history-table) | Avg Down: baris tahap terpotong di HP dan kolom sempit; tampilan "--x%" saat average up atau loss membesar; estimasi riwayat yang mengabaikan fee; teks riwayat yang hanya berbahasa Indonesia |
| `64d6a96` | 2026-10-07 | — | Ikon sidebar Dividen dan E-IPO sama (`Coins`); ikon `Percent` dipakai Compounding, bukan Persentase |
| `f2c68f1` | 2026-10-07 | Compounding pada L-01, sebagian L-07 (toast Compounding) | Compounding: fee broker dipotong tapi tidak tampil di tabel harian (baris tidak cocok dengan saldo); kolom pajak di tabel harian bergantung pada input mode lain; input persen `type=number` menolak koma ("0,5"); grafik tidak bisa disentuh di HP; label sumbu hampir tak terlihat; `maxY = 0` (modal 0) menghasilkan NaN; hapus rencana tanpa konfirmasi; default target 5%/hari yang tidak realistis |

**Masih terbuka:** semua temuan Critical dan High, M-01–M-08, M-10–M-18, L-01 (E-IPO), L-02, L-03, L-05, L-06, L-07 (auth-modal, quick-nav), L-08–L-10.

---

## 13. Utang Teknis & Kualitas Kode

**File raksasa** (lebih dari 900 LOC):
- `analysis-tab.tsx` (2374): chart, skeleton, scoring, dan UI dalam satu file, dengan 16 `useState`.
- `compounding-tab.tsx` (1720): sudah dipecah ke komponen kecil (`Field`, `Segmented`, `StatCard`) dan logika dipindah ke `lib/compounding.ts`, tetapi masih satu file besar.
- `page.tsx` (1138): auth, demo user, CRUD, dan routing tab.
- `ipo-tab.tsx` (1032), `technical/route.ts` (997), `dividend-tab.tsx` (995), `portfolio-tab.tsx` (957).

**Duplikasi:**

| Pola | Jumlah | Konsolidasi ke |
|---|---|---|
| Komponen logo emiten dengan fallback (FormEmitenLogo, ResultsEmitenLogo, HistoryEmitenLogo, CompanyLogo, IpoEmitenLogo, PortfolioEmitenLogo) | 6× | `components/emiten-logo.tsx` |
| `formatIDR` lokal, padahal sudah ada di [format.ts:86](src/lib/format.ts#L86) | 4× (dividend, ipo, portfolio, compounding versi singkat Juta/Miliar); results-display & history-table sudah pakai `@/lib/format` | `@/lib/format` (tambahkan opsi format singkat) |
| Tombol −/+ angka | Sudah satu komponen [`StepperInput`](src/components/stepper-input.tsx), dipakai Avg Down & Compounding | Pakai juga di Dividen, E-IPO, Persentase, Portofolio |
| Rantai fallback Gemini → Groq → OpenAI | 2× | `lib/llm.ts` |
| Parser RSS | 2× | `lib/rss.ts` |
| String User-Agent Mozilla | 15× di 8 file | `lib/yahoo.ts` |
| `NEXT_PUBLIC_ADMIN_EMAIL \|\| 'admin@…'` | 5× | `lib/config.ts` |
| Literal kunci `nunnn_stock_*` | Puluhan | `lib/storage-keys.ts` |
| Tipe `StockFundamentals` (server vs klien berbeda bentuk) | 2× | `lib/types.ts` |

**Kode mati:**
- `resolveTickerName` ([tickers.ts:958](src/lib/tickers.ts#L958)).
- Array `open`, high/low mingguan, dan `_status` di `technical/route.ts`.
- Export di `e-ipo.ts` yang hanya dipakai di file itu sendiri.
- Kunci terjemahan `exportExcel`/`saveSim`.
- Kunci terjemahan `compounding.targetReturn`, `durasiHari`, `setoranTambahan`, dan sejenisnya tidak lagi dipakai sejak label Compounding dibuat dinamis per periode.
- Aset bawaan di `public/*.svg`.

**Kebersihan lain:**
- `analysis-tab.tsx` tidak punya `'use client'`. Saat ini aman karena hanya diimpor oleh page klien.
- `news/summary/route.ts` diawali BOM.
- `.gitignore` memuat `.vercel` dua kali.
- Ada 6 `eslint-disable` (exhaustive-deps dan unused).

**Sisi positifnya:**
- Tidak ada `any` atau `@ts-ignore`.
- Lint bersih.
- Tipe di `lib/` cukup rapi, dan fungsi kalkulasinya murni sehingga mudah dites.

---

## 14. Roadmap Rekomendasi

### P0: dampak besar, kerja kecil (1–2 hari)
1. **C-01:** ganti `lib/supabase.ts` ke `createBrowserClient` (`@supabase/ssr`), lalu uji Analisis dan Rangkuman AI saat sudah login.
2. **C-02:** limiter AI hanya untuk route LLM, dan auto-refresh LIVE tidak memanggil AI.
3. **H-04:** pindah ke `next/font/google`.
4. **H-01:** tambahkan flag `isFallback`/`isSynthetic` dan badge di UI.
5. **M-01, M-02, M-10, M-03:** perbaikan satu baris di logika kalkulasi. (M-09 ✅ `b9db7a6`.)
6. **L-01, L-02:** tambahkan tombol simpan E-IPO dan perbaiki mojibake. (Simpan Compounding ✅ `f2c68f1`; selector login L-04 ✅ `b9db7a6`.)

### P1: keamanan & keandalan (1 minggu)
1. **H-02:** approval dicek di server dan di RLS.
2. **H-03:** perkuat SSRF guard dan batasi panjang body.
3. **H-05:** pasang Upstash; **M-17:** `CRON_SECRET`.
4. **H-06:** ganti `deploy.js` dengan manajemen env yang selektif.
5. Tambahkan timeout ke semua fetch eksternal, `Promise.all` di Analisis, dan cache market-summary (M-15).
6. **M-14:** simpan rincian tahap Avg Down.

### P2: kualitas jangka panjang
1. **Test (H-07):** pasang Vitest, lalu mulai dari fungsi murni:
   - `calculator.ts`, `compounding.ts`, `dividend.ts`, `e-ipo.ts`, `percentage.ts`
   - `format.ts` (termasuk kasus "0.125"), `validators.ts`
   - Indikator di `technical/route.ts`, setelah dipindah ke `lib/indicators.ts` agar bisa dites: RSI, MACD, Bollinger, dan lain-lain, dicek terhadap nilai referensi.
2. **CI:** buat `ci.yml` yang menjalankan `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` pada setiap PR. Perbaiki atau hapus `slsa-provenance.yml`, pin image semgrep, dan hapus `|| true`.
3. **Refactor:** pecah `analysis-tab.tsx` dan `page.tsx` (misalnya hook `useAuth`, `usePlans`), dan konsolidasikan duplikasi di §13.
4. **i18n:** pindahkan semua teks *hardcoded* ke `translations.ts`.
5. **Dokumentasi:** perbarui README (§3 dan §4 di dokumen ini) dan buat `.env.example`.
6. **Indikator:** samakan dengan definisi standar (M-04 sampai M-07) dan cache data Yahoo per ticker.

---

## 15. Lampiran

### 15.1 Riwayat pengembangan (104 commit)

| Periode | Fokus utama |
|---|---|
| 2026-05-31 | Inisiasi: kalkulator Avg Down, portofolio, Supabase, styling |
| Jun 2026 | Compounding, E-IPO, sistem approval user, Admin Panel |
| Pertengahan 2026 | Analisis Saham Pro: UX overhaul `902390f`, indikator dan konsensus berbobot `6a01dd8`, perbaikan ADX `fad0114`, live refresh 60 detik `d1fd001` |
| Pertengahan 2026 | Dashboard Beranda: IHSG `1d59119`, quick search `1a7de23`, news strip `271bb77`, snapshot `ad09369`, tip `74db9ad`, watchlist `bcf57d5`, 941 ticker BEI `f753ce3` |
| Pertengahan 2026 | Pembersihan: hapus `any` (`2c89fd5`, `a807adf`, `23dafa8`), next/image `c7a7e1b`, hash password demo `21726bf`, keepalive `840275e`, hapus confetti |
| 2026-09-02/03 | Sprint keamanan: authz, SSRF, RLS, rate limit, upgrade Next `f24e8ce`; headers, validator, hapus xlsx, CSRF `56beb3d`; pin SHA `01950d7`; laporan final `a7f4dfa` |
| 2026-10-01 | Tab Persentase `cc0a8d2`, perbaikan TS `d45a9c7`, vercel.json untuk Hobby plan `3c29703` |
| 2026-10-02 | Dokumentasi & audit kode ini `5d64816` |
| 2026-10-07 | Avg Down: UX overhaul, contoh GTSI, tombol −/+, harga BEP `b9db7a6`; ikon sidebar unik `64d6a96`; Compounding: trading harian/bulanan/tahunan & UX overhaul `f2c68f1` |

### 15.2 Glosarium

| Istilah | Arti |
|---|---|
| **Average Down** | Membeli lagi saham yang turun untuk menurunkan harga rata-rata |
| **Lot** | Satuan transaksi di BEI = 100 lembar |
| **Floating P/L** | Untung/rugi yang belum direalisasikan (posisi masih dipegang) |
| **Bandarmology** | Analisis jejak "bandar" (pemain besar) lewat volume, broker summary, dan arus dana asing. Di aplikasi ini bersifat estimasi atau sintetis |
| **Foreign flow** | Selisih beli/jual investor asing |
| **DRIP** | *Dividend Reinvestment Plan*: dividen dipakai lagi untuk membeli saham |
| **DPS / Yield** | Dividen per saham / dividen dibagi harga |
| **Cum-date / Ex-date** | Batas terakhir memiliki saham agar berhak dividen / tanggal saham diperdagangkan tanpa hak dividen |
| **E-IPO** | Sistem penawaran umum perdana elektronik BEI |
| **Golongan IPO** | Kelas I–V berdasarkan nilai emisi; menentukan porsi alokasi terpusat |
| **Clawback** | Penambahan porsi alokasi terpusat saat oversubscription tinggi |
| **Oversubscription** | Total pesanan dibagi saham yang ditawarkan |
| **SEOJK 15/2020 vs 25/2025** | Aturan OJK: rasio ritel:non-ritel 1:2 (lama) vs 1:1 (baru) |
| **ARA / ARB** | Auto Rejection Atas/Bawah: batas kenaikan/penurunan harga harian |
| **RDN** | Rekening Dana Nasabah (kas di sekuritas) |
| **IHSG (`^JKSE`)** | Indeks Harga Saham Gabungan |
| **RLS** | Row Level Security Postgres/Supabase |

---

*Dokumen ini disusun dari pembacaan seluruh kode di `src/`, `supabase/`, konfigurasi, dan workflow pada commit `3c29703`. Temuan berlabel R perlu dikonfirmasi dengan menjalankan aplikasi (login Supabase, cek Network tab dan Console CSP).*
