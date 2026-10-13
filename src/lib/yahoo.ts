/**
 * Helper bersama untuk endpoint Yahoo Finance (tidak resmi).
 * Dipakai oleh provider data BEI (lib/market-data/yahoo-provider.ts) dan route global-markets.
 */

import { getAutoRejectionBounds } from '@/lib/calculator';
import { getRefreshGeneration } from '@/lib/refresh-generation';

export const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_TIMEOUT_MS = 8000;

export interface YahooQuote {
  symbol: string; // Simbol seperti yang diminta (mis. "BBCA.JK", "^JKSE")
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketTime: number | null; // Epoch detik transaksi terakhir
  closes: number[]; // Harga penutupan per interval (untuk sparkline)
  /** Tanggal bursa (YYYY-MM-DD) bar yang dipakai sebagai acuan `previousClose` (null bila dari meta). */
  previousCloseDate: string | null;
  /** Tanggal bursa transaksi terakhir. */
  sessionDate: string | null;
}

export interface YahooChartQuote extends YahooQuote {
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
}

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  longName?: string;
  shortName?: string;
  gmtoffset?: number;
}

interface YahooSeries {
  meta?: YahooMeta;
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

interface SparkResponse {
  spark?: { result?: Array<{ symbol: string; response?: YahooSeries[] }> };
}

interface ChartResponse {
  chart?: { result?: YahooSeries[] };
}

/**
 * Pisahkan bar per tanggal bursa (zona waktu exchange) untuk mendapatkan
 * penutupan sesi sebelumnya dan harga-harga sesi terakhir.
 *
 * Field meta `chartPreviousClose`/`previousClose` dari Yahoo tidak bisa dipercaya
 * (contoh: IHSG memakai penutupan 2 hari lalu, VKTR memakai harga lama sebelum
 * corporate action), jadi acuan diambil dari bar harian sebelumnya bila tersedia.
 *
 * Tanggal sesi terakhir diambil dari `regularMarketTime` (waktu transaksi terakhir),
 * bukan dari bar terakhir yang berisi angka: setelah tengah malam Yahoo kadang
 * mengosongkan (`null`) bar sesi yang baru selesai, sehingga bar sebelumnya
 * keliru dianggap sesi terakhir dan acuan bergeser satu hari (BBCA −2,02% padahal −0,82%).
 */
/** Tanggal bursa (YYYY-MM-DD, zona waktu exchange) dari epoch detik. */
const exchangeDate = (series: YahooSeries, sec: number) =>
  new Date((sec + (series.meta?.gmtoffset ?? 0)) * 1000).toISOString().slice(0, 10);

/** Bar yang berisi angka penutupan, beserta tanggal bursanya. */
function closePoints(series: YahooSeries): Array<{ date: string; close: number }> {
  const timestamps = series.timestamp ?? [];
  const rawCloses = series.indicators?.quote?.[0]?.close ?? [];
  const points: Array<{ date: string; close: number }> = [];
  timestamps.forEach((t, i) => {
    const close = rawCloses[i];
    if (typeof close === 'number') points.push({ date: exchangeDate(series, t), close });
  });
  return points;
}

function splitSessions(series: YahooSeries): { previousClose: number | null; previousCloseDate: string | null; latestDate: string; sessionCloses: number[] } | null {
  const points = closePoints(series);
  if (points.length === 0) return null;

  const marketTime = series.meta?.regularMarketTime;
  const latestDate = marketTime ? exchangeDate(series, marketTime) : points[points.length - 1].date;
  const earlier = points.filter((p) => p.date < latestDate);
  const previous = earlier.length > 0 ? earlier[earlier.length - 1] : null;
  return {
    previousClose: previous?.close ?? null,
    previousCloseDate: previous?.date ?? null,
    latestDate,
    sessionCloses: points.filter((p) => p.date === latestDate).map((p) => p.close),
  };
}

function toQuote(symbol: string, series: YahooSeries | undefined): YahooQuote | null {
  const meta = series?.meta;
  if (!series || !meta || meta.regularMarketPrice == null) return null;
  const price = meta.regularMarketPrice;
  const sessions = splitSessions(series);
  // Pembulatan ke fraksi BEI dilakukan di lib/market-data/validate.ts (berlaku untuk semua provider).
  const previousClose = sessions?.previousClose ?? meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - previousClose;
  const closes = sessions
    ? sessions.sessionCloses
    : (series.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    price,
    previousClose,
    change,
    changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
    volume: meta.regularMarketVolume ?? 0,
    marketTime: meta.regularMarketTime ?? null,
    closes,
    previousCloseDate: sessions?.previousClose != null ? sessions.previousCloseDate : null,
    sessionDate: sessions?.latestDate ?? (meta.regularMarketTime ? exchangeDate(series, meta.regularMarketTime) : null),
  };
}

type SparkOptions = { range?: string; interval?: string; batchSize?: number; parallel?: number; timeoutMs?: number };

/**
 * Ambil kutipan banyak simbol lewat Spark API (maks 20 simbol per request),
 * dijalankan dalam gelombang paralel. Simbol yang gagal dilewati.
 */
export async function fetchSparkQuotes(symbols: string[], options: SparkOptions = {}): Promise<Map<string, YahooQuote>> {
  const quotes = new Map<string, YahooQuote>();
  for (const [symbol, series] of await fetchSparkSeries(symbols, options)) {
    const quote = toQuote(symbol, series);
    if (quote) quotes.set(symbol, quote);
  }
  return quotes;
}

/** Deret mentah Spark API per simbol. */
async function fetchSparkSeries(
  symbols: string[],
  { range = '1d', interval = '1d', batchSize = 20, parallel = 5, timeoutMs = DEFAULT_TIMEOUT_MS }: SparkOptions = {}
): Promise<Map<string, YahooSeries>> {
  const out = new Map<string, YahooSeries>();
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }

