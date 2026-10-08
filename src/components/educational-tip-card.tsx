'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MarketSummaryData } from '@/components/home/types';

interface Tip {
  id: string;
  title_id: string;
  title_en: string;
  body_id: string;
  body_en: string;
}

const TIPS: Tip[] = [
  {
    id: 'pe-ratio',
    title_id: 'Memahami P/E Ratio',
    title_en: 'Understanding P/E Ratio',
    body_id: 'P/E Ratio membandingkan harga saham dengan laba per saham. P/E rendah bisa berarti saham undervalued, tapi bisa juga karena pertumbuhan yang lambat. Selalu bandingkan dengan P/E rata-rata sektor industri.',
    body_en: 'P/E Ratio compares stock price to earnings per share. A low P/E may indicate an undervalued stock, but could also signal slow growth. Always compare with the sector average P/E.',
  },
  {
    id: 'dca',
    title_id: 'Dollar Cost Averaging (DCA)',
    title_en: 'Dollar Cost Averaging (DCA)',
    body_id: 'Strategi DCA adalah membeli saham secara berkala dengan nominal tetap, terlepas dari kondisi pasar. Ini mengurangi risiko timing market dan memanfaatkan volatilitas untuk harga rata-rata yang lebih baik.',
    body_en: 'DCA strategy means buying stocks regularly with a fixed amount, regardless of market conditions. This reduces timing risk and leverages volatility for a better average price.',
  },
  {
    id: 'dividend',
    title_id: 'Dividen vs Capital Gain',
    title_en: 'Dividend vs Capital Gain',
    body_id: 'Dividen adalah pembagian laba perusahaan kepada pemegang saham, sementara capital gain adalah keuntungan dari selisih harga jual dan beli. Investor jangka panjang sering mengandalkan dividen untuk passive income.',
    body_en: 'Dividends are profit distributions to shareholders, while capital gain is profit from price difference. Long-term investors often rely on dividends for passive income.',
  },
  {
    id: 'risk-management',
    title_id: 'Manajemen Risiko Portofolio',
    title_en: 'Portfolio Risk Management',
    body_id: 'Jangan menaruh semua modal di satu saham. Diversifikasi minimal 5-10 saham di sektor berbeda untuk mengurangi risiko idiosinkratik. Atur juga rasio kas (RDN) minimal 10-20% untuk peluang market crash.',
    body_en: 'Never put all capital in one stock. Diversify across 5-10 stocks in different sectors to reduce idiosyncratic risk. Keep at least 10-20% cash for market crash opportunities.',
  },
  {
    id: 'average-down',
    title_id: 'Strategi Average Down',
    title_en: 'Average Down Strategy',
    body_id: 'Average down adalah membeli tambahan saham saat harga turun untuk menurunkan harga rata-rata. Efektif untuk saham fundamental bagus, tapi berbahaya untuk saham yang trennya menurun terus. Tentukan cutoff loss.',
    body_en: 'Averaging down means buying more shares when price drops to lower your average cost. Effective for fundamentally strong stocks, but risky for stocks in a downtrend. Always set a cutoff loss.',
  },
  {
    id: 'compounding',
    title_id: 'Kekuatan Bunga Majemuk',
    title_en: 'The Power of Compounding',
    body_id: 'Bunga majemuk membuat keuntungan ikut menghasilkan keuntungan. Rp 10 juta dengan return 12% per tahun menjadi sekitar Rp 31 juta dalam 10 tahun tanpa tambahan modal. Semakin awal mulai, semakin besar efeknya.',
    body_en: 'Compounding means your returns start earning returns too. Rp 10M at 12% a year grows to about Rp 31M in 10 years without adding capital. The earlier you start, the bigger the effect.',
  },
  {
    id: 'bear-bull',
    title_id: 'Pasar Bear vs Bull',
    title_en: 'Bear vs Bull Market',
    body_id: 'Bull market adalah kondisi pasar yang naik (optimisme), bear market adalah penurunan berkepanjangan (pesimisme). Banyak investor takut saat bear market, padahal itu bisa menjadi kesempatan membeli saham bagus dengan harga diskon.',
    body_en: 'Bull market is rising (optimism), bear market is declining (pessimism). Long-term investors often fear bear markets, but they are actually opportunities to buy quality stocks at a discount.',
  },
  {
    id: 'fomo-ara',
    title_id: 'Hati-hati Mengejar Saham ARA',
    title_en: 'Careful Chasing ARA Stocks',
    body_id: 'Saham yang menyentuh ARA sering dibuka gap naik lalu berbalik tajam. Cek dulu nilai transaksi (likuiditas), alasan kenaikan, dan siapkan batas rugi. Antre di harga ARA berarti membeli di harga tertinggi hari itu.',
    body_en: 'Stocks that hit ARA often gap up and then reverse sharply. Check traded value (liquidity), the reason for the move and set a stop first. Queueing at the ARA price means buying at the day\'s highest price.',
  },
  {
    id: 'take-profit',
    title_id: 'Disiplin Ambil Untung',
    title_en: 'Take-Profit Discipline',
    body_id: 'Saat pasar menguat, tentukan target jual sebelum euforia: misalnya jual sebagian di resistance terdekat dan geser batas rugi ke harga beli. Profit yang belum direalisasi masih bisa hilang.',
    body_en: 'When the market rallies, set sell targets before euphoria sets in: e.g. sell part at the nearest resistance and move your stop to break-even. Unrealised profit can still disappear.',
  },
  {
    id: 'broker-fee',
    title_id: 'Biaya Broker & Break-Even',
    title_en: 'Broker Fees & Break-Even',
    body_id: 'Setiap transaksi saham dikenakan fee beli (~0,15–0,19%) dan fee jual (~0,25–0,29%). Hitung break-even sebelum entry: harga harus naik sekitar 0,40–0,48% (fee beli + jual) sebelum Anda benar-benar profit.',
    body_en: 'Each stock trade incurs a buy fee (~0.15–0.19%) and a sell fee (~0.25–0.29%). Calculate break-even before entry: the price must rise about 0.40–0.48% (buy + sell fee) before you actually profit.',
  },
];

