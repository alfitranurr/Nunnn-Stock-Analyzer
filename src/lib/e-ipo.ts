/**
 * Simulasi penjatahan saham E-IPO sesuai SEOJK 25/SEOJK.04/2025
 * (ditetapkan & berlaku 17 Nov 2025, mencabut SEOJK 15/SEOJK.04/2020).
 * Semua fungsi murni (tanpa I/O).
 *
 * Ringkasan aturan yang dimodelkan:
 * - Golongan penawaran (romawi VI) & alokasi minimal penjatahan terpusat (romawi VII angka 1–2).
 * - Penyesuaian alokasi bila pesanan penjatahan terpusat melebihi alokasi minimal 2,5×/10×/25× (romawi VIII angka 1–2).
 * - Porsi terpusat dibagi ritel : selain ritel = 1 : 1 (romawi VII angka 5). Pemesan ritel = pesanan ≤ Rp100 juta.
 * - Total pesanan satu pemodal maksimal 10% dari nilai penawaran (romawi IV).
 * - Penjatahan dalam tiap porsi (romawi VIII angka 7):
 *   a. tiap pemodal dijatah dulu maksimal 10 lot (atau sesuai pesanan bila < 10 lot);
 *   b. bila lot tersedia < jumlah pemodal → 1 lot per pemodal sesuai urutan waktu pesan;
 *   c. sisa dibagi proporsional terhadap sisa pesanan yang belum terpenuhi;
 *   d. pecahan lot dibulatkan ke bawah;
 *   e. sisa pembulatan diberikan 1 lot per pemodal sesuai urutan waktu.
 */

export const SHARES_PER_LOT = 100;
export const RETAIL_MAX_ORDER_RP = 100_000_000;
export const MAX_ORDER_PCT_OF_OFFERING = 10;
export const FIRST_TIER_MAX_LOTS = 10;

export type Golongan = 1 | 2 | 3 | 4 | 5;

export interface GolonganRule {
  golongan: Golongan;
  /** Batas atas nilai penawaran (Rp), inklusif. */
  maxOfferingRp: number;
  minPct: number;
  minRp: number;
  /** Alokasi minimal setelah penyesuaian untuk tingkat pesanan 2,5×, 10×, 25×. */
  adjustedPct: [number, number, number];
}

export const GOLONGAN_RULES: GolonganRule[] = [
  { golongan: 1, maxOfferingRp: 100e9, minPct: 20, minRp: 10e9, adjustedPct: [22.5, 25, 30] },
  { golongan: 2, maxOfferingRp: 250e9, minPct: 15, minRp: 20e9, adjustedPct: [17.5, 20, 25] },
  { golongan: 3, maxOfferingRp: 500e9, minPct: 10, minRp: 37.5e9, adjustedPct: [12.5, 15, 20] },
  { golongan: 4, maxOfferingRp: 1000e9, minPct: 7.5, minRp: 50e9, adjustedPct: [10, 12.5, 17.5] },
  { golongan: 5, maxOfferingRp: Infinity, minPct: 2.5, minRp: 75e9, adjustedPct: [5, 7.5, 12.5] },
];

/** Batas tingkat pesanan (×) untuk penyesuaian I, II, III. */
export const ADJUSTMENT_THRESHOLDS: [number, number, number] = [2.5, 10, 25];

export function getGolonganRule(offeringRp: number): GolonganRule {
  return GOLONGAN_RULES.find((r) => offeringRp <= r.maxOfferingRp) ?? GOLONGAN_RULES[GOLONGAN_RULES.length - 1];
}

export interface PoolAllocation {
  golongan: Golongan;
  offeringRp: number;
  /** Seluruh efek masuk penjatahan terpusat (golongan I dengan nilai ≤ Rp10 miliar). */
  allPooling: boolean;
  initialLots: number;
  initialPct: number;
  /** 0 = tanpa penyesuaian, 1–3 = penyesuaian I–III. */
  adjustmentTier: 0 | 1 | 2 | 3;
  finalLots: number;
  finalPct: number;
  retailLots: number;
  nonRetailLots: number;
}

/**
 * Alokasi penjatahan terpusat. `poolOversubscription` = total lot dipesan di penjatahan terpusat
 * dibagi alokasi minimal awal (definisi "tingkat pemesanan" pada romawi VIII angka 1).
 * Alokasi "paling sedikit", jadi lot dibulatkan ke atas.
 */
