/**
 * Dividen saham BEI: analisis riwayat pembagian dan simulasi passive income.
 * Semua fungsi di sini murni (tanpa I/O) sehingga mudah diuji.
 *
 * Konvensi tanggal (format ISO "YYYY-MM-DD", tanpa jam):
 * - exDate  : tanggal ex dividen (dari sumber data, mis. Yahoo Finance).
 * - cumDate : hari bursa terakhir untuk membeli agar berhak dividen = 1 hari bursa sebelum ex-date
 *             (settlement T+2). Hari libur bursa tidak diketahui, jadi hanya akhir pekan yang dilewati.
 * - payDate : PERKIRAAN tanggal dana masuk RDN. Data BEI 2022–2024: 9–24 hari setelah ex-date.
 */

import { getIdxTickSize, roundDownToIdxTick, roundToNearestIdxTick } from '@/lib/calculator';

export interface DividendEvent {
  exDate: string;
  /** Dividen kotor per lembar (Rp), sudah disesuaikan stock split. */
  amount: number;
}

export interface DividendEventDetail extends DividendEvent {
  cumDate: string;
  payDate: string;
  dividendYear: number;
  /** Ex-date masih di masa depan (sudah dijadwalkan menurut sumber data). */
  upcoming: boolean;
}

export interface AnnualDividend {
  year: number;
  dps: number;
  payments: number;
  /** Rata-rata harga penutupan bulanan tahun itu (null bila tidak ada data harga). */
  avgPrice: number | null;
  /** Yield historis = DPS tahun itu / rata-rata harga tahun itu. */
  yieldPct: number | null;
  /** Tahun berjalan yang belum selesai. */
  partial: boolean;
}

export interface ProjectedPayment {
  exDate: string;
  cumDate: string;
  payDate: string;
  /** Dividen per lembar: nominal resmi bila `confirmed`, selain itu nominal siklus acuan (akan diskalakan). */
  amount: number;
  /** true = sudah dijadwalkan sumber data; false = perkiraan dari pola 12 bulan terakhir. */
  confirmed: boolean;
}

export interface DividendProfile {
  /** Urut terbaru → terlama. */
  events: DividendEventDetail[];
  /** Urut tahun naik, termasuk tahun tanpa dividen di antaranya. */
  annual: AnnualDividend[];
  ttmDps: number;
  ttmPayments: number;
  lastFullYear: number | null;
  lastFullYearDps: number;
  /** Rata-rata 3 tahun penuh terakhir (null bila riwayat belum 3 tahun). */
  avg3yDps: number | null;
  /** Tahun penuh berturut-turut membagikan dividen, dihitung mundur dari tahun penuh terakhir. */
  consecutiveYears: number;
  /** Pertumbuhan DPS tahunan majemuk (CAGR). */
  growth: { years: number; cagrPct: number } | null;
  /** Berapa kali DPS turun dibanding tahun sebelumnya dalam 5 tahun penuh terakhir. */
  declinesLast5: number;
  /** Total DPS siklus acuan yang dipakai untuk memproyeksikan jadwal. */
  baseCycleDps: number;
  /** Jadwal 12 bulan ke depan. */
  projected: ProjectedPayment[];
  lastExDate: string | null;
}

export type DpsBasis = 'ttm' | 'last-year' | 'avg-3y' | 'manual';

export type TaxPresetId = 'final10' | 'reinvest' | 'foreign' | 'custom';

/**
 * Pajak dividen saham emiten dalam negeri (UU 7/2021 HPP jo. UU Cipta Kerja, PMK 18/2021):
 * - WP orang pribadi dalam negeri: dikecualikan dari pajak bila diinvestasikan di Indonesia
 *   minimal 3 tahun pajak; bila tidak, PPh final 10% (disetor sendiri).
 * - WP luar negeri: PPh 26 sebesar 20%, atau tarif tax treaty (P3B) yang lebih rendah.
 */
export const TAX_PRESET_RATES: Record<Exclude<TaxPresetId, 'custom'>, number> = {
  final10: 10,
  reinvest: 0,
  foreign: 20,
};

export const DEFAULT_BUY_FEE_PCT = 0.15;
export const DEFAULT_SELL_FEE_PCT = 0.25;
export const PAYMENT_LAG_DAYS = 18;

// ─── Tanggal ───
const DAY_MS = 86_400_000;
const parseIso = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isWeekend = (ms: number) => {
  const d = new Date(ms).getUTCDay();
  return d === 0 || d === 6;
};

