import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { requireUser } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { createTtlCache, fetchOhlc, type OhlcSeries } from '@/lib/yahoo';
import { getValidatedStockQuotes } from '@/lib/market-data';
import { IDX_TICKERS } from '@/lib/tickers';
import {
  adx, atr, bollinger, cmf, ema, macd, mfi, obv, pivotLevels, riskMetrics, rsi, sma, stochastic,
  type Bars, type PivotLevel,
} from '@/lib/indicators';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Direction = 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
type Signal = { indicator: string; signal: 'bull' | 'bear'; weight: number; note: string };

export interface TechnicalResponse {
  symbol: string;
  name: string;
  asOf: string;
  source: { label: string; delayed: boolean };
  quote: {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    suspect: boolean;
    /** Tidak bertransaksi pada sesi bursa terakhir (suspensi / tanpa transaksi). */
    stale: boolean;
    lastTradeDate: string | null;
    volume: number;
    valueTraded: number;
    dayHigh: number | null;
    dayLow: number | null;
    yearHigh: number;
    yearLow: number;
  };
  indicators: {
    rsi: number | null;
    macd: ReturnType<typeof macd>;
    bollinger: ReturnType<typeof bollinger>;
    stochastic: ReturnType<typeof stochastic>;
    atr: number | null;
    atrPct: number | null;
    adx: ReturnType<typeof adx>;
    obv: ReturnType<typeof obv>;
    mfi: number | null;
    cmf: number | null;
    vwap20: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    ema20: number | null;
    ema50: number | null;
  };
  trend: Record<'weekly' | 'daily' | 'hourly', { direction: Direction; detail: string } | null>;
  pivots: {
    basis: { date: string; high: number; low: number; close: number };
    classic: PivotLevel[];
    fibonacci: PivotLevel[];
    camarilla: PivotLevel[];
  } | null;
  volumeFlow: {
    status: 'STRONG_ACCUMULATION' | 'ACCUMULATION' | 'NEUTRAL' | 'DISTRIBUTION' | 'STRONG_DISTRIBUTION';
    score: number;
    volumeRatio: number | null;
    /** Sesi hari ini belum selesai: volume belum final. */
    partial: boolean;
    avgValue20: number | null;
  };
  risk: ReturnType<typeof riskMetrics>;
  signals: Signal[];
  summary: { score: number; rating: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL' };
}

const cache = createTtlCache<TechnicalResponse | null>(30_000, 200);
const WIB_OFFSET = 7 * 3600;

const toBars = (s: OhlcSeries): Bars => ({ open: s.open, high: s.high, low: s.low, close: s.close, volume: s.volume, time: s.time });
const dateOf = (sec: number, offset: number) => new Date((sec + offset) * 1000).toISOString().slice(0, 10);

/** Indeks bar harian terakhir yang sesinya SUDAH selesai (bar hari ini dilewati sebelum 16:15 WIB). */
function lastCompletedIndex(daily: OhlcSeries, nowSec: number): number {
  let i = daily.close.length - 1;
  if (i < 0) return -1;
  const today = dateOf(nowSec, WIB_OFFSET);
  const minutes = Math.floor(((nowSec + WIB_OFFSET) % 86400) / 60);
  if (dateOf(daily.time[i], daily.gmtoffset || WIB_OFFSET) === today && minutes < 16 * 60 + 15) i--;
  // Lewati bar kosong (high = low tanpa volume), mis. data hari libur.
  while (i > 0 && daily.high[i] === daily.low[i] && daily.volume[i] === 0) i--;
  return i;
}

function trendFrom(closes: number[], fast: number, slow: number, label: string): { direction: Direction; detail: string } | null {
  if (closes.length < slow + 1) return null;
  const price = closes[closes.length - 1];
  const f = ema(closes, fast);
  const s = sma(closes, slow);
  const r = rsi(closes, 14);
  if (f === null || s === null) return null;
  let direction: Direction = 'SIDEWAYS';
  if (price > f && f > s && (r ?? 50) >= 50) direction = 'BULLISH';
  else if (price < f && f < s && (r ?? 50) <= 50) direction = 'BEARISH';
  return { direction, detail: `${label} ${price > f ? '>' : '<'} EMA${fast} · EMA${fast} ${f > s ? '>' : '<'} SMA${slow} · RSI ${r?.toFixed(0) ?? '—'}` };
}

async function analyze(ticker: string): Promise<TechnicalResponse | null> {
  const symbol = `${ticker}.JK`;
  const [daily, weekly, hourly, quotes] = await Promise.all([
    fetchOhlc(symbol, '1y', '1d'),
    fetchOhlc(symbol, '2y', '1wk').catch(() => null),
    fetchOhlc(symbol, '1mo', '60m').catch(() => null),
    getValidatedStockQuotes([ticker]).catch(() => null),
  ]);
  if (!daily) return null;
  if (daily.close.length < 30) throw new Error(`Data harian ${ticker} terlalu sedikit (${daily.close.length} bar)`);

  const bars = toBars(daily);
  const n = bars.close.length;
  const validated = quotes?.quotes.get(ticker);
  const price = validated?.quote.price ?? daily.regularMarketPrice ?? bars.close[n - 1];
  const previousClose = validated?.quote.previousClose ?? bars.close[n - 2];
  const change = price - previousClose;
  const nowSec = Math.floor(Date.now() / 1000);

  // Bar terakhir memakai harga terkini agar indikator mengikuti harga live.
  const closes = [...bars.close.slice(0, -1), price];
  const liveBars: Bars = { ...bars, close: closes };

  const rsiV = rsi(closes, 14);
  const macdV = macd(closes);
  const bb = bollinger(closes);
  const stoch = stochastic(liveBars);
  const atrV = atr(liveBars);
  const adxV = adx(liveBars);
  const obvV = obv(liveBars);
  const mfiV = mfi(liveBars);
  const cmfV = cmf(liveBars);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  let pv = 0;
  let vv = 0;
  for (let i = n - 20; i < n; i++) {
    if (i < 0) continue;
    pv += ((bars.high[i] + bars.low[i] + closes[i]) / 3) * bars.volume[i];
    vv += bars.volume[i];
  }
  const vwap20 = vv > 0 ? pv / vv : null;

  // ─── Support & resistance dari sesi yang sudah selesai ───
  const ci = lastCompletedIndex(daily, nowSec);
  const pivots = ci >= 0
    ? {
        basis: { date: dateOf(daily.time[ci], daily.gmtoffset || WIB_OFFSET), high: bars.high[ci], low: bars.low[ci], close: bars.close[ci] },
        classic: pivotLevels(bars.high[ci], bars.low[ci], bars.close[ci], 'classic'),
        fibonacci: pivotLevels(bars.high[ci], bars.low[ci], bars.close[ci], 'fibonacci'),
        camarilla: pivotLevels(bars.high[ci], bars.low[ci], bars.close[ci], 'camarilla'),
      }
    : null;

  // ─── Arus volume (estimasi dari harga & volume, bukan data broker/asing) ───
  const todayIsLast = dateOf(daily.time[n - 1], daily.gmtoffset || WIB_OFFSET) === dateOf(nowSec, WIB_OFFSET);
  const todayVolume = validated?.quote.volume ?? bars.volume[n - 1];
  const prevVolumes = bars.volume.slice(-21, -1);
  const avgVol20 = prevVolumes.length > 0 ? prevVolumes.reduce((a, c) => a + c, 0) / prevVolumes.length : 0;
  const volumeRatio = avgVol20 > 0 ? todayVolume / avgVol20 : null;
  let flowScore = 50 + (cmfV ?? 0) * 200;
  if (obvV?.trend === 'Rising') flowScore += 10;
  else if (obvV?.trend === 'Falling') flowScore -= 10;
  if (mfiV !== null) flowScore += (mfiV - 50) * 0.2;
  flowScore = Math.round(Math.max(0, Math.min(100, flowScore)));
  const flowStatus: TechnicalResponse['volumeFlow']['status'] =
    flowScore >= 75 ? 'STRONG_ACCUMULATION' : flowScore >= 58 ? 'ACCUMULATION' : flowScore <= 25 ? 'STRONG_DISTRIBUTION' : flowScore <= 42 ? 'DISTRIBUTION' : 'NEUTRAL';

  // ─── Konsensus teknikal berbobot ───
  const signals: Signal[] = [];
  const push = (indicator: string, signal: 'bull' | 'bear', weight: number, note: string) => signals.push({ indicator, signal, weight, note });
  // Bobot maksimum tiap indikator yang datanya ada; skor = 50 ± selisih bull/bear terhadap total ini,
  // jadi "STRONG" butuh banyak sinyal kuat, bukan sekadar 3 sinyal kecil yang searah.
  let maxWeight = 0;
  if (rsiV !== null) maxWeight += 1.5;
  if (macdV) maxWeight += 2;
  if (sma20 !== null) maxWeight += 0.5;
  if (sma50 !== null) maxWeight += 1;
  if (sma200 !== null) maxWeight += 1;
  if (stoch) maxWeight += 1.5;
  if (bb) maxWeight += 0.5;
  if (adxV) maxWeight += 1;
  if (obvV) maxWeight += 1;
  if (rsiV !== null) {
    if (rsiV < 30) push('RSI', 'bull', 1.5, `RSI ${rsiV.toFixed(1)} jenuh jual`);
    else if (rsiV > 70) push('RSI', 'bear', 1.5, `RSI ${rsiV.toFixed(1)} jenuh beli`);
    else if (rsiV > 55) push('RSI', 'bull', 0.5, `RSI ${rsiV.toFixed(1)} momentum positif`);
    else if (rsiV < 45) push('RSI', 'bear', 0.5, `RSI ${rsiV.toFixed(1)} momentum lemah`);
  }
  if (macdV) {
    const cross = macdV.signalName.includes('Crossover');
    if (macdV.signalName.startsWith('Bullish')) push('MACD', 'bull', cross ? 2 : 1, macdV.signalName);
    else if (macdV.signalName.startsWith('Bearish')) push('MACD', 'bear', cross ? 2 : 1, macdV.signalName);
  }
  if (sma20 !== null) push('SMA20', price > sma20 ? 'bull' : 'bear', 0.5, `harga ${price > sma20 ? 'di atas' : 'di bawah'} SMA20`);
  if (sma50 !== null) push('SMA50', price > sma50 ? 'bull' : 'bear', 1, `harga ${price > sma50 ? 'di atas' : 'di bawah'} SMA50`);
  if (sma200 !== null) push('SMA200', price > sma200 ? 'bull' : 'bear', 1, `harga ${price > sma200 ? 'di atas' : 'di bawah'} SMA200`);
  if (stoch) {
    if (stoch.signal === 'Buy Signal') push('Stochastic', 'bull', 1.5, 'golden cross di area jenuh jual');
    else if (stoch.signal === 'Sell Signal') push('Stochastic', 'bear', 1.5, 'death cross di area jenuh beli');
    else if (stoch.signal === 'Bullish') push('Stochastic', 'bull', 0.5, '%K di atas %D');
    else if (stoch.signal === 'Bearish') push('Stochastic', 'bear', 0.5, '%K di bawah %D');
  }
  if (bb) {
    if (bb.percentB < 10) push('Bollinger', 'bull', 0.5, 'dekat lower band');
    else if (bb.percentB > 90) push('Bollinger', 'bear', 0.5, 'dekat upper band');
  }
  if (adxV?.trend === 'Strong') push('ADX', adxV.plusDI > adxV.minusDI ? 'bull' : 'bear', 1, `tren kuat (ADX ${adxV.value.toFixed(0)})`);
  if (obvV?.divergence === 'Bullish') push('OBV', 'bull', 1, 'divergensi bullish');
  else if (obvV?.divergence === 'Bearish') push('OBV', 'bear', 1, 'divergensi bearish');

  const bull = signals.filter((s) => s.signal === 'bull').reduce((a, s) => a + s.weight, 0);
  const bear = signals.filter((s) => s.signal === 'bear').reduce((a, s) => a + s.weight, 0);
  const score = maxWeight > 0 ? Math.round(Math.max(0, Math.min(100, 50 + ((bull - bear) / maxWeight) * 50))) : 50;
  const rating: TechnicalResponse['summary']['rating'] = score >= 75 ? 'STRONG BUY' : score >= 55 ? 'BUY' : score <= 25 ? 'STRONG SELL' : score <= 45 ? 'SELL' : 'NEUTRAL';

  const yearHigh = Math.max(...bars.high.slice(-252), price);
  const yearLow = Math.min(...bars.low.slice(-252), price);

  return {
    symbol: ticker,
    name: validated?.quote.name || IDX_TICKERS[ticker] || daily.name || ticker,
    asOf: new Date((daily.regularMarketTime ?? nowSec) * 1000).toISOString(),
    source: { label: 'Yahoo Finance', delayed: true },
    quote: {
      price,
      previousClose,
      change,
      changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
      suspect: validated ? validated.issue !== null : false,
      stale: validated?.stale === true,
      lastTradeDate: validated?.lastTradeDate ?? null,
      volume: todayVolume,
      valueTraded: price * todayVolume,
      dayHigh: todayIsLast ? bars.high[n - 1] : null,
      dayLow: todayIsLast ? bars.low[n - 1] : null,
      yearHigh,
      yearLow,
    },
    indicators: {
      rsi: rsiV,
      macd: macdV,
      bollinger: bb,
      stochastic: stoch,
      atr: atrV,
      atrPct: atrV !== null && price > 0 ? (atrV / price) * 100 : null,
      adx: adxV,
      obv: obvV,
      mfi: mfiV,
      cmf: cmfV,
      vwap20,
      sma20,
      sma50,
      sma200,
      ema20,
      ema50,
    },
    trend: {
      weekly: weekly ? trendFrom(weekly.close, 10, 20, 'Close') : null,
      daily: trendFrom(closes, 20, 50, 'Close'),
      hourly: hourly ? trendFrom(hourly.close, 20, 50, 'Close') : null,
    },
    pivots,
    volumeFlow: {
      status: flowStatus,
      score: flowScore,
      volumeRatio,
      partial: todayIsLast && ci < n - 1,
      avgValue20: avgVol20 > 0 ? avgVol20 * (sma20 ?? price) : null,
    },
    risk: riskMetrics(closes),
    signals,
    summary: { score, rating },
  };
}

/**
 * GET /api/analysis/technical?symbol=BBCA
 * Indikator teknikal dari data Yahoo (harian 1 tahun, mingguan 2 tahun, per jam 1 bulan),
 * support/resistance 9 titik (klasik, Fibonacci, Camarilla) dari sesi yang sudah selesai,
 * dan estimasi arus volume. Tidak ada data cadangan buatan: 404 bila simbol tidak dikenal,
 * 502 bila sumber gagal.
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const ticker = validateTickerSymbol(request.nextUrl.searchParams.get('symbol'))?.replace(/\.JK$/, '');
  if (!ticker) return NextResponse.json({ error: 'Invalid or missing symbol parameter', code: 'invalid_symbol' }, { status: 400 });

  try {
    const { value } = await cache(ticker, () => analyze(ticker));
    if (!value) return NextResponse.json({ error: `Ticker ${ticker} not found`, code: 'not_found' }, { status: 404 });
    return NextResponse.json(value);
  } catch (error) {
    console.error(`[technical] ${ticker}:`, getErrorMessage(error));
    return NextResponse.json({ error: 'Technical data source unavailable', code: 'source_failed' }, { status: 502 });
  }
}
