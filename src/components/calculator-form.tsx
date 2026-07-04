'use client';

import * as React from 'react';
import { Sparkles, Info, Plus, Trash2, RefreshCw } from 'lucide-react';
import { AvgDownInput, PurchaseTranche } from '@/lib/calculator';
import { motion, AnimatePresence } from 'framer-motion';
import { cleanCompanyName } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

interface CalculatorFormProps {
  onCalculate: (values: AvgDownInput) => void;
  onSavePlan?: (title: string) => void;
  isSaving?: boolean;
  user?: any;
  initialValues?: {
    ticker: string;
    company_name?: string;
    lot_awal: number;
    avg_price_awal: number;
    current_price: number;
    lot_baru: number;
    harga_beli_baru: number;
    fee_beli: number;
    fee_jual: number;
    avgPriceAwalIncludesFee?: boolean;
    tranches?: Array<{ id: string; lot: number; price: number }>;
  } | null;
}

// Database emiten BEI populer untuk deteksi otomatis nama perusahaan secara instan
const TICKER_DATABASE: Record<string, string> = {
  // Perbankan
  'BBCA': 'Bank Central Asia Tbk',
  'BBRI': 'Bank Rakyat Indonesia Tbk',
  'BMRI': 'Bank Mandiri Tbk',
  'BBNI': 'Bank Negara Indonesia Tbk',
  'BBTN': 'Bank Tabungan Negara Tbk',
  'BDMN': 'Bank Danamon Indonesia Tbk',
  'BRIS': 'Bank Syariah Indonesia Tbk',
  'ARTO': 'Bank Jago Tbk',
  'BBYB': 'Bank Neo Commerce Tbk',
  'MEGA': 'Bank Mega Tbk',
  'PNBN': 'Bank Pan Indonesia Tbk',
  
  // Pertambangan & Energi
  'ANTM': 'Aneka Tambang Tbk',
  'CUAN': 'Petrindo Jaya Kreasi Tbk',
  'ADRO': 'Adaro Energy Indonesia Tbk',
  'ADMR': 'Adaro Minerals Indonesia Tbk',
  'PTBA': 'Bukit Asam Tbk',
  'HRUM': 'Harum Energy Tbk',
  'ITMG': 'Indo Tambangraya Megah Tbk',
  'INDY': 'Indika Energy Tbk',
  'MEDC': 'Medco Energi Internasional Tbk',
  'PGAS': 'Perusahaan Gas Negara Tbk',
  'BUMI': 'Bumi Resources Tbk',
  'BRMS': 'Bumi Resources Minerals Tbk',
  'DOID': 'Delta Dunia Makmur Tbk',
  'AKRA': 'AKR Corporindo Tbk',
  'MBMA': 'Merdeka Battery Materials Tbk',
  'NCKL': 'Trimegah Bangun Persada Tbk',
  'MDKA': 'Merdeka Copper Gold Tbk',
  'TPIA': 'Chandra Asri Pacific Tbk',
  'BRPT': 'Barito Pacific Tbk',
  'BREN': 'Barito Renewables Energy Tbk',
  'AMMN': 'Amman Mineral Internasional Tbk',
  'PGEO': 'Pertamina Geothermal Energy Tbk',
  
  // Infrastruktur, Telko & Utilitas
  'TLKM': 'Telkom Indonesia Tbk',
  'ISAT': 'Indosat Ooredoo Hutchison Tbk',
  'EXCL': 'XL Axiata Tbk',
  'FREN': 'Smartfren Telecom Tbk',
  'TOWR': 'Sarana Menara Nusantara Tbk',
  'TBIG': 'Tower Bersama Infrastructure Tbk',
  'JSMR': 'Jasa Marga Tbk',
  'WIKA': 'Wijaya Karya Tbk',
  'PTPP': 'PP (Persero) Tbk',
  'ADHI': 'Adhi Karya Tbk',
  
  // Consumer Goods & Health
  'UNVR': 'Unilever Indonesia Tbk',
  'ICBP': 'Indofood CBP Sukses Makmur Tbk',
  'INDF': 'Indofood Sukses Makmur Tbk',
  'MYOR': 'Mayora Indah Tbk',
  'KLBF': 'Kalbe Farma Tbk',
  'SIDO': 'Industri Jamu dan Farmasi Sido Muncul Tbk',
  'GGRM': 'Gudang Gram Tbk',
  'HMSP': 'Hanjaya Mandala Sampoerna Tbk',
  'CPIN': 'Charoen Pokphand Indonesia Tbk',
  'JPFA': 'Japfa Comfeed Indonesia Tbk',
  'MIKA': 'Mitra Keluarga Karyasehat Tbk',
  'HEAL': 'Medikaloka Hermina Tbk',
  'SILO': 'Siloam International Hospitals Tbk',
  
  // Retail & Perdagangan
  'MAPI': 'Mitra Adiperkasa Tbk',
  'MAPA': 'MAP Active Adiperkasa Tbk',
  'ACES': 'Aspirasi Hidup Indonesia Tbk',
  'LPPF': 'Matahari Department Store Tbk',
  'ERAA': 'Erajaya Swasembada Tbk',
  'AMRT': 'Sumber Alfaria Trijaya Tbk (Alfamart)',
  
  // Otomotif & Konglomerasi
  'ASII': 'Astra International Tbk',
  'AUTO': 'Astra Otoparts Tbk',
  'ASSA': 'Adi Sarana Armada Tbk',
  'MPMX': 'Mitra Pinasthika Mustika Tbk',
  
  // Properti & Real Estate
  'BSDE': 'Bumi Serpong Damai Tbk',
  'PWON': 'Pakuwon Jati Tbk',
  'SMRA': 'Summarecon Agung Tbk',
  'CTRA': 'Ciputra Development Tbk',
  'ASRI': 'Alam Sutera Realty Tbk',
  
  // Teknologi & Media
  'GOTO': 'GoTo Gojek Tokopedia Tbk',
  'BUKA': 'Bukalapak.com Tbk',
  'BELI': 'Global Digital Niaga Tbk (Blibli)',
  'EMTKB': 'Elang Mahkota Teknologi Tbk',
  'SCMA': 'Surya Citra Media Tbk',
  'JELI': 'PT Niramas Utama Tbk (INACO)',
  
  // Transportasi & Logistik
  'BIRD': 'Blue Bird Tbk',
  'SMDR': 'Samudera Indonesia Tbk',
  'TMAS': 'Temas Tbk',
};