export const addDays = (iso: string, days: number) => toIso(parseIso(iso) + days * DAY_MS);
export const daysBetween = (fromIso: string, toIsoDate: string) => Math.round((parseIso(toIsoDate) - parseIso(fromIso)) / DAY_MS);

/** Hari bursa (Senin–Jumat) sebelum tanggal ini. */
export function previousTradingDay(iso: string): string {
  let ms = parseIso(iso) - DAY_MS;
  while (isWeekend(ms)) ms -= DAY_MS;
  return toIso(ms);
}

/** Perkiraan tanggal pembayaran: ex-date + 18 hari, digeser ke hari kerja berikutnya. */
export function estimatePayDate(exDate: string): string {
  let ms = parseIso(exDate) + PAYMENT_LAG_DAYS * DAY_MS;
  while (isWeekend(ms)) ms += DAY_MS;
  return toIso(ms);
}

/**
 * Tahun pembagian: tahun ex-date, kecuali ex-date di bulan Januari dihitung ke tahun sebelumnya
 * (dividen interim yang tertunda, mis. interim BBRI ex 2 Jan 2024 milik siklus 2023).
 */
export function dividendYearOf(exDate: string): number {
  const year = Number(exDate.slice(0, 4));
  return exDate.slice(5, 7) === '01' ? year - 1 : year;
}

