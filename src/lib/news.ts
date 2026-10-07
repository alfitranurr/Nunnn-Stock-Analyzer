import { IDX_TICKERS } from '@/lib/tickers';

/** Berita yang dikirim /api/news ke klien. */
export interface NewsItem {
  id: string; // Kunci stabil (link Google News)
  title: string; // Tanpa akhiran " - Nama Media"
  link: string;
  pubDate: string; // ISO 8601
  source: string;
  sourceDomain: string | null;
  tickers: string[]; // Kode saham BEI yang disebut di judul
}

export type NewsCategory = 'saham' | 'global' | 'makro' | 'komoditas';

export const NEWS_CATEGORIES: NewsCategory[] = ['saham', 'global', 'makro', 'komoditas'];

/** Kueri Google News per kategori (Bahasa Indonesia, 7 hari terakhir ditambahkan oleh route). */
export const CATEGORY_QUERIES: Record<NewsCategory, string> = {
  saham: 'saham OR IHSG OR emiten OR "Bursa Efek Indonesia"',
  global: '"Wall Street" OR "bursa Asia" OR "The Fed" OR Nasdaq OR "S&P 500" OR "pasar global"',
  makro: '"Bank Indonesia" OR "BI Rate" OR inflasi OR APBN OR rupiah OR OJK OR "neraca perdagangan" OR "kebijakan fiskal"',
  komoditas: '"harga batu bara" OR "harga nikel" OR "harga emas" OR "harga minyak" OR CPO OR komoditas',
};

/**
 * Media keuangan/berita arus utama yang diprioritaskan. Bila sebuah kategori punya cukup
 * berita dari daftar ini, sumber lain disaring agar feed bebas dari blog & media yang tidak relevan.
 */
const TRUSTED_DOMAINS = [
  'kontan.co.id', 'cnbcindonesia.com', 'bisnis.com', 'investor.id', 'investortrust.id', 'idnfinancials.com',
  'antaranews.com', 'kompas.com', 'kompas.id', 'kompas.tv', 'detik.com', 'katadata.co.id', 'cnnindonesia.com',
  'liputan6.com', 'idxchannel.com', 'okezone.com', 'tempo.co', 'emitennews.com', 'investing.com', 'reuters.com',
  'bloombergtechnoz.com', 'tradingview.com', 'infobanknews.com', 'swa.co.id', 'idx.co.id', 'ojk.go.id', 'bi.go.id',
  'kemenkeu.go.id', 'mediaindonesia.com', 'republika.co.id', 'sindonews.com', 'beritasatu.com', 'wartaekonomi.co.id',
  'kumparan.com', 'tirto.id', 'jawapos.com', 'idntimes.com', 'xtb.com', 'marketbisnis.com', 'stockbit.com',
];

export const MIN_TRUSTED_ITEMS = 10;

/** Konten video (mis. 20detik, "Video: ...") tidak bisa dibaca/dianalisis dan jarang berguna bagi trader. */
export function isVideoItem(title: string, domain: string | null): boolean {
  return /^video\b/i.test(title.trim()) || domain === '20.detik.com';
}

