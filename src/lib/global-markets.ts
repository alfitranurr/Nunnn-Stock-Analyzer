/** Instrumen makro & global yang ditampilkan di Beranda (dipakai server & klien). */
export interface GlobalInstrument {
  symbol: string; // Simbol Yahoo
  id: string; // Label Bahasa Indonesia
  en: string; // Label English
  unit?: string;
  decimals: number;
}

export const GLOBAL_INSTRUMENTS: GlobalInstrument[] = [
  { symbol: 'IDR=X', id: 'USD/IDR', en: 'USD/IDR', decimals: 0 },
  { symbol: '^JKLQ45', id: 'LQ45', en: 'LQ45', decimals: 2 },
  { symbol: 'GC=F', id: 'Emas', en: 'Gold', unit: 'USD/oz', decimals: 1 },
  { symbol: 'BZ=F', id: 'Minyak Brent', en: 'Brent Oil', unit: 'USD/bbl', decimals: 2 },
  { symbol: 'MTF=F', id: 'Batu Bara (API2)', en: 'Coal (API2)', unit: 'USD/t', decimals: 2 },
  { symbol: '^N225', id: 'Nikkei 225', en: 'Nikkei 225', decimals: 0 },
  { symbol: '^HSI', id: 'Hang Seng', en: 'Hang Seng', decimals: 0 },
  { symbol: 'ES=F', id: 'S&P 500 Futures', en: 'S&P 500 Futures', decimals: 0 },
];
