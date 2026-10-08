'use client';

import * as React from 'react';
import { Waves } from 'lucide-react';
import { Card, CardTitle, Stat, pick, type Lang } from '@/components/shared/calc-ui';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';
import type { TechnicalResponse } from '@/app/api/analysis/technical/route';

const STATUS: Record<TechnicalResponse['volumeFlow']['status'], { id: string; en: string; tone: 'emerald' | 'rose' | 'slate' }> = {
  STRONG_ACCUMULATION: { id: 'Tekanan beli kuat', en: 'Strong buying pressure', tone: 'emerald' },
  ACCUMULATION: { id: 'Tekanan beli', en: 'Buying pressure', tone: 'emerald' },
  NEUTRAL: { id: 'Seimbang', en: 'Balanced', tone: 'slate' },
  DISTRIBUTION: { id: 'Tekanan jual', en: 'Selling pressure', tone: 'rose' },
  STRONG_DISTRIBUTION: { id: 'Tekanan jual kuat', en: 'Strong selling pressure', tone: 'rose' },
};

/**
 * Arus volume & dana dari data harga-volume publik (CMF, MFI, OBV, rasio volume).
 * Menggantikan "broker summary" dan "net foreign" lama yang ternyata dikarang dari hash kode saham.
 */
export function FlowPanel({ language, data }: { language: Lang; data: TechnicalResponse }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const f = data.volumeFlow;
  const i = data.indicators;
  const st = STATUS[f.status];
  const n1 = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : formatNumberLocale(v, language, d));

  return (
    <Card>
      <CardTitle
        icon={<Waves className="h-5 w-5 text-emerald-400" />}
        title={L('Arus Volume & Dana', 'Volume & Money Flow')}
        subtitle={L(
          'Estimasi dari pergerakan harga dan volume harian (bukan data broker). Data broker summary dan net beli asing per saham tidak tersedia dari sumber gratis, jadi tidak ditampilkan.',
          'Estimated from daily price and volume (not broker data). Broker summary and net foreign buying per stock are not available from free sources, so they are not shown.'
        )}
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat tone={st.tone} className="col-span-2 lg:col-span-1" valueClassName="text-base whitespace-normal" label={L('Status', 'Status')} value={L(st.id, st.en)} sub={L(`skor ${f.score}/100`, `score ${f.score}/100`)} />
        <Stat
          tone={i.cmf === null ? 'slate' : i.cmf > 0.05 ? 'emerald' : i.cmf < -0.05 ? 'rose' : 'slate'}
          label="Chaikin Money Flow (20)"
          value={n1(i.cmf, 2)}
          sub={L('+ = penutupan dekat high dengan volume', '+ = closes near highs on volume')}
        />
        <Stat
          tone={i.mfi === null ? 'slate' : i.mfi > 80 ? 'rose' : i.mfi < 20 ? 'emerald' : 'slate'}
          label="Money Flow Index (14)"
          value={n1(i.mfi)}
          sub={i.mfi === null ? undefined : i.mfi > 80 ? L('jenuh beli', 'overbought') : i.mfi < 20 ? L('jenuh jual', 'oversold') : L('netral', 'neutral')}
        />
        <Stat
          tone={i.obv?.trend === 'Rising' ? 'emerald' : i.obv?.trend === 'Falling' ? 'rose' : 'slate'}
          label="On-Balance Volume"
          value={i.obv ? (i.obv.trend === 'Rising' ? L('Naik', 'Rising') : i.obv.trend === 'Falling' ? L('Turun', 'Falling') : L('Datar', 'Flat')) : '—'}
          sub={i.obv?.divergence && i.obv.divergence !== 'None' ? L(`divergensi ${i.obv.divergence === 'Bullish' ? 'bullish' : 'bearish'}`, `${i.obv.divergence.toLowerCase()} divergence`) : L('10 hari terakhir', 'last 10 days')}
        />
        <Stat
          tone={f.volumeRatio !== null && f.volumeRatio >= 1.5 ? 'sky' : 'slate'}
          label={L('Volume vs rata-rata 20 hari', 'Volume vs 20-day avg')}
          value={f.volumeRatio !== null ? `${n1(f.volumeRatio, 2)}×` : '—'}
          sub={
            f.partial
              ? L(`sesi berjalan, belum final · ${formatIDRCompact(data.quote.valueTraded, language)}`, `session in progress, not final · ${formatIDRCompact(data.quote.valueTraded, language)}`)
              : L(`nilai hari ini ${formatIDRCompact(data.quote.valueTraded, language)}`, `today ${formatIDRCompact(data.quote.valueTraded, language)}`)
          }
        />
      </div>
    </Card>
  );
}
