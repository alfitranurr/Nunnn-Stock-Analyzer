export interface CompoundingInput {
  title: string;
  initialAmount: number;
  contributionAmount: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  annualReturnRate: number;
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'yearly';
  durationYears: number;
  durationMonths: number;
  inflationRate: number;
  taxRate: number;
}

export interface CompoundingPeriodDetail {
  period: number; // Nomor bulan (1, 2, 3...)
  year: number;
  month: number; // Bulan ke-n di tahun tersebut (1-12)
  startingBalance: number;
  deposit: number;
  interestEarned: number;
  taxDeducted: number;
  endingBalance: number;
  realEndingBalance: number; // Disesuaikan inflasi
  cumulativeDeposits: number;
  cumulativeInterest: number;
  cumulativeTax: number;
}

export interface CompoundingYearlySummary {
  year: number;
  startingBalance: number;
  totalDeposits: number;
  totalInterestEarned: number;
  totalTaxDeducted: number;
  endingBalance: number;
  realEndingBalance: number;
  cumulativeDeposits: number;
  cumulativeInterest: number;
}

export interface CompoundingResult {
  nominalEndingBalance: number;
  realEndingBalance: number;
  totalDeposits: number;
  totalInterestEarned: number;
  totalTaxDeducted: number;
  monthlyDetails: CompoundingPeriodDetail[];
  yearlySummaries: CompoundingYearlySummary[];
}

/**
 * Menghitung simulasi bunga majemuk (compounding interest) secara rinci bulan demi bulan.
 */
export function calculateCompounding(input: CompoundingInput): CompoundingResult {
  const {
    initialAmount,
    contributionAmount,
    contributionFrequency,
    annualReturnRate,
    compoundingFrequency,
    durationYears,
    durationMonths,
    inflationRate,
    taxRate
  } = input;

  const totalMonths = Math.max(1, durationYears * 12 + durationMonths);
  const r_annual = annualReturnRate / 100;
  const i_annual = inflationRate / 100;
  const t_rate = taxRate / 100;

  // 1. Hitung interest rate bulanan ekuivalen (r_monthly) berdasarkan frekuensi compounding
  let r_monthly = 0;
  if (compoundingFrequency === 'yearly') {
    r_monthly = Math.pow(1 + r_annual, 1 / 12) - 1;
  } else if (compoundingFrequency === 'quarterly') {
    r_monthly = Math.pow(1 + r_annual / 4, 1 / 3) - 1;
  } else if (compoundingFrequency === 'monthly') {
    r_monthly = r_annual / 12;
  } else if (compoundingFrequency === 'daily') {
    // Menggunakan 365 hari setahun, ekuivalen bulanan
    r_monthly = Math.pow(1 + r_annual / 365, 365 / 12) - 1;
  }

  // 2. Hitung inflasi bulanan ekuivalen (i_monthly)
  const i_monthly = Math.pow(1 + i_annual, 1 / 12) - 1;

  // 3. Simulasikan bulan demi bulan
  const monthlyDetails: CompoundingPeriodDetail[] = [];
  let currentBalance = initialAmount;
  let cumulativeDeposits = initialAmount;
  let cumulativeInterest = 0;
  let cumulativeTax = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const startingBalance = currentBalance;
    const year = Math.ceil(m / 12);
    const monthOfYear = m % 12 === 0 ? 12 : m % 12;

    // Hitung deposit bulan ini
    let deposit = 0;
    if (contributionFrequency === 'daily') {
      // Pendekatan 30.417 hari per bulan
      deposit = contributionAmount * 30.417;
    } else if (contributionFrequency === 'weekly') {
      // Pendekatan 4.333 minggu per bulan
      deposit = contributionAmount * 4.333;
    } else if (contributionFrequency === 'monthly') {
      deposit = contributionAmount;
    } else if (contributionFrequency === 'yearly') {
      // Setoran ditambahkan setiap akhir tahun (bulan ke-12, 24, 36, dst)
      if (m % 12 === 0) {
        deposit = contributionAmount;
      }
    }

    // Hitung bunga yang didapat bulan ini
    const interestEarned = startingBalance * r_monthly;
    const taxDeducted = interestEarned * t_rate;
    const netInterest = interestEarned - taxDeducted;

    // Saldo akhir sebelum disesuaikan inflasi
    currentBalance = startingBalance + deposit + netInterest;
    
    // Akumulasi modal disetor, bunga kotor, dan pajak
    cumulativeDeposits += deposit;
    cumulativeInterest += interestEarned;
    cumulativeTax += taxDeducted;

    // Hitung saldo akhir riil (daya beli disesuaikan inflasi sejak awal simulasi)
    const discountFactor = Math.pow(1 + i_monthly, m);
    const realEndingBalance = currentBalance / discountFactor;

    monthlyDetails.push({
      period: m,
      year,
      month: monthOfYear,
      startingBalance,
      deposit,
      interestEarned,
      taxDeducted,
      endingBalance: currentBalance,
      realEndingBalance,
      cumulativeDeposits,
      cumulativeInterest,
      cumulativeTax
    });
  }

  // 4. Hitung ringkasan tahunan
  const yearlySummaries: CompoundingYearlySummary[] = [];
  for (let y = 1; y <= Math.ceil(totalMonths / 12); y++) {
    const startIdx = (y - 1) * 12;
    const endIdx = Math.min(y * 12 - 1, totalMonths - 1);
    
    const yearDetails = monthlyDetails.slice(startIdx, endIdx + 1);
    if (yearDetails.length === 0) continue;

    const firstMonth = yearDetails[0];
    const lastMonth = yearDetails[yearDetails.length - 1];

    const totalDeposits = yearDetails.reduce((sum, d) => sum + d.deposit, 0);
    const totalInterestEarned = yearDetails.reduce((sum, d) => sum + d.interestEarned, 0);
    const totalTaxDeducted = yearDetails.reduce((sum, d) => sum + d.taxDeducted, 0);

    yearlySummaries.push({
      year: y,
      startingBalance: firstMonth.startingBalance,
      totalDeposits,
      totalInterestEarned,
      totalTaxDeducted,
      endingBalance: lastMonth.endingBalance,
      realEndingBalance: lastMonth.realEndingBalance,
      cumulativeDeposits: lastMonth.cumulativeDeposits,
      cumulativeInterest: lastMonth.cumulativeInterest
    });
  }

  return {
    nominalEndingBalance: currentBalance,
    realEndingBalance: monthlyDetails[totalMonths - 1].realEndingBalance,
    totalDeposits: cumulativeDeposits,
    totalInterestEarned: cumulativeInterest,
    totalTaxDeducted: cumulativeTax,
    monthlyDetails,
    yearlySummaries
  };
}