export function calculatePoolAllocation(totalLots: number, price: number, poolOversubscription: number): PoolAllocation {
  const lots = Math.max(0, Math.floor(totalLots));
  const offeringRp = lots * SHARES_PER_LOT * Math.max(0, price);
  const rule = getGolonganRule(offeringRp);
  const lotValue = price * SHARES_PER_LOT;

  const allPooling = rule.golongan === 1 && offeringRp <= rule.minRp;
  let initialLots = lots;
  if (!allPooling && lotValue > 0) {
    initialLots = Math.min(lots, Math.max(Math.ceil((lots * rule.minPct) / 100), Math.ceil(rule.minRp / lotValue)));
  }

  const x = Math.max(0, poolOversubscription);
  // Seluruh efek sudah di penjatahan terpusat → tidak ada penyesuaian.
  const adjustmentTier: PoolAllocation['adjustmentTier'] = allPooling
    ? 0
    : x >= ADJUSTMENT_THRESHOLDS[2] ? 3 : x >= ADJUSTMENT_THRESHOLDS[1] ? 2 : x >= ADJUSTMENT_THRESHOLDS[0] ? 1 : 0;
  let finalLots = initialLots;
  if (adjustmentTier > 0) {
    // Bila alokasi awal sudah melebihi batas penyesuaian, tidak perlu disesuaikan (romawi VIII angka 4).
    finalLots = Math.min(lots, Math.max(initialLots, Math.ceil((lots * rule.adjustedPct[adjustmentTier - 1]) / 100)));
  }

  const retailLots = Math.floor(finalLots / 2);
  return {
    golongan: rule.golongan,
    offeringRp,
    allPooling,
    initialLots,
    initialPct: lots > 0 ? (initialLots / lots) * 100 : 0,
    adjustmentTier,
    finalLots,
    finalPct: lots > 0 ? (finalLots / lots) * 100 : 0,
    retailLots,
    nonRetailLots: finalLots - retailLots,
  };
}

export type PoolStage = 'filled' | 'queue-one-lot' | 'equal-rounds' | 'proportional';

export interface PoolInput {
  poolLots: number;
  /** Jumlah pemodal di porsi ini, termasuk Anda. */
  investors: number;
  /** Total lot dipesan di porsi ini, termasuk pesanan Anda. */
  demandLots: number;
  myOrderLots: number;
  /** Posisi waktu pesan Anda: 0 = paling awal, 100 = paling akhir. */
  myQueuePct: number;
}

export interface PoolResult {
  stage: PoolStage;
  poolLots: number;
  investors: number;
  demandLots: number;
  /** Total pesanan ÷ lot tersedia di porsi ini. */
  oversubscription: number;
  /** Rata-rata pesanan pemodal lain (lot), dasar asumsi model. */
  avgOtherOrderLots: number;
  /** Tahap antrean: hanya X% pemodal tercepat yang mendapat jatah (null bila tidak berlaku). */
  queueCutoffPct: number | null;
  /** Jatah dasar per pemodal sebelum sisa dibagi (lot). */
  baseLotsPerInvestor: number;
  myFirstTierLots: number;
  myExtraLots: number;
  myLots: number;
  /** Masih mungkin +1 lot dari sisa pembulatan bila memesan cukup awal (tidak dihitung di `myLots`). */
  myRoundingBonusPossible: boolean;
}

/**
 * Perkiraan jatah satu pemodal dalam satu porsi (ritel atau selain ritel).
 * Model mengasumsikan pemodal lain memesan rata-rata sama besar ((total − pesanan Anda) / (pemodal − 1)),
 * karena sebaran pesanan per pemodal tidak dipublikasikan.
 */
