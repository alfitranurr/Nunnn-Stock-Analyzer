'use client';

import * as React from 'react';
import { Layers } from 'lucide-react';
import { Badge, Card, CardTitle, Segmented, pct, pick, rp, type Lang } from '@/components/shared/calc-ui';
import { getIdxTickSize } from '@/lib/calculator';
import type { LevelKey, PivotLevel, PivotMethod } from '@/lib/indicators';
import type { TechnicalResponse } from '@/app/api/analysis/technical/route';

interface LevelMeta {
  name: { id: string; en: string };
  hint: { id: string; en: string };
  tone: 'res' | 'pivot' | 'sup';
  strength: 1 | 2 | 3 | 4;
}

const META: Record<LevelKey, LevelMeta> = {
  R4: { name: { id: 'Resistance ekstrem', en: 'Extreme resistance' }, hint: { id: 'Target lanjutan bila breakout kuat; jarang tersentuh', en: 'Extended target on a strong breakout; rarely reached' }, tone: 'res', strength: 4 },
  R3: { name: { id: 'Resistance kuat', en: 'Strong resistance' }, hint: { id: 'Zona ambil untung agresif', en: 'Aggressive profit-taking zone' }, tone: 'res', strength: 3 },
  R2: { name: { id: 'Resistance menengah', en: 'Mid resistance' }, hint: { id: 'Hambatan kedua; uji kekuatan tren naik', en: 'Second hurdle; tests the uptrend' }, tone: 'res', strength: 2 },
  R1: { name: { id: 'Resistance terdekat', en: 'Nearest resistance' }, hint: { id: 'Hambatan pertama di atas harga', en: 'First hurdle above price' }, tone: 'res', strength: 1 },
  PP: { name: { id: 'Pivot (titik keseimbangan)', en: 'Pivot (balance point)' }, hint: { id: 'Di atas pivot = bias naik, di bawah = bias turun', en: 'Above = bullish bias, below = bearish bias' }, tone: 'pivot', strength: 1 },
  S1: { name: { id: 'Support terdekat', en: 'Nearest support' }, hint: { id: 'Pijakan pertama di bawah harga', en: 'First floor below price' }, tone: 'sup', strength: 1 },
  S2: { name: { id: 'Support menengah', en: 'Mid support' }, hint: { id: 'Area pantul kedua', en: 'Second bounce area' }, tone: 'sup', strength: 2 },
  S3: { name: { id: 'Support kuat', en: 'Strong support' }, hint: { id: 'Area beli agresif / batas cut loss umum', en: 'Aggressive buy area / common stop level' }, tone: 'sup', strength: 3 },
  S4: { name: { id: 'Support ekstrem', en: 'Extreme support' }, hint: { id: 'Kondisi panik/jual besar; jarang tersentuh', en: 'Panic-selling level; rarely reached' }, tone: 'sup', strength: 4 },
};

const METHOD_NOTE: Record<PivotMethod, { id: string; en: string }> = {
  classic: { id: 'Klasik: PP=(H+L+C)/3, R1=2PP−L, R2=PP+(H−L), R3=H+2(PP−L), R4=R3+(H−L), simetris untuk S.', en: 'Classic: PP=(H+L+C)/3, R1=2PP−L, R2=PP+(H−L), R3=H+2(PP−L), R4=R3+(H−L), mirrored for S.' },
  fibonacci: { id: 'Fibonacci: PP ± 0,382 / 0,618 / 1,000 / 1,618 × rentang (H−L).', en: 'Fibonacci: PP ± 0.382 / 0.618 / 1.000 / 1.618 × range (H−L).' },
  camarilla: { id: 'Camarilla: penutupan ± rentang × 1,1 ÷ 12 / 6 / 4 / 2; cocok untuk trading harian (titik lebih rapat).', en: 'Camarilla: close ± range × 1.1 ÷ 12 / 6 / 4 / 2; suited to intraday trading (tighter levels).' },
};

interface SrLevelsProps {
  language: Lang;
  data: TechnicalResponse;
}

