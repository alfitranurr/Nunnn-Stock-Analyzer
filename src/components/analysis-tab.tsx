import * as React from 'react';
import { Search, TrendingUp, TrendingDown, BookOpen, Clock, AlertTriangle, RefreshCw, BarChart2, DollarSign, ShieldAlert, Sparkles, Building, Activity, ChevronUp, ChevronDown, Layers, Compass } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

// Popular BEI Tickers for suggestions
const POPULAR_TICKERS = [
  { symbol: 'BBCA', name: 'Bank Central Asia Tbk' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia Tbk' },
  { symbol: 'BMRI', name: 'Bank Mandiri (Persero) Tbk' },
  { symbol: 'TLKM', name: 'Telkom Indonesia (Persero) Tbk' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk' },
  { symbol: 'ASII', name: 'Astra International Tbk' },
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia Tbk' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia Tbk' },
  { symbol: 'UNVR', name: 'Unilever Indonesia Tbk' },
  { symbol: 'KLBF', name: 'Kalbe Farma Tbk' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara Tbk' },
  { symbol: 'AMRT', name: 'Sumber Alfaria Trijaya Tbk' },
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia Tbk' },
  { symbol: 'ANTM', name: 'Aneka Tambang Tbk' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur Tbk' },
  { symbol: 'ICBP', name: 'Indofood CBP Sukses Makmur Tbk' },
];

interface AnalysisTabProps {
  user: any;
  onSignInClick: () => void;
  initialTicker?: string | null;
}

interface ChartData {
  label: string;
  revenue: number;
  netIncome: number;
}

// Utility to format financial metrics
const formatFinancialNumber = (num: number | null) => {
  if (num === null || isNaN(num)) return '-';
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (absNum >= 1e12) return `${sign}Rp ${(absNum / 1e12).toFixed(2)} T`;
  if (absNum >= 1e9) return `${sign}Rp ${(absNum / 1e9).toFixed(2)} M`;
  if (absNum >= 1e6) return `${sign}Rp ${(absNum / 1e6).toFixed(2)} Jt`;
  return `${sign}Rp ${num.toLocaleString('id-ID')}`;
};

const formatShort = (num: number) => {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (absNum >= 1e12) return `${sign}${(absNum / 1e12).toFixed(1)}T`;
  if (absNum >= 1e9) return `${sign}${(absNum / 1e9).toFixed(1)}M`;
  if (absNum >= 1e6) return `${sign}${(absNum / 1e6).toFixed(1)}Jt`;
  return `${sign}${num.toLocaleString('id-ID')}`;
};

// SVG-based Custom Bar Chart
function FinancialBarChart({ data }: { data: ChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-slate-400">
        Data historis tidak tersedia.
      </div>
    );
  }

  // Find max and min values
  const allValues = data.flatMap(d => [d.revenue, d.netIncome]);
  const maxValue = Math.max(...allValues, 1000);
  const minValue = Math.min(...allValues, 0);

  // Chart configuration
  const chartHeight = 200;
  const chartWidth = 500;
  const padding = { top: 20, right: 20, bottom: 35, left: 65 };

  // Calculate scales
  const absoluteMax = Math.max(Math.abs(maxValue), Math.abs(minValue));
  const hasNegative = minValue < 0;
  
  const getY = (val: number) => {
    const usableHeight = chartHeight - padding.top - padding.bottom;
    if (hasNegative) {
      const zeroY = padding.top + usableHeight / 2;
      const offset = (val / absoluteMax) * (usableHeight / 2);
      return zeroY - offset;
    } else {
      const zeroY = chartHeight - padding.bottom;
      const offset = (val / maxValue) * usableHeight;
      return zeroY - offset;
    }
  };

  const getBarHeight = (val: number) => {
    const usableHeight = chartHeight - padding.top - padding.bottom;
    if (hasNegative) {
      return (Math.abs(val) / absoluteMax) * (usableHeight / 2);
    } else {
      return (Math.abs(val) / maxValue) * usableHeight;
    }
  };

  const zeroY = getY(0);
  const usableWidth = chartWidth - padding.left - padding.right;
  const groupWidth = usableWidth / data.length;
  const barWidth = Math.max(14, groupWidth * 0.22);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px]">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full overflow-visible">
          {/* Grid lines */}
          <line x1={padding.left} y1={getY(maxValue)} x2={chartWidth - padding.right} y2={getY(maxValue)} stroke="#334155" strokeDasharray="3 3" />
          {hasNegative && (
            <line x1={padding.left} y1={getY(minValue)} x2={chartWidth - padding.right} y2={getY(minValue)} stroke="#334155" strokeDasharray="3 3" />
          )}
          <line x1={padding.left} y1={zeroY} x2={chartWidth - padding.right} y2={zeroY} stroke="#475569" strokeWidth="1.5" />

          {/* Y Axis Labels */}
          <text x={padding.left - 10} y={getY(maxValue) + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
            {formatShort(maxValue)}
          </text>
          {hasNegative && (
            <text x={padding.left - 10} y={getY(minValue) + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
              {formatShort(minValue)}
            </text>
          )}
          <text x={padding.left - 10} y={zeroY + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
            0
          </text>

          {/* Render Bars */}
          {data.map((item, idx) => {
            const xGroupStart = padding.left + idx * groupWidth;
            const xRev = xGroupStart + groupWidth / 2 - barWidth - 3;
            const xNet = xGroupStart + groupWidth / 2 + 3;

            const revHeight = getBarHeight(item.revenue);
            const netHeight = getBarHeight(item.netIncome);

            const revY = item.revenue >= 0 ? zeroY - revHeight : zeroY;
            const netY = item.netIncome >= 0 ? zeroY - netHeight : zeroY;

            return (
              <g key={idx} className="group">
                {/* Revenue Bar - Violet Gradient/Color */}
                <rect
                  x={xRev}
                  y={revY}
                  width={barWidth}
                  height={revHeight}
                  rx="3"
                  className="fill-violet-600/80 hover:fill-violet-500 transition-all duration-200 cursor-pointer"
                />
                
                {/* Net Income Bar - Teal Gradient/Color */}
                <rect
                  x={xNet}
                  y={netY}
                  width={barWidth}
                  height={netHeight}
                  rx="3"
                  className="fill-teal-500/80 hover:fill-teal-400 transition-all duration-200 cursor-pointer"
                />

                {/* X Axis Label */}
                <text
                  x={xGroupStart + groupWidth / 2}
                  y={chartHeight - 12}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-medium"
                >
                  {item.label}
                </text>

                {/* Browser Native Tooltip */}
                <title>
                  {item.label}
                  &#10;Pendapatan: {formatFinancialNumber(item.revenue)}
                  &#10;Laba Bersih: {formatFinancialNumber(item.netIncome)}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function AnalysisTab({ user, onSignInClick, initialTicker }: AnalysisTabProps) {
  const [tickerQuery, setTickerQuery] = React.useState('');
  const [activeTicker, setActiveTicker] = React.useState<string>('BBCA');
  const [suggestions, setSuggestions] = React.useState<typeof POPULAR_TICKERS>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = React.useState(false);

  // Financial and News state
  const [fundamentals, setFundamentals] = React.useState<any>(null);
  const [history, setHistory] = React.useState<{
    annual: { year: number; revenue: number; netIncome: number }[];
    quarterly: { quarter: string; revenue: number; netIncome: number }[];
  } | null>(null);
  const [news, setNews] = React.useState<any[]>([]);
  const [analysis, setAnalysis] = React.useState<{ sentiment: string; summary: string; isAI: boolean } | null>(null);
  const [historyType, setHistoryType] = React.useState<'annual' | 'quarterly'>('annual');
  const [technicals, setTechnicals] = React.useState<any>(null);
  const [pivotMethod, setPivotMethod] = React.useState<'standard' | 'fibonacci'>('standard');

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchTimeoutRef = React.useRef<any>(null);

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Handle outside click to close suggestions
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Listen for initialTicker changes
  React.useEffect(() => {
    if (initialTicker) {
      const cleanTicker = initialTicker.toUpperCase().trim();
      setActiveTicker(cleanTicker);
      setTickerQuery(cleanTicker);
      setHasAnalyzed(true);
      fetchAnalysisData(cleanTicker);
    }
  }, [initialTicker]);

  const fetchAnalysisData = async (symbol: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Fundamentals
      const fundRes = await fetch(`/api/analysis/fundamentals?symbol=${symbol}`);
      if (!fundRes.ok) {
        const err = await fundRes.json();
        throw new Error(err.error || 'Gagal memuat data fundamental.');
      }
      const fundData = await fundRes.json();

      // 2. Fetch Technical Indicators
      let techData = null;
      try {
        const techRes = await fetch(`/api/analysis/technical?symbol=${symbol}`);
        if (techRes.ok) {
          techData = await techRes.json();
        }
      } catch (techErr) {
        console.warn('Failed to fetch technical indicators:', techErr);
      }

      // 3. Fetch News and Sentiment
      const newsRes = await fetch(`/api/analysis/news?symbol=${symbol}`);
      if (!newsRes.ok) {
        const err = await newsRes.json();
        throw new Error(err.error || 'Gagal memuat berita.');
      }
      const newsData = await newsRes.json();

      setFundamentals(fundData.fundamentals);
      setHistory(fundData.history);
      setTechnicals(techData);
      setNews(newsData.news || []);
      setAnalysis(newsData.analysis || null);
    } catch (err: any) {
      console.error('Error fetching stock analysis:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memuat data analisis.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = async (val: string) => {
    setTickerQuery(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 1. Show local matches instantly
    const localFiltered = POPULAR_TICKERS.filter(
      item =>
        item.symbol.toLowerCase().includes(val.toLowerCase()) ||
        item.name.toLowerCase().includes(val.toLowerCase())
    );
    setSuggestions(localFiltered);
    setShowSuggestions(true);

    // 2. Debounce and fetch more suggestions from BEI/Yahoo search API via our backend
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ticker?q=${val}`);
        if (res.ok) {
          const data = await res.json();
          const quotes = data.quotes || [];
          if (quotes.length > 0) {
            setSuggestions(prev => {
              // Merge, avoiding duplicates
              const merged = [...prev];
              quotes.forEach((q: any) => {
                if (!merged.some(m => m.symbol.toUpperCase() === q.symbol.toUpperCase())) {
                  merged.push(q);
                }
              });
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch ticker search results:', err);
      }
    }, 300);
  };

  const handleSelectSuggestion = (symbol: string) => {
    setActiveTicker(symbol);
    setTickerQuery(symbol);
    setShowSuggestions(false);
    setHasAnalyzed(true);
    fetchAnalysisData(symbol);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tickerQuery.toUpperCase().trim();
    if (clean) {
      setActiveTicker(clean);
      setShowSuggestions(false);
      setHasAnalyzed(true);
      fetchAnalysisData(clean);
    }
  };

  // Shield lock if user is not authenticated
  if (!user) {
    return (
      <div className="relative overflow-hidden border border-brand-purple/20 p-8 md:p-12 text-center bg-slate-950/70 backdrop-blur-md rounded-2xl max-w-2xl mx-auto my-12 shadow-xl animate-fadeIn">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-brand-purple/10 border border-brand-purple/30 rounded-full animate-pulse">
            <ShieldAlert className="w-12 h-12 text-brand-purple" />
          </div>
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
          Analisis Saham Pro Terkunci
        </h2>
        <p className="mb-8 text-sm md:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
          Silakan masuk dengan akun Anda untuk melihat analisa teknikal TradingView, indikator fundamental mendalam, dan rangkuman sentimen berita bertenaga AI untuk saham-saham BEI.
        </p>
        <button
          onClick={onSignInClick}
          className="px-8 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] shadow-md hover:scale-[1.02]"
        >
          Masuk ke Akun Anda
        </button>
      </div>
    );
  }

  const getAnalysisRecommendations = () => {
    if (!fundamentals) {
      return {
        fundamental: { rating: 'HOLD', score: 50, desc: 'Menunggu data fundamental...' },
        technical: { rating: 'HOLD', score: 50, desc: 'Menunggu data teknikal...' },
        bandarmology: { rating: 'NEUTRAL', score: 50, desc: 'Menunggu data bandarmology...' },
        narrative: { rating: 'HOLD', score: 50, desc: 'Menunggu sentimen berita...' },
        unified: { rating: 'HOLD', score: 50, desc: 'Menunggu analisa...' },
        pros: [],
        cons: []
      };
    }

    // 1. FUNDAMENTAL EVALUATION
    let fundPoints = 0;
    let fundMaxPoints = 0;
    const reasons: string[] = [];

    const pe = fundamentals.peRatio;
    if (pe !== null && pe !== undefined) {
      fundMaxPoints += 2;
      if (pe < 0) {
        fundPoints -= 2;
        reasons.push('EPS negatif (merugi)');
      } else if (pe < 12) {
        fundPoints += 2;
        reasons.push('P/E rendah (< 12x)');
      } else if (pe < 22) {
        fundPoints += 1;
        reasons.push('P/E wajar (12x - 22x)');
      } else {
        fundPoints -= 1;
        reasons.push('P/E tinggi (> 22x)');
      }
    }

    const pb = fundamentals.pbRatio;
    if (pb !== null && pb !== undefined) {
      fundMaxPoints += 2;
      if (pb < 1.2) {
        fundPoints += 2;
        reasons.push('PBV sangat murah (< 1.2x)');
      } else if (pb < 3.0) {
        fundPoints += 1;
        reasons.push('PBV wajar (1.2x - 3.0x)');
      } else {
        fundPoints -= 1;
        reasons.push('PBV tinggi (> 3.0x)');
      }
    }

    const roe = fundamentals.roe;
    if (roe !== null && roe !== undefined) {
      fundMaxPoints += 2;
      if (roe > 15) {
        fundPoints += 2;
        reasons.push('ROE tinggi (> 15%)');
      } else if (roe > 8) {
        fundPoints += 1;
        reasons.push('ROE sehat (8% - 15%)');
      } else if (roe <= 0) {
        fundPoints -= 2;
        reasons.push('ROE negatif');
      }
    }

    const der = fundamentals.der;
    if (der !== null && der !== undefined) {
      fundMaxPoints += 1;
      if (der < 80) {
        fundPoints += 1;
        reasons.push('DER rendah (< 80%)');
      } else if (der > 200) {
        fundPoints -= 1;
        reasons.push('DER tinggi (> 200%)');
      }
    }

    const pm = fundamentals.profitMargin;
    if (pm !== null && pm !== undefined) {
      fundMaxPoints += 1;
      if (pm > 15) {
        fundPoints += 1;
        reasons.push('NPM tinggi (> 15%)');
      } else if (pm < 0) {
        fundPoints -= 1;
        reasons.push('NPM negatif');
      }
    }

    let fundScore = 50;
    if (fundMaxPoints > 0) {
      const minPossible = -5;
      const maxPossible = fundMaxPoints;
      const normalized = (fundPoints - minPossible) / (maxPossible - minPossible);
      fundScore = Math.round(Math.min(100, Math.max(0, normalized * 100)));
    }

    let fundRating = 'NEUTRAL / HOLD';
    if (fundScore >= 75) fundRating = 'STRONG BUY';
    else if (fundScore >= 55) fundRating = 'BUY';
    else if (fundScore <= 25) fundRating = 'STRONG SELL';
    else if (fundScore <= 45) fundRating = 'SELL';

    const fundDesc = reasons.length > 0 
      ? reasons.join(', ')
      : 'rasio fundamental berada pada level netral';

    // 2. TECHNICAL EVALUATION
    const techScore = technicals?.summary?.score ?? 50;
    const techRating = technicals?.summary?.rating ?? 'NEUTRAL';
    let techDesc = 'kondisi RSI netral dan MA berkonsolidasi';
    if (technicals) {
      const rsiVal = technicals.rsi?.value;
      const rsiSig = technicals.rsi?.signal;
      const macdSig = technicals.macd?.signalName;
      techDesc = `RSI di level ${rsiVal?.toFixed(1)} (${rsiSig}), tren MACD ${macdSig || 'Netral'}, serta Moving Averages harian`;
    }

    // 3. BANDARMOLOGY EVALUATION
    const bandarScore = technicals?.bandarmologySummary?.score ?? 50;
    const bandarRating = technicals?.bandarmologySummary?.rating ?? 'NEUTRAL';
    let bandarDesc = 'aliran dana masuk dan keluar terpantau seimbang';
    if (technicals) {
      const bandarStatus = technicals.bandarmology?.status || 'NEUTRAL';
      const foreignNet = technicals.bandarmology?.foreignNetBuy || 0;
      const mfiVal = technicals.moneyFlow?.mfi || 50;
      bandarDesc = `aktivitas Bandarmology berstatus ${bandarStatus}, akumulasi asing bersih sebesar ${formatShort(foreignNet)}, dan Money Flow Index (MFI) di level ${mfiVal.toFixed(1)}`;
    }

    // 4. NARRATIVE SENTIMENT EVALUATION
    let narrScore = 50;
    const sentiment = analysis?.sentiment || 'Netral';
    if (sentiment === 'Bullish') {
      narrScore = 80;
    } else if (sentiment === 'Bearish') {
      narrScore = 20;
    }

    let narrRating = 'HOLD';
    if (sentiment === 'Bullish') narrRating = 'BUY';
    else if (sentiment === 'Bearish') narrRating = 'SELL';

    const narrDesc = analysis?.summary 
      ? `sentimen cenderung ${sentiment.toLowerCase()}`
      : `sentimen pasar terpantau ${sentiment.toLowerCase()}`;

    // 5. UNIFIED CONSENSUS (25% Fundamental, 25% Technical, 25% Bandarmology, 25% Narrative)
    const unifiedScore = Math.round((fundScore * 0.25) + (techScore * 0.25) + (bandarScore * 0.25) + (narrScore * 0.25));
    
    let unifiedRating = 'HOLD';
    if (unifiedScore >= 75) unifiedRating = 'STRONG BUY';
    else if (unifiedScore >= 55) unifiedRating = 'BUY';
    else if (unifiedScore <= 25) unifiedRating = 'STRONG SELL';
    else if (unifiedScore <= 45) unifiedRating = 'SELL';

    const tickerName = activeTicker.split('.')[0];
    const unifiedDesc = `Sinyal utama gabungan untuk ${tickerName} merekomendasikan ${unifiedRating} dengan skor akumulasi ${unifiedScore}%. Secara fundamental dinilai ${fundRating} karena ${fundDesc}. Dari sisi teknikal, indikator menunjukkan status ${techRating} berdasarkan ${techDesc}. Di sisi Bandarmology, transaksi berstatus ${bandarRating} dengan ${bandarDesc}. Sedangkan aspek narasi/berita merekomendasikan ${narrRating} dengan sentimen pasar cenderung ${sentiment.toLowerCase()}.`;

    // Pros & Cons calculation
    const pros: string[] = [];
    const cons: string[] = [];

    // Fundamental Pros & Cons
    if (pe !== null && pe !== undefined) {
      if (pe < 0) cons.push('Laba EPS negatif (perusahaan merugi)');
      else if (pe < 12) pros.push(`Valuasi P/E murah (${pe.toFixed(1)}x)`);
      else if (pe < 22) pros.push(`Valuasi P/E wajar (${pe.toFixed(1)}x)`);
      else cons.push(`Valuasi P/E tinggi/mahal (${pe.toFixed(1)}x)`);
    }
    if (pb !== null && pb !== undefined) {
      if (pb < 1.2) pros.push(`Valuasi PBV sangat murah (${pb.toFixed(1)}x)`);
      else if (pb < 3.0) pros.push(`Valuasi PBV wajar (${pb.toFixed(1)}x)`);
      else cons.push(`Valuasi PBV tinggi/mahal (${pb.toFixed(1)}x)`);
    }
    if (roe !== null && roe !== undefined) {
      if (roe > 15) pros.push(`Profitabilitas ROE tinggi (${roe.toFixed(1)}%)`);
      else if (roe > 8) pros.push(`Profitabilitas ROE sehat (${roe.toFixed(1)}%)`);
      else if (roe <= 0) cons.push(`Profitabilitas ROE negatif (${roe.toFixed(1)}%)`);
      else cons.push(`Profitabilitas ROE rendah (${roe.toFixed(1)}%)`);
    }
    if (der !== null && der !== undefined) {
      if (der < 80) pros.push(`Rasio utang DER rendah/aman (${der.toFixed(1)}%)`);
      else if (der > 200) cons.push(`Rasio utang DER tinggi/berisiko (${der.toFixed(1)}%)`);
    }
    if (pm !== null && pm !== undefined) {
      if (pm > 15) pros.push(`Margin laba bersih NPM tinggi (${pm.toFixed(1)}%)`);
      else if (pm < 0) cons.push(`Margin laba bersih NPM negatif (${pm.toFixed(1)}%)`);
    }

    // Technical Pros & Cons
    if (technicals) {
      const rsiVal = technicals.rsi?.value;
      if (rsiVal !== undefined) {
        if (rsiVal < 30) pros.push(`Momentum RSI Jenuh Jual / Oversold (${rsiVal.toFixed(1)})`);
        else if (rsiVal > 70) cons.push(`Momentum RSI Jenuh Beli / Overbought (${rsiVal.toFixed(1)})`);
      }
      const macdSig = technicals.macd?.signalName;
      if (macdSig) {
        if (macdSig.includes('Bullish')) pros.push(`Indikator MACD: ${macdSig}`);
        else if (macdSig.includes('Bearish')) cons.push(`Indikator MACD: ${macdSig}`);
      }
      const curPrice = technicals.price || fundamentals.price || 0;
      const sma20 = technicals.movingAverages?.sma20;
      const sma50 = technicals.movingAverages?.sma50;
      if (curPrice && sma20 && sma50) {
        if (curPrice > sma20 && curPrice > sma50) pros.push('Moving Averages: Uptrend kuat (di atas SMA 20 & 50)');
        else if (curPrice < sma20 && curPrice < sma50) cons.push('Moving Averages: Downtrend kuat (di bawah SMA 20 & 50)');
      }
      const w = technicals.multiTimeframe?.weekly;
      const d = technicals.multiTimeframe?.daily;
      if (w === 'BULLISH') pros.push('Tren Mingguan (Weekly): Bullish');
      if (w === 'BEARISH') cons.push('Tren Mingguan (Weekly): Bearish');
      if (d === 'BULLISH') pros.push('Tren Harian (Daily): Bullish');
      if (d === 'BEARISH') cons.push('Tren Harian (Daily): Bearish');
    }

    // Bandarmology Pros & Cons
    if (technicals) {
      const status = technicals.bandarmology?.status || '';
      if (status.includes('ACCUMULATION')) pros.push(`Bandarmology: Akumulasi volume (${status})`);
      else if (status.includes('DISTRIBUTION')) cons.push(`Bandarmology: Distribusi volume (${status})`);

      const foreignNet = technicals.bandarmology?.foreignNetBuy || 0;
      if (foreignNet > 0) pros.push(`Aliran Asing (Net Foreign Buy): +${formatShort(foreignNet)}`);
      else if (foreignNet < 0) cons.push(`Aliran Asing (Net Foreign Sell): ${formatShort(foreignNet)}`);

      const mfiVal = technicals.moneyFlow?.mfi;
      if (mfiVal !== undefined) {
        if (mfiVal < 30) pros.push(`Aliran Dana (MFI) Jenuh Jual (${mfiVal.toFixed(1)})`);
        else if (mfiVal > 70) cons.push(`Aliran Dana (MFI) Jenuh Beli (${mfiVal.toFixed(1)})`);
      }
    }

    // Sentiment Pros & Cons
    if (sentiment === 'Bullish') pros.push('Sentimen Media/Berita: Positif/Bullish');
    else if (sentiment === 'Bearish') cons.push('Sentimen Media/Berita: Negatif/Bearish');

    return {
      fundamental: { rating: fundRating, score: fundScore, desc: fundDesc },
      technical: { rating: techRating, score: techScore, desc: techDesc },
      bandarmology: { rating: bandarRating, score: bandarScore, desc: bandarDesc },
      narrative: { rating: narrRating, score: narrScore, desc: narrDesc },
      unified: { rating: unifiedRating, score: unifiedScore, desc: unifiedDesc },
      pros,
      cons
    };
  };

  // TradingView symbol parsing
  const tradingViewSymbol = `IDX:${activeTicker.split('.')[0]}`;
  const recs = getAnalysisRecommendations();

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-brand-purple/10 p-5 rounded-2xl bg-slate-950/40 backdrop-blur-sm relative z-50">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-purple" /> Analisis Saham Pro
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Emiten aktif: <span className="font-semibold text-brand-purple">{activeTicker.split('.')[0]}</span> - BEI (Bursa Efek Indonesia)
          </p>
        </div>

        {/* Refresh and Smart Search Bar Container */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Refresh Button - Left of Search Input */}
          {hasAnalyzed && (
            <button
              onClick={() => fetchAnalysisData(activeTicker)}
              disabled={loading}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Smart Search Bar */}
          <div ref={containerRef} className="relative w-full md:w-80">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari kode saham (e.g. BBRI, GOTO)..."
                  value={tickerQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/60 transition-all duration-200"
                />
                <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500" />
              </div>
            </form>

            {/* Autocomplete Suggestions */}
            {showSuggestions && (suggestions.length > 0 || tickerQuery.trim().length > 0) && (
              <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-xl shadow-2xl z-[100] divide-y divide-slate-900">
                {suggestions.map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => handleSelectSuggestion(item.symbol)}
                    className="w-full text-left px-4 py-3 hover:bg-brand-purple/10 transition-colors flex items-center justify-between"
                  >
                    <span className="font-bold text-white text-sm">{item.symbol}</span>
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">{item.name}</span>
                  </button>
                ))}
                
                {/* Fallback Option for Custom Query */}
                {tickerQuery.trim().length > 0 && !suggestions.some(item => item.symbol.toUpperCase() === tickerQuery.toUpperCase().trim()) && (
                  <button
                    onClick={() => handleSelectSuggestion(tickerQuery)}
                    className="w-full text-left px-4 py-3 hover:bg-brand-purple/10 transition-colors flex items-center gap-2 text-brand-purple font-medium"
                  >
                    <Search className="w-4 h-4 text-brand-purple" />
                    <span className="text-sm">Analisis Saham "{tickerQuery.toUpperCase().trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="border border-red-500/20 bg-red-500/10 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">{errorMsg}</div>
        </div>
      )}

      {!hasAnalyzed ? (
        <div className="border border-white/5 bg-slate-950/40 backdrop-blur-md rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto my-6 shadow-xl flex flex-col items-center justify-center space-y-6">
          <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-400">
            <TrendingUp className="w-10 h-10 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-white md:text-2xl">
            Analisis Saham Profesional
          </h3>
          <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Gunakan kotak pencarian di atas untuk menganalisis kode saham BEI apa saja, atau klik salah satu pintasan emiten terpopuler di bawah untuk memulai analisis chart teknikal, ringkasan fundamental keuangan, dan sentimen narasi AI secara instan.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {['BBCA', 'BBRI', 'BMRI', 'TLKM', 'GOTO'].map((symbol) => (
              <button
                key={symbol}
                onClick={() => handleSelectSuggestion(symbol)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:border-brand-purple/40 hover:text-white rounded-lg transition-all duration-200 cursor-pointer"
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Main Content Grid */}
          <div className="flex flex-col gap-6 w-full">
            
            {/* Unified Analysis Consensus Overview Card */}
            {fundamentals && (
              <div className="relative overflow-hidden border border-brand-purple/20 bg-slate-950/60 backdrop-blur-md rounded-2xl shadow-xl p-6 w-full animate-fadeIn">
                {/* Top gradient strip */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-brand-purple to-violet-600" />
                
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  {/* Left Side: Summary & Sinyal Utama */}
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-brand-purple animate-pulse" />
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Konsensus Analisis Unifikasi</span>
                    </div>
                    
                    <div className="flex items-baseline gap-3">
                      <span className={`text-2xl sm:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${
                        recs.unified.rating.includes('STRONG BUY')
                          ? 'from-emerald-400 to-teal-500'
                          : recs.unified.rating.includes('BUY')
                          ? 'from-emerald-400/80 to-teal-500/80'
                          : recs.unified.rating.includes('SELL')
                          ? 'from-rose-400 to-pink-500'
                          : 'from-slate-300 to-slate-400'
                      }`}>
                        {recs.unified.rating}
                      </span>
                      <span className="text-sm text-slate-400 font-semibold font-mono">
                        Skor Akumulasi: {recs.unified.score}%
                      </span>
                    </div>
  
                    <p className="text-xs sm:text-sm text-slate-350 leading-relaxed max-w-3xl border-l-2 border-brand-purple/40 pl-3">
                      Sinyal utama gabungan untuk <span className="font-bold text-white">{activeTicker.split('.')[0]}</span> menyimpulkan rekomendasi <span className={`font-black uppercase ${recs.unified.rating.includes('BUY') ? 'text-emerald-400' : recs.unified.rating.includes('SELL') ? 'text-rose-400' : 'text-yellow-400'}`}>{recs.unified.rating}</span> (Skor: {recs.unified.score}%).
                    </p>

                    {/* Visual Pros & Cons Grid for Quick Digest */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-w-4xl w-full">
                      {/* Pros (Kekuatan) */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-500/10 pb-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Sinyal Positif & Kekuatan
                        </div>
                        <ul className="space-y-1.5">
                          {recs.pros && recs.pros.length > 0 ? (
                            recs.pros.map((pro, index) => (
                              <li key={index} className="text-[11px] text-slate-300 flex items-start gap-1.5 leading-normal">
                                <span className="text-emerald-400 shrink-0 select-none font-bold">✓</span>
                                <span>{pro}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-[11px] text-slate-500 italic">Tidak ada sinyal positif yang menonjol.</li>
                          )}
                        </ul>
                      </div>

                      {/* Cons (Risiko) */}
                      <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-500/10 pb-1.5">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Sinyal Risiko & Kelemahan
                        </div>
                        <ul className="space-y-1.5">
                          {recs.cons && recs.cons.length > 0 ? (
                            recs.cons.map((con, index) => (
                              <li key={index} className="text-[11px] text-slate-300 flex items-start gap-1.5 leading-normal">
                                <span className="text-rose-400 shrink-0 select-none font-bold">⚠</span>
                                <span>{con}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-[11px] text-slate-500 italic">Tidak ada risiko kritis yang terdeteksi.</li>
                          )}
                        </ul>
                      </div>
                    </div>
  
                    {/* Sub-breakdowns */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 w-full">
                      {/* Fundamental */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analisa Fundamental</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-xs font-bold ${
                            recs.fundamental.rating.includes('BUY') ? 'text-emerald-400' : recs.fundamental.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'
                          }`}>{recs.fundamental.rating}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">{recs.fundamental.score}%</span>
                        </div>
                      </div>
  
                      {/* Teknikal */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analisa Teknikal</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-xs font-bold ${
                            recs.technical.rating.includes('BUY') ? 'text-emerald-400' : recs.technical.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'
                          }`}>{recs.technical.rating}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">{recs.technical.score}%</span>
                        </div>
                      </div>
  
                      {/* Bandarmology */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Bandarmology</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-xs font-bold ${
                            recs.bandarmology?.rating.includes('ACCUMULATION') ? 'text-emerald-400' : recs.bandarmology?.rating.includes('DISTRIBUTION') ? 'text-rose-400' : 'text-slate-400'
                          }`}>{recs.bandarmology?.rating || 'NEUTRAL'}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">{recs.bandarmology?.score || 50}%</span>
                        </div>
                      </div>
  
                      {/* Narasi/Sentimen */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analisa Narasi</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-xs font-bold ${
                            recs.narrative.rating.includes('BUY') ? 'text-emerald-400' : recs.narrative.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'
                          }`}>{recs.narrative.rating}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">{recs.narrative.score}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
  
                  {/* Right Side: Speedometer/Gauge bar */}
                  <div className="w-full lg:w-72 flex flex-col items-center justify-center p-4 bg-slate-900/30 border border-slate-900 rounded-2xl relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 to-transparent opacity-30 pointer-events-none" />
                    
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Sinyal Konsensus Meter</span>
                    
                    {/* Horizontal segmented bar visualizer with highlight cursor */}
                    <div className="w-full space-y-2">
                       <div className="relative h-4 w-full bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex">
                        {/* Strong Sell (Red) */}
                        <div className="h-full w-[20%] bg-gradient-to-r from-red-600 to-rose-500" />
                        {/* Sell (Orange) */}
                        <div className="h-full w-[20%] bg-gradient-to-r from-rose-500 to-amber-500" />
                        {/* Hold (Yellow) */}
                        <div className="h-full w-[20%] bg-gradient-to-r from-amber-500 to-yellow-400" />
                        {/* Buy (Light Green) */}
                        <div className="h-full w-[20%] bg-gradient-to-r from-yellow-400 to-emerald-400" />
                        {/* Strong Buy (Dark Green) */}
                        <div className="h-full w-[20%] bg-gradient-to-r from-emerald-400 to-teal-500" />
                        
                        {/* Position Cursor pin */}
                        <div 
                          style={{ left: `calc(${recs.unified.score}% - 4px)` }}
                          className="absolute top-0 bottom-0 w-2 bg-white border border-slate-950 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse transition-all duration-1000"
                        />
                      </div>
                      
                      <div className="flex justify-between text-[8px] font-bold text-slate-500 px-1 font-mono">
                        <span>STRONG SELL</span>
                        <span>HOLD</span>
                        <span>STRONG BUY</span>
                      </div>
                    </div>
  
                    <div className="mt-4 text-center">
                      <span className="text-[11px] text-slate-400 font-medium">Verdict: </span>
                      <span className={`text-xs font-black ${
                        recs.unified.rating.includes('STRONG BUY')
                          ? 'text-teal-400'
                          : recs.unified.rating.includes('BUY')
                          ? 'text-emerald-400'
                          : recs.unified.rating.includes('SELL')
                          ? 'text-rose-400'
                          : 'text-yellow-400'
                      }`}>
                        {recs.unified.rating} ({recs.unified.score}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
         
         {/* Technical Chart Card (Full width) */}
        <div className="border border-slate-800/60 rounded-2xl overflow-hidden bg-slate-950/40 shadow-lg flex flex-col h-[540px] w-full">
          <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Chart Teknikal Profesional (TradingView)
            </span>
          </div>
          
          <div className="flex-1 bg-slate-950 relative">
            {/* Embedded TradingView Interactive Widget */}
            <iframe
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tradingViewSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e293b&theme=dark&style=1&timezone=Asia%2FJakarta&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22PivotPointsStandard%40tv-basicstudies%22%5D&locale=id`}
              className="w-full h-full border-0 absolute inset-0"
              allowFullScreen
            />
          </div>
        </div>

        {/* Technical Indicators Dashboard */}
        <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg flex flex-col h-auto w-full">
          <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold">Dashboard Indikator Teknikal Kompleks</span>
            </div>
            {technicals?.summary && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                technicals.summary.rating.includes('BUY') 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : technicals.summary.rating.includes('SELL')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                Rekomendasi: {technicals.summary.rating} ({technicals.summary.score}%)
              </span>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Oscillators (RSI & MACD) */}
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Osilator (RSI & MACD)
              </h4>
              
              {/* RSI (14) */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">RSI (14)</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    technicals?.rsi?.signal === 'Oversold' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : technicals?.rsi?.signal === 'Overbought'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {loading ? '...' : technicals?.rsi?.value ? technicals.rsi.value.toFixed(2) : '-'} - {loading ? '...' : technicals?.rsi?.signal || '-'}
                  </span>
                </div>
                
                {/* RSI Scale Progress Bar */}
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between text-[9px] text-slate-500">
                    <span>Oversold (30)</span>
                    <span>Neutral (50)</span>
                    <span>Overbought (70)</span>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-950 border border-slate-900 relative">
                    {/* Zone markers */}
                    <div className="absolute left-[30%] right-[30%] top-0 bottom-0 border-l border-r border-slate-850 bg-slate-800/5" />
                    
                    {/* Progress Fill */}
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, technicals?.rsi?.value || 50))}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        (technicals?.rsi?.value || 50) < 30 
                          ? 'bg-emerald-500' 
                          : (technicals?.rsi?.value || 50) > 70 
                          ? 'bg-rose-500' 
                          : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {(technicals?.rsi?.value || 50) < 30 
                    ? 'Harga berada di area jenuh jual (Oversold), peluang untuk akumulasi beli.' 
                    : (technicals?.rsi?.value || 50) > 70 
                    ? 'Harga berada di area jenuh beli (Overbought), rawan aksi ambil untung (profit taking).' 
                    : 'Momentum harga netral, cenderung konsolidasi.'}
                </p>
              </div>

              {/* MACD (12, 26, 9) */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">MACD (12, 26, 9)</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    technicals?.macd?.signalName?.includes('Bullish') 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : technicals?.macd?.signalName?.includes('Bearish')
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {loading ? '...' : technicals?.macd?.signalName || 'Neutral'}
                  </span>
                </div>
                
                {/* MACD metric values */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="bg-slate-950 p-2 rounded border border-slate-900">
                    <div className="text-slate-500">MACD</div>
                    <div className="font-mono font-semibold text-slate-200 mt-0.5">
                      {loading ? '...' : technicals?.macd?.macd ? technicals.macd.macd.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-900">
                    <div className="text-slate-500">Signal</div>
                    <div className="font-mono font-semibold text-slate-200 mt-0.5">
                      {loading ? '...' : technicals?.macd?.signal ? technicals.macd.signal.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-900">
                    <div className="text-slate-500">Histogram</div>
                    <div className={`font-mono font-semibold mt-0.5 ${
                      (technicals?.macd?.histogram || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {loading ? '...' : technicals?.macd?.histogram ? technicals.macd.histogram.toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {technicals?.macd?.signalName?.includes('Crossover')
                    ? `Terjadi crossover ${technicals.macd.signalName.toLowerCase()}, sinyal perubahan tren kuat!`
                    : (technicals?.macd?.histogram || 0) >= 0
                    ? 'Histogram positif menunjukkan momentum kenaikan (bullish) masih berlanjut.'
                    : 'Histogram negatif menunjukkan tekanan jual (bearish) masih berlanjut.'}
                </p>
              </div>
            </div>

            {/* Column 2: Pivot Points (Support & Resistance) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Support & Resistance
                </h4>
                <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[9px] font-bold">
                  <button
                    onClick={() => setPivotMethod('standard')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      pivotMethod === 'standard' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Standar
                  </button>
                  <button
                    onClick={() => setPivotMethod('fibonacci')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      pivotMethod === 'fibonacci' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fibonacci
                  </button>
                </div>
              </div>

              {/* S/R Level Stack */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-2">
                {/* Levels list */}
                {(() => {
                  const method = pivotMethod;
                  const levels = technicals?.pivotPoints?.[method] || {
                    pp: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0
                  };
                  const currentPrice = technicals?.price || fundamentals?.price || 0;

                  return (
                    <div className="space-y-1.5 font-mono text-xs">
                      {/* R3 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-rose-400 font-semibold">Resistansi 3 (R3)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r3 ? `Rp ${Math.round(levels.r3).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                      {/* R2 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-rose-400/80 font-semibold">Resistansi 2 (R2)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r2 ? `Rp ${Math.round(levels.r2).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                      {/* R1 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-rose-400/60 font-semibold">Resistansi 1 (R1)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r1 ? `Rp ${Math.round(levels.r1).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                      
                      {/* Pivot Point */}
                      <div className="flex justify-between items-center py-1 bg-slate-950/60 px-2 rounded border border-slate-800/60 my-1">
                        <span className="text-cyan-400 font-bold">Pivot Point (PP)</span>
                        <span className="font-bold text-white">
                          {loading ? '...' : levels.pp ? `Rp ${Math.round(levels.pp).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>

                      {/* S1 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-emerald-500/60 font-semibold">Support 1 (S1)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s1 ? `Rp ${Math.round(levels.s1).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                      {/* S2 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-emerald-500/80 font-semibold">Support 2 (S2)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s2 ? `Rp ${Math.round(levels.s2).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                      {/* S3 */}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-emerald-500 font-semibold">Support 3 (S3)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s3 ? `Rp ${Math.round(levels.s3).toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>

                      {/* Current Price Comparison */}
                      {currentPrice > 0 && (
                        <div className="text-[10px] text-slate-400 text-center pt-3 border-t border-slate-800 mt-2 font-sans">
                          Harga saat ini (<span className="text-slate-200 font-bold font-mono">Rp {currentPrice.toLocaleString('id-ID')}</span>) 
                          {currentPrice > levels.pp 
                            ? ' berada di atas Pivot Point (Tren Bullish jangka pendek).' 
                            : ' berada di bawah Pivot Point (Tren Bearish jangka pendek).'}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Column 3: Moving Averages */}
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Moving Averages (MA)
              </h4>

              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-4">
                <div className="space-y-3">
                  {/* SMA 20 */}
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-300 font-sans">SMA 20</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {loading ? '...' : technicals?.movingAverages?.sma20 ? `Rp ${Math.round(technicals.movingAverages.sma20).toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    {(() => {
                      const curPrice = technicals?.price || fundamentals?.price || 0;
                      const sma = technicals?.movingAverages?.sma20 || 0;
                      const isBull = curPrice > sma;
                      return (
                        <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isBull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isBull ? 'Bullish' : 'Bearish'}
                        </span>
                      );
                    })()}
                  </div>

                  {/* EMA 20 */}
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-300 font-sans">EMA 20</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {loading ? '...' : technicals?.movingAverages?.ema20 ? `Rp ${Math.round(technicals.movingAverages.ema20).toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    {(() => {
                      const curPrice = technicals?.price || fundamentals?.price || 0;
                      const ema = technicals?.movingAverages?.ema20 || 0;
                      const isBull = curPrice > ema;
                      return (
                        <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isBull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isBull ? 'Bullish' : 'Bearish'}
                        </span>
                      );
                    })()}
                  </div>

                  {/* SMA 50 */}
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-300 font-sans">SMA 50</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {loading ? '...' : technicals?.movingAverages?.sma50 ? `Rp ${Math.round(technicals.movingAverages.sma50).toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    {(() => {
                      const curPrice = technicals?.price || fundamentals?.price || 0;
                      const sma = technicals?.movingAverages?.sma50 || 0;
                      const isBull = curPrice > sma;
                      return (
                        <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isBull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isBull ? 'Bullish' : 'Bearish'}
                        </span>
                      );
                    })()}
                  </div>

                  {/* EMA 50 */}
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-300 font-sans">EMA 50</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {loading ? '...' : technicals?.movingAverages?.ema50 ? `Rp ${Math.round(technicals.movingAverages.ema50).toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    {(() => {
                      const curPrice = technicals?.price || fundamentals?.price || 0;
                      const ema = technicals?.movingAverages?.ema50 || 0;
                      const isBull = curPrice > ema;
                      return (
                        <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isBull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isBull ? 'Bullish' : 'Bearish'}
                        </span>
                      );
                    })()}
                  </div>

                </div>

                <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-900/60 leading-relaxed font-medium">
                  {(() => {
                    const curPrice = technicals?.price || fundamentals?.price || 0;
                    const sma20 = technicals?.movingAverages?.sma20 || 0;
                    const sma50 = technicals?.movingAverages?.sma50 || 0;
                    
                    if (curPrice > sma20 && curPrice > sma50) {
                      return 'Harga berada di atas rata-rata jangka pendek dan menengah. Ini mengonfirmasi tren naik (uptrend) yang kuat.';
                    } else if (curPrice < sma20 && curPrice < sma50) {
                      return 'Harga berada di bawah rata-rata jangka pendek dan menengah. Sinyal tren turun (downtrend) dominan.';
                    } else {
                      return 'Harga berada di antara rata-rata jangka pendek dan menengah, mengindikasikan fase konsolidasi.';
                    }
                  })()}
                </div>
            </div>

          </div>

          {/* Column 4: Multi-Timeframe Trend */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Analisis Multi-Timeframe (MTF)
            </h4>
            
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-4">
              <div className="space-y-3">
                {/* Weekly (Long-Term) */}
                <div className="flex justify-between items-center text-xs border-b border-slate-800/30 pb-2">
                  <span className="font-semibold text-slate-300 font-sans">Weekly (Jangka Panjang)</span>
                  <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    technicals?.multiTimeframe?.weekly === 'BULLISH'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {loading ? '...' : technicals?.multiTimeframe?.weekly || '-'}
                  </span>
                </div>

                {/* Daily (Medium-Term) */}
                <div className="flex justify-between items-center text-xs border-b border-slate-800/30 pb-2">
                  <span className="font-semibold text-slate-300 font-sans">Daily (Jangka Menengah)</span>
                  <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    technicals?.multiTimeframe?.daily === 'BULLISH'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {loading ? '...' : technicals?.multiTimeframe?.daily || '-'}
                  </span>
                </div>

                {/* Hourly (Jangka Pendek) */}
                <div className="flex justify-between items-center text-xs pb-1">
                  <span className="font-semibold text-slate-300 font-sans">Hourly (Jangka Pendek)</span>
                  <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    technicals?.multiTimeframe?.hourly?.includes('BULLISH')
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : technicals?.multiTimeframe?.hourly?.includes('BEARISH')
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {loading ? '...' : technicals?.multiTimeframe?.hourly || '-'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-900/60 leading-relaxed font-medium mt-3">
                {(() => {
                  const w = technicals?.multiTimeframe?.weekly || '';
                  const d = technicals?.multiTimeframe?.daily || '';
                  const h = technicals?.multiTimeframe?.hourly || '';
                  
                  if (w === 'BULLISH' && d === 'BULLISH') {
                    return 'Tren utama mingguan dan harian selaras dalam kondisi BULLISH. Menawarkan tingkat probabilitas transaksi beli yang paling tinggi.';
                  } else if (w === 'BEARISH' && d === 'BEARISH') {
                    return 'Tren utama mingguan dan harian dalam kondisi BEARISH. Sebaiknya hindari pembelian, tren turun jangka menengah masih dominan.';
                  } else {
                    return 'Terjadi divergensi timeframe (tren mingguan dan harian tidak sejalan). Kondisi ini biasa menunjukkan konsolidasi besar atau transisi pembalikan tren.';
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Bottom narrative for Technical */}
          <div className="px-5 pb-5">
            <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
              <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
                <Activity className="w-3.5 h-3.5" /> Analisis Kesimpulan Teknikal
              </span>
              Secara teknikal, indikator menunjukkan status <span className={`font-bold ${recs.technical.rating.includes('BUY') ? 'text-emerald-400' : recs.technical.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.technical.rating}</span> dengan skor kekuatan sinyal sebesar {recs.technical.score}%. Indikator momentum menunjukkan {recs.technical.desc.charAt(0).toLowerCase() + recs.technical.desc.slice(1)}.
            </div>
          </div>

        </div>
      </div>

      {/* Bandarmology & Cash Flow Dashboard (Fully Separated Section) */}
      <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg flex flex-col h-auto w-full">
        <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-brand-purple" />
            <span className="text-sm font-semibold">Analisis Bandarmology & Arus Kas Transaksi</span>
          </div>
          {technicals?.bandarmologySummary && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              technicals.bandarmologySummary.rating.includes('ACCUMULATION') 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : technicals.bandarmologySummary.rating.includes('DISTRIBUTION')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}>
              Bandarmology: {technicals.bandarmologySummary.rating} ({technicals.bandarmologySummary.score}%)
            </span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Bandarmology & Aliran Asing */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              Aliran Transaksi & Aliran Asing (Foreign Flow)
            </h4>
            
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-4">
              {/* Bandarmology Status & Foreign Flow Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded border border-slate-900 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Bandarmology</span>
                  <span className={`text-xs font-bold mt-1.5 ${
                    technicals?.bandarmology?.status?.includes('ACCUMULATION') 
                      ? 'text-emerald-400' 
                      : technicals?.bandarmology?.status?.includes('DISTRIBUTION')
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}>
                    {loading ? '...' : technicals?.bandarmology?.status || 'NEUTRAL'}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-900 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Aliran Asing (Net Foreign)</span>
                  <span className={`text-xs font-bold mt-1.5 ${
                    (technicals?.bandarmology?.foreignNetBuy || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {loading ? '...' : (technicals?.bandarmology?.foreignNetBuy !== undefined) 
                      ? `${(technicals.bandarmology.foreignNetBuy >= 0 ? '+' : '')}${formatShort(technicals.bandarmology.foreignNetBuy)}` 
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Money Flow Index (MFI 14) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 font-sans">Money Flow Index (MFI 14)</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    (technicals?.moneyFlow?.mfi || 50) < 30 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : (technicals?.moneyFlow?.mfi || 50) > 70 
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {loading ? '...' : technicals?.moneyFlow?.mfi ? technicals.moneyFlow.mfi.toFixed(2) : '-'}
                  </span>
                </div>
                
                {/* MFI Progress Bar */}
                <div className="relative pt-1">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-950 border border-slate-900 relative">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, technicals?.moneyFlow?.mfi || 50))}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        (technicals?.moneyFlow?.mfi || 50) < 30 
                          ? 'bg-emerald-500' 
                          : (technicals?.moneyFlow?.mfi || 50) > 70 
                          ? 'bg-rose-500' 
                          : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Order Flow (Top 3 Broker Summary) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              Broker Summary Order Flow
            </h4>

            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400 font-sans">Order Flow (Top 3 Broker {activeTicker.split('.')[0]})</span>
                {(() => {
                  const rawVal = technicals?.bandarmology?.top3Brokers || '';
                  let statusText = 'Neutral';
                  let badgeClass = 'bg-slate-800 text-slate-400';
                  if (rawVal.includes('Buy')) {
                    statusText = 'NET BUY';
                    badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                  } else if (rawVal.includes('Sell')) {
                    statusText = 'NET SELL';
                    badgeClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                  } else if (rawVal.includes('Neutral')) {
                    statusText = 'NET NEUTRAL';
                    badgeClass = 'bg-slate-850 text-slate-400 border border-slate-800';
                  }
                  return (
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide border ${badgeClass}`}>
                      {loading ? '...' : statusText}
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const detailedBrokers = technicals?.bandarmology?.detailedBrokers;
                if (!detailedBrokers) {
                  const rawVal = technicals?.bandarmology?.top3Brokers || '';
                  const buyMatch = rawVal.match(/Top Buy:\s*([^|]+)/);
                  const sellMatch = rawVal.match(/Top Sell:\s*([^)]+)/);
                  const topBuy = buyMatch ? buyMatch[1].trim() : '-';
                  const topSell = sellMatch ? sellMatch[1].trim() : '-';
                  return (
                    <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <div className="text-slate-500 font-bold mb-1 uppercase tracking-wider">Top Buy</div>
                        <div className="font-mono font-bold text-emerald-400 tracking-wider">
                          {loading ? '...' : topBuy}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <div className="text-slate-500 font-bold mb-1 uppercase tracking-wider">Top Sell</div>
                        <div className="font-mono font-bold text-rose-400 tracking-wider">
                          {loading ? '...' : topSell}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    {/* Buyers Column */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-2">
                      <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider border-b border-slate-900 pb-1 flex justify-between">
                        <span>Broker Buy</span>
                        <span>Estimasi (Lot)</span>
                      </div>
                      <div className="space-y-1.5">
                        {detailedBrokers.buy.map((b: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{b.code}</span>
                            <span className="text-slate-200 font-bold">+{b.lots.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sellers Column */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-2">
                      <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider border-b border-slate-900 pb-1 flex justify-between">
                        <span>Broker Sell</span>
                        <span>Estimasi (Lot)</span>
                      </div>
                      <div className="space-y-1.5">
                        {detailedBrokers.sell.map((s: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">{s.code}</span>
                            <span className="text-slate-200 font-bold">-{s.lots.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Bottom narrative */}
        <div className="px-5 pb-5">
          <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
            <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
              <Compass className="w-3.5 h-3.5" /> Analisis Kesimpulan Bandarmology
            </span>
            Aktivitas Bandarmology terpantau menunjukkan status <span className={`font-bold ${recs.bandarmology?.rating?.includes('ACCUMULATION') ? 'text-emerald-400' : recs.bandarmology?.rating?.includes('DISTRIBUTION') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.bandarmology?.rating || 'NEUTRAL'}</span>. Berdasarkan data aliran transaksi, {recs.bandarmology ? recs.bandarmology.desc.charAt(0).toLowerCase() + recs.bandarmology.desc.slice(1) : ''}. {(() => {
              const status = technicals?.bandarmology?.status || '';
              if (status.includes('ACCUMULATION')) {
                return 'Hal ini mengindikasikan volume beli broker besar (Bandar) mendominasi pasar, menunjukkan potensi harga sedang diakumulasi sebelum kenaikan.';
              } else if (status.includes('DISTRIBUTION')) {
                return 'Hal ini mengindikasikan volume jual broker besar (Bandar) mendominasi pasar, menunjukkan risiko aksi distribusi besar oleh institusi.';
              } else {
                return 'Arus transaksi bandar terpantau seimbang tanpa dominasi akumulasi atau distribusi agresif.';
              }
            })()}
          </div>
        </div>
      </div>

        {/* AI Narrative & Realtime Sentiment Card (Full width, 2 columns inner on desktop) */}
        <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg flex flex-col h-auto w-full">
          <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between text-white">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" /> Sentimen & Narasi Terkini
            </span>
            {fundamentals && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                recs.narrative.rating.includes('BUY') 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : recs.narrative.rating.includes('SELL')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                Analisis Berita: {recs.narrative.rating} ({recs.narrative.score}%)
              </span>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Sentiment & AI Summary */}
            <div className="space-y-4">
              {/* Sentiment Gauge */}
              <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-800/40">
                <span className="text-xs text-slate-400">Rangkuman Sentimen</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  analysis?.sentiment === 'Bullish' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : analysis?.sentiment === 'Bearish'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {analysis?.sentiment || 'Netral'}
                </span>
              </div>

              {/* AI Summary Text */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Analisis AI {analysis?.isAI ? '(Gemini/OpenAI)' : '(Sistem Lokal)'}</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-slate-900 whitespace-pre-line">
                  {loading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-slate-800 rounded w-full"></div>
                      <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                      <div className="h-3 bg-slate-800 rounded w-4/5"></div>
                    </div>
                  ) : (
                    analysis?.summary
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Related News Feed */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Berita Terkait
              </span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-10 bg-slate-900/60 border border-slate-900 rounded-lg animate-pulse" />
                  ))
                ) : news.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">Tidak ada berita yang ditemukan.</div>
                ) : (
                  news.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-slate-900/30 hover:bg-slate-900/80 border border-slate-900 hover:border-brand-purple/20 rounded-xl transition-all duration-200 group"
                    >
                      <h4 className="text-xs font-medium text-slate-200 group-hover:text-white line-clamp-2 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                        <span>{item.source}</span>
                        <span>{item.pubDate ? new Date(item.pubDate).toLocaleDateString('id-ID') : ''}</span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom narrative for Sentiment */}
          <div className="px-5 pb-5">
            <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
              <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5" /> Analisis Kesimpulan Sentimen & Narasi
              </span>
              Berdasarkan analisis sentimen berita terkini, saham ini memiliki rating sentimen <span className={`font-bold ${recs.narrative.rating.includes('BUY') ? 'text-emerald-400' : recs.narrative.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.narrative.rating}</span>. {recs.narrative.desc.charAt(0).toUpperCase() + recs.narrative.desc.slice(1)}. {analysis?.summary ? 'Analisis sentimen mendeteksi poin-poin utama seperti tercantum dalam rangkuman AI di atas.' : ''}
            </div>
          </div>

        </div>
      </div>

      {/* Fundamental Section */}
      <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-900 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-teal-400" /> Ringkasan Fundamental & Keuangan
          </h3>
          {fundamentals && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full max-w-fit ${
              recs.fundamental.rating.includes('BUY') 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : recs.fundamental.rating.includes('SELL')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}>
              Analisis Fundamental: {recs.fundamental.rating} ({recs.fundamental.score}%)
            </span>
          )}
        </div>

        {/* Vertical Stack: Full-Width metrics grid and then Financial Chart */}
        <div className="flex flex-col gap-8 w-full">
          
          {/* Key Financial Metrics (5 columns wide on desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* PE Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">P/E Ratio</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.peRatio ? `${fundamentals.peRatio.toFixed(2)}x` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Valuasi Laba</span>
            </div>

            {/* PBV Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Price to Book (PBV)</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.pbRatio ? `${fundamentals.pbRatio.toFixed(2)}x` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Valuasi Aset</span>
            </div>

            {/* ROE Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ROE</span>
              <span className={`text-lg font-bold mt-1 ${
                fundamentals?.roe > 15 ? 'text-emerald-400' : 'text-white'
              }`}>
                {loading ? '...' : fundamentals?.roe ? `${fundamentals.roe.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Efisiensi Ekuitas</span>
            </div>

            {/* ROA Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ROA</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.roa ? `${fundamentals.roa.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Efisiensi Aset</span>
            </div>

            {/* DER Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">DER (Leverage)</span>
              <span className={`text-lg font-bold mt-1 ${
                fundamentals?.der > 200 ? 'text-rose-400' : 'text-white'
              }`}>
                {loading ? '...' : fundamentals?.der ? `${(fundamentals.der).toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Rasio Utang / Modal</span>
            </div>

            {/* Div Yield Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dividend Yield</span>
              <span className="text-lg font-bold text-teal-400 mt-1">
                {loading ? '...' : fundamentals?.dividendYield ? `${fundamentals.dividendYield.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Yield Dividen</span>
            </div>

            {/* EPS Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">EPS (Trailing)</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.eps ? `Rp ${fundamentals.eps.toFixed(1)}` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Laba Per Saham</span>
            </div>

            {/* Profit Margin Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Net Profit Margin</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.profitMargin ? `${fundamentals.profitMargin.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Marjin Laba Bersih</span>
            </div>

            {/* Market Cap Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between col-span-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Market Cap</span>
              <span className="text-sm font-bold text-white mt-1 truncate">
                {loading ? '...' : formatFinancialNumber(fundamentals?.marketCap)}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">Kapitalisasi Pasar</span>
            </div>
          </div>

          {/* Performance Charts */}
          <div className="border border-slate-900 bg-slate-950/20 p-5 rounded-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400">Kinerja Pendapatan & Laba Bersih</span>
              
              {/* Yearly/Quarterly Switcher */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  onClick={() => setHistoryType('annual')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    historyType === 'annual' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tahunan
                </button>
                <button
                  onClick={() => setHistoryType('quarterly')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    historyType === 'quarterly' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Kuartalan
                </button>
              </div>
            </div>

            {/* Custom SVG Chart */}
            <div className="flex-1 flex flex-col justify-center">
              {loading ? (
                <div className="flex h-[200px] items-center justify-center">
                  <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history ? (
                <FinancialBarChart
                  data={
                    historyType === 'annual'
                      ? history.annual.map(d => ({ label: String(d.year), revenue: d.revenue, netIncome: d.netIncome }))
                      : history.quarterly.map(d => ({ label: d.quarter, revenue: d.revenue, netIncome: d.netIncome }))
                  }
                />
              ) : (
                <div className="flex h-[200px] items-center justify-center text-slate-500 text-xs">
                  Gagal mengambil riwayat finansial
                </div>
              )}
            </div>

            {/* Chart Legend */}
            <div className="flex justify-center gap-6 mt-4 text-[10px] font-semibold text-slate-400 border-t border-slate-900 pt-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-violet-600 rounded-sm" />
                <span>Pendapatan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-teal-500 rounded-sm" />
                <span>Laba Bersih</span>
              </div>
            </div>
          </div>

          {/* Bottom narrative for Fundamental */}
          <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
            <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
              <Building className="w-3.5 h-3.5" /> Analisis Kesimpulan Fundamental
            </span>
            Secara fundamental, kinerja keuangan emiten dinilai berada pada kondisi <span className={`font-bold ${recs.fundamental.rating.includes('BUY') ? 'text-emerald-400' : recs.fundamental.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.fundamental.rating}</span> dengan skor fundamental sebesar {recs.fundamental.score}%. Hal ini dipengaruhi oleh beberapa faktor rasio utama: {recs.fundamental.desc.charAt(0).toUpperCase() + recs.fundamental.desc.slice(1)}.
          </div>

        </div>
      </div>
      </>
      )}
    </div>
  );
}
