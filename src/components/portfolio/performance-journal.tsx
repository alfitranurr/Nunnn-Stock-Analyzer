'use client';

import * as React from 'react';
import { CalendarRange, Info, NotebookPen, RotateCcw, Target } from 'lucide-react';
import { Card, CardTitle, Stat, formatMonth, pct, pick, rp2 as rp, sanitizeNumber, type Lang } from '@/components/shared/calc-ui';
import { AnimatedNumber } from '@/components/shared/motion';
import { formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import type { AppUser } from '@/lib/types';
import {
  DEFAULT_TARGET_RATES,
  buildJournal,
  currentMonthKey,
  loadJournal,
  resetJournal,
  saveRecord,
  snapshotRecord,
  type JournalSource,
  type JournalStatus,
  type MonthlyRecord,
} from '@/lib/portfolio-journal';

/**
 * Data jurnal + pencatatan otomatis nilai portofolio bulan berjalan.
 * Dipanggil dari halaman Portofolio (bukan hanya tab jurnal) agar nilai tetap tercatat
 * walau pengguna tidak membuka tab "Target & Performa".
 */
export function usePortfolioJournal({ user, isActive, value, ready }: { user: AppUser | null; isActive: boolean; value: number | null; ready: boolean }) {
  const [records, setRecords] = React.useState<MonthlyRecord[]>([]);
  const [source, setSource] = React.useState<JournalSource>('local');
  const [warning, setWarning] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const recordsRef = React.useRef<MonthlyRecord[]>([]);
  const lastSaved = React.useRef<{ month: string; value: number } | null>(null);

  React.useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadJournal(user).then((res) => {
      if (cancelled) return;
      setRecords(res.records);
      setSource(res.source);
      setWarning(res.warning);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Catat nilai bulan berjalan (ditunda 3 detik agar tidak menyimpan setiap kedipan harga).
  React.useEffect(() => {
    if (!user || !loaded || !ready || !isActive || value === null || !(value > 0)) return;
    const timer = window.setTimeout(() => {
      const month = currentMonthKey();
      const last = lastSaved.current;
      if (last && last.month === month && Math.abs(last.value - value) < 0.5) return;
      const record = snapshotRecord(recordsRef.current, month, value, new Date().toISOString());
      lastSaved.current = { month, value };
      setRecords((prev) => [...prev.filter((r) => r.month !== month), record].sort((a, b) => a.month.localeCompare(b.month)));
      saveRecord(user, source, record).catch((err: unknown) => setWarning(err instanceof Error ? err.message : String(err)));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [user, loaded, ready, isActive, value, source]);

  const reset = async () => {
    if (!user) return;
    await resetJournal(user, source);
    lastSaved.current = null;
    setRecords([]);
  };

  return { records, source, warning, loaded, reset };
}

export type PortfolioJournal = ReturnType<typeof usePortfolioJournal>;

const ratesKey = (userId: string) => `nunnn_stock_journal_rates_${userId}`;
const rulesKey = (userId: string) => `nunnn_stock_trading_rules_${userId}`;

function readRates(userId: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ratesKey(userId)) ?? 'null');
    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((n) => typeof n === 'number' && n > 0 && n <= 500)) return parsed;
  } catch {
    // pakai bawaan
  }
  return DEFAULT_TARGET_RATES;
}

/** Tab "Target & Performa": jurnal bulanan seperti spreadsheet compounding, dari data portofolio nyata. */
export function PerformanceJournal({
  language,
  user,
  journal,
  ready,
  hasPortfolio,
  onConfirmReset,
}: {
  language: Lang;
  user: AppUser;
  journal: PortfolioJournal;
  ready: boolean;
  hasPortfolio: boolean;
  onConfirmReset: () => void;
}) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [rates, setRates] = React.useState<number[]>(() => readRates(user.id));
  const [rateDraft, setRateDraft] = React.useState<string[]>(() => readRates(user.id).map((r) => String(r)));
  const [rules, setRules] = React.useState<string>(() => {
    try {
      return localStorage.getItem(rulesKey(user.id)) ?? '';
    } catch {
      return '';
    }
  });

  const month = currentMonthKey();
  const table = React.useMemo(() => buildJournal(journal.records, rates, month), [journal.records, rates, month]);

  const commitRate = (i: number) => {
    const v = parseFormattedNumber(rateDraft[i] ?? '');
    if (!(v > 0 && v <= 500)) {
      setRateDraft((d) => d.map((x, k) => (k === i ? String(rates[i]) : x)));
      return;
    }
    const next = rates.map((r, k) => (k === i ? Math.round(v * 100) / 100 : r));
    setRates(next);
    try {
      localStorage.setItem(ratesKey(user.id), JSON.stringify(next));
    } catch {
      // abaikan
    }
  };

  const statusText = (s: JournalStatus) =>
    s.kind === 'hit'
      ? { text: L(`Tembus ${formatNumberLocale(s.rate, language, 0)}%`, `Hit ${formatNumberLocale(s.rate, language, 0)}%`), cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
      : s.kind === 'below'
        ? { text: L('Untung, di bawah target', 'Profit, below target'), cls: 'bg-sky-500/10 text-sky-300 border-sky-500/25' }
        : s.kind === 'loss'
          ? { text: L('Rugi', 'Loss'), cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25' }
          : null;

  const signedRp = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${rp(Math.abs(v), language)}`;
  const signedPctTxt = (v: number) => `${v > 0 ? '+' : ''}${pct(v, language)}`;
  const tone = (v: number | null) => (v === null || v === 0 ? 'text-slate-300' : v > 0 ? 'text-emerald-400' : 'text-rose-400');
  const currentRow = table.rows.find((r) => r.isCurrent) ?? null;

  /**
   * Sisa ke target: kenaikan (%) yang masih dibutuhkan total akhir agar mencapai jalur target terdekat
   * yang belum tercapai = (nilai target ÷ total akhir − 1) × 100. null bila bulan itu belum ada data.
   */
  const remainingTo = (end: number | null, targets: number[]) => {
    if (end === null || !(end > 0)) return null;
    const next = targets
      .map((tv, k) => ({ tv, rate: rates[k] }))
      .sort((a, b) => a.tv - b.tv)
      .find((t) => end < t.tv);
    if (!next) return { done: true as const };
    return { done: false as const, rate: next.rate, pct: (next.tv / end - 1) * 100, short: next.tv - end };
  };
  const currentRemaining = currentRow ? remainingTo(currentRow.record?.endValue ?? null, currentRow.targets) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle
          icon={<CalendarRange className="h-5 w-5 text-emerald-400" />}
          title={L('Target & Performa Bulanan', 'Monthly Target & Performance')}
          subtitle={L(
            'Dicatat otomatis dari nilai portofolio (nilai pasar saham + kas RDN) setiap kali halaman ini terbuka dan semua harga termuat. Modal awal bulan = total akhir bulan sebelumnya.',
            'Recorded automatically from your portfolio value (stocks at market + RDN cash) whenever this page is open and all prices are loaded. A month starts at the previous month’s ending value.'
          )}
          right={
            <div className="self-start flex flex-col items-start sm:items-end gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Target className="h-3 w-3" /> {L('Target per bulan', 'Monthly targets')}
              </span>
              <div className="flex gap-1.5">
                {rates.map((_, i) => (
                  <label key={i} className="flex items-center gap-0.5 px-2 py-1 rounded-lg border border-white/10 bg-input-bg">
                    <input
                      inputMode="decimal"
                      value={rateDraft[i] ?? ''}
                      onChange={(e) => setRateDraft((d) => d.map((x, k) => (k === i ? sanitizeNumber(e.target.value) : x)))}
                      onBlur={() => commitRate(i)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      aria-label={L(`Target ${i + 1} (% per bulan)`, `Target ${i + 1} (% per month)`)}
                      className="w-9 bg-transparent text-right text-xs font-bold text-white outline-none"
                    />
                    <span className="text-[11px] text-slate-500">%</span>
                  </label>
                ))}
              </div>
            </div>
          }
        />

        {journal.warning && (
          <p className="mb-3 text-[11px] text-amber-300">
            {/portfolio_monthly/.test(journal.warning) || /relation|does not exist|schema cache/i.test(journal.warning)
              ? L('Tabel jurnal belum ada di database. Jalankan migrasi supabase/migrations/20261011000012_portfolio_monthly.sql di Supabase SQL Editor; sementara jurnal disimpan di browser ini.', 'The journal table does not exist yet. Run supabase/migrations/20261011000012_portfolio_monthly.sql in the Supabase SQL Editor; meanwhile the journal is stored in this browser.')
              : L(`Gagal menyimpan ke cloud: ${journal.warning}`, `Cloud save failed: ${journal.warning}`)}
          </p>
        )}

        {table.rows.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-white/10 space-y-1">
            <p className="text-sm font-bold text-white">{L('Jurnal belum dimulai', 'Journal not started yet')}</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {!hasPortfolio
                ? L('Tambahkan saham atau isi kas RDN di tab Kepemilikan; jurnal mulai dicatat otomatis setelah itu.', 'Add stocks or set your RDN cash in the Holdings tab; the journal starts recording automatically after that.')
                : !ready
                  ? L('Menunggu harga semua saham termuat untuk mencatat nilai awal…', 'Waiting for all stock prices to load to record the starting value…')
                  : L('Mencatat nilai awal…', 'Recording the starting value…')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                label={L('Nilai awal jurnal', 'Journal starting value')}
                value={rp(table.startValue, language)}
                valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
                sub={
                  table.startMonth
                    ? L(
                        `nilai pasar saat mulai dicatat (${formatMonth(`${table.startMonth}-01`, language, true)}), bukan harga beli`,
                        `market value when tracking began (${formatMonth(`${table.startMonth}-01`, language, true)}), not purchase cost`
                      )
                    : undefined
                }
              />
              <Stat
                tone="emerald"
                label={L('Nilai sekarang', 'Current value')}
                value={table.currentValue !== null ? <AnimatedNumber value={table.currentValue} format={(v) => rp(v, language)} /> : '—'}
                valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
                sub={ready ? L('live dari portofolio', 'live from portfolio') : L('menunggu harga…', 'waiting for prices…')}
              />
              <Stat
                tone={table.cumulativePct === null ? 'slate' : table.cumulativePct >= 0 ? 'emerald' : 'rose'}
                label={L('Return kumulatif', 'Cumulative return')}
                value={<span className={tone(table.cumulativePct)}>{table.cumulativePct !== null ? signedPctTxt(table.cumulativePct) : '—'}</span>}
                sub={L(`untung ${signedRp(table.totalGain)}`, `profit ${signedRp(table.totalGain)}`)}
              />
              <Stat
                tone={currentRow?.returnPct == null ? 'slate' : currentRow.returnPct >= 0 ? 'emerald' : 'rose'}
                label={L('Bulan ini', 'This month')}
                value={<span className={tone(currentRow?.returnPct ?? null)}>{currentRow?.returnPct != null ? signedPctTxt(currentRow.returnPct) : '—'}</span>}
                sub={
                  currentRemaining && !currentRemaining.done
                    ? L(
                        `butuh +${pct(currentRemaining.pct, language)} lagi ke target ${formatNumberLocale(currentRemaining.rate, language, 0)}%`,
                        `needs +${pct(currentRemaining.pct, language)} more to the ${formatNumberLocale(currentRemaining.rate, language, 0)}% target`
                      )
                    : currentRemaining?.done
                      ? L('semua target bulan ini tercapai', 'all targets reached this month')
                      : currentRow
                        ? L(`target ${formatNumberLocale(rates[0], language, 0)}%: ${rp(currentRow.targets[0], language)}`, `${formatNumberLocale(rates[0], language, 0)}% target: ${rp(currentRow.targets[0], language)}`)
                        : undefined
                }
              />
            </div>

            <p className="lg:hidden mt-4 text-[11px] font-semibold text-slate-500">{L('Geser tabel ke kanan untuk melihat untung, kumulatif, sisa ke target, dan target →', 'Swipe the table right to see profit, cumulative, distance to target and targets →')}</p>
            <div className="mt-2 lg:mt-5 overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1230px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                    <th className="py-2.5 px-3 sticky left-0 z-10 bg-card-bg">{L('Bulan', 'Month')}</th>
                    <th className="py-2.5 px-3 text-right" title={L('Nilai pasar portofolio di awal bulan (= total akhir bulan sebelumnya), bukan harga beli', 'Portfolio market value at the start of the month (= previous month end), not purchase cost')}>{L('Modal awal', 'Start')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Total akhir', 'End value')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Untung', 'Profit')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Untung %', 'Profit %')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Kumulatif', 'Cumulative')}</th>
                    <th
                      className="py-2.5 px-3 text-right text-amber-300/90"
                      title={L('Kenaikan yang masih dibutuhkan total akhir untuk mencapai target terdekat yang belum tercapai', 'Increase the end value still needs to reach the nearest unmet target')}
                    >
                      {L('Sisa ke target', 'To next target')}
                    </th>
                    {rates.map((r) => (
                      <th key={r} className="py-2.5 px-3 text-right text-amber-300/90">{L(`Target ${formatNumberLocale(r, language, 0)}%`, `Target ${formatNumberLocale(r, language, 0)}%`)}</th>
                    ))}
                    <th className="py-2.5 px-3">{L('Status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {table.rows.map((row) => {
                    const st = statusText(row.status);
                    const end = row.record?.endValue ?? null;
                    const remaining = remainingTo(end, row.targets);
                    return (
                      <tr key={row.month} className={row.isCurrent ? 'bg-emerald-500/[0.06]' : row.isFuture ? 'opacity-70' : ''}>
                        <td className={`py-2.5 px-3 font-bold text-white whitespace-nowrap sticky left-0 z-10 ${row.isCurrent ? 'bg-[#16211d]' : 'bg-card-bg'}`}>
                          {formatMonth(`${row.month}-01`, language, true)}
                          {row.isCurrent && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-black">LIVE</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">{row.record ? rp(row.record.startValue, language) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">{end !== null ? rp(end, language) : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-mono whitespace-nowrap ${tone(row.gain)}`}>{row.gain !== null ? signedRp(row.gain) : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-mono ${tone(row.returnPct)}`}>{row.returnPct !== null ? signedPctTxt(row.returnPct) : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-mono ${tone(row.cumulativePct)}`}>{row.cumulativePct !== null ? signedPctTxt(row.cumulativePct) : '—'}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {remaining === null ? (
                            <span className="text-slate-600">—</span>
                          ) : remaining.done ? (
                            <span className="font-bold text-emerald-400">{L('✓ Semua tercapai', '✓ All reached')}</span>
                          ) : (
                            <>
                              <span className="block font-mono font-bold text-amber-300">+{pct(remaining.pct, language)}</span>
                              <span className="block text-[11px] text-slate-500">
                                {L(
                                  `${row.isCurrent ? 'ke' : 'kurang ke'} ${formatNumberLocale(remaining.rate, language, 0)}% · ${rp(remaining.short, language)}`,
                                  `${row.isCurrent ? 'to' : 'short of'} ${formatNumberLocale(remaining.rate, language, 0)}% · ${rp(remaining.short, language)}`
                                )}
                              </span>
                            </>
                          )}
                        </td>
                        {row.targets.map((tv, k) => (
                          <td
                            key={k}
                            className={`py-2.5 px-3 text-right font-mono whitespace-nowrap ${end !== null && end >= tv ? 'text-emerald-300 bg-emerald-500/[0.07]' : 'text-slate-400'}`}
                            title={end !== null ? (end >= tv ? L('Total akhir di atas jalur target ini', 'End value is above this target path') : L(`Kurang ${rp(tv - end, language)}`, `Short by ${rp(tv - end, language)}`)) : undefined}
                          >
                            {rp(tv, language)}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {st ? <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${st.cls}`}>{st.text}</span> : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/15 text-xs font-bold">
                    <td className="py-3 px-3 text-white sticky left-0 z-10 bg-card-bg">{L('Total', 'Total')}</td>
                    <td className="py-3 px-3 text-right font-mono">{rp(table.startValue, language)}</td>
                    <td className="py-3 px-3 text-right font-mono text-white">{table.currentValue !== null ? rp(table.currentValue, language) : '—'}</td>
                    <td className={`py-3 px-3 text-right font-mono ${tone(table.totalGain)}`}>{signedRp(table.totalGain)}</td>
                    <td className="py-3 px-3" />
                    <td className={`py-3 px-3 text-right font-mono ${tone(table.cumulativePct)}`}>{table.cumulativePct !== null ? signedPctTxt(table.cumulativePct) : '—'}</td>
                    <td className="py-3 px-3" />
                    {rates.map((r, k) => (
                      <td key={r} className="py-3 px-3 text-right font-mono text-amber-300 whitespace-nowrap">{rp(table.rows[table.rows.length - 1]?.targets[k] ?? 0, language)}</td>
                    ))}
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-400" /> {L('Cara membaca tabel', 'How to read the table')}
                </h3>
                <button
                  type="button"
                  onClick={onConfirmReset}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] hover:bg-rose-500/10 text-[11px] font-bold text-rose-300 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> {L('Mulai ulang jurnal', 'Restart journal')}
                </button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  { term: L('Untung', 'Profit'), def: L('Total akhir − modal awal', 'End value − start value') },
                  { term: L('Untung %', 'Profit %'), def: L('Untung ÷ modal awal', 'Profit ÷ start value') },
                  { term: L('Kumulatif', 'Cumulative'), def: L('Untung % tiap bulan dikalikan berantai', 'Monthly profit % compounded') },
                  { term: L('Sisa ke target', 'To next target'), def: L('Kenaikan yang masih dibutuhkan: target terdekat ÷ total akhir − 1, beserta kekurangannya dalam Rp', 'Increase still needed: nearest target ÷ end value − 1, with the shortfall in Rp') },
                  { term: L('Jalur target', 'Target path'), def: L('Target bulan lalu × (1 + target %), mulai dari nilai awal jurnal', 'Last month’s target × (1 + target %), starting from the journal starting value') },
                  { term: L('Sel hijau', 'Green cell'), def: L('Total akhir sudah melewati jalur target itu', 'End value has passed that target path') },
                ].map((d) => (
                  <div key={d.term} className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <dt className="text-[11px] font-black uppercase tracking-wider text-slate-300">{d.term}</dt>
                    <dd className="text-[11px] text-slate-400 leading-snug mt-0.5">{d.def}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 space-y-1 text-[11px] text-slate-500 leading-snug">
                <li className="flex gap-1.5"><span className="text-amber-400">•</span>{L('Top-up atau tarik dana ikut terhitung sebagai naik/turunnya nilai.', 'Deposits or withdrawals count as changes in value.')}</li>
                <li className="flex gap-1.5"><span className="text-amber-400">•</span>{L('Bulan berjalan memakai harga terakhir (bisa tertunda) dan belum dipotong fee jual & pajak.', 'The current month uses the latest (possibly delayed) prices, before sell fees & tax.')}</li>
              </ul>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardTitle
          icon={<NotebookPen className="h-5 w-5 text-amber-400" />}
          title={L('Aturan trading pribadi', 'Personal trading rules')}
          subtitle={L('Catatan untuk diri sendiri, tersimpan di browser ini.', 'Notes to yourself, saved in this browser.')}
        />
        <textarea
          value={rules}
          onChange={(e) => {
            setRules(e.target.value);
            try {
              localStorage.setItem(rulesKey(user.id), e.target.value);
            } catch {
              // abaikan
            }
          }}
          rows={5}
          maxLength={2000}
          placeholder={L(
            '1. Kalau belum dapat barang, jangan dipaksakan\n2. Kurangi greedy\n3. Target harian tercapai → stop\n4. Jangan salahkan orang lain atas keputusan sendiri\n5. DYOR',
            '1. If you miss an entry, don’t force it\n2. Less greed\n3. Daily target reached → stop\n4. Own your decisions\n5. DYOR'
          )}
          className="w-full px-3.5 py-3 rounded-2xl border border-white/10 bg-input-bg text-sm text-slate-200 leading-relaxed outline-none focus:border-emerald-500/40 resize-y"
        />
      </Card>
    </div>
  );
}
