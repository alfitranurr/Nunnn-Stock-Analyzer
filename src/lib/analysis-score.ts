/**
 * Skor konsensus Analisis Saham (fungsi murni).
 * Bobot: teknikal 35%, fundamental 30%, arus volume 20%, berita 15%. Komponen yang datanya
 * tidak tersedia dikeluarkan dan bobot sisanya dinormalkan ulang (tidak diisi angka 50 palsu).
 */

import type { FundamentalMetrics } from '@/lib/fundamentals-source';

export type Rating = 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';

export interface ScorePoint {
  text: string;
  tone: 'pro' | 'con';
}

export function ratingFromScore(score: number): Rating {
  if (score >= 75) return 'STRONG BUY';
  if (score >= 55) return 'BUY';
  if (score <= 25) return 'STRONG SELL';
  if (score <= 45) return 'SELL';
  return 'NEUTRAL';
}

/**
 * Skor fundamental 0–100. Rentang min/max dihitung dari metrik yang benar-benar tersedia
 * (temuan M-08: sebelumnya min di-hardcode −5). DER diabaikan untuk sektor keuangan.
 */
export function fundamentalScore(m: FundamentalMetrics, sector: string | null): { score: number; points: ScorePoint[] } | null {
  let total = 0;
  let min = 0;
  let max = 0;
  const points: ScorePoint[] = [];
  const add = (weight: number, value: number, text: string) => {
    min -= weight;
    max += weight;
    total += value;
    if (value > 0) points.push({ text, tone: 'pro' });
    else if (value < 0) points.push({ text, tone: 'con' });
  };
  const f1 = (v: number) => v.toFixed(1);

  if (m.pe !== null) {
    if (m.pe < 0) add(2, -2, `P/E negatif (rugi)`);
    else if (m.pe < 12) add(2, 2, `P/E murah ${f1(m.pe)}x`);
    else if (m.pe < 22) add(2, 1, `P/E wajar ${f1(m.pe)}x`);
    else add(2, -1, `P/E mahal ${f1(m.pe)}x`);
  } else if (m.eps !== null && m.eps < 0) {
    add(2, -2, 'EPS negatif (rugi)');
  }
  if (m.pbv !== null) {
    if (m.pbv < 1.2) add(2, 2, `PBV murah ${f1(m.pbv)}x`);
    else if (m.pbv < 3) add(2, 1, `PBV wajar ${f1(m.pbv)}x`);
    else add(2, -1, `PBV tinggi ${f1(m.pbv)}x`);
  }
  if (m.roe !== null) {
    if (m.roe > 15) add(2, 2, `ROE tinggi ${f1(m.roe)}%`);
    else if (m.roe > 8) add(2, 1, `ROE sehat ${f1(m.roe)}%`);
    else if (m.roe <= 0) add(2, -2, `ROE negatif ${f1(m.roe)}%`);
    else add(2, 0, '');
  }
  if (m.der !== null && sector !== 'Finance') {
    if (m.der < 0.8) add(1, 1, `DER rendah ${m.der.toFixed(2)}x`);
    else if (m.der > 2) add(1, -1, `DER tinggi ${m.der.toFixed(2)}x`);
    else add(1, 0, '');
  }
  if (m.netMargin !== null) {
    if (m.netMargin > 15) add(1, 1, `Margin laba bersih ${f1(m.netMargin)}%`);
    else if (m.netMargin < 0) add(1, -1, `Margin laba bersih negatif ${f1(m.netMargin)}%`);
    else add(1, 0, '');
  }
  if (m.dividendYield !== null) {
    if (m.dividendYield >= 4) add(1, 1, `Dividend yield ${f1(m.dividendYield)}%`);
    else add(1, 0, '');
  }
  if (max === 0) return null;
  return { score: Math.round(((total - min) / (max - min)) * 100), points: points.filter((p) => p.text) };
}

export interface ConsensusInput {
  technical: number | null;
  fundamental: number | null;
  flow: number | null;
  news: number | null;
  riskLevel?: 'High' | 'Moderate' | 'Low' | null;
}

const WEIGHTS = { technical: 0.35, fundamental: 0.3, flow: 0.2, news: 0.15 } as const;

export function consensus(input: ConsensusInput): { score: number; rating: Rating; used: Array<keyof typeof WEIGHTS> } | null {
  const used = (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).filter((k) => input[k] !== null);
  if (used.length === 0) return null;
  const weightSum = used.reduce((s, k) => s + WEIGHTS[k], 0);
  let score = used.reduce((s, k) => s + (input[k] as number) * WEIGHTS[k], 0) / weightSum;
  if (input.riskLevel === 'High') score -= 5;
  else if (input.riskLevel === 'Low') score += 2;
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, rating: ratingFromScore(score), used };
}

export const newsScore = (sentiment: string | undefined, method: string | undefined): number | null =>
  !sentiment || method === 'none' ? null : sentiment === 'Bullish' ? 75 : sentiment === 'Bearish' ? 25 : 50;
