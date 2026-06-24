# 📈 Nunnn-Stock-Analyzer

**Nunnn-Stock-Analyzer** adalah platform web finansial modern, interaktif, dan premium yang dirancang khusus untuk mempermudah investor serta trader saham (terutama di Bursa Efek Indonesia / BEI) dalam melakukan analisis fundamental, teknikal, sentimen pasar berbasis kecerdasan buatan (AI), serta mengoptimalkan strategi alokasi dana investasi lewat kalkulator finansial canggih dan pelacakan portofolio real-time.

Platform ini menyajikan data pasar real-time dari Yahoo Finance API, memproses aggregator berita Google News RSS, mendekode URL redirect Google News, mengekstrak artikel penuh (*full-text scraping*), dan memanfaatkan kemampuan analisis bahasa alami canggih dari **Google Gemini API** (dengan model *fallback chain* otomatis) untuk menghasilkan ringkasan sentimen terstruktur dan obyektif.

Aplikasi ini mendukung mode online terhubung dengan cloud database **Supabase** (PostgreSQL & Auth), serta mode offline cerdas (*local-first*) berbasis **localStorage** browser bagi pengguna yang ingin langsung mencoba fitur kalkulator secara lokal tanpa konfigurasi awal.

---

## 🚀 Fitur Utama

### 1. 🧮 Kalkulator Average Down (Rata-Rata Turun)
*   **Simulasi Multi-Pembelian**: Mendukung simulasi pembelian saham bertahap (baik input tunggal maupun multi-tranche pembelian) untuk menghitung rata-rata harga beli baru, total modal terkumpul, dan persentase kenaikan harga yang dibutuhkan agar mencapai titik impas (BEP).
*   **Penyegaran Harga Real-time**: Dilengkapi tombol refresh harga terkini yang langsung menembak Yahoo Finance API untuk menarik harga saham terkini emiten BEI.
*   **Perhitungan Broker Fee Presisi**: Menyediakan preset biaya transaksi (beli & jual) untuk broker populer (Stockbit/Ajaib: `0.15% / 0.25%`, IPOT: `0.19% / 0.29%`, None, atau Custom sesuai preferensi pengguna).
*   **Penyimpanan Riwayat Rencana**: Pengguna terautentikasi dapat menyimpan perhitungan rencana investasi secara permanen ke cloud database Supabase atau disimpan secara lokal di browser.

### 2. 💰 Kalkulator Compounding (Bunga Berbunga)
*   **Standard Compounding Mode**: Menghitung pertumbuhan investasi jangka panjang dengan opsi kontribusi berkala (harian, mingguan, bulanan, tahunan), frekuensi pemajemukan bunga (harian, bulanan, kuartalan, tahunan), serta penyesuaian laju inflasi tahunan dan tarif pajak untuk mengetahui nilai riil daya beli di masa depan.
*   **Daily Compounding Mode**: Dirancang khusus bagi pelaku *day trading* atau *scalping* saham yang menargetkan persentase profit harian konsisten (compounding profit harian). Mendukung simulasi pemotongan biaya broker transaksi harian (beli & jual) dan menampilkan hasil proyeksi saldo kumulatif secara mendetail.
*   **Visualisasi Grafik & Log Detail**: Grafik pertumbuhan interaktif dinamis dan tabel amortisasi bulanan/tahunan yang dapat diekspor langsung ke file Excel (.xlsx) menggunakan SheetJS.

### 3. 🪙 Kalkulator Alokasi E-IPO (IDX Allotment)
*   **Estimasi Allotment Realistis**: Memproyeksikan alokasi jumlah lot saham perdana (E-IPO) yang akan didapatkan investor ritel berdasarkan nilai pesanan (personal order), total lot yang ditawarkan, faktor kelebihan permintaan (*oversubscription factor*), jumlah partisipan, dan porsi ritel.
*   **Klasifikasi Golongan Otomatis (Golongan I - IV)**: Secara dinamis mengklasifikasikan investor ke dalam Golongan I (≤ Rp 100M), Golongan II (Rp 100M - Rp 250M), Golongan III (Rp 250M - Rp 500M), atau Golongan IV (> Rp 500M) berdasarkan aturan prospektus alokasi E-IPO Bursa Efek Indonesia terbaru.
*   **Rasio Refund & Estimasi Dana Kembali**: Menghitung secara instan sisa saldo kas yang dikembalikan (*refund*) setelah penjatahan selesai dilakukan.
*   **Auto-Suggestion Emiten Populer**: Memiliki database emiten BEI populer bawaan untuk mempermudah pengisian profil harga dan nama perusahaan secara otomatis.

