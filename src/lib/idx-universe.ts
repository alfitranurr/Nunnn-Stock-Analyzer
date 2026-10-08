/**
 * Daftar emiten BEI yang aktif diperdagangkan (server).
 *
 * Sumber utama: screener publik TradingView (semua saham biasa di bursa IDX, termasuk IPO baru).
 * Diverifikasi 8 Okt 2026: 845 saham, mencakup seluruh 842 saham yang bertransaksi 7 hari terakhir
 * menurut Yahoo, sementara daftar bawaan (Wikipedia, Des 2024) kehilangan 38 di antaranya
 * (mis. CDIA, AADI, EMAS, CBDK, RATU, FORE) dan masih memuat 137 kode tidak aktif.
 *
 * Cadangan: daftar bawaan `IDX_TICKERS` bila TradingView gagal atau hasilnya tidak wajar.
 */

import { IDX_TICKERS } from '@/lib/tickers';
import { cleanCompanyName } from '@/lib/utils';
import { createTtlCache, YAHOO_UA } from '@/lib/yahoo';

export interface UniverseStock {
  symbol: string;
  name: string;
}

export interface IdxUniverse {
  stocks: UniverseStock[];
  source: 'tradingview' | 'static';
  fetchedAt: number;
  /** Kode aktif yang tidak ada di daftar bawaan (biasanya IPO baru). */
  newSymbols: string[];
  /** Kode di daftar bawaan yang tidak lagi diperdagangkan (suspensi/delisting). */
  inactiveSymbols: string[];
  /** Pesan galat bila jatuh ke daftar bawaan. */
  error: string | null;
}

const TTL_MS = 60 * 60 * 1000;
/** Batas bawah wajar jumlah saham BEI; di bawah ini dianggap respons rusak. */
const MIN_EXPECTED = 600;

const cache = createTtlCache<IdxUniverse>(TTL_MS, 1);

interface ScannerResponse {
  totalCount?: number;
  data?: Array<{ s?: string; d?: unknown[] }>;
}

async function fetchFromTradingView(): Promise<UniverseStock[]> {
  const res = await fetch('https://scanner.tradingview.com/indonesia/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': YAHOO_UA },
    body: JSON.stringify({
      filter: [
        { left: 'type', operation: 'equal', right: 'stock' },
        { left: 'exchange', operation: 'equal', right: 'IDX' },
      ],
      columns: ['name', 'description'],
      range: [0, 2000],
      sort: { sortBy: 'name', sortOrder: 'asc' },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  const json: ScannerResponse = await res.json();

  const seen = new Set<string>();
  const stocks: UniverseStock[] = [];
  for (const row of json.data ?? []) {
    const symbol = typeof row.d?.[0] === 'string' ? row.d[0].toUpperCase() : '';
    if (!/^[A-Z]{4}$/.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    const description = typeof row.d?.[1] === 'string' ? row.d[1] : '';
    stocks.push({ symbol, name: IDX_TICKERS[symbol] || cleanCompanyName(description) || symbol });
  }
  if (stocks.length < MIN_EXPECTED) throw new Error(`TradingView hanya mengembalikan ${stocks.length} saham`);
  return stocks;
}

function staticUniverse(error: string): IdxUniverse {
  return {
    stocks: Object.entries(IDX_TICKERS).map(([symbol, name]) => ({ symbol, name })),
    source: 'static',
    fetchedAt: Date.now(),
    newSymbols: [],
    inactiveSymbols: [],
    error,
  };
}

async function load(): Promise<IdxUniverse> {
  // Melempar error bila gagal: cache lalu menyajikan daftar terakhir yang berhasil (bila ada).
  const stocks = await fetchFromTradingView();
  const active = new Set(stocks.map((s) => s.symbol));
  return {
    stocks,
    source: 'tradingview',
    fetchedAt: Date.now(),
    newSymbols: stocks.filter((s) => !IDX_TICKERS[s.symbol]).map((s) => s.symbol),
    inactiveSymbols: Object.keys(IDX_TICKERS).filter((s) => !active.has(s)),
    error: null,
  };
}

/**
 * Daftar emiten aktif (cache 1 jam per instance; `clearAllServerCaches` memaksa muat ulang).
 * Bila TradingView gagal dan belum pernah berhasil, dipakai daftar bawaan (tidak di-cache,
 * sehingga permintaan berikutnya mencoba lagi).
 */
export async function getIdxUniverse(): Promise<IdxUniverse> {
  try {
    const { value } = await cache('universe', load);
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[idx-universe] memakai daftar bawaan:', message);
    return staticUniverse(message);
  }
}

/** Nama emiten dari daftar aktif, lalu daftar bawaan. */
export function nameFromUniverse(universe: IdxUniverse, symbol: string): string {
  return universe.stocks.find((s) => s.symbol === symbol)?.name || IDX_TICKERS[symbol] || symbol;
}
