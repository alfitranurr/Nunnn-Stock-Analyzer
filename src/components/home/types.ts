export type Lang = 'id' | 'en';

export interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  limit: 'ARA' | 'ARB' | null;
}

export type MoverCategory = 'gainers' | 'losers' | 'value' | 'volume';

/** Respons GET /api/market-summary */
export interface MarketSummaryData {
  ihsg: {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    yearHigh: number;
    yearLow: number;
    marketTime: number | null;
    intraday: number[];
  };
  breadth: {
    advancers: number;
    decliners: number;
    unchanged: number;
    ara: number;
    arb: number;
    totalValue: number;
    /** Saham yang tidak bertransaksi pada sesi terakhir (tidak ikut naik/turun/tetap). */
    notTraded?: number;
  };
  movers: Record<MoverCategory, StockMover[]>;
  minValue: number;
  totalScanned: number;
  notTraded?: Array<{ symbol: string; lastTradeDate: string | null }>;
  /** Saham yang dilewati karena datanya tidak lolos pengecekan kewajaran. */
  dataQuality: { excludedCount: number; excluded: Array<{ symbol: string; issue: string }> };
  source: { id: string; label: string; delayed: boolean };
  scannedAt: string;
}
