'use client';

import * as React from 'react';
import { Sparkles, Info } from 'lucide-react';
import { AvgDownInput } from '@/lib/calculator';

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
  
  // Transportasi & Logistik
  'BIRD': 'Blue Bird Tbk',
  'SMDR': 'Samudera Indonesia Tbk',
  'TMAS': 'Temas Tbk',
};

// Helper functions for parsing and formatting numbers typed by the user
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
    maximumFractionDigits: 4,
  }).format(parsed);
};

const BROKER_PRESETS = [
  { id: 'stockbit', name: 'Stockbit', buy: 0.15, sell: 0.25 },
  { id: 'ajaib', name: 'Ajaib', buy: 0.15, sell: 0.25 },
  { id: 'ipot', name: 'IPOT (Indo Premier)', buy: 0.19, sell: 0.29 },
  { id: 'custom', name: 'Custom Fee', buy: 0.20, sell: 0.30 }
];

export function CalculatorForm({ onCalculate, onSavePlan, isSaving = false, user, initialValues }: CalculatorFormProps) {
  const [ticker, setTicker] = React.useState('ANTM');
  const [companyName, setCompanyName] = React.useState('Aneka Tambang Tbk');
  const [lotAwal, setLotAwal] = React.useState<string>('10');
  const [avgPriceAwal, setAvgPriceAwal] = React.useState<string>('3,200');
  const [currentPrice, setCurrentPrice] = React.useState<string>('2,900');
  
  const [lotBaru, setLotBaru] = React.useState<string>('15');
  const [hargaBeliBaru, setHargaBeliBaru] = React.useState<string>('2,800');
  
  const [brokerPreset, setBrokerPreset] = React.useState('stockbit');
  const [feeBeli, setFeeBeli] = React.useState(0.15);
  const [feeJual, setFeeJual] = React.useState(0.25);
  const [includeFees, setIncludeFees] = React.useState(true);


  // Sync state if initialValues changes
  React.useEffect(() => {
    if (initialValues) {
      setTicker(initialValues.ticker);
      setCompanyName(initialValues.company_name || TICKER_DATABASE[initialValues.ticker] || '');
      setLotAwal(formatNumberForInput(initialValues.lot_awal));
      setAvgPriceAwal(formatNumberForInput(initialValues.avg_price_awal));
      setCurrentPrice(formatNumberForInput(initialValues.current_price));
      setLotBaru(formatNumberForInput(initialValues.lot_baru));
      setHargaBeliBaru(formatNumberForInput(initialValues.harga_beli_baru));
      setFeeBeli(initialValues.fee_beli);
      setFeeJual(initialValues.fee_jual);
      setIncludeFees(initialValues.fee_beli > 0 || initialValues.fee_jual > 0);
      
      const matchedPreset = BROKER_PRESETS.find(p => p.buy === initialValues.fee_beli && p.sell === initialValues.fee_jual);
      if (matchedPreset) {
        setBrokerPreset(matchedPreset.id);
      } else if (initialValues.fee_beli === 0 && initialValues.fee_jual === 0) {
        setBrokerPreset('none');
      } else {
        setBrokerPreset('custom');
      }
    }
  }, [initialValues]);

  // Mengambil nama emiten & harga secara real-time dari internet (Yahoo Finance) atau database lokal
  React.useEffect(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      if (TICKER_DATABASE[val]) {
        setCompanyName(TICKER_DATABASE[val]);
      }
      
      const fetchRemoteTicker = async () => {
        try {
          const res = await fetch(`/api/ticker?symbol=${val}`);
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
        }
      };
      fetchRemoteTicker();
    } else {
      setCompanyName('');
      setCurrentPrice('');
    }
  }, [ticker]);

  // Trigger calculation on input changes
  React.useEffect(() => {
    const calculationInput: AvgDownInput = {
      ticker: ticker || 'IDX',
      companyName: companyName,
      lotAwal: parseFormattedNumber(lotAwal),
      avgPriceAwal: parseFormattedNumber(avgPriceAwal),
      currentPrice: parseFormattedNumber(currentPrice),
      lotBaru: parseFormattedNumber(lotBaru),
      hargaBeliBaru: parseFormattedNumber(hargaBeliBaru),
      feeBeli: includeFees ? Number(feeBeli) : 0,
      feeJual: includeFees ? Number(feeJual) : 0,
      includeFees
    };
    onCalculate(calculationInput);
  }, [
    ticker, companyName, lotAwal, avgPriceAwal, currentPrice, 
    lotBaru, hargaBeliBaru, feeBeli, feeJual, includeFees,
    onCalculate
  ]);


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
            <Sparkles className="h-4.5 w-4.5 text-brand-purple" />
            Parameter Rencana Average Down
          </h2>
        </div>
      </div>

      {/* Horizontal Form Layout */}
      <form onSubmit={handleSaveClick} className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 w-full">
        
        {/* Ticker & Nama Emiten (2 Kotak Berdampingan) */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[280px] relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Saham & Emiten</label>
          <div className="flex gap-2">
            
            {/* Kotak Ticker */}
            <div className="w-1/3 relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                }}
                placeholder="ANTM"
                className="w-full text-center font-extrabold tracking-wider glass-input px-3.5 py-2.5 text-base md:text-xs uppercase"
                required
              />
            </div>
            
            {/* Kotak Nama Perusahaan */}
            <div className="w-2/3">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nama Perusahaan"
                className="w-full glass-input px-3.5 py-2.5 text-base md:text-xs font-semibold placeholder:text-slate-500/50"
              />
            </div>
          </div>
        </div>

        {/* Posisi Portofolio Awal */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">2. Posisi Awal</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <input
                type="text"
                value={lotAwal}
                onChange={(e) => setLotAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => handleBlur(lotAwal, setLotAwal)}
                placeholder="Lot Awal"
                className="w-full glass-input px-1 py-2.5 text-base md:text-xs text-center font-bold"
                required
              />
              <span className="text-[9px] text-slate-500 text-center block mt-1">Lot Awal</span>
            </div>
            <div>
              <input
                type="text"
                value={avgPriceAwal}
                onChange={(e) => setAvgPriceAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => handleBlur(avgPriceAwal, setAvgPriceAwal)}
                placeholder="Avg Price"
                className="w-full glass-input px-1 py-2.5 text-base md:text-xs text-center font-bold"
                required
              />
              <span className="text-[9px] text-slate-500 text-center block mt-1">Avg Price (Rp)</span>
            </div>
            <div>
              <input
                type="text"
                value={currentPrice}
                placeholder="Harga Sekarang"
                className="w-full glass-input px-1 py-2.5 text-base md:text-xs text-center font-bold bg-slate-100/10 dark:bg-black/15 cursor-not-allowed opacity-75"
                readOnly
                required
              />
              <span className="text-[9px] text-slate-500 text-center block mt-1">Current Price (Rp)</span>
            </div>
          </div>
        </div>

        {/* Rencana Pembelian Baru */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[190px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">3. Rencana Beli Baru</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                value={lotBaru}
                onChange={(e) => setLotBaru(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => handleBlur(lotBaru, setLotBaru)}
                placeholder="Lot Baru"
                className="w-full glass-input px-1 py-2.5 text-base md:text-xs text-center font-bold border-brand-purple/20 focus:border-brand-purple"
                required
              />
              <span className="text-[9px] text-slate-500 text-center block mt-1">Lot Baru</span>
            </div>
            <div>
              <input
                type="text"
                value={hargaBeliBaru}
                onChange={(e) => setHargaBeliBaru(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={() => handleBlur(hargaBeliBaru, setHargaBeliBaru)}
                placeholder="Harga Baru"
                className="w-full glass-input px-1 py-2.5 text-base md:text-xs text-center font-bold border-brand-purple/20 focus:border-brand-purple"
                required
              />
              <span className="text-[9px] text-slate-500 text-center block mt-1">Harga Beli (Rp)</span>
            </div>
          </div>
        </div>

        {/* Broker Fee Settings */}
        <div className="flex flex-col gap-1.5 shrink-0 min-w-[210px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">4. Broker Fee</label>
          <select
            value={brokerPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full glass-input px-3 py-2.5 text-base md:text-xs font-bold cursor-pointer text-foreground bg-background"
          >
            <option value="stockbit">Stockbit (Buy 0.15% / Sell 0.25%)</option>
            <option value="ajaib">Ajaib (Buy 0.15% / Sell 0.25%)</option>
            <option value="ipot">IPOT (Buy 0.19% / Sell 0.29%)</option>
            <option value="custom">Custom (Beli 0.20% / Jual 0.30%)</option>
            <option value="none">Tanpa Fee (0.00%)</option>
          </select>
          <span className="text-[9px] text-slate-500 text-center block mt-1">
            {includeFees ? 'Potongan fee dihitung' : 'Murni tanpa biaya broker'}
          </span>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={
            isSaving ||
            parseFormattedNumber(lotAwal) <= 0 ||
            parseFormattedNumber(avgPriceAwal) <= 0 ||
            parseFormattedNumber(lotBaru) <= 0 ||
            parseFormattedNumber(hargaBeliBaru) <= 0
          }
          className="py-3 px-5.5 rounded-xl bg-gradient-to-r from-brand-indigo to-brand-purple hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs transition-all duration-300 shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0 self-stretch xl:self-auto h-10.5 xl:mb-4.5"
        >
          {isSaving ? (
            <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
          ) : null}
          <span>{user ? 'Simpan' : 'Simpan Lokal'}</span>
        </button>
      </form>
    </div>
  );
}
