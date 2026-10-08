/**
 * Sumber riwayat dividen (server). Satu request Yahoo Chart per emiten, di-cache 6 jam
 * karena data dividen hanya berubah beberapa kali setahun.
 * Tidak ada data cadangan/sintetis: bila sumber tidak punya data, hasilnya memang kosong.
 */

import { cleanCompanyName } from '@/lib/utils';
import { IDX_TICKERS } from '@/lib/tickers';
import { createTtlCache, fetchDividendHistory } from '@/lib/yahoo';
import type { DividendEvent } from '@/lib/dividend';

export interface DividendSourceData {
  ticker: string;
  companyName: string;
  events: DividendEvent[];
  yearlyAvgClose: Record<number, number>;
}

export const DIVIDEND_SOURCE = { id: 'yahoo', label: 'Yahoo Finance', delayed: true } as const;

const cache = createTtlCache<DividendSourceData | null>(6 * 60 * 60 * 1000, 400);

/** null = emiten tidak dikenal sumber data. Melempar error bila sumber gagal dan belum ada cache. */
export async function getDividendData(ticker: string): Promise<{ data: DividendSourceData | null; cachedAt: number }> {
  const { value, cachedAt } = await cache(ticker, async () => {
    const history = await fetchDividendHistory(`${ticker}.JK`);
    if (!history) return null;
    return {
      ticker,
      companyName: cleanCompanyName(history.name) || IDX_TICKERS[ticker] || ticker,
      events: history.events,
      yearlyAvgClose: history.yearlyAvgClose,
    };
  });
  return { data: value, cachedAt };
}