### 4. 💼 Manajemen Portofolio Saya & Kas RDN
*   **Live Asset Tracker**: Menampilkan daftar kepemilikan saham riil (simbol emiten, jumlah lot, harga beli rata-rata) lengkap dengan perhitungan keuntungan/kerugian belum terealisasi (*Unrealized Profit & Loss*) dan persentase imbal hasil berdasarkan harga pasar Yahoo Finance terbaru.
*   **Simulasi Saldo Kas RDN**: Mendukung pencatatan saldo Kas (Buying Power) untuk memantau dana menganggur dan menyimulasikan transaksi pembelian portofolio.
*   **Integrasi Aksi Cepat**: Tombol pintas untuk langsung mengirim aset portofolio ke kalkulator Average Down atau memicu analisis emiten secara instan.

### 5. 📊 Analisis Saham Komprehensif (3-in-1)
*   **Analisis Fundamental**: Menampilkan metrik valuasi, efisiensi, dan kesehatan emiten secara lengkap (seperti Market Cap, P/E Ratio, PBV Ratio, EPS, ROE, Debt to Equity Ratio, Dividend Yield, Profit Margin, dll.).
*   **Analisis Teknikal**: Grafik candlestick dan garis interaktif menggunakan library Recharts dengan opsi rentang waktu fleksibel (1D, 5D, 1M, 6M, 1Y) untuk membaca tren harga historis.
*   **Analisis Sentimen Terkumpul**: Mengumpulkan dan menganalisis 10-15 berita terhangat terkait emiten secara agregat untuk menghitung sentimen pasar keseluruhan (Bullish, Bearish, Netral) beserta skor kepercayaan (*confidence score*).

### 6. 📰 Feed Berita & AI Summary (Google Gemini)
*   **RSS Aggregator & Redirection Decoder**: Menarik berita pasar terkini berdasarkan topik emiten spesifik atau kategori ekonomi (Domestik, Global, Valas, Politik). Dilengkapi modul decoder untuk mendekode URL redirect terenkripsi dari Google News RSS (`batchexecute` protocol) agar bisa mengunduh konten orisinal berita.
*   **AI Smart Summarizer**: Menggunakan Gemini AI SDK untuk membaca teks lengkap artikel dan mengekstrak ringkasan berita terstruktur dalam format JSON schema (Highlight Utama, Konteks Singkat, Key Findings, dan Key Takeaways) dalam Bahasa Indonesia.
*   **Mekanisme Fallback Chain Multi-Model**: Sistem ketahanan berlapis dari Google Gemini API. Jika model utama terkena *rate limit* (429) atau server sibuk (503), sistem akan otomatis berganti ke model cadangan sesuai urutan:
    $$\text{gemini-2.5-flash} \rightarrow \text{gemini-2.5-flash-lite} \rightarrow \text{gemini-3.1-flash-lite} \rightarrow \text{gemini-flash-lite-latest} \rightarrow \text{gemini-3-flash-preview}$$
    Jika koneksi API gagal sepenuhnya, sistem beralih ke mesin ekstraksi sentimen berbasis kata kunci lokal (*local keyword matching*).

### 7. 🌐 Sistem Multi-Bahasa & Tema Premium
*   **Dukungan Bilingual**: Transisi mulus seluruh teks dan label antarmuka antara Bahasa Indonesia dan English menggunakan React Context (`lib/language-context.tsx`).
*   **Aesthetics Gelap Modern**: Desain antarmuka eksklusif dengan tema gelap premium (Harmonious Dark Theme), efek glassmorphism, visual mikro-animasi menggunakan Framer Motion, dan confetti visual meriah menggunakan Canvas Confetti saat perhitungan profit selesai dihitung.

### 8. ⚙️ Panel Administrasi & Keamanan
*   **Whitelisting User System**: Admin dapat mengontrol pendaftaran user baru. Setiap user yang mendaftar melalui Supabase Auth (baik Email-Password maupun Google OAuth) harus disetujui terlebih dahulu oleh administrator agar dapat masuk ke dasbor utama aplikasi.
*   **Monitor Aktivitas & Log**: Menampilkan ringkasan total pengguna terdaftar, pengguna aktif, riwayat rencana yang disimpan di cloud database, serta log aktivitas sistem.

