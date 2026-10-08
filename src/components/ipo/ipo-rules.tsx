'use client';

import * as React from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { ADJUSTMENT_THRESHOLDS, GOLONGAN_RULES, type Golongan } from '@/lib/e-ipo';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';
import { Card, pick, type Lang } from '@/components/shared/calc-ui';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Ringkasan aturan penjatahan terpusat SEOJK 25/SEOJK.04/2025 (bisa dibuka-tutup). */
export function IpoRules({ language, activeGolongan }: { language: Lang; activeGolongan: Golongan | null }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [open, setOpen] = React.useState(false);
  const pctTxt = (n: number) => `${formatNumberLocale(n, language, n % 1 === 0 ? 0 : 1)}%`;

  return (
    <Card className="p-0 sm:p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-white/[0.02] cursor-pointer"
      >
        <span className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><BookOpen className="h-4 w-4" /></span>
          <span>
            <span className="block text-sm font-black text-white">{L('Aturan penjatahan E-IPO (SEOJK 25/2025)', 'E-IPO allocation rules (SEOJK 25/2025)')}</span>
            <span className="block text-[11px] text-slate-400">
              {L('Berlaku sejak 17 Nov 2025, menggantikan SEOJK 15/2020.', 'In force since 17 Nov 2025, replacing SEOJK 15/2020.')}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-5 text-xs text-slate-300 border-t border-white/10 pt-4">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2 px-2">{L('Golongan', 'Class')}</th>
                  <th className="py-2 px-2">{L('Nilai penawaran', 'Offering value')}</th>
                  <th className="py-2 px-2">{L('Alokasi minimal terpusat', 'Minimum pooling')}</th>
                  {ADJUSTMENT_THRESHOLDS.map((t, i) => (
                    <th key={t} className="py-2 px-2 text-right">
                      {L('Penyesuaian', 'Adj.')} {ROMAN[i]}
                      <span className="block normal-case font-semibold text-slate-500">
                        {i < 2 ? `${formatNumberLocale(t, language, t % 1 ? 1 : 0)}× – <${ADJUSTMENT_THRESHOLDS[i + 1]}×` : `≥ ${t}×`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {GOLONGAN_RULES.map((r, i) => {
                  const prevMax = i > 0 ? GOLONGAN_RULES[i - 1].maxOfferingRp : 0;
                  const active = r.golongan === activeGolongan;
                  return (
                    <tr key={r.golongan} className={active ? 'bg-emerald-500/10' : ''}>
                      <td className={`py-2 px-2 font-black ${active ? 'text-emerald-400' : 'text-white'}`}>{ROMAN[i]}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {Number.isFinite(r.maxOfferingRp)
                          ? `${prevMax > 0 ? `> ${formatIDRCompact(prevMax, language)} – ` : ''}≤ ${formatIDRCompact(r.maxOfferingRp, language)}`
                          : `> ${formatIDRCompact(prevMax, language)}`}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">≥ {pctTxt(r.minPct)} {L('atau', 'or')} {formatIDRCompact(r.minRp, language)}</td>
                      {r.adjustedPct.map((p) => <td key={p} className="py-2 px-2 text-right font-bold">≥ {pctTxt(p)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 list-disc pl-4 leading-relaxed text-slate-400">
            <li>{L('Alokasi minimal = yang lebih tinggi antara persentase dan nilai rupiah. Golongan I dengan nilai penawaran ≤ Rp10 miliar: seluruh saham masuk penjatahan terpusat.', 'Minimum allocation = the higher of the percentage and the rupiah value. Class I offerings ≤ Rp10 billion: all shares go to pooling.')}</li>
            <li>{L('Penyesuaian dipicu oleh tingkat pesanan penjatahan terpusat dibanding alokasi minimal awal (bukan oversubscribe IPO keseluruhan). Saham tambahan diambil dari porsi penjatahan pasti.', 'Adjustments are triggered by pooling demand versus the initial minimum allocation (not the overall IPO oversubscription). Extra shares come from the fixed-allotment portion.')}</li>
            <li>{L('Porsi terpusat dibagi ritel : selain ritel = 1 : 1. Pemesan ritel = total pesanan ≤ Rp100 juta.', 'Pooling is split retail : non-retail = 1 : 1. Retail = total order ≤ Rp100 million.')}</li>
            <li>{L('Total pesanan satu pemodal maksimal 10% dari nilai penawaran; pesanan di atas batas dikembalikan untuk disesuaikan.', 'A single investor’s total order is capped at 10% of the offering value; orders above it are returned for adjustment.')}</li>
          </ul>

          <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-2">{L('Urutan penjatahan di tiap porsi', 'Allocation order within each portion')}</p>
            <ol className="space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>{L('Setiap pemodal dijatah dulu maksimal 10 lot (atau sesuai pesanan bila kurang dari 10 lot).', 'Each investor first receives up to 10 lots (or their order if smaller).')}</li>
              <li>{L('Bila lot tersedia lebih sedikit dari jumlah pemodal: 1 lot per pemodal sesuai urutan waktu pesan. Contoh SEOJK: 100.000 lot untuk 125.000 pemodal → 100.000 pemesan pertama mendapat 1 lot, sisanya tidak dapat.', 'If lots are fewer than investors: 1 lot each by order time. SEOJK example: 100,000 lots for 125,000 investors → the first 100,000 get 1 lot, the rest get none.')}</li>
              <li>{L('Sisa lot dibagi proporsional terhadap sisa pesanan yang belum terpenuhi, dibulatkan ke bawah.', 'Remaining lots are split pro rata to unfilled orders, rounded down.')}</li>
              <li>{L('Sisa pembulatan dibagikan 1 lot per pemodal sesuai urutan waktu pesan.', 'Rounding leftovers go 1 lot each by order time.')}</li>
            </ol>
          </div>
          <p className="text-[10px] text-slate-500">
            {L('Sumber: SEOJK 25/SEOJK.04/2025 romawi IV, VI, VII, VIII. Selalu cek prospektus & pengumuman penjatahan resmi di e-ipo.co.id.', 'Source: SEOJK 25/SEOJK.04/2025 sections IV, VI, VII, VIII. Always check the prospectus & official allotment announcement on e-ipo.co.id.')}
          </p>
        </div>
      )}
    </Card>
  );
}