// ─── Rencana Trading (target profit per periode: harian / bulanan / tahunan) ───

export type TradingPeriod = 'daily' | 'monthly' | 'yearly';

// Asumsi hari bursa: ±21 hari per bulan, 252 hari per tahun.
export const TRADING_DAYS_PER_MONTH = 21;
export const TRADING_DAYS_PER_YEAR = 252;

/** Lama satu periode dalam satuan hari bursa. */
export const TRADING_PERIOD_DAYS: Record<TradingPeriod, number> = {
  daily: 1,
  monthly: TRADING_DAYS_PER_MONTH,
  yearly: TRADING_DAYS_PER_YEAR,
};

/** Batas jumlah periode agar tabel & grafik tetap ringan. */
export const TRADING_MAX_PERIODS: Record<TradingPeriod, number> = {
  daily: 2520, // 10 tahun bursa
  monthly: 600, // 50 tahun
  yearly: 100,
};

export interface TradingCompoundingInput {
  title: string;
  initialAmount: number;
  contributionAmount: number; // Setoran tambahan per periode
  returnRatePerPeriod: number; // Target profit (%) per periode
  periods: number; // Jumlah periode
  feeBeli: number;
  feeJual: number;
}

export interface TradingCompoundingDetail {
  period: number; // Periode ke-n
  startingBalance: number;
  deposit: number;
  interestEarned: number; // Profit kotor periode ini
  taxDeducted: number; // Fee broker (beli + jual) periode ini
  endingBalance: number;
  cumulativeDeposits: number;
  cumulativeInterest: number;
  cumulativeTax: number;
}

