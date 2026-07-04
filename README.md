# 📈 Nunnn-Stock-Analyzer

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-AI_Analysis-8E75B2?style=for-the-badge&logo=google-gemini)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Nunnn-Stock-Analyzer** adalah platform finansial modern, profesional, dan premium yang dirancang khusus untuk mempermudah investor serta trader saham di **Bursa Efek Indonesia (BEI / IDX)** dalam melakukan analisis fundamental, teknikal, analisis sentimen pasar berbasis AI (*Artificial Intelligence*), serta mengoptimalkan alokasi strategi investasi melalui kalkulator finansial presisi tinggi dan pelacakan portofolio *real-time*.

Platform ini mengintegrasikan data harga real-time dari **Yahoo Finance API**, agregasi berita keuangan **Google News RSS**, *decoding redirection protocol* otomatis, serta teknologi analisis bahasa alami (*Natural Language Processing*) mutakhir dari **Google Gemini AI SDK** (dengan arsitektur *Multi-Model Fallback Chain* otomatis) untuk menyajikan ringkasan sentimen pasar terstruktur dan obyektif.

Antarmuka dirancang menggunakan filosofi **Card-in-Card Design System** yang ultra-konsisten, responsif di seluruh resolusi layar (dari seluler, tablet, hingga layar monitor full-screen ultra-wide), serta dilengkapi animasi mikro dinamis berbasis **Framer Motion**.

---

## 🚀 Fitur Utama & Modul Finansial

### 1. 🧮 Kalkulator Average Down (Rata-Rata Turun)
*   **Simulasi Multi-Tranche Pembelian**: Mendukung perhitungan pembelian bertahap (multi-tahap) untuk memproyeksikan harga rata-rata baru, modal tambahan yang diperlukan, dan persentase kenaikan harga yang dibutuhkan untuk mencapai titik impas (*Break-Even Point / BEP*).
*   **Penyegaran Harga Real-Time**: Terintegrasi langsung dengan Yahoo Finance API untuk menarik harga emiten BEI terkini dalam satu klik.
*   **Kalkulasi Broker Fee Presisi**: Pilihan preset biaya transaksi saham (beli & jual) untuk broker terkemuka di Indonesia:
    *   **Stockbit**: Beli `0.15%` / Jual `0.25%`
    *   **Ajaib**: Beli `0.15%` / Jual `0.25%`
    *   **IPOT**: Beli `0.19%` / Jual `0.29%`
    *   **Custom Rate & None**: Mengatur komisi secara fleksibel.
*   **Opsi Penyesuaian Fee Beli Awal**: Opsi perhitungan apakah harga *avg price* awal sudah mencakup pemotongan *broker fee* atau belum.
*   **Penyimpanan Riwayat Rencana**: Penyimpanan riwayat simulasi secara permanen ke cloud database **Supabase** (untuk user terautentikasi) atau simulasi otomatis berbasis **localStorage** browser.

### 2. 🪙 Kalkulator Dividen Saham & Passive Income (`DividendTab`)
*   **Proyeksi Dividen 1 Tahun**: Menghitung estimasi imbal hasil dividen kotor (*Gross Dividend*), potongan pajak, hingga nilai bersih (*Net Dividend*) dan *Effective Net Yield (%)* berdasarkan jumlah lot atau nominal modal investasi.
*   **Opsi Pajak Dividen Indonesia**:
    *   `0% Tax-Free`: Insentif dividen dalam negeri yang diinvestasikan kembali (UU HPP).
    *   `10% Final Tax`: PPh Final dividen WPOPS standar.
    *   `Custom Tax Rate`: Penyesuaian persentase pajak kustom.
*   **Simulasi DRIP (Dividend Reinvestment Plan)**: Memproyeksikan efek pemajemukan dividen yang dibelikan kembali ke lembar saham emiten secara otomatis.
*   **Jadwal Cashflow Bulanan & Historis**: Menampilkan riwayat pembayaran dividen historis emiten BEI (Interim, Final, Spesial) serta jadwal estimasi bulan cairnya dividen.
*   **Ekspor Laporan Excel & Salin Ringkasan**: Ekspor laporan simulasi lengkap ke file Excel (`.xlsx`) via SheetJS serta fitur salin teks laporan terformat.