/** Tips yang paling relevan dengan kondisi pasar saat ini, beserta alasannya. Null = tidak ada kondisi khusus. */
function contextualTip(market: MarketSummaryData | null | undefined, isId: boolean): { id: string; reason: string } | null {
  if (!market) return null;
  const { ihsg, breadth } = market;
  const chg = ihsg.changePercent;
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', isId ? ',' : '.')}%`;
  if (breadth.ara >= 15) {
    return { id: 'fomo-ara', reason: isId ? `${breadth.ara} saham menyentuh ARA hari ini.` : `${breadth.ara} stocks hit ARA today.` };
  }
  if (chg <= -1 || breadth.decliners > breadth.advancers * 2) {
    return {
      id: breadth.arb >= 10 ? 'risk-management' : 'average-down',
      reason: isId
        ? `IHSG ${fmt(chg)}, ${breadth.decliners} saham turun vs ${breadth.advancers} naik.`
        : `IHSG ${fmt(chg)}, ${breadth.decliners} decliners vs ${breadth.advancers} advancers.`,
    };
  }
  if (chg >= 1 || breadth.advancers > breadth.decliners * 2) {
    return { id: 'take-profit', reason: isId ? `IHSG ${fmt(chg)}, mayoritas saham naik.` : `IHSG ${fmt(chg)}, most stocks are up.` };
  }
  return null;
}

export function EducationalTipCard({ language, market }: { language: 'id' | 'en'; market?: MarketSummaryData | null }) {
  const isId = language === 'id';
  const context = contextualTip(market, isId);
  // `offset` = geseran manual dari tips utama (tombol ←/→); tips utama mengikuti kondisi pasar.
  const [offset, setOffset] = React.useState(0);
  const [randomBase, setRandomBase] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setRandomBase(Math.floor(Math.random() * TIPS.length));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const baseIdx = context ? Math.max(0, TIPS.findIndex((t) => t.id === context.id)) : randomBase;
  const tipIdx = (((baseIdx + offset) % TIPS.length) + TIPS.length) % TIPS.length;
  const tip = TIPS[tipIdx];
  const showReason = context && offset === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/[0.04] to-blue-500/[0.02] border border-emerald-500/10 p-5"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-[60px] pointer-events-none" />

      <div className="relative z-10 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Lightbulb className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              {showReason ? (isId ? 'Tips Sesuai Kondisi Pasar' : 'Tip for Today\'s Market') : isId ? 'Tips Investasi Hari Ini' : 'Investment Tip of the Day'}
            </span>
            <span className="flex items-center gap-0.5">
              <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={isId ? 'Tips sebelumnya' : 'Previous tip'} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/5 cursor-pointer">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[9px] font-bold text-slate-500 tabular-nums">{tipIdx + 1}/{TIPS.length}</span>
              <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={isId ? 'Tips berikutnya' : 'Next tip'} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/5 cursor-pointer">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tip.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              {showReason && <p className="text-[10px] font-semibold text-amber-300/90 mb-1">{context.reason}</p>}
              <h3 className="text-sm font-bold text-white mb-1.5">
                {isId ? tip.title_id : tip.title_en}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                <Quote className="h-3 w-3 text-emerald-400/40 inline mr-1 -mt-0.5 shrink-0" />
                {isId ? tip.body_id : tip.body_en}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