---

## 🛠️ Tech Stack & Arsitektur

Platform ini dirancang dengan arsitektur modern Next.js App Router (Full-stack Server & Client components) untuk performa responsif:

*   **Framework Utama**: Next.js 16.2.6 (React 19.2.4) dengan App Router dan optimasi kompilasi Turbopack.
*   **Styling & UI**: Tailwind CSS v4 untuk styling modern, dikombinasikan dengan Custom CSS (`globals.css`) dan ikon dari Lucide React.
*   **Manajemen Animasi**: Framer Motion untuk transisi tab dan transisi layout, serta Canvas Confetti untuk efek sukses.
*   **Database & Autentikasi**: Supabase (PostgreSQL database & Supabase Auth) untuk penanganan data persisten dan perlindungan login akun.
*   **Integrasi AI**: Google Gemini AI API (v1beta SDK) dengan konfigurasi JSON Schema output terstruktur.
*   **Pemrosesan File**: Library SheetJS (`xlsx`) untuk mengekspor kalkulasi portofolio dan compounding ke format spreadsheet.
*   **Data Pasar & Berita**: Yahoo Finance API & Google News RSS Search Feed.

---

## 📋 Struktur Direktori Proyek

```text
Nunnn-Stock-Analyzer/
├── src/
│   ├── app/                        # Next.js App Router Pages & API Handlers
│   │   ├── api/
│   │   │   ├── analysis/           # API Analisis Saham BEI
│   │   │   │   ├── fundamentals/   # GET: Mengambil metrik fundamental emiten
│   │   │   │   ├── news/           # GET: Analisis sentimen berita emiten agregatif
│   │   │   │   └── technical/      # GET: Mengambil data historis harga chart
│   │   │   ├── news/               # API Manajemen Feed Berita
│   │   │   │   ├── route.ts        # GET: Fetch berita dari Google News RSS
│   │   │   │   └── summary/        # POST: Ekstraksi teks & AI Summary Gemini
│   │   │   └── ticker/
│   │   │       └── route.ts        # GET: Pencarian emiten & harga real-time Yahoo Finance
│   │   ├── favicon.ico             # Aset Ikon Aplikasi
│   │   ├── globals.css             # Styling Global & Kustomisasi Variabel CSS Tailwind v4
│   │   ├── layout.tsx              # Root Layout, Theme Provider, & Context Language
│   │   └── page.tsx                # Dasbor Utama (Tab Switcher & Main Layout)
│   ├── components/                 # Komponen Antarmuka Pengguna (UI Components)
│   │   ├── admin-panel-tab.tsx     # Tab Admin: Whitelist pengguna & Audit Logs
│   │   ├── analysis-tab.tsx        # Tab Analisis: Grafik Recharts & Metrik Keuangan
│   │   ├── auth-modal.tsx          # Modal Login, Signup, & Opsi Google OAuth
│   │   ├── calculator-form.tsx     # Form Kalkulator Average Down & Tombol Refresh
│   │   ├── compounding-tab.tsx     # Tab Compounding: Standard & Daily Mode dengan visual grafik SVG
│   │   ├── confirm-modal.tsx       # Modal Dialog Konfirmasi Aksi (Logout/Hapus)
│   │   ├── history-table.tsx       # Tabel Riwayat Rencana Average Down
│   │   ├── ipo-tab.tsx             # Tab E-IPO: Kalkulator Allotment Golongan I-IV
│   │   ├── news-tab.tsx            # Tab Feed Berita & AI Summary Modals
│   │   ├── portfolio-tab.tsx       # Tab Portofolio: Tracker Aset, PnL & RDN Cash
│   │   ├── results-display.tsx     # Visualisasi Output Kalkulasi Average Down
│   │   ├── sidebar.tsx             # Sidebar Navigasi Utama dengan toggle collapse
│   │   └── theme-provider.tsx      # Provider Tema untuk Next-Themes
│   └── lib/                        # Utilitas, Helper, & Konfigurasi Modul
│       ├── calculator.ts           # Logika rumus matematika Average Down & BEP
│       ├── compounding.ts          # Logika rumus bunga majemuk standard & daily trading
│       ├── e-ipo.ts                # Logika estimasi alokasi penjatahan e-IPO IDX
│       ├── language-context.tsx    # Context Provider sistem multi-bahasa (ID/EN)
│       ├── polyfills.ts            # Polyfill untuk ketahanan API & penanganan error
│       ├── supabase.ts             # Inisialisasi Klien database Supabase & status check
│       ├── translations.ts         # Kamus terjemahan Bahasa Indonesia & English
│       └── utils.ts                # Helper pembersihan nama emiten & formatting
├── public/                         # Aset gambar statis, logo, dan ikon
├── supabase/                       # Konfigurasi Database Supabase lokal
│   └── migrations/                 # Migrasi SQL PostgreSQL & RLS Policies
│       ├── 20260531000000_create_calculations.sql  # Tabel avg_down_plans
│       ├── 20260531000001_create_portfolio.sql     # Tabel portfolio_holdings & cash
│       ├── 20260612000002_create_compounding_plans.sql # Tabel compounding_plans
│       └── 20260613000003_create_ipo_plans.sql         # Tabel ipo_plans
├── package.json                    # Dependensi dependencies & scripts
├── next.config.ts                  # Konfigurasi Next.js
├── tsconfig.json                   # Konfigurasi TypeScript compiler
└── README.md                       # Dokumentasi Utama Proyek
```

