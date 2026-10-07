/**
 * Kontrak sumber data pasar BEI. Semua route membaca harga lewat antarmuka ini,
 * sehingga mengganti sumber data (mis. vendor berlisensi BEI) cukup dengan
 * menambah satu implementasi provider, tanpa mengubah route maupun UI.
 */

export interface StockQuote {
  ticker: string; // Kode BEI tanpa akhiran, mis. "BBCA"
  name: string; // Nama emiten dari provider ('' bila tidak ada)
  price: number;
  previousClose: number; // Penutupan sesi sebelumnya (acuan perubahan harga)
  change: number;
  changePercent: number;
  volume: number; // Lembar saham
  marketTime: number | null; // Epoch detik transaksi terakhir
  intraday: number[]; // Harga intraday sesi terakhir (kosong bila tidak diminta)
}

export interface IndexQuote extends StockQuote {
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
}

export interface MarketDataProvider {
  /** ID untuk konfigurasi (env MARKET_DATA_PROVIDER). */
  readonly id: string;
  /** Nama yang ditampilkan ke pengguna sebagai sumber data. */
  readonly label: string;
  /** true bila data tidak real-time. */
  readonly delayed: boolean;
  /** Kutipan banyak saham sekaligus; saham yang gagal dimuat tidak disertakan. */
  getStockQuotes(tickers: string[], options?: { intraday?: boolean }): Promise<Map<string, StockQuote>>;
  /** Indeks Harga Saham Gabungan. */
  getCompositeIndex(): Promise<IndexQuote | null>;
}
