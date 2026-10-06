export interface PurchaseTranche {
  id: string;
  lot: number;
  price: number;
}

export interface AvgDownInput {
  ticker: string;
  companyName?: string;
  lotAwal: number;
  avgPriceAwal: number;
  currentPrice: number;
  lotBaru: number;
  hargaBeliBaru: number;
  feeBeli: number; // Persentase fee beli, e.g. 0.15 (%)
  feeJual: number; // Persentase fee jual, e.g. 0.25 (%)
  includeFees: boolean;
  avgPriceAwalIncludesFee?: boolean;
  tranches?: PurchaseTranche[];
}

export interface AvgDownResult {
  // Sebelum Avg Down
  avgPriceAwal: number;
  sharesAwal: number;
  investedAmountAwal: number; // Modal Awal
  marketValueAwal: number;
  floatingPLAwal: number;
  floatingPLAwalPct: number;
  
  // Pembelian Baru
  sharesBaru: number;
  capitalRequired: number; // Modal Baru yang dibutuhkan
  
  // Sesudah Avg Down
  sharesTotal: number;
  lotTotal: number;
  avgPriceBaru: number;
  investedAmountTotal: number; // Modal Total
  marketValueTotal: number;
  floatingPLTotal: number;
  floatingPLTotalPct: number;
  
  // Break Even Point (harga jual impas, sudah memperhitungkan fee jual bila aktif)
  breakEvenPriceAwal: number;
  breakEvenPriceBaru: number;
  gainToBreakEvenAwalPct: number; // Kenaikan harga yang dibutuhkan dari harga sekarang agar impas
  gainToBreakEvenBaruPct: number;

  // Metriks Perbaikan (Sebelum vs Sesudah)
  avgPriceReductionPct: number; // Seberapa jauh harga rata-rata turun (negatif = avg naik)
  plImprovementPct: number; // Selisih persentase P&L
  lossShrunkPct: number | null; // Seberapa banyak floating loss berkurang (%), null jika tidak loss di awal
  turnedIntoProfit: boolean; // Apakah berubah dari loss menjadi profit/break-even
}

/**
 * Fraksi harga (tick size) saham BEI berdasarkan rentang harga.
 */
export function getIdxTickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Apakah harga sesuai kelipatan fraksi harga BEI. */
export function isValidIdxPrice(price: number): boolean {
  if (price <= 0) return false;
  return price % getIdxTickSize(price) === 0;
}

/** Bulatkan harga ke bawah ke fraksi harga BEI terdekat. */
export function roundDownToIdxTick(price: number): number {
  if (price <= 0) return 0;
  const tick = getIdxTickSize(price);
  return Math.floor(price / tick) * tick;
}

/**
 * Naikkan/turunkan harga satu fraksi BEI. Harga yang belum sesuai fraksi
 * di-snap ke harga valid terdekat ke arah yang dituju (mis. 2.755 → 2.760 / 2.750).
 */
export function stepIdxPrice(price: number, direction: 1 | -1): number {
  if (price <= 0) return direction > 0 ? 1 : 0;
  const base = roundDownToIdxTick(price);
  if (direction > 0) return base + getIdxTickSize(base);
  if (base < price) return base;
  // Turun memakai fraksi rentang di bawahnya (200 → 199, 500 → 498).
  return Math.max(1, price - getIdxTickSize(price - 1));
}

/**
 * Menghitung simulasi Average Down berdasarkan input user.
 */
