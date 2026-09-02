'use client';

import * as React from 'react';
import { Lightbulb, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

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
    body_id: 'Bunga majemuk adalah "keajaiban dunia ke-8" menurut Einstein. Rp 10 juta dengan return 12% per tahun menjadi Rp 31 juta dalam 10 tahun tanpa tambahan modal. Mulai sedini mungkin untuk efek maksimal.',
    body_en: 'Compound interest is the "8th wonder of the world" per Einstein. Rp 10M with 12% annual return becomes Rp 31M in 10 years without additional capital. Start early for maximum effect.',
  },
  {
    id: 'bear-bull',
    title_id: 'Pasar Bear vs Bull',
    title_en: 'Bear vs Bull Market',
    body_id: 'Bull market adalah kondisi pasar yang naik (optimisme), bear market adalah penurunan pasifik (pesimisme). Investor pemodal sering takut bear market, padahal itu adalah kesempatan membeli saham bagus dengan diskon.',
    body_en: 'Bull market is rising (optimism), bear market is declining (pessimism). Long-term investors often fear bear markets, but they are actually opportunities to buy quality stocks at a discount.',
  },
  {
    id: 'broker-fee',
    title_id: 'Biaya Broker & Break-Even',
    title_en: 'Broker Fees & Break-Even',
    body_id: 'Setiap transaksi saham dikenakan fee beli (~0.15-0.19%) dan fee jual (~0.25-0.29%). Hitung break-even point sebelum entry: saham harus naik minimal 0.44% (buy+sell fee) baru Anda profit.',
    body_en: 'Each stock trade incurs buy fee (~0.15-0.19%) and sell fee (~0.25-0.29%). Calculate break-even before entry: stock must rise at least 0.44% (buy+sell fee) to profit.',
  },
];

export function EducationalTipCard({ language }: { language: 'id' | 'en' }) {
  const [tipIdx, setTipIdx] = React.useState(0);
  const isId = language === 'id';

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTipIdx(Math.floor(Math.random() * TIPS.length));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const tip = TIPS[tipIdx];

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
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              {isId ? 'Tips Investasi Hari Ini' : 'Investment Tip of the Day'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mb-1.5">
            {isId ? tip.title_id : tip.title_en}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <Quote className="h-3 w-3 text-emerald-400/40 inline mr-1 -mt-0.5 shrink-0" />
            {isId ? tip.body_id : tip.body_en}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