/** Tanggal yang sama (bulan-hari) di tahun lain; 29 Feb menjadi 28 Feb bila perlu. */
function shiftYear(iso: string, years: number): string {
  const year = Number(iso.slice(0, 4)) + years;
  let md = iso.slice(5);
  if (md === '02-29' && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) md = '02-28';
  return `${year}-${md}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Analisis riwayat ───
export function analyzeDividends(
  rawEvents: DividendEvent[],
  todayIso: string,
  yearlyAvgClose: Record<number, number> = {}
): DividendProfile {
  const sorted = rawEvents
    .filter((e) => e.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.exDate))
    .sort((a, b) => a.exDate.localeCompare(b.exDate));

  const events: DividendEventDetail[] = sorted
    .map((e) => ({
      ...e,
      cumDate: previousTradingDay(e.exDate),
      payDate: estimatePayDate(e.exDate),
      dividendYear: dividendYearOf(e.exDate),
      upcoming: e.exDate > todayIso,
    }))
    .reverse();

  const past = sorted.filter((e) => e.exDate <= todayIso);
  const ttmStart = addDays(todayIso, -365);
  const ttmEvents = past.filter((e) => e.exDate > ttmStart);
  const ttmDps = round2(ttmEvents.reduce((s, e) => s + e.amount, 0));

  // Ringkasan per tahun pembagian.
  const byYear = new Map<number, { dps: number; payments: number }>();
  for (const e of past) {
    const y = dividendYearOf(e.exDate);
    const cur = byYear.get(y) ?? { dps: 0, payments: 0 };
    cur.dps += e.amount;
    cur.payments += 1;
    byYear.set(y, cur);
  }
  const currentYear = dividendYearOf(todayIso);
  const lastFullYearCandidate = currentYear - 1;
  const firstYear = byYear.size > 0 ? Math.min(...byYear.keys()) : null;

  const annual: AnnualDividend[] = [];
  if (firstYear !== null) {
    for (let y = firstYear; y <= currentYear; y++) {
      const row = byYear.get(y);
      const dps = round2(row?.dps ?? 0);
      const avgPrice = yearlyAvgClose[y] ?? null;
      if (y === currentYear && !row) continue; // tahun berjalan tanpa pembagian tidak perlu ditampilkan
      annual.push({
        year: y,
        dps,
        payments: row?.payments ?? 0,
        avgPrice,
        yieldPct: avgPrice && avgPrice > 0 && dps > 0 ? (dps / avgPrice) * 100 : null,
        partial: y > lastFullYearCandidate,
      });
    }
  }
  const dpsOf = (y: number) => round2(byYear.get(y)?.dps ?? 0);

  const lastFullYear = firstYear !== null && firstYear <= lastFullYearCandidate ? lastFullYearCandidate : null;
  const lastFullYearDps = lastFullYear !== null ? dpsOf(lastFullYear) : 0;
  const avg3yDps =
    lastFullYear !== null && firstYear !== null && firstYear <= lastFullYear - 2
      ? round2((dpsOf(lastFullYear) + dpsOf(lastFullYear - 1) + dpsOf(lastFullYear - 2)) / 3)
      : null;

  let consecutiveYears = 0;
  if (lastFullYear !== null) {
    for (let y = lastFullYear; dpsOf(y) > 0; y--) consecutiveYears++;
  }

  let growth: DividendProfile['growth'] = null;
  if (lastFullYear !== null) {
    for (const span of [5, 3]) {
      const start = dpsOf(lastFullYear - span);
      const end = dpsOf(lastFullYear);
      if (start > 0 && end > 0) {
        growth = { years: span, cagrPct: (Math.pow(end / start, 1 / span) - 1) * 100 };
        break;
      }
    }
  }

  let declinesLast5 = 0;
  if (lastFullYear !== null) {
    for (let y = lastFullYear - 4; y <= lastFullYear; y++) {
      if (firstYear !== null && y - 1 >= firstYear && dpsOf(y) < dpsOf(y - 1)) declinesLast5++;
    }
  }

  // Siklus acuan untuk proyeksi: pembagian 12 bulan terakhir; bila kosong, tahun penuh terakhir.
  const baseCycle = ttmEvents.length > 0
    ? ttmEvents
    : lastFullYear !== null
      ? past.filter((e) => dividendYearOf(e.exDate) === lastFullYear)
      : [];
  // Tidak dibulatkan: dipakai sebagai pembagi skala jadwal agar total jadwal = DPS tahunan pilihan.
  const baseCycleDps = baseCycle.reduce((s, e) => s + e.amount, 0);

  const horizonEnd = addDays(todayIso, 365);
  const confirmed: ProjectedPayment[] = sorted
    .filter((e) => e.exDate > todayIso && e.exDate <= horizonEnd)
    .map((e) => ({ exDate: e.exDate, cumDate: previousTradingDay(e.exDate), payDate: estimatePayDate(e.exDate), amount: e.amount, confirmed: true }));

  const estimated: ProjectedPayment[] = [];
  for (const e of baseCycle) {
    let exDate = e.exDate;
    while (exDate <= todayIso) exDate = shiftYear(exDate, 1);
    if (exDate > horizonEnd) continue;
    // Pembagian yang sudah dijadwalkan di sekitar tanggal ini menggantikan perkiraannya.
    if (confirmed.some((c) => Math.abs(daysBetween(c.exDate, exDate)) <= 45)) continue;
    // Ex-date jatuh di akhir pekan → geser ke hari bursa berikutnya.
    let ms = parseIso(exDate);
    while (isWeekend(ms)) ms += DAY_MS;
    exDate = toIso(ms);
    estimated.push({ exDate, cumDate: previousTradingDay(exDate), payDate: estimatePayDate(exDate), amount: e.amount, confirmed: false });
  }

  return {
    events,
    annual,
    ttmDps,
    ttmPayments: ttmEvents.length,
    lastFullYear,
    lastFullYearDps,
    avg3yDps,
    consecutiveYears,
    growth,
    declinesLast5,
    baseCycleDps,
    projected: [...confirmed, ...estimated].sort((a, b) => a.exDate.localeCompare(b.exDate)),
    lastExDate: past.length > 0 ? past[past.length - 1].exDate : null,
  };
}

/** DPS tahunan sesuai basis yang dipilih (manual ditangani pemanggil). */
export function dpsForBasis(profile: DividendProfile, basis: Exclude<DpsBasis, 'manual'>): number {
  if (basis === 'ttm') return profile.ttmDps;
  if (basis === 'last-year') return profile.lastFullYearDps;
  return profile.avg3yDps ?? 0;
}

// ─── Simulasi kepemilikan ───
export interface DividendSimInput {
  buyPrice: number;
  inputMode: 'amount' | 'lot';
  capitalRp: number;
  lots: number;
  buyFeePct: number;
  /** DPS kotor per tahun. */
  annualDps: number;
  taxRatePct: number;
}

export interface DividendSimResult {
  lots: number;
  shares: number;
  tradeValueRp: number;
  buyFeeRp: number;
  /** Modal terpakai (nilai transaksi + fee beli). */
  totalCostRp: number;
  /** Sisa modal yang tidak cukup untuk 1 lot lagi (mode nominal). */
  leftoverRp: number;
  grossAnnualRp: number;
  taxAnnualRp: number;
  netAnnualRp: number;
  avgMonthlyNetRp: number;
  /** Yield terhadap modal terpakai. */
  grossYieldOnCostPct: number;
  netYieldOnCostPct: number;
}

export function simulateDividend(input: DividendSimInput): DividendSimResult {
  const price = Math.max(0, input.buyPrice);
  const fee = Math.max(0, input.buyFeePct) / 100;
  const tax = Math.min(100, Math.max(0, input.taxRatePct)) / 100;
  const dps = Math.max(0, input.annualDps);

  let lots = 0;
  if (price > 0) {
    lots = input.inputMode === 'lot'
      ? Math.max(0, Math.floor(input.lots))
      // Toleransi kecil agar pembulatan floating point tidak memotong 1 lot.
      : Math.max(0, Math.floor(Math.max(0, input.capitalRp) / (price * 100 * (1 + fee)) + 1e-9));
  }
  const shares = lots * 100;
  const tradeValueRp = shares * price;
  const buyFeeRp = tradeValueRp * fee;
  const totalCostRp = tradeValueRp + buyFeeRp;
  const leftoverRp = input.inputMode === 'amount' ? Math.max(0, input.capitalRp - totalCostRp) : 0;

  const grossAnnualRp = shares * dps;
  const taxAnnualRp = grossAnnualRp * tax;
  const netAnnualRp = grossAnnualRp - taxAnnualRp;

  return {
    lots,
    shares,
    tradeValueRp,
    buyFeeRp,
    totalCostRp,
    leftoverRp,
    grossAnnualRp,
    taxAnnualRp,
    netAnnualRp,
    avgMonthlyNetRp: netAnnualRp / 12,
    grossYieldOnCostPct: totalCostRp > 0 ? (grossAnnualRp / totalCostRp) * 100 : 0,
    netYieldOnCostPct: totalCostRp > 0 ? (netAnnualRp / totalCostRp) * 100 : 0,
  };
}

export interface ScheduledPayment extends ProjectedPayment {
  /** DPS kotor yang dipakai untuk pembayaran ini. */
  dps: number;
  grossRp: number;
  taxRp: number;
  netRp: number;
}

/**
 * Jadwal pembayaran 12 bulan ke depan untuk jumlah lembar tertentu. Nominal perkiraan
 * diskalakan ke DPS tahunan pilihan pengguna dengan proporsi siklus acuan (mis. interim 55 : final 281);
 * pembagian yang sudah dijadwalkan memakai nominal resminya.
 */
export function buildPaymentSchedule(
  profile: DividendProfile,
  annualDps: number,
  shares: number,
  taxRatePct: number
): ScheduledPayment[] {
  const scale = profile.baseCycleDps > 0 ? annualDps / profile.baseCycleDps : 0;
  const tax = Math.min(100, Math.max(0, taxRatePct)) / 100;
  return profile.projected.map((p) => {
    const dps = p.confirmed ? p.amount : p.amount * scale;
    const grossRp = dps * shares;
    return { ...p, dps, grossRp, taxRp: grossRp * tax, netRp: grossRp * (1 - tax) };
  });
}

// ─── Proyeksi DRIP vs tanpa DRIP ───
export interface DripInput {
  shares: number;
  buyPrice: number;
  initialCostRp: number;
  annualDps: number;
  taxRatePct: number;
  buyFeePct: number;
  years: number;
  dpsGrowthPct: number;
  priceGrowthPct: number;
  /** Waktu pembayaran dalam setahun (0–1) dan porsinya dari DPS tahunan. */
  payments: Array<{ at: number; share: number }>;
}

export interface DripYearRow {
  year: number;
  price: number;
  dps: number;
  drip: { shares: number; lots: number; netDividendRp: number; reinvestedRp: number; cashRp: number; valueRp: number };
  plain: { shares: number; netDividendRp: number; cumulativeCashRp: number; valueRp: number };
}

export interface DripResult {
  rows: DripYearRow[];
  dripFinalRp: number;
  plainFinalRp: number;
  dripReturnPct: number;
  plainReturnPct: number;
  addedLots: number;
}

/**
 * Bandingkan dividen diinvestasikan ulang (DRIP) vs diambil tunai.
 * DRIP membeli dalam kelipatan lot (100 lembar) di harga saat pembayaran, termasuk fee beli;
 * sisa dana yang belum cukup 1 lot dibawa ke pembayaran berikutnya.
 */
export function projectDrip(input: DripInput): DripResult {
  const years = Math.max(1, Math.min(50, Math.floor(input.years)));
  const tax = Math.min(100, Math.max(0, input.taxRatePct)) / 100;
  const fee = Math.max(0, input.buyFeePct) / 100;
  const dg = input.dpsGrowthPct / 100;
  const pg = input.priceGrowthPct / 100;
  const payments = input.payments.length > 0 ? input.payments : [{ at: 0.5, share: 1 }];
  const priceAt = (t: number) => input.buyPrice * Math.pow(1 + pg, t);

  let dripShares = input.shares;
  let cash = 0;
  let plainCash = 0;
  const rows: DripYearRow[] = [];

  for (let y = 1; y <= years; y++) {
    const dps = input.annualDps * Math.pow(1 + dg, y - 1);
    let dripNet = 0;
    let reinvested = 0;
    let plainNet = 0;

    for (const p of payments) {
      const net = dps * p.share * (1 - tax);
      plainNet += input.shares * net;
      const received = dripShares * net;
      dripNet += received;
      cash += received;
      const price = priceAt(y - 1 + p.at);
      const lotCost = price * 100 * (1 + fee);
      const lots = lotCost > 0 ? Math.floor(cash / lotCost + 1e-9) : 0;
      if (lots > 0) {
        dripShares += lots * 100;
        cash -= lots * lotCost;
        reinvested += lots * lotCost;
      }
    }
    plainCash += plainNet;

    const priceEnd = priceAt(y);
    rows.push({
      year: y,
      price: priceEnd,
      dps,
      drip: {
        shares: dripShares,
        lots: Math.floor(dripShares / 100),
        netDividendRp: dripNet,
        reinvestedRp: reinvested,
        cashRp: cash,
        valueRp: dripShares * priceEnd + cash,
      },
      plain: {
        shares: input.shares,
        netDividendRp: plainNet,
        cumulativeCashRp: plainCash,
        valueRp: input.shares * priceEnd + plainCash,
      },
    });
  }

  const last = rows[rows.length - 1];
  const base = input.initialCostRp > 0 ? input.initialCostRp : input.shares * input.buyPrice;
  return {
    rows,
    dripFinalRp: last.drip.valueRp,
    plainFinalRp: last.plain.valueRp,
    dripReturnPct: base > 0 ? (last.drip.valueRp / base - 1) * 100 : 0,
    plainReturnPct: base > 0 ? (last.plain.valueRp / base - 1) * 100 : 0,
    addedLots: Math.floor((last.drip.shares - input.shares) / 100),
  };
}

// ─── Simulasi ex-date (beli saat cum, jual saat ex) ───
export interface ExDateSimInput {
  cumPrice: number;
  lots: number;
  /** DPS kotor untuk satu pembagian ini. */
  dps: number;
  taxRatePct: number;
  buyFeePct: number;
  sellFeePct: number;
  /** Harga jual di ex-date; default = harga teoritis (cum − DPS, dibulatkan ke fraksi). */
  exPrice?: number;
}

export interface ExDateSimResult {
  shares: number;
  buyCostRp: number;
  theoreticalExPrice: number;
  exPrice: number;
  sellProceedsRp: number;
  netDividendRp: number;
  pnlRp: number;
  pnlPct: number;
  /** Harga jual minimal (sesuai fraksi BEI) agar impas setelah fee & pajak. */
  breakEvenPrice: number;
  dividendYieldPct: number;
}

/** Bulatkan ke atas ke harga yang valid menurut fraksi BEI. */
function roundUpToIdxTick(price: number): number {
  if (price <= 0) return 0;
  const down = roundDownToIdxTick(price);
  return down >= price - 1e-9 ? down : down + getIdxTickSize(down);
}

export function simulateExDate(input: ExDateSimInput): ExDateSimResult {
  const shares = Math.max(0, Math.floor(input.lots)) * 100;
  const buyFee = Math.max(0, input.buyFeePct) / 100;
  const sellFee = Math.max(0, input.sellFeePct) / 100;
  const tax = Math.min(100, Math.max(0, input.taxRatePct)) / 100;
  const cumPrice = Math.max(0, input.cumPrice);
  const dps = Math.max(0, input.dps);

  const theoreticalExPrice = cumPrice > 0 ? roundToNearestIdxTick(Math.max(1, cumPrice - dps)) : 0;
  const exPrice = input.exPrice && input.exPrice > 0 ? input.exPrice : theoreticalExPrice;

  const buyCostRp = shares * cumPrice * (1 + buyFee);
  const sellProceedsRp = shares * exPrice * (1 - sellFee);
  const netDividendRp = shares * dps * (1 - tax);
  const pnlRp = sellProceedsRp + netDividendRp - buyCostRp;
  const breakEvenRaw = shares > 0 && sellFee < 1 ? (buyCostRp - netDividendRp) / (shares * (1 - sellFee)) : 0;

  return {
    shares,
    buyCostRp,
    theoreticalExPrice,
    exPrice,
    sellProceedsRp,
    netDividendRp,
    pnlRp,
    pnlPct: buyCostRp > 0 ? (pnlRp / buyCostRp) * 100 : 0,
    breakEvenPrice: roundUpToIdxTick(breakEvenRaw),
    dividendYieldPct: cumPrice > 0 ? (dps / cumPrice) * 100 : 0,
  };
}