export function calculateAvgDown(input: AvgDownInput): AvgDownResult {
  const {
    lotAwal,
    avgPriceAwal,
    currentPrice,
    lotBaru,
    hargaBeliBaru,
    feeBeli,
    feeJual,
    includeFees,
    avgPriceAwalIncludesFee = true,
    tranches = []
  } = input;

  const sharesAwal = lotAwal * 100;
  const feeBeliPct = feeBeli / 100;
  const feeJualPct = feeJual / 100;

  // 1. Sebelum Average Down
  const realAvgPriceAwal = (includeFees && !avgPriceAwalIncludesFee) 
    ? avgPriceAwal * (1 + feeBeliPct) 
    : avgPriceAwal;

  const investedAmountAwal = sharesAwal * realAvgPriceAwal;
  const marketValueAwal = sharesAwal * currentPrice;
  
  let floatingPLAwal = 0;
  if (includeFees) {
    // Estimasi nilai jual bersih setelah dipotong fee jual bursa
    const netSellValueAwal = marketValueAwal * (1 - feeJualPct);
    floatingPLAwal = netSellValueAwal - investedAmountAwal;
  } else {
    floatingPLAwal = marketValueAwal - investedAmountAwal;
  }
  const floatingPLAwalPct = investedAmountAwal > 0 
    ? (floatingPLAwal / investedAmountAwal) * 100 
    : 0;

  // 2. Pembelian Baru
  let sharesBaru = 0;
  let capitalRequired = 0;

  if (tranches && tranches.length > 0) {
    tranches.forEach(tranche => {
      const trancheShares = tranche.lot * 100;
      sharesBaru += trancheShares;
      let trancheCost = trancheShares * tranche.price;
      if (includeFees) {
        trancheCost = trancheCost * (1 + feeBeliPct);
      }
      capitalRequired += trancheCost;
    });
  } else {
    sharesBaru = lotBaru * 100;
    capitalRequired = sharesBaru * hargaBeliBaru;
    if (includeFees) {
      capitalRequired = capitalRequired * (1 + feeBeliPct);
    }
  }

  // 3. Setelah Average Down
  const sharesTotal = sharesAwal + sharesBaru;
  const lotTotal = sharesTotal / 100;
  const investedAmountTotal = investedAmountAwal + capitalRequired;
  const avgPriceBaru = sharesTotal > 0 ? investedAmountTotal / sharesTotal : 0;
  const marketValueTotal = sharesTotal * currentPrice;

  let floatingPLTotal = 0;
  if (includeFees) {
    // Estimasi nilai jual bersih setelah dipotong fee jual bursa
    const netSellValueTotal = marketValueTotal * (1 - feeJualPct);
    floatingPLTotal = netSellValueTotal - investedAmountTotal;
  } else {
    floatingPLTotal = marketValueTotal - investedAmountTotal;
  }
  const floatingPLTotalPct = investedAmountTotal > 0
    ? (floatingPLTotal / investedAmountTotal) * 100
    : 0;

  // 4. Break Even Point: harga jual di mana nilai jual bersih = modal
  const sellFactor = includeFees ? 1 - feeJualPct : 1;
  const breakEvenPriceAwal = sharesAwal > 0 && sellFactor > 0
    ? investedAmountAwal / (sharesAwal * sellFactor)
    : 0;
  const breakEvenPriceBaru = sharesTotal > 0 && sellFactor > 0
    ? investedAmountTotal / (sharesTotal * sellFactor)
    : 0;
  const gainToBreakEvenAwalPct = currentPrice > 0
    ? ((breakEvenPriceAwal - currentPrice) / currentPrice) * 100
    : 0;
  const gainToBreakEvenBaruPct = currentPrice > 0
    ? ((breakEvenPriceBaru - currentPrice) / currentPrice) * 100
    : 0;

  // 5. Metriks Perbaikan (dibandingkan dengan avg awal riil agar konsisten dengan yang ditampilkan)
  const avgPriceReductionPct = realAvgPriceAwal > 0
    ? ((realAvgPriceAwal - avgPriceBaru) / realAvgPriceAwal) * 100
    : 0;

  const plImprovementPct = floatingPLTotalPct - floatingPLAwalPct;

  let lossShrunkPct: number | null = null;
  let turnedIntoProfit = false;

  if (floatingPLAwalPct < 0) {
    if (floatingPLTotalPct >= 0) {
      lossShrunkPct = 100; // Kerugian berkurang 100% (sudah break-even atau profit)
      turnedIntoProfit = true;
    } else {
      // Kerugian awal minus (misal -20%), kerugian akhir minus (misal -5%)
      // Rumus: (AwalLoss - AkhirLoss) / AwalLoss
      // ((-20) - (-5)) / (-20) = -15 / -20 = 75%
      lossShrunkPct = ((floatingPLAwalPct - floatingPLTotalPct) / floatingPLAwalPct) * 100;
    }
  }

  return {
    avgPriceAwal: realAvgPriceAwal,
    sharesAwal,
    investedAmountAwal,
    marketValueAwal,
    floatingPLAwal,
    floatingPLAwalPct,
    sharesBaru,
    capitalRequired,
    sharesTotal,
    lotTotal,
    avgPriceBaru,
    investedAmountTotal,
    marketValueTotal,
    floatingPLTotal,
    floatingPLTotalPct,
    breakEvenPriceAwal,
    breakEvenPriceBaru,
    gainToBreakEvenAwalPct,
    gainToBreakEvenBaruPct,
    avgPriceReductionPct,
    plImprovementPct,
    lossShrunkPct,
    turnedIntoProfit
  };
}