export function allocateInPool(input: PoolInput): PoolResult {
  const pool = Math.max(0, Math.floor(input.poolLots));
  const n = Math.max(1, Math.floor(input.investors));
  const mine = Math.max(0, Math.floor(input.myOrderLots));
  const demand = Math.max(mine, input.demandLots);
  const queue = Math.min(100, Math.max(0, input.myQueuePct));
  const others = n - 1;
  const avgOther = others > 0 ? Math.max(1, (demand - mine) / others) : 0;

  const base = {
    poolLots: pool,
    investors: n,
    demandLots: demand,
    oversubscription: pool > 0 ? demand / pool : 0,
    avgOtherOrderLots: avgOther,
  };

  // Pesanan tidak melebihi lot tersedia: semua pesanan terpenuhi.
  if (demand <= pool) {
    return { ...base, stage: 'filled', queueCutoffPct: null, baseLotsPerInvestor: avgOther, myFirstTierLots: mine, myExtraLots: 0, myLots: mine, myRoundingBonusPossible: false };
  }

  // b. Lot lebih sedikit dari jumlah pemodal → 1 lot untuk pemodal tercepat.
  if (pool < n) {
    const cutoff = (pool / n) * 100;
    const got = mine > 0 && queue < cutoff ? 1 : 0;
    return { ...base, stage: 'queue-one-lot', queueCutoffPct: cutoff, baseLotsPerInvestor: 0, myFirstTierLots: got, myExtraLots: 0, myLots: got, myRoundingBonusPossible: false };
  }

  const otherTier = Math.min(FIRST_TIER_MAX_LOTS, avgOther);
  const myTier = Math.min(FIRST_TIER_MAX_LOTS, mine);
  const tierDemand = others * otherTier + myTier;

  // a. (lot cukup untuk 1 lot/orang tapi tidak cukup 10 lot/orang) → dibagi rata per putaran,
  // sisa putaran terakhir 1 lot per pemodal sesuai urutan waktu.
  if (pool < tierDemand) {
    let level = 1;
    const used = (k: number) => others * Math.min(otherTier, k) + Math.min(myTier, k);
    while (level < FIRST_TIER_MAX_LOTS && used(level + 1) <= pool) level++;
    const leftover = pool - used(level);
    const unfilled = (otherTier > level ? others : 0) + (myTier > level ? 1 : 0);
    const myUnfilled = myTier > level;
    const bonus = myUnfilled && unfilled > 0 && queue < (leftover / unfilled) * 100 ? 1 : 0;
    const first = Math.min(myTier, level) + bonus;
    return {
      ...base,
      stage: 'equal-rounds',
      queueCutoffPct: myUnfilled && unfilled > 0 ? Math.min(100, (leftover / unfilled) * 100) : null,
      baseLotsPerInvestor: level,
      myFirstTierLots: first,
      myExtraLots: 0,
      myLots: first,
      myRoundingBonusPossible: false,
    };
  }

  // c–e. Semua dapat jatah tahap pertama; sisa dibagi proporsional terhadap pesanan yang belum terpenuhi.
  const remaining = pool - tierDemand;
  const unfilledTotal = demand - tierDemand;
  const myUnfilled = mine - myTier;
  const extra = unfilledTotal > 0 ? Math.min(myUnfilled, Math.floor((remaining * myUnfilled) / unfilledTotal)) : 0;
  return {
    ...base,
    stage: 'proportional',
    queueCutoffPct: null,
    baseLotsPerInvestor: otherTier,
    myFirstTierLots: myTier,
    myExtraLots: extra,
    myLots: myTier + extra,
    myRoundingBonusPossible: myUnfilled > extra,
  };
}

export interface EIpoInput {
  price: number;
  totalLots: number;
  /** Tingkat pesanan penjatahan terpusat (×) terhadap alokasi minimal awal. */
  poolOversubscription: number;
  retailInvestors: number;
  nonRetailInvestors: number;
  /** Porsi lot dipesan oleh pemesan ritel (% dari seluruh pesanan penjatahan terpusat). */
  retailDemandPct: number;
  myOrderLots: number;
  myQueuePct: number;
}

export interface EIpoResult {
  allocation: PoolAllocation;
  poolDemandLots: number;
  retailDemandLots: number;
  nonRetailDemandLots: number;
  /** Rata-rata nilai pesanan per pemesan (Rp), untuk cek konsistensi asumsi. */
  avgRetailOrderRp: number;
  avgNonRetailOrderRp: number;
  /** Gambaran porsi untuk pemesan "rata-rata" (pesanan = rata-rata porsi, posisi antrean tengah). */
  retailPool: PoolResult;
  nonRetailPool: PoolResult;
  me: {
    category: 'retail' | 'non-retail';
    orderValueRp: number;
    /** Lot maksimal yang masih tergolong ritel (≤ Rp100 juta). */
    maxRetailLots: number;
    /** Lot maksimal menurut batas 10% nilai penawaran. */
    maxOrderLots: number;
    exceedsOrderCap: boolean;
    result: PoolResult;
    allottedValueRp: number;
    refundRp: number;
  };
}

