import { cleanCompanyName } from '@/lib/utils';
import { fetchChartQuote, fetchQuotesWithIntraday, fetchSparkQuotes, type YahooQuote } from '@/lib/yahoo';
import type { IndexQuote, MarketDataProvider, StockQuote } from './types';

function toStockQuote(ticker: string, q: YahooQuote, intraday: boolean): StockQuote {
  return {
    ticker,
    name: q.name !== q.symbol ? cleanCompanyName(q.name) : '',
    price: q.price,
    previousClose: q.previousClose,
    change: q.change,
    changePercent: q.changePercent,
    volume: q.volume,
    marketTime: q.marketTime,
    intraday: intraday ? q.closes : [],
  };
}

/** Yahoo Finance (tidak resmi, gratis, data tertunda). */
export const yahooProvider: MarketDataProvider = {
  id: 'yahoo',
  label: 'Yahoo Finance',
  delayed: true,

  async getStockQuotes(tickers, { intraday = false } = {}) {
    const symbols = tickers.map((t) => `${t}.JK`);
    const raw = intraday
      ? await fetchQuotesWithIntraday(symbols, '5m')
      : await fetchSparkQuotes(symbols, { range: '5d', interval: '1d' });

    const quotes = new Map<string, StockQuote>();
    for (const q of raw.values()) {
      const ticker = q.symbol.replace(/\.JK$/i, '').toUpperCase();
      quotes.set(ticker, toStockQuote(ticker, q, intraday));
    }
    return quotes;
  },

  async getCompositeIndex() {
    // Acuan & high/low dari bar harian; grafik dari bar 5 menit sesi terakhir.
    const [daily, intraday] = await Promise.all([
      fetchChartQuote('^JKSE', { range: '5d', interval: '1d' }),
      fetchSparkQuotes(['^JKSE'], { range: '1d', interval: '5m' }),
    ]);
    if (!daily) return null;
    const quote: IndexQuote = {
      ...toStockQuote('IHSG', daily, false),
      name: 'Indeks Harga Saham Gabungan',
      intraday: intraday.get('^JKSE')?.closes ?? [],
      dayHigh: daily.dayHigh,
      dayLow: daily.dayLow,
      yearHigh: daily.yearHigh,
      yearLow: daily.yearLow,
    };
    return quote;
  },
};
