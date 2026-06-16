'use client';

import * as React from 'react';
import { 
  Sparkles, 
  Info, 
  Save, 
  Trash2, 
  Coins,
  TrendingUp,
  User,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Percent,
  Calculator,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { calculateEIpoAllotment, getGolongan, getInitialAllocationConfig, EIpoInput, EIpoResult } from '@/lib/e-ipo';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { cleanCompanyName } from '@/lib/utils';

interface IpoTabProps {
  user: any;
  onSignInClick: () => void;
}

// Helpers for parsing and formatting numbers
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberForInput = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '';
  const parsed = typeof num === 'number' ? num : parseFloat(num.toString().replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parsed);
};

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
  'GGRM': 'Gudang Garam Tbk',
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
  
  // Transportasi & Logistik
  'BIRD': 'Blue Bird Tbk',
  'SMDR': 'Samudera Indonesia Tbk',
  'TMAS': 'Temas Tbk',
  'JELI': 'PT Niramas Utama Tbk (INACO)',
};

function IpoEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  
  React.useEffect(() => {
    setHasError(false);
  }, [symbol]);

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) return null;

  return (
    <div className="w-8.5 h-8.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
      {!hasError ? (
        <img
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          className="w-6 h-6 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[9.5px] text-brand-purple">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function IpoTab({ user, onSignInClick }: IpoTabProps) {
  // Input States
  const [ticker, setTicker] = React.useState('JELI');
  const [companyName, setCompanyName] = React.useState('PT Niramas Utama Tbk (INACO)');
  const [priceStr, setPriceStr] = React.useState('100');
  const [totalLotsStr, setTotalLotsStr] = React.useState('3,500,000');
  const [oversubscriptionStr, setOversubscriptionStr] = React.useState('25');
  const [totalSubscribersStr, setTotalSubscribersStr] = React.useState('700,000');
  const [retailRatio, setRetailRatio] = React.useState(80); // Slider 0 - 100
  const [personalOrderAmountStr, setPersonalOrderAmountStr] = React.useState('10,000,000');
  const [isFetchingTicker, setIsFetchingTicker] = React.useState(false);

  // Accordion state for OJK rules
  const [isRulesExpanded, setIsRulesExpanded] = React.useState(false);

  const fetchRemoteTicker = React.useCallback(async (symbol: string) => {
    setIsFetchingTicker(true);
    try {
      const res = await fetch(`/api/ticker?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setCompanyName(cleanCompanyName(data.name));
        }
        if (data.price !== undefined && data.price !== null && data.price > 0) {
          setPriceStr(formatNumberForInput(data.price));
        }
      }
    } catch (err) {
      console.error('Error fetching remote ticker data for E-IPO:', err);
    } finally {
      setIsFetchingTicker(false);
    }
  }, []);

  // Fetch ticker real-time data automatically on input change
  React.useEffect(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      if (TICKER_DATABASE[val]) {
        setCompanyName(TICKER_DATABASE[val]);
      }
      fetchRemoteTicker(val);
    }
  }, [ticker, fetchRemoteTicker]);

  // Saving state
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedPlans, setSavedPlans] = React.useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = React.useState(false);

  // Toast notification state
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Convert inputs to numbers
  const price = parseFormattedNumber(priceStr);
  const totalLots = parseFormattedNumber(totalLotsStr);
  const oversubscription = parseFloat(oversubscriptionStr) || 1;
  const totalSubscribers = parseFormattedNumber(totalSubscribersStr);
  const personalOrderAmount = parseFormattedNumber(personalOrderAmountStr);

  // Calculate user's personal lots based on price and rupiah input
  const pricePerLot = price * 100;
  const personalOrderLots = pricePerLot > 0 ? Math.floor(personalOrderAmount / pricePerLot) : 0;

  // 1. Calculate Results using Memo
  const results = React.useMemo(() => {
    const input: EIpoInput = {
      ticker: ticker.toUpperCase(),
      companyName,
      price,
      totalLots,
      oversubscription,
      totalSubscribers,
      retailRatio,
      personalOrderLots
    };
    return calculateEIpoAllotment(input);
  }, [ticker, companyName, priceStr, totalLotsStr, oversubscriptionStr, totalSubscribersStr, retailRatio, personalOrderAmountStr]);

  // Load Saved Plans
  const fetchSavedPlans = React.useCallback(async () => {
    setIsLoadingPlans(true);
    
    const loadFromLocalStorage = () => {
      const stored = localStorage.getItem('nunnn_stock_ipo_plans');
      if (stored) {
        try {
          setSavedPlans(JSON.parse(stored));
        } catch {
          setSavedPlans([]);
        }
      } else {
        setSavedPlans([]);
      }
    };

    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { data, error } = await supabase
          .from('ipo_plans')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
            console.warn('Database ipo_plans table not migrated yet, falling back to local storage.');
            loadFromLocalStorage();
            return;
          }
          throw error;
        }
        setSavedPlans(data || []);
      } catch (err: any) {
        console.error('Error fetching E-IPO plans:', err.message);
        loadFromLocalStorage();
      } finally {
        setIsLoadingPlans(false);
      }
    } else {
      loadFromLocalStorage();
      setIsLoadingPlans(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchSavedPlans();
  }, [fetchSavedPlans]);

  // Save Plan Action
  const handleSavePlan = async () => {
    if (!ticker.trim()) {
      showToast('Masukkan ticker saham terlebih dahulu', 'error');
      return;
    }
    setIsSaving(true);

    const planData = {
      ticker: ticker.toUpperCase(),
      company_name: companyName || 'Emiten IPO',
      price: price,
      total_lots: totalLots,
      oversubscription: oversubscription,
      total_subscribers: totalSubscribers,
      retail_ratio: retailRatio,
      personal_order_lots: personalOrderLots
    };

    const saveToLocalStorage = () => {
      const newPlan = {
        id: crypto.randomUUID(),
        ...planData,
        created_at: new Date().toISOString()
      };
      const updated = [newPlan, ...savedPlans];
      localStorage.setItem('nunnn_stock_ipo_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(`Simulasi E-IPO ${ticker.toUpperCase()} disimpan secara lokal.`);
    };

    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('ipo_plans')
          .insert({
            ...planData,
            user_id: user.id
          });
        
        if (error) {
          if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
            saveToLocalStorage();
            return;
          }
          throw error;
        }
        showToast(`Simulasi E-IPO ${ticker.toUpperCase()} berhasil disimpan ke cloud!`);
        fetchSavedPlans();
      } catch (err: any) {
        console.error('Error saving E-IPO plan:', err.message);
        saveToLocalStorage();
      } finally {
        setIsSaving(false);
      }
    } else {
      saveToLocalStorage();
      setIsSaving(false);
    }
  };

  // Delete Plan Action
  const handleDeletePlan = async (id: string, planTicker: string) => {
    const deleteFromLocalStorage = () => {
      const updated = savedPlans.filter(p => p.id !== id);
      localStorage.setItem('nunnn_stock_ipo_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(`Simulasi E-IPO ${planTicker} berhasil dihapus.`);
    };

    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('ipo_plans')
          .delete()
          .eq('id', id);
        
        if (error) {
          if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
            deleteFromLocalStorage();
            return;
          }
          throw error;
        }
        showToast(`Simulasi E-IPO ${planTicker} berhasil dihapus.`);
        fetchSavedPlans();
      } catch (err: any) {
        console.error('Error deleting E-IPO plan:', err.message);
        deleteFromLocalStorage();
      }
    } else {
      deleteFromLocalStorage();
    }
  };

  // Load Parameters of Saved Plan
  const handleLoadPlan = (plan: any) => {
    setTicker(plan.ticker);
    setCompanyName(cleanCompanyName(plan.company_name));
    setPriceStr(formatNumberForInput(plan.price));
    setTotalLotsStr(formatNumberForInput(plan.total_lots));
    setOversubscriptionStr(plan.oversubscription.toString());
    setTotalSubscribersStr(formatNumberForInput(plan.total_subscribers));
    setRetailRatio(plan.retail_ratio);
    
    // Set personal order based on loaded lots
    const calcOrderRupiah = plan.personal_order_lots * 100 * plan.price;
    setPersonalOrderAmountStr(formatNumberForInput(calcOrderRupiah));

    showToast(`Simulasi E-IPO ${plan.ticker} berhasil dimuat.`);
  };

  // Formatting utility
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRawNumber = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDecimal = (value: number, decimals = 2) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn font-sans pb-10">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            Kalkulator Penjatahan E-IPO
            <Coins className="h-6 w-6 text-brand-purple animate-bounce shrink-0" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulasi estimasi jatah pooling allotment bagi investor Ritel vs Non-Ritel secara komparatif berdasarkan regulasi OJK.
          </p>
        </div>

        {/* Action Button */}
        <button 
          onClick={handleSavePlan}
          disabled={isSaving}
          className="flex items-center gap-2 py-2.5 px-4.5 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Menyimpan...' : 'Simpan Simulasi'}</span>
        </button>
      </div>

      {/* 2. OJK Regulation Cheat Sheet Accordion */}
      <div className="glass-card overflow-hidden">
        <button 
          onClick={() => setIsRulesExpanded(!isRulesExpanded)}
          className="w-full flex items-center justify-between p-4.5 bg-input-bg/50 hover:bg-input-bg text-left transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-purple/10 text-brand-purple">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-xs md:text-sm text-slate-800 dark:text-white">Regulasi Clawback OJK (SEOJK 15/2020 & SEOJK 25/2025)</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Ketuk untuk membaca detail rumus penyesuaian porsi ritel otomatis.</p>
            </div>
          </div>
          {isRulesExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {isRulesExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden border-t border-border-color"
            >
              <div className="p-5 bg-black/10 text-xs text-slate-600 dark:text-slate-300 space-y-4">
                <p>
                  Dalam mekanisme E-IPO, <strong>Alokasi Awal Penjatahan Terpusat</strong> ditentukan dari nilai emisi saham. Apabila terjadi kelebihan pemesanan (*oversubscribed*), porsi penjatahan terpusat wajib disesuaikan secara otomatis (*clawback*) demi melindungi porsi retail publik:
                </p>

                <div className="overflow-x-auto rounded-xl border border-border-color">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-input-bg border-b border-border-color text-slate-800 dark:text-white font-bold text-[10px] uppercase">
                        <th className="p-3 whitespace-nowrap">Golongan Penawaran Umum</th>
                        <th className="p-3 whitespace-nowrap">Batasan Awal Saham</th>
                        <th className="p-3 whitespace-nowrap">Penyesuaian I (2.5x - 10x)</th>
                        <th className="p-3 whitespace-nowrap">Penyesuaian II (10x - 25x)</th>
                        <th className="p-3 whitespace-nowrap">Penyesuaian III (&ge; 25x)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      <tr className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">I (&le; Rp100 Miliar)</td>
                        <td className="p-3 whitespace-nowrap">Min 20% / Rp10 Miliar</td>
                        <td className="p-3 whitespace-nowrap">22,5%</td>
                        <td className="p-3 whitespace-nowrap">25%</td>
                        <td className="p-3 text-brand-purple font-bold whitespace-nowrap">30%</td>
                      </tr>
                      <tr className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">II (&gt; Rp100M - &le; Rp250M)</td>
                        <td className="p-3 whitespace-nowrap">Min 15% / Rp20 Miliar</td>
                        <td className="p-3 whitespace-nowrap">17,5%</td>
                        <td className="p-3 whitespace-nowrap">20%</td>
                        <td className="p-3 text-brand-purple font-bold whitespace-nowrap">25%</td>
                      </tr>
                      <tr className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">III (&gt; Rp250M - &le; Rp500M)</td>
                        <td className="p-3 whitespace-nowrap">Min 10% / Rp37.5 Miliar</td>
                        <td className="p-3 whitespace-nowrap">12,5%</td>
                        <td className="p-3 whitespace-nowrap">15%</td>
                        <td className="p-3 text-brand-purple font-bold whitespace-nowrap">20%</td>
                      </tr>
                      <tr className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">IV (&gt; Rp500M - &le; Rp1 Triliun)</td>
                        <td className="p-3 whitespace-nowrap">Min 7,5% / Rp50 Miliar</td>
                        <td className="p-3 whitespace-nowrap">10%</td>
                        <td className="p-3 whitespace-nowrap">12,5%</td>
                        <td className="p-3 text-brand-purple font-bold whitespace-nowrap">17,5%</td>
                      </tr>
                      <tr className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">V (&gt; Rp1 Triliun)</td>
                        <td className="p-3 whitespace-nowrap">Min 2,5% / Rp75 Miliar</td>
                        <td className="p-3 whitespace-nowrap">5%</td>
                        <td className="p-3 whitespace-nowrap">7.5%</td>
                        <td className="p-3 text-brand-purple font-bold whitespace-nowrap">12,5%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-brand-purple/5 p-4 rounded-xl border border-brand-purple/20 space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="h-4.5 w-4.5 text-brand-purple" /> Perbedaan Rasio Ritel vs Non-Ritel
                  </h4>
                  <ul className="list-disc list-inside space-y-1 mt-1 text-[11px]">
                    <li><strong>Aturan Lama (SEOJK 15/2020):</strong> Menggunakan Rasio 1:2. Dari total alokasi terpusat (pooling), Ritel mendapatkan 33.3%, sedangkan Non-Ritel (institusi/pemesan &gt; 100jt) menguasai 66.7%.</li>
                    <li><strong>Aturan Baru (SEOJK 25/2025):</strong> Menggunakan Rasio 1:1. Jatah terpusat dibagi rata 50% untuk Ritel dan 50% untuk Non-Ritel, secara signifikan menaikkan alokasi bagi investor kecil.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Input Parameters Panel */}
      <div className="glass-card p-5 md:p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2.5">
          <Calculator className="h-4.5 w-4.5 text-brand-purple" />
          Input Parameter Emisi & Asumsi Penawaran
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Ticker Saham */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Ticker IPO</label>
            <div className="flex gap-2 items-center">
              <IpoEmitenLogo symbol={ticker} />
              <input
                type="text"
                maxLength={6}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="w-full glass-input px-3.5 py-2.5 text-xs font-extrabold text-white bg-black/25 focus:bg-background uppercase text-center"
                placeholder="JELI"
              />
            </div>
          </div>

          {/* Nama Emiten */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2. Nama Perusahaan</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`w-full glass-input px-3.5 py-2.5 text-xs font-bold text-white bg-black/25 focus:bg-background transition-all duration-300 ${
                isFetchingTicker ? 'animate-pulse text-slate-400 border-brand-purple/40 shadow-[0_0_8px_rgba(0,177,91,0.15)]' : ''
              }`}
              placeholder="PT Jeli Indonesia Tbk"
            />
          </div>

          {/* Harga Saham */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">3. Harga Saham (Rp)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Rp</span>
              <input
                type="text"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9]/g, ''))}
                className={`w-full glass-input pl-8 pr-3 py-2.5 text-xs font-extrabold text-white text-left bg-black/25 focus:bg-background transition-all duration-300 ${
                  isFetchingTicker ? 'animate-pulse text-slate-400 border-brand-purple/40 shadow-[0_0_8px_rgba(0,177,91,0.15)]' : ''
                }`}
              />
            </div>
          </div>

          {/* Jumlah Lot Ditawarkan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">4. Jumlah Lot Ditawarkan</label>
            <input
              type="text"
              value={totalLotsStr}
              onChange={(e) => setTotalLotsStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              onBlur={() => setTotalLotsStr(formatNumberForInput(totalLotsStr))}
              className="w-full glass-input px-3 py-2.5 text-xs font-extrabold text-white text-left bg-black/25 focus:bg-background"
              placeholder="3,500,000"
            />
          </div>

          {/* Oversubscription */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">5. Oversubscription (X)</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="1"
                value={oversubscriptionStr}
                onChange={(e) => setOversubscriptionStr(e.target.value)}
                className="w-full glass-input pl-3 pr-12 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Kali</span>
            </div>
          </div>

          {/* Jumlah Pemesan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">6. Asumsi Jumlah Pemesan</label>
            <div className="relative">
              <input
                type="text"
                value={totalSubscribersStr}
                onChange={(e) => setTotalSubscribersStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => setTotalSubscribersStr(formatNumberForInput(totalSubscribersStr))}
                className="w-full glass-input pl-3 pr-14 py-2.5 text-xs font-extrabold text-white text-left bg-black/25 focus:bg-background"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">Orang</span>
            </div>
          </div>

          {/* Nominal Pemesanan Pribadi */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">7. Nominal Pesanan Pribadi</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Rp</span>
              <input
                type="text"
                value={personalOrderAmountStr}
                onChange={(e) => setPersonalOrderAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => setPersonalOrderAmountStr(formatNumberForInput(personalOrderAmountStr))}
                className="w-full glass-input pl-8 pr-3 py-2.5 text-xs font-extrabold text-white text-left bg-black/25 focus:bg-background"
                placeholder="10,000,000"
              />
            </div>
          </div>
        </div>

        {/* Retail Ratio Slider */}
        <div className="p-4 bg-black/15 rounded-xl border border-border-color space-y-3">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>8. Rasio Jumlah Pemesan Ritel vs Non-Ritel</span>
            <span className="text-brand-purple text-xs font-extrabold">
              Ritel {retailRatio}% : Non-Ritel {100 - retailRatio}%
            </span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="95" 
            value={retailRatio}
            onChange={(e) => setRetailRatio(parseInt(e.target.value, 10))}
            className="w-full accent-brand-purple h-1 bg-input-bg rounded-lg cursor-pointer"
          />
          <p className="text-[9px] text-slate-500">
            Mengatur persentase investor dari total pemesan ({formatRawNumber(totalSubscribers)} orang) yang masuk kategori Ritel (order &le; Rp100 juta). Estimasi saat ini: <strong>{formatRawNumber(results.retailSubscribers)} orang ritel</strong> vs <strong>{formatRawNumber(results.nonRetailSubscribers)} orang non-ritel</strong>.
          </p>
        </div>
      </div>

      {/* 4. Emission Summary Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4.5 space-y-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Nilai Emisi Penawaran</span>
          <p className="text-lg font-black text-white">{formatIDR(results.emissionValue)}</p>
          <p className="text-[10px] text-slate-400 truncate">Total {formatRawNumber(totalLots * 100)} Lembar</p>
        </div>

        <div className="glass-card p-4.5 space-y-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Golongan Emisi OJK</span>
          <p className="text-lg font-black text-white">Golongan {results.golongan}</p>
          <p className="text-[10px] text-slate-400">Batas awal minimum: {results.initialPercentage.toFixed(1)}%</p>
        </div>

        <div className="glass-card p-4.5 space-y-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Alokasi Awal Terpusat</span>
          <p className="text-lg font-black text-white">{formatRawNumber(results.initialLots)} Lot</p>
          <p className="text-[10px] text-slate-400">Persentase: {formatDecimal(results.initialPercentage)}%</p>
        </div>

        <div className="glass-card p-4.5 space-y-1.5 border-l-2 border-l-brand-purple">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Alokasi Final (Clawback)</span>
          <p className="text-lg font-black text-brand-purple">{formatRawNumber(results.adjustedLots)} Lot</p>
          <p className="text-[10px] text-slate-400">Persentase Adjusted: {formatDecimal(results.adjustedPercentage)}%</p>
        </div>
      </div>

      {/* 5. SIDE-BY-SIDE Comparison (Rules 1:2 vs 1:1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* OLD RULE CARD (SEOJK 15/2020) */}
        <div className="glass-card p-5 space-y-4 border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-center border-b border-border-color pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-400">Aturan Lama</span>
              <h3 className="text-base font-extrabold text-white mt-1">SEOJK 15/2020</h3>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider">Rasio Pembagian</span>
              <span className="text-sm font-black text-slate-300">Ritel 1 : 2 Non-Ritel</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Terpusat (Lot)</span>
              <span className="font-bold text-white">{formatRawNumber(results.oldRule.totalPoolLots)} Lot</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Ritel (33.3%)</span>
              <span className="font-bold text-white">{formatRawNumber(results.oldRule.retailPoolLots)} Lot</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Non-Ritel (66.7%)</span>
              <span className="font-bold text-white">{formatRawNumber(results.oldRule.nonRetailPoolLots)} Lot</span>
            </div>
            
            <div className="pt-2">
              <h4 className="font-extrabold text-[10px] text-brand-purple uppercase tracking-wider mb-2">Perkiraan Allotment Ritel Rata-Rata:</h4>
              <div className="p-3 bg-black/20 rounded-lg space-y-2 border border-border-color/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Jatah Final Rata-Rata</span>
                  <span className="font-black text-slate-200 text-xs">{formatDecimal(results.oldRule.retailAllotmentPerPerson, 3)} Lot</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Peluang Dapatkan 1 Lot</span>
                  <span className={`font-black text-xs ${results.oldRule.retailProbability1Lot >= 100 ? 'text-bullish-green' : 'text-yellow-500'}`}>
                    {results.oldRule.retailProbability1Lot.toFixed(1)}% Peluang
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-slate-300 font-semibold text-[11px]">Dibulatkan ke Atas</span>
                  <span className="font-black text-brand-purple text-xs">{Math.ceil(results.oldRule.retailAllotmentPerPerson)} Lot</span>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <h4 className="font-extrabold text-[10px] text-indigo-400 uppercase tracking-wider mb-2">Perkiraan Allotment Non-Ritel Rata-Rata:</h4>
              <div className="p-3 bg-black/20 rounded-lg space-y-2 border border-border-color/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Jatah Final Rata-Rata</span>
                  <span className="font-black text-slate-200 text-xs">{formatDecimal(results.oldRule.nonRetailAllotmentPerPerson, 3)} Lot</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Peluang Dapatkan 1 Lot</span>
                  <span className={`font-black text-xs ${results.oldRule.nonRetailProbability1Lot >= 100 ? 'text-bullish-green' : 'text-yellow-500'}`}>
                    {results.oldRule.nonRetailProbability1Lot.toFixed(1)}% Peluang
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-slate-300 font-semibold text-[11px]">Dibulatkan ke Atas</span>
                  <span className="font-black text-indigo-400 text-xs">{Math.ceil(results.oldRule.nonRetailAllotmentPerPerson)} Lot</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NEW RULE CARD (SEOJK 25/2025) */}
        <div className="glass-card p-5 space-y-4 border-2 border-brand-purple relative overflow-hidden shadow-lg shadow-brand-purple/5">
          <div className="absolute top-0 right-0 bg-brand-purple text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg">
            Terbaru
          </div>

          <div className="flex justify-between items-center border-b border-border-color pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-purple/20 border border-brand-purple/30 text-brand-purple">Aturan Baru</span>
              <h3 className="text-base font-extrabold text-white mt-1">SEOJK 25/2025</h3>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider">Rasio Pembagian</span>
              <span className="text-sm font-black text-brand-purple">Ritel 1 : 1 Non-Ritel</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Terpusat (Lot)</span>
              <span className="font-bold text-white">{formatRawNumber(results.newRule.totalPoolLots)} Lot</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Ritel (50.0%)</span>
              <span className="font-bold text-brand-purple">{formatRawNumber(results.newRule.retailPoolLots)} Lot</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-color/50">
              <span className="text-slate-400">Jatah Pool Non-Ritel (50.0%)</span>
              <span className="font-bold text-white">{formatRawNumber(results.newRule.nonRetailPoolLots)} Lot</span>
            </div>
            
            <div className="pt-2">
              <h4 className="font-extrabold text-[10px] text-brand-purple uppercase tracking-wider mb-2">Perkiraan Allotment Ritel Rata-Rata:</h4>
              <div className="p-3 bg-brand-purple/5 rounded-lg space-y-2 border border-brand-purple/20">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-[11px]">Jatah Final Rata-Rata</span>
                  <span className="font-black text-white text-xs">{formatDecimal(results.newRule.retailAllotmentPerPerson, 3)} Lot</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-[11px]">Peluang Dapatkan 1 Lot</span>
                  <span className={`font-black text-xs ${results.newRule.retailProbability1Lot >= 100 ? 'text-bullish-green' : 'text-yellow-500'}`}>
                    {results.newRule.retailProbability1Lot.toFixed(1)}% Peluang
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-brand-purple/10">
                  <span className="text-slate-200 font-semibold text-[11px]">Dibulatkan ke Atas</span>
                  <span className="font-black text-brand-purple text-sm">{Math.ceil(results.newRule.retailAllotmentPerPerson)} Lot</span>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <h4 className="font-extrabold text-[10px] text-indigo-400 uppercase tracking-wider mb-2">Perkiraan Allotment Non-Ritel Rata-Rata:</h4>
              <div className="p-3 bg-black/20 rounded-lg space-y-2 border border-border-color/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Jatah Final Rata-Rata</span>
                  <span className="font-black text-slate-200 text-xs">{formatDecimal(results.newRule.nonRetailAllotmentPerPerson, 3)} Lot</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Peluang Dapatkan 1 Lot</span>
                  <span className={`font-black text-xs ${results.newRule.nonRetailProbability1Lot >= 100 ? 'text-bullish-green' : 'text-yellow-500'}`}>
                    {results.newRule.nonRetailProbability1Lot.toFixed(1)}% Peluang
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-slate-300 font-semibold text-[11px]">Dibulatkan ke Atas</span>
                  <span className="font-black text-indigo-400 text-xs">{Math.ceil(results.newRule.nonRetailAllotmentPerPerson)} Lot</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Personal Simulation Panel */}
      <div className="glass-card p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2.5">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <User className="h-4.5 w-4.5 text-brand-purple" />
            Simulasi Penjatahan Pesanan Pribadi Anda
          </h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            personalOrderAmount <= 100_000_000 
              ? 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple' 
              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
          }`}>
            Kategori: {personalOrderAmount <= 100_000_000 ? 'Ritel (\le Rp100jt)' : 'Non-Ritel (&gt; Rp100jt)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Summary Order Card */}
          <div className="bg-black/20 p-4.5 rounded-xl border border-border-color space-y-3">
            <h3 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Detail Pemesanan</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nominal Pesanan</span>
                <span className="font-bold text-white">{formatIDR(personalOrderAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Lot Dipesan</span>
                <span className="font-bold text-white">{formatRawNumber(personalOrderLots)} Lot</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Batas Kategori</span>
                <span className="font-semibold text-slate-400">Rp100.000.000</span>
              </div>
            </div>
          </div>

          {/* Allotment Estimate Card (Old Rule) */}
          <div className="bg-black/20 p-4.5 rounded-xl border border-border-color space-y-3">
            <h3 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Estimasi Jatah (SEOJK 15/2020)</h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Jatah Rata-rata</span>
                <span className="font-bold text-slate-200">
                  {personalOrderAmount <= 100_000_000 
                    ? formatDecimal(results.oldRule.retailAllotmentPerPerson, 2) 
                    : formatDecimal(results.oldRule.nonRetailAllotmentPerPerson, 2)} Lot
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Jatah Proporsional (1/X)</span>
                <span className="font-bold text-slate-200">{formatDecimal(results.oldRule.personalAllotmentProportional, 2)} Lot</span>
              </div>
              <div className="pt-2 border-t border-white/5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold">Estimasi Min Allotment:</span>
                  <span className="font-black text-brand-purple">{results.oldRule.personalAllotmentGuaranteed} Lot</span>
                </div>
                {results.oldRule.personalAllotmentProbabilityExtra > 0 && (
                  <p className="text-[10px] text-yellow-500 text-right font-medium">
                    +{results.oldRule.personalAllotmentProbabilityExtra.toFixed(1)}% Peluang 1 Lot Tambahan
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Allotment Estimate Card (New Rule) */}
          <div className="bg-brand-purple/5 p-4.5 rounded-xl border border-brand-purple/20 space-y-3">
            <h3 className="font-bold text-[11px] text-brand-purple uppercase tracking-wider">Estimasi Jatah (SEOJK 25/2025)</h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Jatah Rata-rata</span>
                <span className="font-bold text-white">
                  {personalOrderAmount <= 100_000_000 
                    ? formatDecimal(results.newRule.retailAllotmentPerPerson, 2) 
                    : formatDecimal(results.newRule.nonRetailAllotmentPerPerson, 2)} Lot
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Jatah Proporsional (1/X)</span>
                <span className="font-bold text-white">{formatDecimal(results.newRule.personalAllotmentProportional, 2)} Lot</span>
              </div>
              <div className="pt-2 border-t border-brand-purple/10 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-200 font-bold">Estimasi Min Allotment:</span>
                  <span className="font-black text-brand-purple text-sm">{results.newRule.personalAllotmentGuaranteed} Lot</span>
                </div>
                {results.newRule.personalAllotmentProbabilityExtra > 0 && (
                  <p className="text-[10px] text-bullish-neon text-right font-bold">
                    +{results.newRule.personalAllotmentProbabilityExtra.toFixed(1)}% Peluang 1 Lot Tambahan
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="p-3.5 rounded-lg bg-input-bg border border-border-color text-[10px] text-slate-500 flex gap-2.5">
          <Info className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
          <p>
            <strong>Catatan Kalkulasi Simulasi:</strong> Estimasi jatah dihitung berdasarkan dua model pemodelan: 
            (1) <em>Model Proporsional</em> (membagi lot pesanan Anda dengan rasio kelebihan permintaan oversubscription), dan 
            (2) <em>Model Pooling</em> (distribusi merata per investor). Sistem penjatahan ril bursa biasanya mendistribusikan jatah minimal (misal 1 - 10 Lot) terlebih dahulu untuk setiap pemesan sebelum mendistribusikan sisa lot secara proporsional.
          </p>
        </div>
      </div>

      {/* 7. Saved Simulation Plans Table */}
      <div className="glass-card p-5 md:p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-brand-purple" />
          Daftar Rencana Simulasi IPO Disimpan
        </h2>

        {isLoadingPlans ? (
          <div className="py-8 text-center text-xs text-slate-500 font-bold">Memuat riwayat rencana simulasi...</div>
        ) : savedPlans.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Belum ada rencana simulasi E-IPO yang disimpan.</div>
        ) : (
          <>
            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-input-bg border-b border-border-color text-slate-800 dark:text-white font-bold text-[10px] uppercase">
                  <th className="p-3 whitespace-nowrap">Emiten</th>
                  <th className="p-3 whitespace-nowrap">Harga Saham</th>
                  <th className="p-3 whitespace-nowrap">Lembar Ditawarkan</th>
                  <th className="p-3 text-center whitespace-nowrap">Oversubscribed</th>
                  <th className="p-3 text-center whitespace-nowrap">Rasio Ritel</th>
                  <th className="p-3 text-center whitespace-nowrap">Pemesanan Pribadi</th>
                  <th className="p-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {savedPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <IpoEmitenLogo symbol={plan.ticker} />
                        <div className="flex flex-col">
                          <div className="font-extrabold text-white leading-tight">{plan.ticker}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">
                            {cleanCompanyName(plan.company_name)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{formatIDR(plan.price)}</td>
                    <td className="p-3 text-slate-300">{formatRawNumber(plan.total_lots * 100)} Lembar</td>
                    <td className="p-3 text-center text-white font-bold">{plan.oversubscription}x</td>
                    <td className="p-3 text-center text-slate-300">{plan.retail_ratio}%</td>
                    <td className="p-3 text-center font-bold text-brand-purple">
                      {plan.personal_order_lots > 0 ? `${formatRawNumber(plan.personal_order_lots)} Lot` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLoadPlan(plan)}
                          className="px-2.5 py-1 rounded bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold text-[10px] cursor-pointer transition-colors border border-brand-purple/25"
                        >
                          Muat
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id, plan.ticker)}
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer transition-colors border border-rose-500/25"
                          title="Hapus Simulasi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Cards) */}
          <div className="block md:hidden space-y-3">
            {savedPlans.map((plan) => (
              <div 
                key={plan.id}
                className="p-4 rounded-xl border border-border-color bg-black/10 space-y-3"
              >
                {/* Logo & Ticker & Company Name */}
                <div className="flex items-center gap-2.5 border-b border-border-color pb-2">
                  <IpoEmitenLogo symbol={plan.ticker} />
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm text-brand-purple tracking-wider leading-none">
                      {plan.ticker}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[170px] mt-0.5" title={cleanCompanyName(plan.company_name)}>
                      {cleanCompanyName(plan.company_name) || '-'}
                    </span>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Harga Saham</span>
                    <span className="font-bold text-slate-200">{formatIDR(plan.price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Lembar Ditawarkan</span>
                    <span className="font-semibold text-slate-300">{formatRawNumber(plan.total_lots * 100)} Lbr</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Oversubscription</span>
                    <span className="font-black text-white">{plan.oversubscription}x</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Rasio Ritel</span>
                    <span className="font-medium text-slate-300">{plan.retail_ratio}%</span>
                  </div>
                </div>

                {/* Personal Order & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border-color bg-black/10 -mx-4 -mb-4 p-3 rounded-b-xl">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-none mb-1">Pesanan Pribadi</span>
                    <span className="font-extrabold text-brand-purple text-xs">
                      {plan.personal_order_lots > 0 ? `${formatRawNumber(plan.personal_order_lots)} Lot` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadPlan(plan)}
                      className="px-3 py-1.5 rounded bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold text-[10px] cursor-pointer transition-colors border border-brand-purple/25 flex items-center gap-1"
                    >
                      Muat
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id, plan.ticker)}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer transition-colors border border-rose-500/25 flex items-center justify-center"
                      title="Hapus Simulasi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Toast Notification Container */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 backdrop-blur-md text-xs font-bold ${
              toast.type === 'success' 
                ? 'bg-bullish-green/90 border-bullish-green/30 text-white' 
                : 'bg-rose-600/90 border-rose-500/30 text-white'
            }`}
          >
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