export function calculateEIpo(input: EIpoInput): EIpoResult {
  const price = Math.max(0, input.price);
  const lotValue = price * SHARES_PER_LOT;
  const allocation = calculatePoolAllocation(input.totalLots, price, input.poolOversubscription);

  const poolDemandLots = Math.max(0, input.poolOversubscription) * allocation.initialLots;
  const retailShare = Math.min(100, Math.max(0, input.retailDemandPct)) / 100;
  const retailDemandLots = poolDemandLots * retailShare;
  const nonRetailDemandLots = poolDemandLots - retailDemandLots;
  const retailInvestors = Math.max(0, Math.floor(input.retailInvestors));
  const nonRetailInvestors = Math.max(0, Math.floor(input.nonRetailInvestors));

  const myOrderLots = Math.max(0, Math.floor(input.myOrderLots));
  const orderValueRp = myOrderLots * lotValue;
  const category: 'retail' | 'non-retail' = orderValueRp <= RETAIL_MAX_ORDER_RP ? 'retail' : 'non-retail';
  const maxOrderLots = lotValue > 0 ? Math.floor((allocation.offeringRp * MAX_ORDER_PCT_OF_OFFERING) / 100 / lotValue) : 0;

  const typical = (poolLots: number, investors: number, demand: number): PoolResult =>
    allocateInPool({ poolLots, investors, demandLots: demand, myOrderLots: investors > 0 ? Math.max(1, Math.round(demand / investors)) : 0, myQueuePct: 50 });

  const isRetail = category === 'retail';
  // Pesanan Anda termasuk dalam total pesanan; bila jumlah pemesan porsi Anda 0, Anda satu-satunya.
  const myPool = allocateInPool({
    poolLots: isRetail ? allocation.retailLots : allocation.nonRetailLots,
    investors: Math.max(1, isRetail ? retailInvestors : nonRetailInvestors),
    demandLots: Math.max(myOrderLots, isRetail ? retailDemandLots : nonRetailDemandLots),
    myOrderLots,
    myQueuePct: input.myQueuePct,
  });

  return {
    allocation,
    poolDemandLots,
    retailDemandLots,
    nonRetailDemandLots,
    avgRetailOrderRp: retailInvestors > 0 ? (retailDemandLots / retailInvestors) * lotValue : 0,
    avgNonRetailOrderRp: nonRetailInvestors > 0 ? (nonRetailDemandLots / nonRetailInvestors) * lotValue : 0,
    retailPool: typical(allocation.retailLots, retailInvestors, retailDemandLots),
    nonRetailPool: typical(allocation.nonRetailLots, nonRetailInvestors, nonRetailDemandLots),
    me: {
      category,
      orderValueRp,
      maxRetailLots: lotValue > 0 ? Math.floor(RETAIL_MAX_ORDER_RP / lotValue) : 0,
      maxOrderLots,
      exceedsOrderCap: myOrderLots > maxOrderLots,
      result: myPool,
      allottedValueRp: myPool.myLots * lotValue,
      refundRp: Math.max(0, myOrderLots - myPool.myLots) * lotValue,
    },
  };
}

/** Jatah untuk beberapa ukuran pesanan sekaligus (tabel strategi pesanan). */
export function compareOrderSizes(input: EIpoInput, sizes: number[]): Array<{ lots: number; category: 'retail' | 'non-retail'; allotted: number; orderValueRp: number; refundRp: number }> {
  const unique = Array.from(new Set(sizes.filter((s) => s > 0).map((s) => Math.floor(s)))).sort((a, b) => a - b);
  return unique.map((lots) => {
    const r = calculateEIpo({ ...input, myOrderLots: lots });
    return { lots, category: r.me.category, allotted: r.me.result.myLots, orderValueRp: r.me.orderValueRp, refundRp: r.me.refundRp };
  });
}

/**
 * Pesanan terkecil (1..maxLots) yang sudah memberi jatah sama dengan memesan `maxLots`.
 * Jatah tidak turun saat pesanan bertambah, jadi cukup pencarian biner.
 */
export function smallestOrderForBestAllotment(input: EIpoInput, maxLots: number): { lots: number; allotted: number } | null {
  const max = Math.floor(maxLots);
  if (max < 1) return null;
  const allottedFor = (lots: number) => calculateEIpo({ ...input, myOrderLots: lots }).me.result.myLots;
  const target = allottedFor(max);
  let lo = 1;
  let hi = max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (allottedFor(mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  return { lots: lo, allotted: target };
}

export interface ListingScenario {
  id: string;
  price: number;
  changePct: number;
  pnlRp: number;
  pnlPct: number;
}

/**
 * Untung/rugi menjual jatah IPO pada harga tertentu, setelah fee beli (bila ada) & fee jual.
 */
export function listingPnl(lots: number, ipoPrice: number, sellPrice: number, buyFeePct: number, sellFeePct: number) {
  const shares = Math.max(0, Math.floor(lots)) * SHARES_PER_LOT;
  const cost = shares * ipoPrice * (1 + Math.max(0, buyFeePct) / 100);
  const proceeds = shares * sellPrice * (1 - Math.max(0, sellFeePct) / 100);
  return { cost, proceeds, pnlRp: proceeds - cost, pnlPct: cost > 0 ? ((proceeds - cost) / cost) * 100 : 0 };
}