/** 9 titik support & resistance berlabel, dengan posisi harga sekarang dan konfluensi indikator. */
export function SrLevels({ language, data }: SrLevelsProps) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [method, setMethod] = React.useState<PivotMethod>('classic');
  if (!data.pivots) return null;

  const price = data.quote.price;
  const levels: PivotLevel[] = data.pivots[method];
  const ind = data.indicators;
  const refs: Array<{ label: string; value: number | null }> = [
    { label: 'SMA20', value: ind.sma20 },
    { label: 'SMA50', value: ind.sma50 },
    { label: 'SMA200', value: ind.sma200 },
    { label: 'EMA20', value: ind.ema20 },
    { label: 'VWAP20', value: ind.vwap20 },
    { label: L('BB atas', 'BB upper'), value: ind.bollinger?.upper ?? null },
    { label: L('BB bawah', 'BB lower'), value: ind.bollinger?.lower ?? null },
    { label: L('Tertinggi 52 mgg', '52w high'), value: data.quote.yearHigh },
    { label: L('Terendah 52 mgg', '52w low'), value: data.quote.yearLow },
  ];
  // Konfluensi: indikator lain berada dalam 1% atau 2 fraksi dari titik.
  const confluence = (level: number) =>
    refs.filter((r) => r.value !== null && Math.abs((r.value as number) - level) <= Math.max(level * 0.01, getIdxTickSize(level) * 2)).map((r) => r.label);

  const nearestAbove = [...levels].filter((l) => l.price > price).sort((a, b) => a.price - b.price)[0] ?? null;
  const nearestBelow = [...levels].filter((l) => l.price < price).sort((a, b) => b.price - a.price)[0] ?? null;
  const pp = levels.find((l) => l.key === 'PP')!;
  // Rentang sesi yang sempit (sedikit fraksi) membuat beberapa titik jatuh di harga yang sama setelah dibulatkan.
  const sameAs = new Map<LevelKey, LevelKey>();
  levels.forEach((l, j) => {
    if (j > 0 && l.price === levels[j - 1].price) sameAs.set(l.key, sameAs.get(levels[j - 1].key) ?? levels[j - 1].key);
  });
  const rangeTicks = Math.round((data.pivots.basis.high - data.pivots.basis.low) / getIdxTickSize(data.pivots.basis.close));

  // Baris "harga sekarang" disisipkan di posisinya.
  const rows: Array<{ kind: 'level'; level: PivotLevel } | { kind: 'price' }> = [];
  let placed = false;
  for (const level of levels) {
    if (!placed && price >= level.price) {
      rows.push({ kind: 'price' });
      placed = true;
    }
    rows.push({ kind: 'level', level });
  }
  if (!placed) rows.push({ kind: 'price' });

  const basisDate = new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${data.pivots.basis.date}T00:00:00Z`));

  return (
    <Card>
      <CardTitle
        icon={<Layers className="h-5 w-5 text-emerald-400" />}
        title={L('Support & Resistance (9 titik)', 'Support & Resistance (9 levels)')}
        subtitle={L(
          `Dihitung dari sesi ${basisDate} yang sudah selesai (H ${rp(data.pivots.basis.high, language)} · L ${rp(data.pivots.basis.low, language)} · C ${rp(data.pivots.basis.close, language)}), dibulatkan ke fraksi BEI.`,
          `Computed from the completed ${basisDate} session (H ${rp(data.pivots.basis.high, language)} · L ${rp(data.pivots.basis.low, language)} · C ${rp(data.pivots.basis.close, language)}), rounded to IDX ticks.`
        )}
        right={
          <Segmented
            ariaLabel={L('Metode', 'Method')}
            value={method}
            onChange={setMethod}
            className="self-start sm:w-80"
            options={[
              { value: 'classic', label: L('Klasik', 'Classic') },
              { value: 'fibonacci', label: 'Fibonacci' },
              { value: 'camarilla', label: 'Camarilla' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
        <div className="p-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.05]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">{L('Resistance terdekat', 'Nearest resistance')}</span>
          <div className="text-base font-black text-white tabular-nums mt-0.5">{nearestAbove ? `${nearestAbove.key} · ${rp(nearestAbove.price, language)}` : L('Di atas R4', 'Above R4')}</div>
          {nearestAbove && <span className="text-[11px] text-rose-300">+{pct(((nearestAbove.price - price) / price) * 100, language)}</span>}
        </div>
        <div className="p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{L('Posisi harga', 'Price position')}</span>
          <div className="text-base font-black text-white tabular-nums mt-0.5">{rp(price, language)}</div>
          <span className={`text-[11px] ${price > pp.price ? 'text-emerald-400' : price < pp.price ? 'text-rose-400' : 'text-slate-300'}`}>
            {price > pp.price
              ? L('Di atas pivot → bias naik', 'Above pivot → bullish bias')
              : price < pp.price
                ? L('Di bawah pivot → bias turun', 'Below pivot → bearish bias')
                : L('Tepat di pivot → arah belum jelas', 'Right at the pivot → no clear bias')}
          </span>
        </div>
        <div className="p-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{L('Support terdekat', 'Nearest support')}</span>
          <div className="text-base font-black text-white tabular-nums mt-0.5">{nearestBelow ? `${nearestBelow.key} · ${rp(nearestBelow.price, language)}` : L('Di bawah S4', 'Below S4')}</div>
          {nearestBelow && <span className="text-[11px] text-emerald-300">{pct(((nearestBelow.price - price) / price) * 100, language)}</span>}
        </div>
      </div>

      <ol className="space-y-1.5" aria-label={L('Daftar 9 titik support dan resistance', 'List of 9 support and resistance levels')}>
        {rows.map((row, i) => {
          if (row.kind === 'price') {
            return (
              <li key="price" className="flex items-center gap-2 py-1" aria-label={L(`Harga sekarang ${rp(price, language)}`, `Current price ${rp(price, language)}`)}>
                <span className="h-px flex-1 bg-amber-400/60" />
                <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black tabular-nums">▶ {L('Harga sekarang', 'Current price')} {rp(price, language)}</span>
                <span className="h-px flex-1 bg-amber-400/60" />
              </li>
            );
          }
          const { level } = row;
          const meta = META[level.key];
          const dist = ((level.price - price) / price) * 100;
          const conf = confluence(level.price);
          const isNearest = level === nearestAbove || level === nearestBelow;
          const dup = sameAs.get(level.key);
          const toneCls = meta.tone === 'res'
            ? 'border-rose-500/20 bg-rose-500/[0.04]'
            : meta.tone === 'sup'
              ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
              : 'border-sky-500/30 bg-sky-500/[0.06]';
          const keyCls = meta.tone === 'res' ? 'bg-rose-500/15 text-rose-300' : meta.tone === 'sup' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300';
          return (
            <li key={`${level.key}-${i}`} className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3rem_minmax(0,1fr)_7rem_5rem] items-center gap-3 px-3 py-2.5 rounded-2xl border ${toneCls} ${isNearest ? 'ring-1 ring-amber-400/50' : ''} ${dup ? 'opacity-55' : ''}`}>
              <span className={`text-center text-xs font-black rounded-lg py-1 ${keyCls}`}>{level.key}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{L(meta.name.id, meta.name.en)}</span>
                  <span className="text-[10px] text-slate-500" aria-hidden>{'●'.repeat(meta.strength)}</span>
                  {isNearest && <Badge tone="amber">{L('terdekat', 'nearest')}</Badge>}
                  {dup && <Badge>{L(`sama dengan ${dup}`, `same as ${dup}`)}</Badge>}
                  {conf.map((c) => <Badge key={c} tone="sky">≈ {c}</Badge>)}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">{L(meta.hint.id, meta.hint.en)}</span>
              </span>
              <span className="text-right font-mono font-black text-white text-sm tabular-nums">{rp(level.price, language)}</span>
              <span className={`hidden sm:block text-right text-[11px] font-bold tabular-nums ${dist > 0 ? 'text-rose-300' : dist < 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                {dist > 0 ? '+' : ''}{pct(dist, language)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
        {L(METHOD_NOTE[method].id, METHOD_NOTE[method].en)}{' '}
        {sameAs.size > 0 &&
          L(
            `Rentang sesi acuan hanya ${rangeTicks} fraksi, jadi sebagian titik berimpit setelah dibulatkan; pakai metode Klasik/Fibonacci untuk jarak yang lebih lebar. `,
            `The basis session spanned only ${rangeTicks} ticks, so some levels coincide after rounding; use Classic/Fibonacci for wider spacing. `
          )}
        {L(
          'Titik dengan label "≈" berdekatan (≤1%) dengan indikator lain sehingga cenderung lebih kuat. Pivot adalah acuan statistik, bukan jaminan harga berbalik.',
          'Levels tagged "≈" sit within 1% of another indicator and tend to be stronger. Pivots are statistical references, not guaranteed turning points.'
        )}
      </p>
    </Card>
  );
}
