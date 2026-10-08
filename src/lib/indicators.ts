/**
 * Indikator teknikal (fungsi murni) mengikuti definisi standar:
 * RSI/ATR/ADX dengan smoothing Wilder, EMA di-seed SMA, MFI = jumlah aliran dana `period` bar,
 * Stochastic (14,3), Bollinger (20,2), OBV, CMF (20), serta support/resistance 9 titik.
 */

import { getIdxTickSize, roundToNearestIdxTick } from '@/lib/calculator';

export interface Bars {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  /** Epoch detik awal bar. */
  time: number[];
}

const last = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/** EMA penuh (null sebelum cukup data), di-seed dengan SMA `period` bar pertama. */
export function emaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  return last(emaSeries(values, period)) ?? null;
}

/** RSI Wilder. Harga datar (tanpa naik/turun) = 50. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const f = emaSeries(closes, fast);
  const s = emaSeries(closes, slow);
  const line: number[] = [];
  for (let i = 0; i < closes.length; i++) if (f[i] !== null && s[i] !== null) line.push((f[i] as number) - (s[i] as number));
  if (line.length < signalPeriod + 1) return null;
  const sig = emaSeries(line, signalPeriod);
  const m = line[line.length - 1];
  const sg = sig[sig.length - 1] as number;
  const pm = line[line.length - 2];
  const ps = sig[sig.length - 2] ?? sg;
  const hist = m - sg;
  const prevHist = pm - (ps as number);
  let signal: 'Bullish Crossover' | 'Bearish Crossover' | 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (m > sg && pm <= (ps as number)) signal = 'Bullish Crossover';
  else if (m < sg && pm >= (ps as number)) signal = 'Bearish Crossover';
  else if (m > sg) signal = 'Bullish';
  else if (m < sg) signal = 'Bearish';
  return { macd: m, signal: sg, histogram: hist, histogramRising: hist > prevHist, signalName: signal };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  if (mid === null) return null;
  const slice = closes.slice(-period);
  const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  const upper = mid + mult * sd;
  const lower = mid - mult * sd;
  const price = closes[closes.length - 1];
  const width = upper - lower;
  return {
    upper,
    middle: mid,
    lower,
    percentB: width > 0 ? ((price - lower) / width) * 100 : 50,
    bandwidth: mid > 0 ? (width / mid) * 100 : 0,
  };
}

/** Stochastic lambat: %K(14) dihaluskan SMA3, %D = SMA3 dari %K. */
export function stochastic(b: Bars, period = 14, smoothK = 3, smoothD = 3) {
  const n = b.close.length;
  if (n < period + smoothK + smoothD) return null;
  const raw: number[] = [];
  for (let i = period - 1; i < n; i++) {
    const hh = Math.max(...b.high.slice(i - period + 1, i + 1));
    const ll = Math.min(...b.low.slice(i - period + 1, i + 1));
    raw.push(hh === ll ? 50 : ((b.close[i] - ll) / (hh - ll)) * 100);
  }
  const kSeries: number[] = [];
  for (let i = smoothK - 1; i < raw.length; i++) kSeries.push(raw.slice(i - smoothK + 1, i + 1).reduce((a, c) => a + c, 0) / smoothK);
  const k = kSeries[kSeries.length - 1];
  const d = sma(kSeries, smoothD) ?? k;
  const prevK = kSeries[kSeries.length - 2] ?? k;
  const prevD = sma(kSeries.slice(0, -1), smoothD) ?? d;
  let signal: 'Buy Signal' | 'Sell Signal' | 'Overbought' | 'Oversold' | 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (k < 20 && prevK <= prevD && k > d) signal = 'Buy Signal';
  else if (k > 80 && prevK >= prevD && k < d) signal = 'Sell Signal';
  else if (k > 80) signal = 'Overbought';
  else if (k < 20) signal = 'Oversold';
  else if (k > d) signal = 'Bullish';
  else if (k < d) signal = 'Bearish';
  return { k, d, signal };
}

function trueRanges(b: Bars): number[] {
  const tr: number[] = [];
  for (let i = 1; i < b.close.length; i++) {
    tr.push(Math.max(b.high[i] - b.low[i], Math.abs(b.high[i] - b.close[i - 1]), Math.abs(b.low[i] - b.close[i - 1])));
  }
  return tr;
}

