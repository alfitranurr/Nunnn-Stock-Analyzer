/**
 * Helper bersama untuk endpoint Yahoo Finance (tidak resmi).
 * Dipakai oleh provider data BEI (lib/market-data/yahoo-provider.ts) dan route global-markets.
 */

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
 */
function splitSessions(series: YahooSeries): { previousClose: number | null; sessionCloses: number[] } | null {
  const timestamps = series.timestamp;
  const rawCloses = series.indicators?.quote?.[0]?.close;
  if (!timestamps?.length || !rawCloses?.length) return null;
  const offsetMs = (series.meta?.gmtoffset ?? 0) * 1000;

  const points: Array<{ date: string; close: number }> = [];
  timestamps.forEach((t, i) => {
    const close = rawCloses[i];
    if (typeof close === 'number') points.push({ date: new Date(t * 1000 + offsetMs).toISOString().slice(0, 10), close });
  });
  if (points.length === 0) return null;

  const latestDate = points[points.length - 1].date;
  const earlier = points.filter((p) => p.date < latestDate);
  return {
    previousClose: earlier.length > 0 ? earlier[earlier.length - 1].close : null,
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
  };
}

/**
 * Ambil kutipan banyak simbol lewat Spark API (maks 20 simbol per request),
 * dijalankan dalam gelombang paralel. Simbol yang gagal dilewati.
 */
export async function fetchSparkQuotes(
  symbols: string[],
  {
    range = '1d',
    interval = '1d',
    batchSize = 20,
    parallel = 5,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { range?: string; interval?: string; batchSize?: number; parallel?: number; timeoutMs?: number } = {}
): Promise<Map<string, YahooQuote>> {
  const quotes = new Map<string, YahooQuote>();
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
            const quote = toQuote(result.symbol, result.response?.[0]);
            if (quote) quotes.set(result.symbol, quote);
          }
        } catch {
          // Batch gagal (timeout/jaringan) dilewati; batch lain tetap dipakai.
        }
      })
    );
  }

  return quotes;
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

/**
 * Cache in-memory sederhana dengan deduplikasi request yang sedang berjalan.
 * Pada Fluid Compute, satu instance melayani banyak request sehingga hasil
 * scan bisa dipakai bersama oleh semua pengunjung.
 */
export function createTtlCache<T>(ttlMs: number, maxEntries = 100) {
  const store = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();

  return async function cached(key: string, load: () => Promise<T>): Promise<{ value: T; cachedAt: number }> {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, cachedAt: hit.at };

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