---

## 💾 Skema Database Supabase

Seluruh tabel dilengkapi dengan aturan **Row Level Security (RLS)** untuk memastikan setiap pengguna hanya dapat membaca, menambah, mengubah, dan menghapus data milik mereka sendiri berdasarkan ID pengguna (`user_id`).

### 1. Tabel `public.avg_down_plans`
Menyimpan parameter perhitungan kalkulator Average Down.
```sql
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
```

### 2. Tabel `public.portfolio_holdings`
Menyimpan kepemilikan aset saham portofolio pengguna saat ini.
```sql
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
```

### 3. Tabel `public.portfolio_cash`
Menyimpan saldo uang tunai (buying power) di simulasi rekening dana nasabah (RDN).
```sql
create table public.portfolio_cash (
  user_id uuid references auth.users(id) on delete cascade primary key,
  cash_balance numeric default 0 not null check (cash_balance >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### 4. Tabel `public.compounding_plans`
Menyimpan data rencana kalkulasi pertumbuhan compounding investasi.
```sql
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
```

### 5. Tabel `public.ipo_plans`
Menyimpan parameter kalkulasi alokasi E-IPO IDX.
```sql
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
```

### 6. Tabel `public.user_approvals`
Digunakan oleh Whitelist System untuk membatasi hak akses masuk aplikasi dasbor sebelum disetujui administrator.
```sql
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
*   **Deskripsi**: Mendukung pencarian emiten BEI (`q` parameter) atau penarikan harga real-time emiten spesifik (`symbol` parameter).
*   **Query Params**:
    *   `q=[Pencarian Nama/Kode Ticker]` (contoh: `/api/ticker?q=Bumi`)
    *   `symbol=[Kode Ticker]` (contoh: `/api/ticker?symbol=BBCA`)
*   **Response (`q`)**:
    ```json
    {
      "quotes": [
        { "symbol": "BUMI", "name": "Bumi Resources Tbk" }
      ]
    }
    ```
*   **Response (`symbol`)**:
    ```json
    {
      "symbol": "BBCA",
      "name": "Bank Central Asia Tbk",
      "price": 10250
    }
    ```

### 2. `/api/news`
*   **Method**: `GET`
*   **Deskripsi**: Mengambil berita terbaru dari Google News RSS Feed.
*   **Query Params**:
    *   `q=[Kode Ticker / Topik]` (contoh: `/api/news?q=BBRI`)
    *   `category=[Kategori]` (pilihan: `saham`, `domestik`, `foreign`, `global`, `politik`)
*   **Response**:
    ```json
    {
      "news": [
        {
          "title": "BBRI Catatkan Kinerja Gemilang Kuartal Ini...",
          "link": "https://news.google.com/rss/articles/...",
          "pubDate": "Wed, 24 Jun 2026 12:00:00 GMT",
          "source": "CNBC Indonesia"
        }
      ]
    }
    ```

### 3. `/api/news/summary`
*   **Method**: `POST`
*   **Deskripsi**: Mengunduh teks penuh dari link berita asli, mendekode url Google News redirect, dan memproses rangkuman sentimen menggunakan AI Gemini.
*   **Request Body**:
    ```json
    {
      "title": "Judul Berita",
      "source": "Penerbit Berita",
      "link": "https://news.google.com/rss/articles/..."
    }
    ```