/** ATR Wilder. */
export function atr(b: Bars, period = 14): number | null {
  const tr = trueRanges(b);
  if (tr.length < period) return null;
  let v = tr.slice(0, period).reduce((a, c) => a + c, 0) / period;
  for (let i = period; i < tr.length; i++) v = (v * (period - 1) + tr[i]) / period;
  return v;
}

/** ADX Wilder (+DI/−DI dari jumlah yang di-smoothing, ADX = rata-rata Wilder dari DX). */
export function adx(b: Bars, period = 14) {
  const n = b.close.length;
  if (n < period * 2 + 1) return null;
  const tr = trueRanges(b);
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < n; i++) {
    const up = b.high[i] - b.high[i - 1];
    const down = b.low[i - 1] - b.low[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  let sTR = tr.slice(0, period).reduce((a, c) => a + c, 0);
  let sP = plusDM.slice(0, period).reduce((a, c) => a + c, 0);
  let sM = minusDM.slice(0, period).reduce((a, c) => a + c, 0);
  const dx: number[] = [];
  let pdi = 0;
  let mdi = 0;
  for (let i = period; i <= tr.length; i++) {
    if (i > period) {
      sTR = sTR - sTR / period + tr[i - 1];
      sP = sP - sP / period + plusDM[i - 1];
      sM = sM - sM / period + minusDM[i - 1];
    }
    pdi = sTR > 0 ? (sP / sTR) * 100 : 0;
    mdi = sTR > 0 ? (sM / sTR) * 100 : 0;
    dx.push(pdi + mdi > 0 ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0);
  }
  if (dx.length < period) return null;
  let value = dx.slice(0, period).reduce((a, c) => a + c, 0) / period;
  for (let i = period; i < dx.length; i++) value = (value * (period - 1) + dx[i]) / period;
  return { value, plusDI: pdi, minusDI: mdi, trend: value > 25 ? 'Strong' : value > 20 ? 'Weak' : 'None' as 'Strong' | 'Weak' | 'None' };
}

/** MFI standar: rasio jumlah aliran dana positif/negatif selama `period` bar terakhir. */
export function mfi(b: Bars, period = 14): number | null {
  const n = b.close.length;
  if (n <= period) return null;
  const tp = b.close.map((c, i) => (b.high[i] + b.low[i] + c) / 3);
  let pos = 0;
  let neg = 0;
  for (let i = n - period; i < n; i++) {
    const flow = tp[i] * b.volume[i];
    if (tp[i] > tp[i - 1]) pos += flow;
    else if (tp[i] < tp[i - 1]) neg += flow;
  }
  if (pos === 0 && neg === 0) return 50;
  if (neg === 0) return 100;
  return 100 - 100 / (1 + pos / neg);
}

/** Chaikin Money Flow (20): + berarti penutupan cenderung dekat high dengan volume (tekanan beli). */
export function cmf(b: Bars, period = 20): number | null {
  const n = b.close.length;
  if (n < period) return null;
  let mfv = 0;
  let vol = 0;
  for (let i = n - period; i < n; i++) {
    const range = b.high[i] - b.low[i];
    const mult = range > 0 ? ((b.close[i] - b.low[i]) - (b.high[i] - b.close[i])) / range : 0;
    mfv += mult * b.volume[i];
    vol += b.volume[i];
  }
  return vol > 0 ? mfv / vol : 0;
}

/** OBV, tren 10 bar (relatif terhadap volume rata-rata, aman untuk OBV negatif), dan divergensi harga. */
export function obv(b: Bars, lookback = 10) {
  const n = b.close.length;
  if (n < lookback + 1) return null;
  const series = [0];
  for (let i = 1; i < n; i++) {
    const prev = series[i - 1];
    series.push(b.close[i] > b.close[i - 1] ? prev + b.volume[i] : b.close[i] < b.close[i - 1] ? prev - b.volume[i] : prev);
  }
  const change = series[n - 1] - series[n - 1 - lookback];
  const avgVol = b.volume.slice(-lookback).reduce((a, c) => a + c, 0) / lookback || 1;
  const trend: 'Rising' | 'Falling' | 'Flat' = change > avgVol * 0.5 ? 'Rising' : change < -avgVol * 0.5 ? 'Falling' : 'Flat';
  const priceChange = (b.close[n - 1] - b.close[n - 1 - lookback]) / b.close[n - 1 - lookback];
  const divergence: 'Bullish' | 'Bearish' | 'None' = priceChange > 0.02 && change < 0 ? 'Bearish' : priceChange < -0.02 && change > 0 ? 'Bullish' : 'None';
  return { value: series[n - 1], trend, divergence };
}

/** Volatilitas tahunan, max drawdown, dan rasio imbal hasil/risiko (proksi Sharpe, bebas risiko 0). */
export function riskMetrics(closes: number[], periodsPerYear = 252) {
  if (closes.length < 21) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, c) => a + c, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1));
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    maxDD = Math.min(maxDD, c / peak - 1);
  }
  const volatility = sd * Math.sqrt(periodsPerYear) * 100;
  return {
    volatility,
    maxDrawdown: Math.abs(maxDD) * 100,
    sharpeProxy: sd > 0 ? (mean * periodsPerYear) / (sd * Math.sqrt(periodsPerYear)) : 0,
    riskLevel: (volatility > 50 ? 'High' : volatility > 25 ? 'Moderate' : 'Low') as 'High' | 'Moderate' | 'Low',
  };
}