### 3. 💰 Kalkulator Compounding Investasi (Bunga Berbunga)
*   **Standard Compounding Mode**: Menghitung pertumbuhan modal jangka panjang dengan opsi kontribusi berkala (harian, mingguan, bulanan, tahunan), frekuensi pemajemukan, serta penyesuaian inflasi tahunan dan pajak untuk mengetahui estimasi daya beli riil (*real purchasing power*).
*   **Daily Compounding Mode (Scalping / Day Trading)**: Khusus bagi *day trader* yang mematok target persentase profit harian konsisten. Mendukung pemotongan biaya broker transaksi harian (beli & jual) dan menyajikan tabel pertumbuhan harian secara mendetail.
*   **Visualisasi Grafik SVG & Amortisasi**: Grafik proyeksi saldo kumulatif interaktif dan tabel rincian saldo per bulan/tahun yang dapat diekspor langsung ke spreadsheet Excel.

### 4. 🎰 Kalkulator Alokasi E-IPO (IDX Allotment)
*   **Estimasi Allotment Realistis**: Memproyeksikan alokasi jumlah lot saham perdana (E-IPO) yang akan diperoleh investor ritel berdasarkan total nilai pesanan, faktor *oversubscription*, jumlah partisipan, dan rasio porsi ritel.
*   **Klasifikasi Golongan Penjatahan (Golongan I - IV)**: Mengklasifikasikan investor secara otomatis sesuai aturan prospektus Bursa Efek Indonesia:
    *   **Golongan I**: Pesanan $\le \text{Rp } 100\text{ Juta}$
    *   **Golongan II**: Pesanan $\text{Rp } 100\text{ Juta} - \text{Rp } 250\text{ Juta}$
    *   **Golongan III**: Pesanan $\text{Rp } 250\text{ Juta} - \text{Rp } 500\text{ Juta}$
    *   **Golongan IV**: Pesanan $> \text{Rp } 500\text{ Juta}$
*   **Rasio Refund & Saldo Kembali**: Menghitung estimasi saldo kas RDN yang dikembalikan (*refund*) secara otomatis setelah proses penjatahan selesai.

### 5. 💼 Manajemen Portofolio Saya & Kas RDN
*   **Live Asset Tracker**: Memantau kepemilikan saham riil (lot, avg price, harga pasar real-time Yahoo Finance) lengkap dengan kalkulasi nilai pasar, *Unrealized Profit & Loss (Rp & %)*.
*   **Simulasi Rekening Dana Nasabah (RDN)**: Pencatatan saldo kas (*Buying Power*) menganggur dan pemantauan total ekuitas portofolio.
*   **Pintasan Aksi Cepat**: Mengirim saham portofolio ke kalkulator Average Down atau memicu analisis emiten secara langsung.

### 6. 📊 Analisis Saham Komprehensif (3-in-1)
*   **Analisis Fundamental**: Menyajikan metrik valuasi dan kinerja keuangan lengkap (Market Cap, P/E Ratio, PBV Ratio, EPS, ROE, Debt to Equity, Dividend Yield, Profit Margin).
*   **Analisis Teknikal**: Grafik harga candlestick & garis interaktif berbantu **Recharts** dengan rentang waktu fleksibel (1D, 5D, 1M, 6M, 1Y).
*   **Analisis Sentimen Terkumpul**: Mengagregasi 10–15 berita terkini emiten untuk mengkalkulasi skor sentimen pasar (*Bullish / Bearish / Neutral*) dan tingkat kepercayaan (*confidence score*).

### 7. 📰 Feed Berita Pasar & AI Summary (Google Gemini)
*   **RSS Aggregator & Redirection Decoder**: Mengambil berita keuangan terhangat via Google News RSS Feed (topik emiten & kategori ekonomi: Domestik, Global, Valas, Politik). Dilengkapi modul decoder untuk mendekode URL redirect terenkripsi (`batchexecute` protocol) guna mengambil teks berita orisinal.
*   **AI Smart Summarizer**: Menggunakan Google Gemini AI SDK untuk mengekstrak ringkasan berita terstruktur dalam format JSON Schema (Highlight Utama, Konteks Singkat, Key Findings, dan Key Takeaways).
*   **Multi-Model Fallback Chain**: Arsitektur ketahanan API otomatis dari Google Gemini. Jika model utama mengalami *Rate Limit (429)* atau *Server Busy (503)*, sistem otomatis berpindah secara mulus ke model cadangan:
    $$\text{gemini-2.5-flash} \rightarrow \text{gemini-2.5-flash-lite} \rightarrow \text{gemini-3.1-flash-lite} \rightarrow \text{gemini-flash-lite-latest} \rightarrow \text{gemini-3-flash-preview}$$
    Jika jaringan API terputus sepenuhnya, sistem mengaktifkan ekstraksi sentimen berbasis kata kunci lokal (*local keyword matching*).