// Helper functions for parsing and formatting numbers typed by the user
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().trim();
  
  // Remove currency symbols, spaces, and other non-numeric formatting characters
  clean = clean.replace(/[Rp$\s]/g, '');

  const hasComma = clean.includes(',');
  const hasPeriod = clean.includes('.');

  if (hasComma && !hasPeriod) {
    // If there is a comma and no period, and it ends with a comma followed by 3 digits (e.g. "700,000")
    // or has multiple commas (e.g. "1,250,000")
    if (/,\d{3}(?:,\d{3})*$/.test(clean) || (clean.match(/,/g) || []).length > 1) {
      clean = clean.replace(/,/g, '');
    } else {
      // Otherwise treat as decimal separator (e.g. "12,5")
      clean = clean.replace(/,/g, '.');
    }
  } else if (hasPeriod && !hasComma) {
    // If there is a period and no comma, and it ends with a period followed by 3 digits (e.g. "700.000")
    // or has multiple periods (e.g. "1.250.000")
    if (/\.\d{3}(?:\.\d{3})*$/.test(clean) || (clean.match(/\./g) || []).length > 1) {
      clean = clean.replace(/\./g, '');
    }
  } else if (hasComma && hasPeriod) {
    // Both exist (e.g., "1,250.50" or "1.250,50")
    const commaIndex = clean.lastIndexOf(',');
    const periodIndex = clean.lastIndexOf('.');
    if (commaIndex > periodIndex) {
      // Comma is the decimal separator (e.g., "1.250,50")
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Period is the decimal separator (e.g., "1,250.50")
      clean = clean.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberForInput = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '';
  const parsed = typeof num === 'number' ? num : parseFloat(num.toString().replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(parsed);
};

const BROKER_PRESETS = [
  { id: 'stockbit', name: 'Stockbit', buy: 0.15, sell: 0.25 },
  { id: 'ajaib', name: 'Ajaib', buy: 0.15, sell: 0.25 },
  { id: 'ipot', name: 'IPOT (Indo Premier)', buy: 0.19, sell: 0.29 },
  { id: 'custom', name: 'Custom Fee', buy: 0.20, sell: 0.30 }
];

function FormEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  const [prevSymbol, setPrevSymbol] = React.useState(symbol);
  
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setHasError(false);
  }

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) {
    return (
      <div className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-slate-100/5 border border-white/10 flex items-center justify-center shrink-0">
        <span className="font-extrabold text-[9px] text-slate-500">IDX</span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
      {!hasError ? (
        <img
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          className="w-7 h-7 md:w-6 md:h-6 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[10px] md:text-[11px] text-emerald-400">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function CalculatorForm({ onCalculate, onSavePlan, isSaving = false, user, initialValues }: CalculatorFormProps) {
  const { t, language } = useLanguage();
  const [ticker, setTicker] = React.useState('ANTM');
  const [companyName, setCompanyName] = React.useState('Aneka Tambang Tbk');
  const [lotAwal, setLotAwal] = React.useState<string>('10');
  const [avgPriceAwal, setAvgPriceAwal] = React.useState<string>('3,200');
  const [currentPrice, setCurrentPrice] = React.useState<string>('2,900');
  
  const [tranches, setTranches] = React.useState<Array<{ id: string; lot: string; price: string }>>([
    { id: '1', lot: '15', price: '2,800' }
  ]);
  
  const [brokerPreset, setBrokerPreset] = React.useState('stockbit');
  const [feeBeli, setFeeBeli] = React.useState(0.15);
  const [feeJual, setFeeJual] = React.useState(0.25);
  const [includeFees, setIncludeFees] = React.useState(true);
  
  // Custom configurations and loading states
  const [avgPriceAwalIncludesFee, setAvgPriceAwalIncludesFee] = React.useState(true);
  const [isFetchingTicker, setIsFetchingTicker] = React.useState(false);
  const [fetchingTrancheId, setFetchingTrancheId] = React.useState<string | null>(null);
  
  const isLoadedPlanRef = React.useRef(false);
  const prevCurrentPriceRef = React.useRef(currentPrice);


  React.useEffect(() => {
    if (initialValues) {
      isLoadedPlanRef.current = true;
      const timer = setTimeout(() => {
        setTicker(initialValues.ticker);
        setCompanyName(cleanCompanyName(initialValues.company_name) || TICKER_DATABASE[initialValues.ticker] || '');
        setLotAwal(formatNumberForInput(initialValues.lot_awal));
        setAvgPriceAwal(formatNumberForInput(initialValues.avg_price_awal));
        setCurrentPrice(formatNumberForInput(initialValues.current_price));
        if (initialValues.tranches && initialValues.tranches.length > 0) {
          setTranches(initialValues.tranches.map(t => ({
            id: t.id || crypto.randomUUID(),
            lot: formatNumberForInput(t.lot),
            price: formatNumberForInput(t.price)
          })));
        } else {
          setTranches([
            { 
              id: '1', 
              lot: formatNumberForInput(initialValues.lot_baru), 
              price: formatNumberForInput(initialValues.harga_beli_baru) 
            }
          ]);
        }
        setFeeBeli(initialValues.fee_beli);
        setFeeJual(initialValues.fee_jual);
        setIncludeFees(initialValues.fee_beli > 0 || initialValues.fee_jual > 0);
        setAvgPriceAwalIncludesFee(initialValues.avgPriceAwalIncludesFee !== false);
        
        const matchedPreset = BROKER_PRESETS.find(p => p.buy === initialValues.fee_beli && p.sell === initialValues.fee_jual);
        if (matchedPreset) {
          setBrokerPreset(matchedPreset.id);
        } else if (initialValues.fee_beli === 0 && initialValues.fee_jual === 0) {
          setBrokerPreset('none');
        } else {
          setBrokerPreset('custom');
        }
        
        // Reset plan loaded flag after rendering
        setTimeout(() => {
          isLoadedPlanRef.current = false;
        }, 500);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialValues]);

  const fetchRemoteTicker = React.useCallback(async (symbol: string) => {
    setIsFetchingTicker(true);
    try {
      const res = await fetch(`/api/ticker?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setCompanyName(data.name);
        }
        if (data.price !== undefined && data.price !== null) {
          setCurrentPrice(formatNumberForInput(data.price));
        }
      }
    } catch (err) {
      console.error('Error fetching remote ticker data:', err);
    } finally {
      setIsFetchingTicker(false);
    }
  }, []);

  // Mengambil nama emiten & harga secara real-time dari internet (Yahoo Finance) atau database lokal
  React.useEffect(() => {
    const val = ticker.toUpperCase().trim();
    const timer = setTimeout(() => {
      if (val.length >= 4) {
        if (TICKER_DATABASE[val]) {
          setCompanyName(TICKER_DATABASE[val]);
        }
        fetchRemoteTicker(val);
      } else {
        setCompanyName('');
        setCurrentPrice('');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [ticker, fetchRemoteTicker]);

  const handleRefreshPrice = React.useCallback(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      fetchRemoteTicker(val);
    }
  }, [ticker, fetchRemoteTicker]);

  const handleRefreshTranchePrice = async (trancheId: string) => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      setFetchingTrancheId(trancheId);
      try {
        const res = await fetch(`/api/ticker?symbol=${val}`);
        if (res.ok) {
          const data = await res.json();
          if (data.price !== undefined && data.price !== null) {
            const formattedPrice = formatNumberForInput(data.price);
            setCurrentPrice(formattedPrice);
            
            // Set the price of this specific tranche
            setTranches(prev => prev.map(t => 
              t.id === trancheId ? { ...t, price: formattedPrice } : t
            ));
            return;
          }
        }
      } catch (err) {
        console.error('Error refreshing tranche price:', err);
      } finally {
        setFetchingTrancheId(null);
      }
    }
    
    // Fallback: copy currentPrice if api fetch fails or symbol is invalid
    if (currentPrice) {
      setTranches(prev => prev.map(t => 
        t.id === trancheId ? { ...t, price: currentPrice } : t
      ));
    }
  };

  // Automatically sync tranche prices to currentPrice if they are not customized
  React.useEffect(() => {
    const oldPrice = prevCurrentPriceRef.current;
    const newPrice = currentPrice;
    prevCurrentPriceRef.current = newPrice;
    
    if (isLoadedPlanRef.current) return;
    
    if (newPrice !== oldPrice) {
      setTranches(prev => prev.map(t => {
        if (!t.price || t.price === oldPrice || oldPrice === '' || t.price === '2,800') {
          return { ...t, price: newPrice };
        }
        return t;
      }));
    }
  }, [currentPrice]);

  // Trigger calculation on input changes
  React.useEffect(() => {
    const parsedTranches = tranches.map(t => ({
      id: t.id,
      lot: parseFormattedNumber(t.lot),
      price: parseFormattedNumber(t.price)
    }));

    // Calculate total lots and weighted average price of new buys to support legacy bindings
    let totalLots = 0;
    let totalCost = 0;
    parsedTranches.forEach(t => {
      totalLots += t.lot;
      totalCost += t.lot * t.price;
    });
    const weightedPrice = totalLots > 0 ? totalCost / totalLots : 0;

    const calculationInput: AvgDownInput = {
      ticker: ticker || 'IDX',
      companyName: companyName,
      lotAwal: parseFormattedNumber(lotAwal),
      avgPriceAwal: parseFormattedNumber(avgPriceAwal),
      currentPrice: parseFormattedNumber(currentPrice),
      lotBaru: totalLots,
      hargaBeliBaru: weightedPrice,
      feeBeli: includeFees ? Number(feeBeli) : 0,
      feeJual: includeFees ? Number(feeJual) : 0,
      includeFees,
      avgPriceAwalIncludesFee,
      tranches: parsedTranches
    };
    onCalculate(calculationInput);
  }, [
    ticker, companyName, lotAwal, avgPriceAwal, currentPrice, 
    tranches, feeBeli, feeJual, includeFees, avgPriceAwalIncludesFee,
    onCalculate
  ]);

  const handleAddTranche = () => {
    setTranches([
      ...tranches,
      { id: crypto.randomUUID(), lot: '', price: currentPrice || '' }
    ]);
  };

  const handleRemoveTranche = (id: string) => {
    if (tranches.length <= 1) return;
    setTranches(tranches.filter(t => t.id !== id));
  };

  const handleTrancheChange = (id: string, field: 'lot' | 'price', value: string) => {
    setTranches(tranches.map(t => {
      if (t.id === id) {
        const cleanVal = field === 'lot' ? value.replace(/[^0-9]/g, '') : value.replace(/[^0-9.,]/g, '');
        return { ...t, [field]: cleanVal };
      }
      return t;
    }));
  };

  const handleTrancheBlur = (id: string, field: 'lot' | 'price') => {
    setTranches(tranches.map(t => {
      if (t.id === id) {
        return { ...t, [field]: formatNumberForInput(t[field]) };
      }
      return t;
    }));
  };


  const handlePresetChange = (presetId: string) => {
    setBrokerPreset(presetId);
    if (presetId === 'none') {
      setIncludeFees(false);
      setFeeBeli(0);
      setFeeJual(0);
    } else {
      setIncludeFees(true);
      const selected = BROKER_PRESETS.find(p => p.id === presetId);
      if (selected) {
        setFeeBeli(selected.buy);
        setFeeJual(selected.sell);
      }
    }
  };

  const handleBlur = (val: string, setter: (val: string) => void) => {
    if (!val) return;
    setter(formatNumberForInput(val));
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePlan) {
      onSavePlan(`Rencana Avg Down ${ticker}`);
    }
  };

  return (
    <div className="glass-card p-5 md:p-6 w-full flex flex-col gap-4">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200/50 dark:border-white/5 pb-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
            {t('calculator.title')}
          </h2>
        </div>
      </div>

      {/* Responsive Form Layout with Consistent Sub-Cards */}
      <form onSubmit={handleSaveClick} className="flex flex-col gap-5 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5 items-stretch w-full">
          
          {/* Sub-Card Step 1: Ticker & Nama Emiten */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all duration-300 space-y-4 flex flex-col justify-between min-w-0 w-full">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                {t('calculator.step1')}
              </label>
              <div className="flex gap-2.5 items-center">
                
                {/* Logo Emiten */}
                <FormEmitenLogo symbol={ticker} />

                {/* Kotak Ticker */}
                <div className="w-1/3 relative">
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value.toUpperCase());
                    }}
                    placeholder="ANTM"
                    className="w-full text-center font-bold tracking-wider glass-input px-2.5 py-2.5 text-xs uppercase"
                    required
                  />
                </div>
                
                {/* Kotak Nama Perusahaan */}
                <div className="w-2/3">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('calculator.placeholderCompany')}
                    className={`w-full glass-input px-3 py-2.5 text-xs font-semibold placeholder:text-slate-500/50 transition-all duration-300 ${
                      isFetchingTicker ? 'animate-pulse text-slate-400 bg-slate-100/5 dark:bg-white/5 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Card Step 2: Posisi Portofolio Awal */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all duration-300 space-y-4 flex flex-col justify-between min-w-0 w-full">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                {t('calculator.step2')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="text"
                    value={lotAwal}
                    onChange={(e) => setLotAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(lotAwal, setLotAwal)}
                    placeholder={t('calculator.lotAwal')}
                    className="w-full glass-input px-1.5 py-2.5 text-xs text-center font-semibold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.lotAwal')}</span>
                </div>
                <div>
                  <input
                    type="text"
                    value={avgPriceAwal}
                    onChange={(e) => setAvgPriceAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(avgPriceAwal, setAvgPriceAwal)}
                    placeholder="Avg Price"
                    className="w-full glass-input px-1.5 py-2.5 text-xs text-center font-semibold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.avgPrice').replace(' (Rp)', '')} (Rp)</span>
                </div>
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                      onBlur={() => handleBlur(currentPrice, setCurrentPrice)}
                      placeholder="Harga Sekarang"
                      className={`w-full glass-input pl-1.5 pr-7 py-2.5 text-xs text-center font-semibold transition-all duration-300 ${
                        isFetchingTicker ? 'animate-pulse text-slate-400 bg-slate-100/5 dark:bg-white/5 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : ''
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleRefreshPrice}
                      disabled={isFetchingTicker || ticker.toUpperCase().trim().length < 4}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Refresh Harga Sekarang"
                    >
                      <RefreshCw className={`h-3 w-3 ${isFetchingTicker ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.currentPrice').replace(' (Rp)', '')} (Rp)</span>
                </div>
              </div>
            </div>
            
            {/* Checkbox Penyesuaian Fee Beli Awal */}
            {includeFees ? (
              <div className="flex items-center gap-2 pt-1 animate-fadeIn select-none">
                <input
                  type="checkbox"
                  id="avgPriceAwalIncludesFee"
                  checked={avgPriceAwalIncludesFee}
                  onChange={(e) => setAvgPriceAwalIncludesFee(e.target.checked)}
                  className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500 bg-black/40 h-3.5 w-3.5 cursor-pointer"
                />
                <label 
                  htmlFor="avgPriceAwalIncludesFee" 
                  className="text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer transition-colors font-semibold leading-none"
                >
                  {t('calculator.includingFeeCheckbox')}
                </label>
              </div>
            ) : null}
          </div>

          {/* Sub-Card Step 3: Rencana Pembelian Baru */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all duration-300 space-y-4 flex flex-col justify-between min-w-0 w-full">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                {t('calculator.step3')}
              </label>
              
              {tranches.length > 0 && (
                <div className="flex items-center gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span className="w-12 shrink-0">{t('calculator.tahap')}</span>
                  <span className="flex-1 text-center">{t('calculator.trancheLot')}</span>
                  <span className="flex-2 text-center pr-6">{t('calculator.tranchePrice')}</span>
                  {tranches.length > 1 && <span className="w-8 shrink-0" />}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {tranches.map((tranche, index) => (
                    <motion.div
                      key={tranche.id}
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 overflow-hidden py-0.5 shrink-0"
                    >
                      <span className="text-[10px] font-bold text-slate-400 w-12 shrink-0">
                        {t('calculator.tahap')} {index + 1}
                      </span>

                      <div className="flex-1 min-w-[60px]">
                        <input
                          type="text"
                          value={tranche.lot}
                          onChange={(e) => handleTrancheChange(tranche.id, 'lot', e.target.value)}
                          onBlur={() => handleTrancheBlur(tranche.id, 'lot')}
                          placeholder={t('calculator.trancheLot')}
                          className="w-full glass-input px-1.5 py-2 text-xs text-center font-semibold border-emerald-500/10 focus:border-emerald-500 bg-black/20"
                          required
                        />
                      </div>

                      <div className="flex-2 min-w-[90px] relative">
                        <input
                          type="text"
                          value={tranche.price}
                          onChange={(e) => handleTrancheChange(tranche.id, 'price', e.target.value)}
                          onBlur={() => handleTrancheBlur(tranche.id, 'price')}
                          placeholder={t('calculator.tranchePrice')}
                          className="w-full glass-input pl-2 pr-7 py-2 text-xs text-center font-semibold border-emerald-500/10 focus:border-emerald-500 bg-black/20"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRefreshTranchePrice(tranche.id)}
                          disabled={fetchingTrancheId !== null || isFetchingTicker || ticker.toUpperCase().trim().length < 4}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Set / Refresh Harga saat ini"
                        >
                          <RefreshCw className={`h-3 w-3 ${(fetchingTrancheId === tranche.id || isFetchingTicker) ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {tranches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTranche(tranche.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Hapus Tahap Ini"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddTranche}
              className="mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs transition-all cursor-pointer select-none"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('calculator.addTranche')}
            </button>
          </div>

          {/* Sub-Card Step 4: Broker Fee Settings */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all duration-300 space-y-4 flex flex-col justify-between min-w-0 w-full">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                {t('calculator.step4')}
              </label>
              <select
                value={brokerPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full glass-input px-3 py-2.5 text-xs font-semibold cursor-pointer text-foreground bg-background rounded-xl"
              >
                <option value="stockbit">Stockbit ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                <option value="ajaib">Ajaib ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                <option value="ipot">IPOT ({t('calculator.feeBeli')} 0.19% / {t('calculator.feeJual')} 0.29%)</option>
                <option value="custom">{t('calculator.presetCustom')}</option>
                <option value="none">{t('calculator.presetNone')}</option>
              </select>
              
              {brokerPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mt-2 animate-fadeIn">
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={feeBeli}
                        onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)}
                        className="w-full glass-input pl-2 pr-5 py-2 text-xs text-center font-semibold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <span className="text-[9px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.feeBeli')}</span>
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={feeJual}
                        onChange={(e) => setFeeJual(parseFloat(e.target.value) || 0)}
                        className="w-full glass-input pl-2 pr-5 py-2 text-xs text-center font-semibold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <span className="text-[9px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.feeJual')}</span>
                  </div>
                </div>
              )}
            </div>
            
            <span className="text-[10px] text-slate-400 text-center block font-medium">
              {includeFees 
                ? (language === 'id' ? 'Potongan fee dihitung' : 'Fees calculation included') 
                : (language === 'id' ? 'Murni tanpa biaya broker' : 'Purely without broker fees')}
            </span>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200/50 dark:border-white/5 w-full">
          <button
            type="submit"
            disabled={
              isSaving ||
              parseFormattedNumber(lotAwal) <= 0 ||
              parseFormattedNumber(avgPriceAwal) <= 0 ||
              tranches.some(t => parseFormattedNumber(t.lot) <= 0 || parseFormattedNumber(t.price) <= 0)
            }
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs transition-all duration-300 shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : null}
            <span>{user ? t('common.save') : t('common.saveLocal')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