*   **Response**:
    ```json
    {
      "highlight": "Highlight utama dari berita emiten",
      "context": "Konteks singkat dari berita terkait",
      "keyFindings": [
        "Temuan penting 1",
        "Temuan penting 2"
      ],
      "takeaway": "Rekomendasi bagi investor"
    }
    ```

### 4. `/api/analysis/fundamentals`
*   **Method**: `GET`
*   **Deskripsi**: Menarik data keuangan fundamental dari Yahoo Finance untuk emiten BEI.
*   **Query Params**: `symbol=[Kode Ticker]` (contoh: `/api/analysis/fundamentals?symbol=TLKM`)
*   **Response**: Menyediakan metrik P/E ratio, Market Cap, PBV, Debt to Equity Ratio, Dividend Yield, ROE, dll.

### 5. `/api/analysis/technical`
*   **Method**: `GET`
*   **Deskripsi**: Mengambil riwayat harga saham historis untuk rendering grafik visual harga.
*   **Query Params**:
    *   `symbol=[Kode Ticker]` (contoh: `/api/analysis/technical?symbol=ADRO`)
    *   `range=[Rentang Waktu]` (pilihan: `1d`, `5d`, `1m`, `6m`, `1y`)

### 6. `/api/analysis/news`
*   **Method**: `GET`
*   **Deskripsi**: Menganalisis sentimen agregat dari 10 berita terhangat terkait kode emiten tertentu.
*   **Query Params**: `symbol=[Kode Ticker]` (contoh: `/api/analysis/news?symbol=GOTO`)
*   **Response**: Menghasilkan sentimen agregat (Bullish / Bearish / Neutral) beserta *confidence score*.

---

## ⚙️ Panduan Instalasi & Jalankan Lokal

Ikuti langkah-langkah di bawah untuk memasang dan menjalankan aplikasi ini pada komputer lokal Anda:

### 1. Prasyarat
Pastikan sistem Anda telah memiliki:
*   [Node.js](https://nodejs.org/) (Versi LTS sangat direkomendasikan, versi ≥ 18.x)
*   [Git](https://git-scm.com/)

### 2. Kloning Repositori
Kloning repositori dengan nama baru ini dan arahkan terminal ke dalam folder proyek:
```bash
git clone https://github.com/alfitranurr/Nunnn-Stock-Analyzer.git
cd Nunnn-Stock-Analyzer
```

### 3. Pasang Dependensi
Gunakan Node Package Manager (`npm`) untuk memasang semua modul pustaka yang dibutuhkan:
```bash
npm install
```

### 4. Setup Environment Variables
Buat file baru bernama `.env.local` pada direktori utama (root) proyek Anda dan isi konfigurasi kunci berikut:

```env
# Supabase Configuration (opsional - jika dikosongkan, web akan otomatis menggunakan fallback Local Storage browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google OAuth Credentials (untuk login Google cepat)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Gemini API Key (wajib jika menggunakan analisis AI Summary sentimen)
GEMINI_API_KEY=your-gemini-api-key

# Konfigurasi Email Akun Administrator Utama (untuk whitelist system)
NEXT_PUBLIC_ADMIN_EMAIL=alfitranurr@gmail.com
```

### 5. Jalankan Development Server
Jalankan perintah berikut untuk mengaktifkan server lokal dalam mode pengembangan:
```bash
npm run dev
```

Buka peramban (browser) Anda dan arahkan alamat ke **[http://localhost:3000](http://localhost:3000)**. Dasbor Nunnn-Stock-Analyzer siap dijalankan.

---

## 🤝 Kontribusi

Kami sangat menyambut kontribusi dari komunitas! Jika Anda ingin mengoptimalkan perhitungan kalkulator, memperbaiki rendering grafik teknikal, menyempurnakan prompt rekayasa Gemini AI, atau meningkatkan lokalisasi terjemahan:

1. Lakukan **Fork** pada repositori ini.
2. Buat branch fitur baru (`git checkout -b fitur/fitur-keren-baru`).
3. Commit kontribusi Anda (`git commit -m 'Menambahkan fitur keren baru'`).
4. Push branch ke akun Anda (`git push origin fitur/fitur-keren-baru`).
5. Kirimkan **Pull Request (PR)** pada repositori utama untuk ditinjau oleh pembuat proyek.

---

## 📄 Lisensi

Proyek ini berada di bawah lisensi resmi [MIT License](LICENSE). Hak Cipta © 2026 **alfitranurr**.