### 8. 🎨 Card-in-Card Design System & Multi-Bahasa
*   **Desain Card-in-Card Konsisten**: Seluruh form parameter kalkulator dibungkus dalam modul sub-card `rounded-2xl bg-white/[0.03] border border-white/10` dengan tata letak grid responsif (`grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 items-stretch`) yang mencegah elemen terpotong saat layar di-fullscreen.
*   **Dukungan Bilingual (ID & EN)**: Transisi bahasa instan seluruh antarmuka antara Bahasa Indonesia dan English menggunakan React Context (`lib/language-context.tsx`).
*   **Tema Gelap Harmonized & Animasi**: Efek glassmorphism modern, visual mikro-animasi Framer Motion, dan confetti visual Canvas Confetti saat proyeksi profit tercapai.

### 9. ⚙️ Panel Administrasi & System Security
*   **Whitelisting User System**: Admin dapat mengontrol pendaftaran pengguna baru. Setiap akun yang terdaftar melalui Supabase Auth (Email/Password atau Google OAuth) harus mendapatkan persetujuan admin sebelum dapat mengakses dasbor utama.
*   **Auditing & Log Activity**: Pemantauan pengguna aktif, statistik riwayat tersimpan, dan catatan aktivitas sistem.

---

## 🛠️ Tech Stack & Arsitektur

*   **Core Framework**: Next.js 16.2.6 (React 19.2.4) dengan App Router & Turbopack Compiler.
*   **Styling & UI**: Tailwind CSS v4, Custom CSS (`globals.css`), dan Ikonografi Lucide React.
*   **Animasi & Interaktivitas**: Framer Motion & Canvas Confetti.
*   **Database & Auth**: Supabase (PostgreSQL Database & Supabase Auth).
*   **AI Engine**: Google Gemini AI (v1beta SDK) dengan Structured JSON Outputs.
*   **Visualisasi Data**: Recharts (Grafik Teknikal) & Custom SVG (Grafik Compounding).
*   **Data Processing & Export**: SheetJS (`xlsx`) untuk ekspor spreadsheet Excel.
*   **Data Sources**: Yahoo Finance API & Google News RSS Feed.

---

## 📋 Struktur Direktori Proyek

