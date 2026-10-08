'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { Card, CardTitle, Segmented, Stat, pct, pick, type Lang } from '@/components/shared/calc-ui';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';
import type { FinancialPoint, FundamentalsData } from '@/lib/fundamentals-source';

function HistoryChart({ language, points }: { language: Lang; points: FinancialPoint[] }) {
  const L = (id: string, en: string) => pick(language, id, en);
  if (points.length === 0) return <p className="py-8 text-center text-xs text-slate-500">{L('Riwayat laporan keuangan tidak tersedia.', 'Financial history is not available.')}</p>;
  const values = points.flatMap((p) => [p.revenue ?? 0, p.netIncome ?? 0]);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const zero = (max / span) * 100;
  const h = (v: number | null) => (v === null ? 0 : (Math.abs(v) / span) * 100);

  return (
    <div>
      <div className="relative h-48 flex items-stretch gap-2 sm:gap-4 px-1" role="img" aria-label={L('Grafik pendapatan dan laba bersih', 'Revenue and net income chart')}>
        <div className="absolute left-0 right-0 border-t border-white/15" style={{ top: `${zero}%` }} />
        {points.map((p) => (
          <div key={p.date} className="flex-1 min-w-0 relative" title={`${p.label}: ${L('pendapatan', 'revenue')} ${p.revenue !== null ? formatIDRCompact(p.revenue, language) : '—'}, ${L('laba bersih', 'net income')} ${p.netIncome !== null ? formatIDRCompact(p.netIncome, language) : '—'}`}>
            {(['revenue', 'netIncome'] as const).map((k, idx) => {
              const v = p[k];
              const neg = (v ?? 0) < 0;
              return (
                <div
                  key={k}
                  className={`absolute w-[42%] rounded-sm ${k === 'revenue' ? 'bg-violet-400/80' : neg ? 'bg-rose-400/80' : 'bg-emerald-400/80'}`}
                  style={{ left: idx === 0 ? '6%' : '52%', height: `${h(v)}%`, ...(neg ? { top: `${zero}%` } : { bottom: `${100 - zero}%` }) }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-4 px-1 mt-1.5">
        {points.map((p) => (
          <div key={p.date} className="flex-1 min-w-0 text-center">
            <span className="block text-[10px] font-bold text-slate-400">{p.label}</span>
            <span className={`block text-[9px] tabular-nums ${(p.netIncome ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{p.netIncome !== null ? formatIDRCompact(p.netIncome, language) : '—'}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-[10px] font-bold text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet-400" />{L('Pendapatan', 'Revenue')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-400" />{L('Laba bersih', 'Net income')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-400" />{L('Rugi bersih', 'Net loss')}</span>
      </div>
    </div>
  );
}

/** Rasio fundamental terkini + riwayat pendapatan & laba. Metrik kosong tampil "—", bukan angka perkiraan. */
export function FundamentalsPanel({ language, data }: { language: Lang; data: FundamentalsData }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [period, setPeriod] = React.useState<'annual' | 'quarterly'>('annual');
  const m = data.metrics;
  const x = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : `${formatNumberLocale(v, language, d)}x`);
  const p = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : pct(v, language, d));
  const isFinance = data.sector === 'Finance';

  return (
    <Card>
      <CardTitle
        icon={<Building2 className="h-5 w-5 text-emerald-400" />}
        title={L('Fundamental', 'Fundamentals')}
        subtitle={[data.sector, data.industry].filter(Boolean).join(' · ') || undefined}
      />
      {m ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat tone={m.pe !== null && m.pe > 0 && m.pe < 15 ? 'emerald' : m.pe !== null && (m.pe < 0 || m.pe > 25) ? 'rose' : 'slate'} label="P/E (TTM)" value={m.pe !== null ? x(m.pe) : m.eps !== null && m.eps < 0 ? L('rugi', 'loss') : '—'} sub={`EPS ${m.eps !== null ? formatNumberLocale(m.eps, language, 1) : '—'}`} />
          <Stat tone={m.pbv !== null && m.pbv < 1.2 ? 'emerald' : m.pbv !== null && m.pbv > 3 ? 'rose' : 'slate'} label="PBV" value={x(m.pbv, 2)} sub={`P/S ${x(m.ps, 2)}`} />
          <Stat tone={m.roe !== null && m.roe > 15 ? 'emerald' : m.roe !== null && m.roe <= 0 ? 'rose' : 'slate'} label="ROE" value={p(m.roe)} sub={`ROA ${p(m.roa)}`} />
          <Stat
            tone={isFinance || m.der === null ? 'slate' : m.der < 0.8 ? 'emerald' : m.der > 2 ? 'rose' : 'slate'}
            label={L('Utang / ekuitas (DER)', 'Debt / equity (DER)')}
            value={x(m.der, 2)}
            sub={isFinance ? L('kurang relevan untuk bank', 'less relevant for banks') : `${L('current ratio', 'current ratio')} ${x(m.currentRatio, 2)}`}
          />
          <Stat tone={m.dividendYield !== null && m.dividendYield >= 4 ? 'emerald' : 'slate'} label="Dividend yield" value={p(m.dividendYield, 2)} />
          <Stat tone={m.netMargin !== null && m.netMargin < 0 ? 'rose' : 'slate'} label={L('Margin laba bersih', 'Net margin')} value={p(m.netMargin)} sub={`${L('operasi', 'operating')} ${p(m.operatingMargin)}`} />
          <Stat label={L('Kapitalisasi pasar', 'Market cap')} value={m.marketCap !== null ? formatIDRCompact(m.marketCap, language, 1) : '—'} sub={m.freeFloatPct !== null ? `free float ${pct(m.freeFloatPct, language, 1)}` : undefined} />
          <Stat label={L('Pendapatan (TTM)', 'Revenue (TTM)')} value={m.revenue !== null ? formatIDRCompact(m.revenue, language, 1) : '—'} />
          <Stat tone={m.netIncome !== null && m.netIncome < 0 ? 'rose' : 'slate'} label={L('Laba bersih', 'Net income')} value={m.netIncome !== null ? formatIDRCompact(m.netIncome, language, 1) : '—'} />
          <Stat label="Free cash flow" value={m.freeCashFlow !== null ? formatIDRCompact(m.freeCashFlow, language, 1) : '—'} sub={m.beta !== null ? `beta ${formatNumberLocale(m.beta, language, 2)}` : undefined} />
        </div>
      ) : (
        <p className="py-4 text-xs text-slate-500">{L('Rasio fundamental tidak tersedia untuk emiten ini.', 'Fundamental ratios are not available for this stock.')}</p>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-bold text-slate-300">{L('Pendapatan & laba bersih', 'Revenue & net income')}</h3>
          <Segmented
            ariaLabel={L('Periode', 'Period')}
            value={period}
            onChange={setPeriod}
            className="w-48"
            options={[
              { value: 'annual', label: L('Tahunan', 'Annual') },
              { value: 'quarterly', label: L('Kuartalan', 'Quarterly') },
            ]}
          />
        </div>
        <HistoryChart language={language} points={data.history[period]} />
      </div>

      <p className="text-[10px] text-slate-500 mt-4">
        {L('Sumber', 'Sources')}: {[data.sources.metrics && `${L('rasio', 'ratios')} ${data.sources.metrics}`, data.sources.history && `${L('riwayat laporan', 'statements')} ${data.sources.history}`].filter(Boolean).join(' · ') || '—'}.{' '}
        {L('Rasio TTM = 12 bulan terakhir; nilai bisa berbeda tipis dengan laporan resmi emiten.', 'TTM = trailing 12 months; values may differ slightly from official filings.')}
      </p>
    </Card>
  );
}