  for (let w = 0; w < batches.length; w += parallel) {
    await Promise.all(
      batches.slice(w, w + parallel).map(async (batch) => {
        const param = batch.map(encodeURIComponent).join(',');
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${param}&range=${range}&interval=${interval}`,
            { headers: { 'User-Agent': YAHOO_UA }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) }
          );
          if (!res.ok) return;
          const data: SparkResponse = await res.json();
          for (const result of data.spark?.result ?? []) {
            const series = result.response?.[0];
            if (series) out.set(result.symbol, series);
          }
        } catch {
          // Batch gagal (timeout/jaringan) dilewati; batch lain tetap dipakai.
        }
      })
    );
  }

  return out;
}

/**
 * Harga + acuan dari bar HARIAN 5 hari terakhir, ditambah grafik intraday sesi terakhir.
 * Bar intraday hari sebelumnya kadang berisi harga basi (mis. VKTR 835), jadi acuan
 * perubahan harga selalu diambil dari bar harian, dan bar intraday hanya untuk grafik.
 */
export async function fetchQuotesWithIntraday(symbols: string[], intradayInterval = '5m'): Promise<Map<string, YahooQuote>> {
  const [daily, intraday] = await Promise.all([
    fetchSparkQuotes(symbols, { range: '5d', interval: '1d' }),
    fetchSparkQuotes(symbols, { range: '1d', interval: intradayInterval }),
  ]);
  for (const [symbol, quote] of daily) {
    quote.closes = intraday.get(symbol)?.closes ?? [];
  }
  return daily;
}

/** Ambil satu simbol lewat Chart API, termasuk high/low harian dan rentang 52 minggu. */
export async function fetchChartQuote(
  symbol: string,
  { range = '1d', interval = '5m', timeoutMs = DEFAULT_TIMEOUT_MS }: { range?: string; interval?: string; timeoutMs?: number } = {}
): Promise<YahooChartQuote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      { headers: { 'User-Agent': YAHOO_UA }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) }
    );
    if (!res.ok) return null;
    const data: ChartResponse = await res.json();
    const series = data.chart?.result?.[0];
    const quote = toQuote(symbol, series);
    if (!quote) return null;
    const meta = series?.meta ?? {};
    return {
      ...quote,
      dayHigh: meta.regularMarketDayHigh ?? quote.price,
      dayLow: meta.regularMarketDayLow ?? quote.price,
      yearHigh: meta.fiftyTwoWeekHigh ?? quote.price,
      yearLow: meta.fiftyTwoWeekLow ?? quote.price,
    };
  } catch {
    return null;
  }
}

export interface OhlcSeries {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  /** Epoch detik awal tiap bar. */
  time: number[];
  /** Offset zona waktu bursa (detik), untuk menentukan tanggal bar. */
  gmtoffset: number;
  regularMarketPrice: number | null;
  regularMarketTime: number | null;
  name: string;
}

/**
 * Bar OHLCV dari Chart API untuk interval apa pun (1d, 1wk, 60m, ...). Bar yang tidak lengkap
 * (ada nilai null) dibuang. Mengembalikan null bila simbol tidak dikenal; melempar error bila gagal.
 */
export async function fetchOhlc(symbol: string, range: string, interval: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<OhlcSeries | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    { headers: { 'User-Agent': YAHOO_UA }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Yahoo chart ${interval} ${res.status}`);
  const data: { chart?: { result?: Array<YahooSeries & { indicators?: { quote?: Array<Record<string, Array<number | null>>> } }> } } = await res.json();
  const series = data.chart?.result?.[0];
  if (!series?.meta) return null;
  const q = series.indicators?.quote?.[0] ?? {};
  const out: OhlcSeries = {
    open: [], high: [], low: [], close: [], volume: [], time: [],
    gmtoffset: series.meta.gmtoffset ?? 0,
    regularMarketPrice: series.meta.regularMarketPrice ?? null,
    regularMarketTime: series.meta.regularMarketTime ?? null,
    name: series.meta.longName || series.meta.shortName || '',
  };
  (series.timestamp ?? []).forEach((t, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (typeof o !== 'number' || typeof h !== 'number' || typeof l !== 'number' || typeof c !== 'number' || !(c > 0)) return;
    out.open.push(o);
    out.high.push(h);
    out.low.push(l);
    out.close.push(c);
    out.volume.push(typeof q.volume?.[i] === 'number' ? (q.volume[i] as number) : 0);
    out.time.push(t);
  });
  return out;
}

export interface YahooDividendHistory {
  name: string;
  /** Pembagian dividen per lembar (sudah disesuaikan stock split), urut tanggal ex-date naik. */
  events: Array<{ exDate: string; amount: number }>;
  /** Rata-rata harga penutupan bulanan per tahun kalender (disesuaikan split), untuk yield historis. */
  yearlyAvgClose: Record<number, number>;
}

interface DividendChartResponse {
  chart?: {
    result?: Array<
      YahooSeries & {
        events?: { dividends?: Record<string, { date?: number; amount?: number }> };
      }
    >;
    error?: { code?: string } | null;
  };
}

/**
 * Riwayat dividen + harga bulanan sepanjang masa dalam satu request Chart API.
 * Tanggal event Yahoo adalah tanggal EX (09:00 WIB), dikonversi memakai zona waktu bursa.
 * Mengembalikan null bila simbol tidak dikenal; melempar error bila jaringan/Yahoo gagal.
 */
export async function fetchDividendHistory(symbol: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<YahooDividendHistory | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo&events=div`,
    { headers: { 'User-Agent': YAHOO_UA }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);

  const data: DividendChartResponse = await res.json();
  const series = data.chart?.result?.[0];
  if (!series?.meta) return null;

  const offsetMs = (series.meta.gmtoffset ?? 0) * 1000;
  const dateOf = (sec: number) => new Date(sec * 1000 + offsetMs).toISOString().slice(0, 10);

  // Gabungkan entri pada tanggal yang sama: duplikat persis dibuang, nominal berbeda dijumlah (reguler + spesial).
  const byDate = new Map<string, number[]>();
  for (const ev of Object.values(series.events?.dividends ?? {})) {
    if (typeof ev?.date !== 'number' || typeof ev.amount !== 'number' || !(ev.amount > 0) || !Number.isFinite(ev.amount)) continue;
    const date = dateOf(ev.date);
    const amounts = byDate.get(date) ?? [];
    if (!amounts.includes(ev.amount)) amounts.push(ev.amount);
    byDate.set(date, amounts);
  }
  const events = Array.from(byDate, ([exDate, amounts]) => ({
    exDate,
    amount: Math.round(amounts.reduce((a, b) => a + b, 0) * 10000) / 10000,
  })).sort((a, b) => a.exDate.localeCompare(b.exDate));

  const sums = new Map<number, { total: number; count: number }>();
  const closes = series.indicators?.quote?.[0]?.close ?? [];
  (series.timestamp ?? []).forEach((t, i) => {
    const close = closes[i];
    if (typeof close !== 'number' || !(close > 0)) return;
    const year = Number(dateOf(t).slice(0, 4));
    const s = sums.get(year) ?? { total: 0, count: 0 };
    s.total += close;
    s.count += 1;
    sums.set(year, s);
  });
  const yearlyAvgClose: Record<number, number> = {};
  for (const [year, s] of sums) yearlyAvgClose[year] = Math.round((s.total / s.count) * 100) / 100;

  return { name: series.meta.longName || series.meta.shortName || '', events, yearlyAvgClose };
}

/**
 * Cache in-memory sederhana dengan deduplikasi request yang sedang berjalan.
 * Pada Fluid Compute, satu instance melayani banyak request sehingga hasil
 * scan bisa dipakai bersama oleh semua pengunjung.
 */
// Disimpan di globalThis: tiap route API dibundel terpisah sehingga modul ini bisa termuat
// beberapa kali dalam satu proses server; registry harus dipakai bersama agar semua cache terjangkau.
const registryHost = globalThis as typeof globalThis & { __nunnnCacheClearers?: Set<() => number>; __nunnnStaleBefore?: number };
const cacheClearers = (registryHost.__nunnnCacheClearers ??= new Set<() => number>());

/** Entri cache yang disimpan sebelum waktu ini dianggap kedaluwarsa (tetap disimpan sebagai cadangan). */
const staleBefore = () => registryHost.__nunnnStaleBefore ?? 0;
function markStaleBefore(ms: number) {
  if (ms > staleBefore()) registryHost.__nunnnStaleBefore = ms;
}

/**
 * Tandai semua cache `createTtlCache` di instance ini kedaluwarsa: request berikutnya wajib mengambil
 * data baru, tetapi data lama tetap disimpan sebagai cadangan bila sumber sedang gagal.
 * Instance lain ikut kedaluwarsa lewat generasi refresh bersama (lib/refresh-generation).
 */
export function clearAllServerCaches(): { caches: number; entries: number } {
  markStaleBefore(Date.now());
  let entries = 0;
  for (const count of cacheClearers) entries += count();
  return { caches: cacheClearers.size, entries };
}

export function createTtlCache<T>(ttlMs: number, maxEntries = 100, options?: { ttlFor?: (value: T) => number }) {
  const store = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();
  cacheClearers.add(() => store.size);

  return async function cached(key: string, load: () => Promise<T>): Promise<{ value: T; cachedAt: number }> {
    // Refresh Admin dari instance mana pun (dicek paling sering tiap 10 detik).
    const generation = await getRefreshGeneration();
    if (generation !== null) markStaleBefore(generation);

    const hit = store.get(key);
    const ttl = hit ? (options?.ttlFor?.(hit.value) ?? ttlMs) : ttlMs;
    if (hit && Date.now() - hit.at < ttl && hit.at >= staleBefore()) return { value: hit.value, cachedAt: hit.at };

    let pending = inflight.get(key);
    if (!pending) {
      pending = load().then((value) => {
        if (store.size >= maxEntries) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { at: Date.now(), value });
        return value;
      });
      inflight.set(key, pending);
      pending.finally(() => inflight.delete(key)).catch(() => undefined);
    }

    try {
      const value = await pending;
      return { value, cachedAt: store.get(key)?.at ?? Date.now() };
    } catch (err) {
      // Bila gagal tapi masih ada data lama, sajikan data lama daripada error.
      if (hit) return { value: hit.value, cachedAt: hit.at };
      throw err;
    }
  };
}

const calendarCache = createTtlCache<string[]>(60_000, 1);

/**
 * Tanggal sesi bursa BEI terbaru (urut naik), dari bar harian IHSG ditambah tanggal transaksi
 * terakhirnya (bar sesi yang baru selesai kadang masih null). Cache 60 detik.
 */
export async function getIdxSessionCalendar(): Promise<string[]> {
  try {
    const { value } = await calendarCache('jkse', async () => {
      const series = (await fetchSparkSeries(['^JKSE'], { range: '10d', interval: '1d' })).get('^JKSE');
      if (!series) throw new Error('IHSG calendar unavailable');
      const dates = new Set(closePoints(series).map((p) => p.date));
      const marketTime = series.meta?.regularMarketTime;
      if (marketTime) dates.add(exchangeDate(series, marketTime));
      return [...dates].sort();
    });
    return value;
  } catch {
    return [];
  }
}

/**
 * Bar harian Yahoo untuk saham kadang hilang satu sesi (mis. Senin 12 Okt 2026 tidak ada di Spark
 * untuk semua saham, padahal IHSG & bar per jam lengkap). Akibatnya acuan perubahan memakai penutupan
 * 2 sesi lalu (CUAN −14,3% dari Jumat, padahal ±0% dari Senin). Fungsi ini mendeteksi celah itu lewat
 * kalender sesi IHSG lalu mengambil penutupan sesi yang hilang dari bar 60 menit. Nilai pengganti
 * hanya dipakai bila masih dalam batas auto rejection dari acuan lama (mencegah harga basi intraday).
 * Mengubah `quotes` di tempat; mengembalikan jumlah kutipan yang diperbaiki.
 */
export async function repairMissedSessions(quotes: Map<string, YahooQuote>): Promise<number> {
  const calendar = await getIdxSessionCalendar();
  if (calendar.length < 2) return 0;
  const latest = calendar[calendar.length - 1];
  const previousSession = calendar[calendar.length - 2];

  const gaps = [...quotes.values()].filter(
    (q) => q.sessionDate === latest && q.previousCloseDate !== null && q.previousCloseDate < previousSession
  );
  if (gaps.length === 0) return 0;

  const hourly = await fetchSparkSeries(
    gaps.map((q) => q.symbol),
    { range: '5d', interval: '60m' }
  );
  let repaired = 0;
  for (const q of gaps) {
    const series = hourly.get(q.symbol);
    if (!series) continue;
    const from = q.previousCloseDate!;
    const missed = closePoints(series).filter((p) => p.date > from && p.date < latest);
    if (missed.length === 0) continue; // Tidak ditransaksikan di sesi itu (mis. suspensi): acuan lama sudah benar.
    const last = missed[missed.length - 1];

    // Batas wajar: auto rejection berantai sebanyak sesi yang terlewat.
    const sessions = calendar.filter((d) => d > from && d <= last.date).length || 1;
    let upper = q.previousClose;
    let lower = q.previousClose;
    for (let i = 0; i < sessions; i++) {
      upper = getAutoRejectionBounds(upper).upper;
      lower = getAutoRejectionBounds(lower).lower;
    }
    if (!(last.close >= lower * 0.999 && last.close <= upper * 1.001)) continue;

    q.previousClose = last.close;
    q.previousCloseDate = last.date;
    q.change = q.price - last.close;
    q.changePercent = last.close > 0 ? (q.change / last.close) * 100 : 0;
    repaired++;
  }
  if (repaired > 0) console.info(`[yahoo] acuan ${repaired}/${gaps.length} saham diperbaiki dari bar 60m (sesi ${previousSession} hilang di bar harian)`);
  return repaired;
}