```text
Nunnn-Stock-Analyzer/
├── src/
│   ├── app/                        # Next.js App Router Pages & API Endpoints
│   │   ├── api/
│   │   │   ├── analysis/           # API Analisis Saham BEI (Fundamental, Technical, News)
│   │   │   │   ├── fundamentals/   # GET: Metrik keuangan & valuasi emiten
│   │   │   │   ├── news/           # GET: Analisis sentimen berita agregatif
│   │   │   │   └── technical/      # GET: Data historis harga chart Recharts
│   │   │   ├── dividend/           # API Dividen Saham
│   │   │   │   └── route.ts        # GET: Data historis & proyeksi dividen emiten BEI
│   │   │   ├── news/               # API Management Feed Berita
│   │   │   │   ├── route.ts        # GET: Fetch berita Google News RSS
│   │   │   │   └── summary/        # POST: Scraping teks asli & AI Summary Gemini
│   │   │   └── ticker/
│   │   │       └── route.ts        # GET: Pencarian emiten & harga real-time Yahoo Finance
│   │   ├── favicon.ico             # Aset Ikon Aplikasi
│   │   ├── globals.css             # Styling Global & Variabel CSS Tailwind v4
│   │   ├── layout.tsx              # Root Layout, Providers (Theme & Language)
│   │   └── page.tsx                # Dasbor Utama (Tab Switcher & Layout Container)
│   ├── components/                 # Modul Komponen Antarmuka (UI Components)
│   │   ├── admin-panel-tab.tsx     # Tab Admin: Whitelist pengguna & Audit Logs
│   │   ├── analysis-tab.tsx        # Tab Analisis: Recharts Technical & Fundamental Cards
│   │   ├── auth-modal.tsx          # Modal Login, Signup, & Google OAuth
│   │   ├── calculator-form.tsx     # Form Kalkulator Average Down (Card-in-Card Design)
│   │   ├── compounding-tab.tsx     # Tab Compounding: Standard & Scalping Trading Mode
│   │   ├── confirm-modal.tsx       # Modal Dialog Konfirmasi Aksi
│   │   ├── dividend-tab.tsx        # Tab Dividen: Proyeksi, Opsi Pajak & Simulasi DRIP
│   │   ├── history-table.tsx       # Tabel Riwayat Rencana Average Down
│   │   ├── ipo-tab.tsx             # Tab E-IPO: Kalkulator Allotment Golongan I-IV
│   │   ├── news-tab.tsx            # Tab Feed Berita & AI Summary Gemini Modal
│   │   ├── portfolio-tab.tsx       # Tab Portofolio: Tracker Asset, PnL & RDN Cash
│   │   ├── results-display.tsx     # Output Visualisasi Hasil Kalkulasi Average Down
│   │   ├── sidebar.tsx             # Sidebar Navigasi Utama (Expand/Collapse)
│   │   └── theme-provider.tsx      # Provider Tema Next-Themes
│   └── lib/                        # Modul Logika Finansial, Helper & Utilities
│       ├── calculator.ts           # Algoritma matematika Average Down & BEP
│       ├── compounding.ts          # Algoritma bunga majemuk standard & daily trading
│       ├── e-ipo.ts                # Logika estimasi alokasi penjatahan E-IPO IDX
│       ├── language-context.tsx    # Context Provider sistem multi-bahasa (ID/EN)
│       ├── polyfills.ts            # Polyfill ketahanan API & penanganan error
│       ├── supabase.ts             # Inisialisasi Klien Supabase & status check
│       ├── translations.ts         # Kamus terjemahan Bahasa Indonesia & English
│       └── utils.ts                # Helper pembersihan nama emiten & formatting angka
├── supabase/                       # Schema Migrasi Database Supabase PostgreSQL
│   └── migrations/                 # Migrasi SQL PostgreSQL & RLS Policies
│       ├── 20260531000000_create_calculations.sql  # Tabel avg_down_plans
│       ├── 20260531000001_create_portfolio.sql     # Tabel portfolio_holdings & cash
│       ├── 20260612000002_create_compounding_plans.sql # Tabel compounding_plans
│       └── 20260613000003_create_ipo_plans.sql         # Tabel ipo_plans
├── package.json                    # Package Manifest & Scripts
├── next.config.ts                  # Konfigurasi Next.js
├── tsconfig.json                   # Konfigurasi Compiler TypeScript
└── README.md                       # Dokumentasi Utama Proyek
```

---

## 💾 Skema Database Supabase

Seluruh tabel dilindungi dengan **Row Level Security (RLS)** untuk menjamin keamanan data antar pengguna berdasarkan `user_id`.

