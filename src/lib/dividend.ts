export interface DividendInput {
  ticker: string;
  companyName: string;
  currentPrice: number;
  expectedBuyPrice: number;
  totalInvestmentRp: number;
  totalLot: number;
  inputMode: 'amount' | 'lot';
  annualDividendPerShare: number; // Rp per lembar per tahun
  taxRatePercent: number; // e.g. 0, 10, or custom
  payoutMonths: number[]; // e.g. [4, 12] for April & December
  isDripEnabled?: boolean;
  language?: 'id' | 'en';
}

export interface MonthlyDividendBreakdown {
  month: number; // 1..12
  monthName: string; // "Januari", "Februari", ... / "January", ...
  monthShort: string; // "Jan", "Feb", ...
  isPayoutMonth: boolean;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  payoutLabel?: string; // e.g. "Final Dividend" | "Interim Dividend"
}

export interface DripYearProjection {
  year: number;
  sharesCount: number;
  lotsCount: number;
  portfolioValueRp: number;
  grossAnnualDividendRp: number;
  netAnnualDividendRp: number;
  monthlyNetIncomeRp: number;
  newSharesAdded: number;
}

export interface DividendResult {
  ticker: string;
  companyName: string;
  buyPrice: number;
  totalInvestmentRp: number;
  totalShares: number;
  totalLots: number;
  annualDividendPerShare: number;
  
  grossAnnualDividendRp: number;
  taxRatePercent: number;
  taxAnnualAmountRp: number;
  netAnnualDividendRp: number;
  
  effectiveGrossYield: number; // %
  effectiveNetYield: number; // %
  yieldOnCost: number; // %
  
  averageMonthlyNetIncomeRp: number; // netAnnual / 12
  monthlyBreakdown: MonthlyDividendBreakdown[];
  dripProjections: DripYearProjection[];
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORTS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_SHORTS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Calculates complete dividend simulation for 1 year, monthly breakdown, tax options, and DRIP projections.
 */
export function calculateDividend(input: DividendInput): DividendResult {
  const buyPrice = input.expectedBuyPrice > 0 ? input.expectedBuyPrice : input.currentPrice;
  const isEn = input.language === 'en';
  
  let totalShares = 0;
  let totalLots = 0;
  let totalInvestmentRp = 0;

  if (input.inputMode === 'lot') {
    totalLots = Math.max(0, input.totalLot);
    totalShares = totalLots * 100;
    totalInvestmentRp = totalShares * buyPrice;
  } else {
    totalInvestmentRp = Math.max(0, input.totalInvestmentRp);
    totalShares = buyPrice > 0 ? Math.floor(totalInvestmentRp / buyPrice) : 0;
    totalLots = Math.floor(totalShares / 100);
    // Recalculate actual investment for exact lot count
    totalShares = totalLots * 100;
  }

  const annualDivPerShare = Math.max(0, input.annualDividendPerShare);
  const grossAnnualDividendRp = totalShares * annualDivPerShare;
  
  const taxRate = Math.max(0, Math.min(100, input.taxRatePercent));
  const taxAnnualAmountRp = grossAnnualDividendRp * (taxRate / 100);
  const netAnnualDividendRp = grossAnnualDividendRp - taxAnnualAmountRp;
  
  const effectiveGrossYield = totalInvestmentRp > 0 ? (grossAnnualDividendRp / totalInvestmentRp) * 100 : 0;
  const effectiveNetYield = totalInvestmentRp > 0 ? (netAnnualDividendRp / totalInvestmentRp) * 100 : 0;
  const yieldOnCost = effectiveNetYield;

  const averageMonthlyNetIncomeRp = netAnnualDividendRp / 12;

  // Monthly breakdown
  const payoutMonths = input.payoutMonths && input.payoutMonths.length > 0 ? input.payoutMonths : [4, 12];
  const payoutCount = payoutMonths.length;

  const monthNames = isEn ? MONTH_NAMES_EN : MONTH_NAMES_ID;
  const monthShorts = isEn ? MONTH_SHORTS_EN : MONTH_SHORTS_ID;

  const monthlyBreakdown: MonthlyDividendBreakdown[] = [];

  for (let m = 1; m <= 12; m++) {
    const isPayout = payoutMonths.includes(m);
    let grossM = 0;
    let taxM = 0;
    let netM = 0;
    let label = undefined;

    if (isPayout) {
      grossM = grossAnnualDividendRp / payoutCount;
      taxM = taxAnnualAmountRp / payoutCount;
      netM = netAnnualDividendRp / payoutCount;
      
      if (payoutCount === 1) {
        label = isEn ? 'Final Dividend' : 'Dividen Final';
      } else if (payoutCount === 2) {
        label = m === Math.min(...payoutMonths)
          ? (isEn ? 'Final Dividend' : 'Dividen Final')
          : (isEn ? 'Interim Dividend' : 'Dividen Interim');
      } else {
        label = isEn ? 'Dividend' : 'Dividen';
      }
    }

    monthlyBreakdown.push({
      month: m,
      monthName: monthNames[m - 1],
      monthShort: monthShorts[m - 1],
      isPayoutMonth: isPayout,
      grossAmount: grossM,
      taxAmount: taxM,
      netAmount: netM,
      payoutLabel: label,
    });
  }

  // Multi-year DRIP projection (5 years)
  const dripProjections: DripYearProjection[] = [];
  let currentShares = totalShares;

  for (let y = 1; y <= 5; y++) {
    const yGrossDiv = currentShares * annualDivPerShare;
    const yTaxDiv = yGrossDiv * (taxRate / 100);
    const yNetDiv = yGrossDiv - yTaxDiv;
    
    // Additional shares bought with net dividend
    const newShares = buyPrice > 0 ? Math.floor(yNetDiv / buyPrice) : 0;
    const portfolioValue = currentShares * buyPrice;

    dripProjections.push({
      year: y,
      sharesCount: currentShares,
      lotsCount: Math.floor(currentShares / 100),
      portfolioValueRp: portfolioValue,
      grossAnnualDividendRp: yGrossDiv,
      netAnnualDividendRp: yNetDiv,
      monthlyNetIncomeRp: yNetDiv / 12,
      newSharesAdded: newShares,
    });

    if (input.isDripEnabled) {
      currentShares += newShares;
    }
  }

  return {
    ticker: input.ticker.toUpperCase().trim(),
    companyName: input.companyName,
    buyPrice,
    totalInvestmentRp,
    totalShares,
    totalLots,
    annualDividendPerShare: annualDivPerShare,
    grossAnnualDividendRp,
    taxRatePercent: taxRate,
    taxAnnualAmountRp,
    netAnnualDividendRp,
    effectiveGrossYield,
    effectiveNetYield,
    yieldOnCost,
    averageMonthlyNetIncomeRp,
    monthlyBreakdown,
    dripProjections,
  };
}