// ─── Support & resistance 9 titik ───
export type PivotMethod = 'classic' | 'fibonacci' | 'camarilla';
export type LevelKey = 'R4' | 'R3' | 'R2' | 'R1' | 'PP' | 'S1' | 'S2' | 'S3' | 'S4';

export interface PivotLevel {
  key: LevelKey;
  price: number;
}

export const LEVEL_ORDER: LevelKey[] = ['R4', 'R3', 'R2', 'R1', 'PP', 'S1', 'S2', 'S3', 'S4'];

/**
 * 9 titik dari high/low/close sesi acuan (sesi yang sudah selesai), dibulatkan ke fraksi BEI.
 * - Klasik: PP=(H+L+C)/3; R1=2PP−L; R2=PP+(H−L); R3=H+2(PP−L); R4=R3+(H−L) (simetris untuk S).
 * - Fibonacci: PP ± 0,382 / 0,618 / 1,000 / 1,618 × (H−L).
 * - Camarilla: C ± (H−L) × 1,1 / 12, 6, 4, 2; PP klasik sebagai titik tengah.
 */
export function pivotLevels(high: number, low: number, close: number, method: PivotMethod): PivotLevel[] {
  const range = high - low;
  const pp = (high + low + close) / 3;
  let raw: Record<LevelKey, number>;
  if (method === 'fibonacci') {
    raw = {
      R4: pp + 1.618 * range, R3: pp + range, R2: pp + 0.618 * range, R1: pp + 0.382 * range, PP: pp,
      S1: pp - 0.382 * range, S2: pp - 0.618 * range, S3: pp - range, S4: pp - 1.618 * range,
    };
  } else if (method === 'camarilla') {
    const k = range * 1.1;
    raw = {
      R4: close + k / 2, R3: close + k / 4, R2: close + k / 6, R1: close + k / 12, PP: pp,
      S1: close - k / 12, S2: close - k / 6, S3: close - k / 4, S4: close - k / 2,
    };
  } else {
    const r3 = high + 2 * (pp - low);
    const s3 = low - 2 * (high - pp);
    raw = {
      R4: r3 + range, R3: r3, R2: pp + range, R1: 2 * pp - low, PP: pp,
      S1: 2 * pp - high, S2: pp - range, S3: s3, S4: s3 - range,
    };
  }
  return LEVEL_ORDER.map((key) => ({ key, price: Math.max(1, roundToNearestIdxTick(raw[key])) }));
}

/** Posisi harga terhadap 9 titik: titik terdekat di atas & di bawah. */
export function locateInLevels(levels: PivotLevel[], price: number) {
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  const above = [...sorted].reverse().find((l) => l.price > price) ?? null;
  const below = sorted.find((l) => l.price < price) ?? null;
  const at = sorted.find((l) => Math.abs(l.price - price) < getIdxTickSize(price) / 2) ?? null;
  return { above, below, at };
}