```sql
-- 1. Tabel avg_down_plans
create table public.avg_down_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker varchar(10) not null,
  company_name varchar(100),
  lot_awal integer not null check (lot_awal > 0),
  avg_price_awal numeric not null check (avg_price_awal > 0),
  current_price numeric not null check (current_price > 0),
  lot_baru integer not null check (lot_baru > 0),
  harga_beli_baru numeric not null check (harga_beli_baru > 0),
  fee_beli numeric default 0.15 check (fee_beli >= 0 and fee_beli <= 100),
  fee_jual numeric default 0.25 check (fee_jual >= 0 and fee_jual <= 100),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Tabel portfolio_holdings
create table public.portfolio_holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker varchar(10) not null,
  company_name varchar(100),
  lot integer not null check (lot >= 0),
  avg_price numeric not null check (avg_price >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, ticker)
);

-- 3. Tabel portfolio_cash
create table public.portfolio_cash (
  user_id uuid references auth.users(id) on delete cascade primary key,
  cash_balance numeric default 0 not null check (cash_balance >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Tabel compounding_plans
create table public.compounding_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title varchar(100) not null,
  initial_amount numeric not null check (initial_amount >= 0),
  contribution_amount numeric default 0 check (contribution_amount >= 0),
  contribution_frequency varchar(20) default 'monthly',
  annual_return_rate numeric not null check (annual_return_rate >= 0),
  compounding_frequency varchar(20) default 'monthly',
  duration_years numeric default 0 check (duration_years >= 0),
  duration_months numeric default 0 check (duration_months >= 0),
  inflation_rate numeric default 0 check (inflation_rate >= 0),
  tax_rate numeric default 0 check (tax_rate >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. Tabel ipo_plans
create table public.ipo_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker varchar(10) not null,
  company_name varchar(100) not null,
  price numeric not null check (price > 0),
  total_lots numeric not null check (total_lots > 0),
  oversubscription numeric not null check (oversubscription >= 1),
  total_subscribers numeric not null check (total_subscribers > 0),
  retail_ratio numeric not null check (retail_ratio >= 0 and retail_ratio <= 100),
  personal_order_lots numeric default 0 check (personal_order_lots >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 6. Tabel user_approvals
create table public.user_approvals (
  id uuid default gen_random_uuid() primary key,
  email varchar(255) unique not null,
  approved boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

---

## 🔌 API Endpoints Spesifikasi

### 1. `/api/ticker`
*   **Method**: `GET`
*   **Deskripsi**: Pencarian emiten BEI atau penarikan harga pasar real-time Yahoo Finance.
*   **Params**: `q=[Keyword]` atau `symbol=[Ticker]` (contoh: `/api/ticker?symbol=BBCA`).

### 2. `/api/dividend`
*   **Method**: `GET`
*   **Deskripsi**: Mengambil data historis dividen dan jadwal pembayaran dividen emiten BEI.
*   **Params**: `symbol=[Ticker]` (contoh: `/api/dividend?symbol=BBRI`).

### 3. `/api/news`
*   **Method**: `GET`
*   **Deskripsi**: Menarik berita pasar keuangan terkini dari Google News RSS Feed.
*   **Params**: `q=[Topic/Ticker]` & `category=[saham|domestik|foreign|global|politik]`.

### 4. `/api/news/summary`
*   **Method**: `POST`
*   **Deskripsi**: Mengunduh teks penuh berita asli, mendekode url Google News redirect, dan memproses AI Summary sentimen Gemini.

### 5. `/api/analysis/fundamentals`
*   **Method**: `GET`
*   **Deskripsi**: Mengambil metrik fundamental & valuasi emiten (P/E, PBV, ROE, DER, Market Cap).

### 6. `/api/analysis/technical`
*   **Method**: `GET`
*   **Deskripsi**: Mengambil data grafik teknikal historis untuk rendering Recharts (1D, 5D, 1M, 6M, 1Y).

### 7. `/api/analysis/news`
*   **Method**: `GET`
*   **Deskripsi**: Menganalisis sentimen agregat dari 10–15 berita emiten secara otomatis.

---

## ⚙️ Panduan Instalasi & Jalankan Lokal

### 1. Prasyarat
*   [Node.js](https://nodejs.org/) (Versi LTS $\ge 18.x$)
*   [Git](https://git-scm.com/)

### 2. Kloning Repositori
```bash
git clone https://github.com/alfitranurr/Nunnn-Stock-Analyzer.git
cd Nunnn-Stock-Analyzer
```

### 3. Pasang Dependensi
```bash
npm install
```

### 4. Setup Environment Variables (`.env.local`)
Buat file `.env.local` pada direktori root:

```env
# Supabase Configuration (opsional - jika dikosongkan, web otomatis menggunakan fallback Local Storage browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Gemini API Key (wajib untuk analisis AI Summary & sentimen)
GEMINI_API_KEY=your-gemini-api-key

# Email Administrator Utama (untuk Whitelist System)
NEXT_PUBLIC_ADMIN_EMAIL=alfitranurr@gmail.com
```

### 5. Jalankan Development Server
```bash
npm run dev
```

Buka browser Anda di **[http://localhost:3000](http://localhost:3000)**.

---

## 🤝 Kontribusi

Kontribusi dari komunitas sangat diterima! Silakan buka **Issue** atau kirimkan **Pull Request (PR)** untuk penyempurnaan fitur finansial, rendering grafik, atau lokalisasi terjemahan.

---

## 📄 Lisensi

Proyek ini terlisensi di bawah [MIT License](LICENSE). Hak Cipta © 2026 **alfitranurr**.
