'use client';

import * as React from 'react';
import { Activity, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Badge, Card, CardTitle, Stat, pct, pick, rp, type Lang } from '@/components/shared/calc-ui';
import { formatNumberLocale } from '@/lib/format';
import type { TechnicalResponse } from '@/app/api/analysis/technical/route';

const fmt = (v: number | null | undefined, language: Lang, digits = 1) => (v === null || v === undefined ? '—' : formatNumberLocale(v, language, digits));

function TrendCell({ language, label, trend }: { language: Lang; label: string; trend: TechnicalResponse['trend']['daily'] }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const dir = trend?.direction;
  const Icon = dir === 'BULLISH' ? TrendingUp : dir === 'BEARISH' ? TrendingDown : Minus;
  const tone = dir === 'BULLISH' ? 'text-emerald-400' : dir === 'BEARISH' ? 'text-rose-400' : 'text-slate-300';
  const text = dir === 'BULLISH' ? L('Naik', 'Uptrend') : dir === 'BEARISH' ? L('Turun', 'Downtrend') : dir ? L('Mendatar', 'Sideways') : '—';
  return (
    <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className={`flex items-center gap-1.5 text-base font-black mt-1 ${tone}`}><Icon className="h-4 w-4" />{text}</div>
      <p className="text-[10px] text-slate-500 mt-1 leading-snug">{trend?.detail ?? L('Data tidak cukup', 'Not enough data')}</p>
    </div>
  );
}

/** Tren multi-timeframe, indikator utama, dan sinyal penyusun skor teknikal. */
export function TechnicalPanel({ language, data }: { language: Lang; data: TechnicalResponse }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const i = data.indicators;
  const price = data.quote.price;
  const rsiTone = i.rsi === null ? 'slate' : i.rsi > 70 ? 'rose' : i.rsi < 30 ? 'emerald' : 'slate';
  const vs = (ma: number | null) => (ma === null ? '' : price >= ma ? L(`harga ${pct(((price - ma) / ma) * 100, language, 1)} di atas`, `price ${pct(((price - ma) / ma) * 100, language, 1)} above`) : L(`harga ${pct(((ma - price) / ma) * 100, language, 1)} di bawah`, `price ${pct(((ma - price) / ma) * 100, language, 1)} below`));

  return (
    <Card>
      <CardTitle
        icon={<Activity className="h-5 w-5 text-emerald-400" />}
        title={L('Indikator Teknikal', 'Technical Indicators')}
        subtitle={L('Data harian 1 tahun, mingguan 2 tahun, dan per jam 1 bulan. Indikator memakai harga terkini sebagai bar terakhir.', 'Daily (1y), weekly (2y) and hourly (1m) data. Indicators use the live price as the last bar.')}
        right={<Badge tone={data.summary.score >= 55 ? 'emerald' : data.summary.score <= 45 ? 'amber' : 'slate'}>{data.summary.rating} · {data.summary.score}</Badge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TrendCell language={language} label={L('Mingguan (jangka panjang)', 'Weekly (long term)')} trend={data.trend.weekly} />
        <TrendCell language={language} label={L('Harian (menengah)', 'Daily (medium)')} trend={data.trend.daily} />
        <TrendCell language={language} label={L('Per jam (pendek)', 'Hourly (short)')} trend={data.trend.hourly} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <Stat tone={rsiTone} label="RSI (14)" value={fmt(i.rsi, language)} sub={i.rsi === null ? '' : i.rsi > 70 ? L('jenuh beli', 'overbought') : i.rsi < 30 ? L('jenuh jual', 'oversold') : L('netral', 'neutral')} />
        <Stat
          tone={i.macd?.signalName.startsWith('Bullish') ? 'emerald' : i.macd?.signalName.startsWith('Bearish') ? 'rose' : 'slate'}
          label="MACD (12,26,9)"
          value={<span className="text-sm">{i.macd?.signalName ?? '—'}</span>}
          sub={i.macd ? `${L('histogram', 'histogram')} ${fmt(i.macd.histogram, language, 2)} ${i.macd.histogramRising ? '↑' : '↓'}` : undefined}
        />
        <Stat label="Stochastic (14,3,3)" value={i.stochastic ? `${fmt(i.stochastic.k, language, 0)} / ${fmt(i.stochastic.d, language, 0)}` : '—'} sub={i.stochastic?.signal} />
        <Stat label="ADX (14)" value={fmt(i.adx?.value, language)} sub={i.adx ? `${i.adx.trend === 'Strong' ? L('tren kuat', 'strong trend') : i.adx.trend === 'Weak' ? L('tren lemah', 'weak trend') : L('tanpa tren', 'no trend')} · +DI ${fmt(i.adx.plusDI, language, 0)} / −DI ${fmt(i.adx.minusDI, language, 0)}` : undefined} />
        <Stat label="Bollinger (20,2)" value={i.bollinger ? `%B ${fmt(i.bollinger.percentB, language, 0)}` : '—'} sub={i.bollinger ? `${rp(i.bollinger.lower, language)} – ${rp(i.bollinger.upper, language)} · ${L('lebar', 'width')} ${pct(i.bollinger.bandwidth, language, 1)}` : undefined} />
        <Stat label="ATR (14)" value={i.atr !== null ? rp(i.atr, language) : '—'} sub={i.atrPct !== null ? L(`${pct(i.atrPct, language, 1)} dari harga per hari`, `${pct(i.atrPct, language, 1)} of price per day`) : undefined} />
        <Stat label="VWAP 20 hari" value={i.vwap20 !== null ? rp(i.vwap20, language) : '—'} sub={vs(i.vwap20)} />
        <Stat
          tone={data.risk?.riskLevel === 'High' ? 'rose' : data.risk?.riskLevel === 'Low' ? 'emerald' : 'slate'}
          label={L('Volatilitas tahunan', 'Annual volatility')}
          value={data.risk ? pct(data.risk.volatility, language, 0) : '—'}
          sub={data.risk ? L(`max drawdown ${pct(data.risk.maxDrawdown, language, 0)} (1 thn)`, `max drawdown ${pct(data.risk.maxDrawdown, language, 0)} (1y)`) : undefined}
        />
      </div>

      <div className="mt-4 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <th className="py-2 px-3">{L('Rata-rata bergerak', 'Moving average')}</th>
              <th className="py-2 px-3 text-right">{L('Nilai', 'Value')}</th>
              <th className="py-2 px-3 text-right">{L('Posisi harga', 'Price position')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {([['EMA 20', i.ema20], ['SMA 20', i.sma20], ['EMA 50', i.ema50], ['SMA 50', i.sma50], ['SMA 200', i.sma200]] as Array<[string, number | null]>).map(([label, v]) => (
              <tr key={label}>
                <td className="py-2 px-3 font-bold text-white">{label}</td>
                <td className="py-2 px-3 text-right font-mono whitespace-nowrap">{v !== null ? rp(v, language) : '—'}</td>
                <td className={`py-2 px-3 text-right ${v === null ? '' : price >= v ? 'text-emerald-400' : 'text-rose-400'}`}>{v !== null ? vs(v) : L('data < periode', 'not enough data')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.signals.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{L('Sinyal penyusun skor teknikal', 'Signals behind the technical score')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.signals.map((s) => (
              <span key={s.indicator} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${s.signal === 'bull' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'}`} title={`${L('bobot', 'weight')} ${s.weight}`}>
                {s.signal === 'bull' ? '▲' : '▼'} {s.indicator}: {s.note}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
