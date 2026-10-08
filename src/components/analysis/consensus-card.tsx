'use client';

import * as React from 'react';
import { Compass } from 'lucide-react';
import { Card, CardTitle, pick, type Lang } from '@/components/shared/calc-ui';
import type { Rating, ScorePoint } from '@/lib/analysis-score';

export interface ConsensusPart {
  key: 'technical' | 'fundamental' | 'flow' | 'news';
  score: number | null;
  /** Bobot dasar dalam persen (35/30/20/15). */
  weight: number;
}

const PART_LABEL: Record<ConsensusPart['key'], { id: string; en: string }> = {
  technical: { id: 'Teknikal', en: 'Technical' },
  fundamental: { id: 'Fundamental', en: 'Fundamental' },
  flow: { id: 'Arus volume', en: 'Volume flow' },
  news: { id: 'Sentimen berita', en: 'News sentiment' },
};

export const RATING_LABEL: Record<Rating, { id: string; en: string; cls: string }> = {
  'STRONG BUY': { id: 'Beli kuat', en: 'Strong buy', cls: 'text-emerald-400' },
  BUY: { id: 'Beli', en: 'Buy', cls: 'text-emerald-400' },
  NEUTRAL: { id: 'Netral', en: 'Neutral', cls: 'text-slate-200' },
  SELL: { id: 'Jual', en: 'Sell', cls: 'text-rose-400' },
  'STRONG SELL': { id: 'Jual kuat', en: 'Strong sell', cls: 'text-rose-400' },
};

const barColor = (s: number) => (s >= 55 ? 'bg-emerald-400' : s <= 45 ? 'bg-rose-400' : 'bg-slate-400');

/** Skor konsensus berbobot dari komponen yang datanya tersedia, plus poin positif/negatif. */
export function ConsensusCard({
  language,
  result,
  parts,
  riskLevel,
  points,
}: {
  language: Lang;
  result: { score: number; rating: Rating } | null;
  parts: ConsensusPart[];
  riskLevel: 'High' | 'Moderate' | 'Low' | null;
  points: ScorePoint[];
}) {
  const L = (id: string, en: string) => pick(language, id, en);
  const available = parts.filter((p) => p.score !== null);
  const weightSum = available.reduce((s, p) => s + p.weight, 0);
  const pros = points.filter((p) => p.tone === 'pro').slice(0, 5);
  const cons = points.filter((p) => p.tone === 'con').slice(0, 5);

  return (
    <Card className="h-full flex flex-col">
      <CardTitle icon={<Compass className="h-5 w-5 text-emerald-400" />} title={L('Skor Konsensus', 'Consensus Score')} subtitle={L('Gabungan berbobot dari data yang tersedia.', 'Weighted blend of the available data.')} />
      {result ? (
        <div className="flex items-end gap-3">
          <span className="text-5xl font-black text-white tabular-nums leading-none">{result.score}</span>
          <div className="pb-1">
            <span className={`block text-lg font-black leading-tight ${RATING_LABEL[result.rating].cls}`}>{L(RATING_LABEL[result.rating].id, RATING_LABEL[result.rating].en)}</span>
            <span className="block text-[10px] text-slate-500">/ 100</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">{L('Menunggu data…', 'Waiting for data…')}</p>
      )}

      <div className="mt-4 space-y-2.5">
        {parts.map((p) => (
          <div key={p.key}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-bold text-slate-300">
                {L(PART_LABEL[p.key].id, PART_LABEL[p.key].en)}{' '}
                <span className="text-slate-500 font-semibold">
                  {p.score === null ? L('· tidak tersedia', '· unavailable') : `· ${L('bobot', 'weight')} ${Math.round((p.weight / weightSum) * 100)}%`}
                </span>
              </span>
              <span className="font-mono text-slate-200">{p.score ?? '—'}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              {p.score !== null && <div className={`h-full rounded-full ${barColor(p.score)}`} style={{ width: `${p.score}%` }} />}
            </div>
          </div>
        ))}
      </div>
      {riskLevel && riskLevel !== 'Moderate' && (
        <p className="text-[10px] text-slate-500 mt-2">
          {riskLevel === 'High' ? L('Volatilitas tinggi: skor dikurangi 5.', 'High volatility: score reduced by 5.') : L('Volatilitas rendah: skor ditambah 2.', 'Low volatility: score increased by 2.')}
        </p>
      )}

      {(pros.length > 0 || cons.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 text-[11px]">
          {pros.length > 0 && (
            <ul className="space-y-1">
              {pros.map((p) => <li key={p.text} className="flex gap-1.5 text-slate-300"><span className="text-emerald-400">+</span>{p.text}</li>)}
            </ul>
          )}
          {cons.length > 0 && (
            <ul className="space-y-1">
              {cons.map((p) => <li key={p.text} className="flex gap-1.5 text-slate-300"><span className="text-rose-400">−</span>{p.text}</li>)}
            </ul>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-500 mt-auto pt-4 leading-snug">
        {L('Skor ini ringkasan otomatis, bukan rekomendasi beli/jual. Selalu cek laporan keuangan dan rencana trading sendiri.', 'This score is an automated summary, not a buy/sell recommendation. Always check filings and your own trading plan.')}
      </p>
    </Card>
  );
}