export function isTrustedDomain(domain: string | null): boolean {
  if (!domain) return false;
  return TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Nama media yang ditampilkan; nama berupa URL mentah diganti domainnya. */
export function cleanSourceName(source: string, domain: string | null): string {
  const name = source.trim();
  if (!name || /^https?:\/\//i.test(name)) return domain ?? name;
  return name;
}

/** Google News menambahkan " - Nama Media" di akhir judul; buang karena media sudah tampil sebagai badge. */
export function stripSourceSuffix(title: string, source: string): string {
  const idx = title.lastIndexOf(' - ');
  if (idx <= 0) return title;
  const suffix = title.slice(idx + 3).trim().toLowerCase();
  const src = source.trim().toLowerCase();
  if (!src) return title;
  // Akhiran bisa terpotong ("InvestorTr…") atau sama dengan nama/URL media.
  const looksLikeSource = src.startsWith(suffix) || suffix.startsWith(src) || src.includes(suffix) || suffix.includes(src);
  return looksLikeSource ? title.slice(0, idx).trim() : title;
}

/** Kunci untuk mendeteksi berita yang sama dari media berbeda. */
export function dedupeKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

/**
 * Kode saham yang juga kata/akronim umum (NATO, NASA, META, BANK, GOLD, ...).
 * Hanya dikenali bila didahului "saham"/"emiten" atau ditulis dalam kurung, mis. "(BANK)".
 */
const AMBIGUOUS_TICKERS = new Set([
  'NATO', 'NASA', 'META', 'BANK', 'GOLD', 'LIFE', 'BEST', 'CASH', 'DATA', 'FAST', 'GOOD', 'HOPE', 'KING', 'MAIN',
  'MEGA', 'NICE', 'POOL', 'PURE', 'SAFE', 'SOHO', 'STAR', 'TRUE', 'WIFI', 'ZONE', 'BOLA', 'CITY', 'FOOD', 'HERO',
  'HOME', 'INDO', 'JAYA', 'LAND', 'LINK', 'MARK', 'PLAN', 'ROCK', 'SAME', 'SURE', 'TECH', 'UNIT', 'VISI', 'AKSI',
  'BAIK', 'BIKE', 'BLUE', 'BOAT', 'BOSS', 'CARE', 'DAYA', 'DEAL', 'DEPO', 'EAST', 'ENAK', 'FILM', 'FIRE', 'FISH',
  'IDEA', 'LUCK', 'MAXI', 'MUTU', 'NANO', 'NEST', 'NICK', 'PADI', 'PIPA', 'RAJA', 'SAGE', 'SINI', 'SOUL', 'UANG',
  'UNIQ', 'KOTA', 'HALO', 'IPTV', 'TRIM', 'SILO', 'PACK', 'GAMA', 'OPMS',
]);

/**
 * Nama/brand emiten yang lazim ditulis di judul berita tanpa kode sahamnya.
 * Frasa yang lebih panjang dicek lebih dulu (mis. "Indofood CBP" sebelum "Indofood",
 * "Bumi Resources Minerals" sebelum "Bumi Resources"). Singkatan pendek peka huruf besar.
 */
const NAME_ALIASES: Array<[RegExp, string]> = [
  [/\bIndofood CBP\b/i, 'ICBP'],
  [/\bIndofood\b/i, 'INDF'],
  [/\bBumi Resources Minerals?\b/i, 'BRMS'],
  [/\bBumi Resources\b/i, 'BUMI'],
  [/\bAstra Agro\b/i, 'AALI'],
  [/\bAstra Otoparts\b/i, 'AUTO'],
  [/\bAstra International\b/i, 'ASII'],
  [/\bBarito Renewables\b/i, 'BREN'],
  [/\bBarito Pacific\b/i, 'BRPT'],
  [/\bMerdeka Battery\b/i, 'MBMA'],
  [/\bMerdeka Copper\b/i, 'MDKA'],
  [/\bPertamina Geothermal\b/i, 'PGEO'],
  [/\bBank Central Asia\b|\bBCA\b/, 'BBCA'],
  [/\bBank Rakyat Indonesia\b|\bBRI\b/, 'BBRI'],
  [/\bBank Negara Indonesia\b|\bBNI\b/, 'BBNI'],
  [/\bBank Mandiri\b/i, 'BMRI'],
  [/\bBank Syariah Indonesia\b/i, 'BRIS'],
  [/\bBank Tabungan Negara\b|\bBTN\b/, 'BBTN'],
  [/\bBank Jago\b/i, 'ARTO'],
  [/\bTelkom\b/i, 'TLKM'],
  [/\bIndosat\b/i, 'ISAT'],
  [/\bXLSMART\b|\bXL Axiata\b/i, 'EXCL'],
  [/\bAntam\b/i, 'ANTM'],
  [/\bBukit Asam\b/i, 'PTBA'],
  [/\bVale Indonesia\b/i, 'INCO'],
  [/\bAmman Mineral\b/i, 'AMMN'],
  [/\bBayan Resources\b/i, 'BYAN'],
  [/\bIndika Energy\b/i, 'INDY'],
  [/\bHarum Energy\b/i, 'HRUM'],
  [/\bMedco\b/i, 'MEDC'],
  [/\bPerusahaan Gas Negara\b|\bPGN\b/, 'PGAS'],
  [/\bChandra Asri\b/i, 'TPIA'],
  [/\bUnilever Indonesia\b/i, 'UNVR'],
  [/\bKalbe\b/i, 'KLBF'],
  [/\bSido Muncul\b/i, 'SIDO'],
  [/\bSampoerna\b/i, 'HMSP'],
  [/\bGudang Garam\b/i, 'GGRM'],
  [/\bAlfamart\b/i, 'AMRT'],
  [/\bSemen Indonesia\b/i, 'SMGR'],
  [/\bIndocement\b/i, 'INTP'],
  [/\bJasa Marga\b/i, 'JSMR'],
  [/\bWijaya Karya\b/i, 'WIKA'],
  [/\bAdhi Karya\b/i, 'ADHI'],
  [/\bGaruda Indonesia\b/i, 'GIAA'],
  [/\bGoTo\b/, 'GOTO'],
  [/\bBukalapak\b/i, 'BUKA'],
  [/\bMitratel\b/i, 'MTEL'],
  [/\bCharoen Pokphand\b/i, 'CPIN'],
  [/\bJapfa\b/i, 'JPFA'],
  [/\bMayora\b/i, 'MYOR'],
  [/\bCiputra\b/i, 'CTRA'],
  [/\bPakuwon\b/i, 'PWON'],
  [/\bSummarecon\b/i, 'SMRA'],
  [/\bErajaya\b/i, 'ERAA'],
  [/\bPetrosea\b/i, 'PTRO'],
];

/** Kode saham BEI yang disebut di judul, lewat kode maupun nama/brand (urut kemunculan, tanpa duplikat). */
export function extractTickers(title: string): string[] {
  const byPosition: Array<{ at: number; code: string }> = [];
  const taken: Array<[number, number]> = [];
  for (const [pattern, code] of NAME_ALIASES) {
    if (!IDX_TICKERS[code]) continue;
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const m of title.matchAll(global)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      // Lewati kemunculan di dalam frasa yang lebih panjang yang sudah cocok ("Indofood" di "Indofood CBP").
      if (taken.some(([s, e]) => start >= s && end <= e)) continue;
      taken.push([start, end]);
      byPosition.push({ at: start, code });
      break;
    }
  }
  const codes = extractTickerCodes(title);
  for (const code of codes) byPosition.push({ at: title.indexOf(code), code });
  byPosition.sort((a, b) => a.at - b.at);
  return Array.from(new Set(byPosition.map((p) => p.code)));
}

/** Kode saham 4 huruf yang ditulis langsung di judul. */
function extractTickerCodes(title: string): string[] {
  const found: string[] = [];
  const re = /(\()?\b([A-Z]{4})\b(\))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(title)) !== null) {
    const code = match[2];
    if (!IDX_TICKERS[code] || found.includes(code)) continue;
    if (AMBIGUOUS_TICKERS.has(code)) {
      const before = title.slice(Math.max(0, match.index - 8), match.index).toLowerCase();
      const explicit = (match[1] && match[3]) || /(saham|emiten)\s+$/.test(before);
      if (!explicit) continue;
    }
    found.push(code);
  }
  return found;
}

/** Nama emiten ringkas untuk kueri pencarian, mis. "Bank Central Asia Tbk" → "Bank Central Asia". */
export function searchableCompanyName(ticker: string): string | null {
  const name = IDX_TICKERS[ticker];
  if (!name) return null;
  const clean = name
    .replace(/\bTbk\.?\b/gi, '')
    .replace(/\(Persero\)/gi, '')
    .replace(/^PT\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Nama satu kata terlalu umum untuk dicocokkan (mis. "Indosat" masih spesifik, tapi batasi minimal 6 huruf).
  return clean.length >= 6 ? clean : null;
}
