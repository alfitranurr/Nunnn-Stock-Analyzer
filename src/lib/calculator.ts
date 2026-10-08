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

/** Bulatkan ke atas ke harga yang valid menurut fraksi BEI (mis. 6.049,7 → 6.050). */
export function roundUpToIdxTick(price: number): number {
  if (price <= 0) return 0;
  const down = roundDownToIdxTick(price);
  return down >= price - 1e-9 ? down : down + getIdxTickSize(down);
}

/** Bulatkan ke fraksi harga BEI terdekat (mis. 672,87 → 675). */
export function roundToNearestIdxTick(price: number): number {
  if (price <= 0) return 0;
  const tick = getIdxTickSize(price);
  return Math.max(tick, Math.round(price / tick) * tick);
}

/**
 * Batas auto rejection ATAS (ARA) BEI (%) berdasarkan harga acuan (penutupan sebelumnya):
 * ≤ Rp200 → 35%, ≤ Rp5.000 → 25%, di atasnya → 20%. Juga berlaku di hari pertama pencatatan saham IPO.
 */
export function getAutoRejectionPct(referencePrice: number): number {
  if (referencePrice <= 200) return 35;
  if (referencePrice <= 5000) return 25;
  return 20;
}

// Kep-00003/BEI/04-2025: ARB 15% untuk semua rentang harga sejak 8 Apr 2025.
// Kep-00136/BEI/09-2026: ARB kembali simetris dengan ARA mulai 1 Jan 2027 (00:00 WIB).
const ARB_FLAT_START_MS = Date.UTC(2025, 3, 7, 17);
const ARB_SYMMETRIC_FROM_MS = Date.UTC(2026, 11, 31, 17);
const ARB_FLAT_PCT = 15;

/** Batas auto rejection BAWAH (ARB) BEI (%) yang berlaku pada waktu `at`. */
export function getAutoRejectionDownPct(referencePrice: number, at: number = Date.now()): number {
  if (at >= ARB_FLAT_START_MS && at < ARB_SYMMETRIC_FROM_MS) return ARB_FLAT_PCT;
  return getAutoRejectionPct(referencePrice);
}

/**
 * Harga tertinggi (ARA) & terendah (ARB) yang dimungkinkan dari harga acuan.
 * - Harga acuan Rp1–Rp10 (sejak harga minimum Rp1, 28 Sep 2026): batas tetap ±Rp1.
 * - Selain itu persentase ARA/ARB di atas, dibulatkan ke fraksi BEI; perubahan minimal satu fraksi selalu diizinkan.
 * `pct` = persentase ARA (dipertahankan untuk kompatibilitas).
 */
export function getAutoRejectionBounds(
  referencePrice: number,
  at: number = Date.now()
): { upper: number; lower: number; pct: number; upPct: number; downPct: number } {
  const upPct = getAutoRejectionPct(referencePrice);
  const downPct = getAutoRejectionDownPct(referencePrice, at);
  if (referencePrice <= 10) {
    return { upper: referencePrice + 1, lower: Math.max(1, referencePrice - 1), pct: upPct, upPct, downPct };
  }
  const tick = getIdxTickSize(referencePrice);
  const upper = Math.max(roundDownToIdxTick(referencePrice * (1 + upPct / 100)), referencePrice + tick);
  const lowerRaw = referencePrice * (1 - downPct / 100);
  const lowerTick = getIdxTickSize(lowerRaw);
  const lower = Math.max(1, Math.min(Math.ceil(lowerRaw / lowerTick) * lowerTick, referencePrice - tick));
  return { upper, lower, pct: upPct, upPct, downPct };
}

/** 'ARA' / 'ARB' bila harga sudah menyentuh batas auto rejection, selain itu null. */
export function getAutoRejectionStatus(referencePrice: number, price: number, at: number = Date.now()): 'ARA' | 'ARB' | null {
  if (referencePrice <= 0 || price <= 0) return null;
  const { upper, lower } = getAutoRejectionBounds(referencePrice, at);
  if (price > referencePrice && price >= upper) return 'ARA';
  if (price < referencePrice && price <= lower) return 'ARB';
  return null;
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