export interface TradingCompoundingResult {
  nominalEndingBalance: number;
  totalDeposits: number;
  totalInterestEarned: number;
  totalTaxDeducted: number;
  details: TradingCompoundingDetail[];
}

/**
 * Simulasi compounding rencana trading. Setiap periode diasumsikan satu kali
 * putaran beli-jual seluruh saldo, sehingga fee beli & jual dipotong sekali per periode.
 */
export function calculateTradingCompounding(input: TradingCompoundingInput): TradingCompoundingResult {
  const {
    initialAmount,
    contributionAmount,
    returnRatePerPeriod,
    periods,
    feeBeli,
    feeJual
  } = input;

  const r = returnRatePerPeriod / 100;
  const f_beli = feeBeli / 100;
  const f_jual = feeJual / 100;

  const details: TradingCompoundingDetail[] = [];
  let currentBalance = initialAmount;
  let cumulativeDeposits = initialAmount;
  let cumulativeInterest = 0;
  let cumulativeTax = 0;

  const totalPeriods = Math.max(1, Math.floor(periods));

  for (let p = 1; p <= totalPeriods; p++) {
    const startingBalance = currentBalance;
    const deposit = contributionAmount;

    // Target profit kotor periode ini
    const interestEarned = startingBalance * r;

    // Fee broker beli & jual
    const buyFee = startingBalance * f_beli;
    const sellFee = (startingBalance + interestEarned) * f_jual;
    const taxDeducted = buyFee + sellFee;

    const netInterest = interestEarned - taxDeducted;

    currentBalance = startingBalance + deposit + netInterest;

    cumulativeDeposits += deposit;
    cumulativeInterest += interestEarned;
    cumulativeTax += taxDeducted;

    details.push({
      period: p,
      startingBalance,
      deposit,
      interestEarned,
      taxDeducted,
      endingBalance: currentBalance,
      cumulativeDeposits,
      cumulativeInterest,
      cumulativeTax
    });
  }

  return {
    nominalEndingBalance: currentBalance,
    totalDeposits: cumulativeDeposits,
    totalInterestEarned: cumulativeInterest,
    totalTaxDeducted: cumulativeTax,
    details
  };
}

export interface TradingGroupSummary {
  group: number; // Kelompok ke-n (mis. bulan ke-n)
  fromPeriod: number;
  toPeriod: number;
  startingBalance: number;
  totalDeposits: number;
  totalProfit: number; // Profit kotor
  totalFees: number;
  endingBalance: number;
  cumulativeReturnPct: number; // Return bersih kumulatif terhadap total setoran
}

/** Rekap detail per periode menjadi kelompok berisi `groupSize` periode (mis. 21 hari → 1 bulan). */
export function groupTradingDetails(details: TradingCompoundingDetail[], groupSize: number): TradingGroupSummary[] {
  const size = Math.max(1, Math.floor(groupSize));
  const groups: TradingGroupSummary[] = [];
  for (let i = 0; i < details.length; i += size) {
    const chunk = details.slice(i, i + size);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    groups.push({
      group: groups.length + 1,
      fromPeriod: first.period,
      toPeriod: last.period,
      startingBalance: first.startingBalance,
      totalDeposits: chunk.reduce((sum, d) => sum + d.deposit, 0),
      totalProfit: chunk.reduce((sum, d) => sum + d.interestEarned, 0),
      totalFees: chunk.reduce((sum, d) => sum + d.taxDeducted, 0),
      endingBalance: last.endingBalance,
      cumulativeReturnPct: last.cumulativeDeposits > 0
        ? ((last.endingBalance - last.cumulativeDeposits) / last.cumulativeDeposits) * 100
        : 0,
    });
  }
  return groups;
}

/**
 * Konversi target return majemuk antar periode trading.
 * Contoh: 1%/hari ≈ 23,2%/bulan (21 hari bursa) ≈ 1.127%/tahun (252 hari bursa).
 */
export function convertTradingRate(ratePct: number, from: TradingPeriod, to: TradingPeriod): number {
  const exponent = TRADING_PERIOD_DAYS[to] / TRADING_PERIOD_DAYS[from];
  const base = 1 + ratePct / 100;
  if (base <= 0) return -100;
  return (Math.pow(base, exponent) - 1) * 100;
}

