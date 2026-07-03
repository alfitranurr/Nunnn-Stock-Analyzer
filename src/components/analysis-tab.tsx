import * as React from 'react';
import { Search, TrendingUp, TrendingDown, BookOpen, Clock, AlertTriangle, RefreshCw, BarChart2, DollarSign, ShieldAlert, Sparkles, Building, Activity, ChevronUp, ChevronDown, Layers, Compass } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cleanCompanyName } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

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
const formatFinancialNumber = (num: number | null, language: string) => {
  if (num === null || isNaN(num)) return '-';
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const loc = language === 'id' ? 'id-ID' : 'en-US';
  const unitT = 'T';
  const unitM = language === 'id' ? 'M' : 'B';
  const unitJ = language === 'id' ? 'Jt' : 'M';
  if (absNum >= 1e12) return `${sign}Rp ${(absNum / 1e12).toFixed(2)} ${unitT}`;
  if (absNum >= 1e9) return `${sign}Rp ${(absNum / 1e9).toFixed(2)} ${unitM}`;
  if (absNum >= 1e6) return `${sign}Rp ${(absNum / 1e6).toFixed(2)} ${unitJ}`;
  return `${sign}Rp ${num.toLocaleString(loc)}`;
};

const formatShort = (num: number, language: string) => {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const loc = language === 'id' ? 'id-ID' : 'en-US';
  const unitT = 'T';
  const unitM = language === 'id' ? 'M' : 'B';
  const unitJ = language === 'id' ? 'Jt' : 'M';
  if (absNum >= 1e12) return `${sign}${(absNum / 1e12).toFixed(1)}${unitT}`;
  if (absNum >= 1e9) return `${sign}${(absNum / 1e9).toFixed(1)}${unitM}`;
  if (absNum >= 1e6) return `${sign}${(absNum / 1e6).toFixed(1)}${unitJ}`;
  return `${sign}${num.toLocaleString(loc)}`;
};

// SVG-based Custom Bar Chart
function FinancialBarChart({ data, language }: { data: ChartData[]; language: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-slate-400">
        {language === 'id' ? 'Data historis tidak tersedia.' : 'Historical data is not available.'}
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
            {formatShort(maxValue, language)}
          </text>
          {hasNegative && (
            <text x={padding.left - 10} y={getY(minValue) + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
              {formatShort(minValue, language)}
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
                  {language === 'id'
                    ? `\nPendapatan: ${formatFinancialNumber(item.revenue, language)}\nLaba Bersih: ${formatFinancialNumber(item.netIncome, language)}`
                    : `\nRevenue: ${formatFinancialNumber(item.revenue, language)}\nNet Income: ${formatFinancialNumber(item.netIncome, language)}`}
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
  const { language, t } = useLanguage();
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
  const [analysis, setAnalysis] = React.useState<{ sentiment: string; summary: string; isAI: boolean; modelUsed?: string } | null>(null);
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

  const fetchAnalysisData = React.useCallback(async (symbol: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Fundamentals
      const fundRes = await fetch(`/api/analysis/fundamentals?symbol=${symbol}`);
      if (!fundRes.ok) {
        const err = await fundRes.json();
        throw new Error(err.error || (language === 'id' ? 'Gagal memuat data fundamental.' : 'Failed to load fundamental data.'));
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
        throw new Error(err.error || (language === 'id' ? 'Gagal memuat berita.' : 'Failed to load news.'));
      }
      const newsData = await newsRes.json();

      setFundamentals(fundData.fundamentals);
      setHistory(fundData.history);
      setTechnicals(techData);
      setNews(newsData.news || []);
      setAnalysis(newsData.analysis || null);
    } catch (err: any) {
      console.error('Error fetching stock analysis:', err);
      setErrorMsg(err.message || (language === 'id' ? 'Terjadi kesalahan saat memuat data analisis.' : 'An error occurred while loading analysis data.'));
    } finally {
      setLoading(false);
    }
  }, [language]);

  // Listen for initialTicker changes
  React.useEffect(() => {
    if (initialTicker) {
      const cleanTicker = initialTicker.toUpperCase().trim();
      const timer = setTimeout(() => {
        setActiveTicker(cleanTicker);
        setTickerQuery(cleanTicker);
        setHasAnalyzed(true);
        fetchAnalysisData(cleanTicker);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialTicker, fetchAnalysisData]);

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
      <div className="relative overflow-hidden border border-border-color p-8 md:p-12 text-center bg-card-bg rounded-2xl max-w-2xl mx-auto my-12 shadow-xl animate-fadeIn">
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-purple" />
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-brand-purple/10 border border-brand-purple/20 rounded-full animate-pulse">
            <ShieldAlert className="w-12 h-12 text-brand-purple" />
          </div>
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
          {t('analysis.lockedTitle')}
        </h2>
        <p className="mb-8 text-sm md:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
          {t('analysis.lockedDesc')}
        </p>
        <button
          onClick={onSignInClick}
          className="px-8 py-3.5 bg-brand-purple hover:bg-brand-purple/90 text-white font-medium rounded-xl transition-all duration-300 shadow-md hover:scale-[1.02]"
        >
          {t('analysis.loginButton')}
        </button>
      </div>
    );
  }

  const getAnalysisRecommendations = () => {
    if (!fundamentals) {
      return {
        fundamental: { rating: 'HOLD', score: 50, desc: language === 'id' ? 'Menunggu data fundamental...' : 'Waiting for fundamental data...' },
        technical: { rating: 'HOLD', score: 50, desc: language === 'id' ? 'Menunggu data teknikal...' : 'Waiting for technical data...' },
        bandarmology: { rating: 'NEUTRAL', score: 50, desc: language === 'id' ? 'Menunggu data bandarmology...' : 'Waiting for bandarmology data...' },
        narrative: { rating: 'HOLD', score: 50, desc: language === 'id' ? 'Menunggu sentimen berita...' : 'Waiting for news sentiment...' },
        unified: { rating: 'HOLD', score: 50, desc: language === 'id' ? 'Menunggu analisa...' : 'Waiting for analysis...' },
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
        reasons.push(language === 'id' ? 'EPS negatif (merugi)' : 'Negative EPS (losing money)');
      } else if (pe < 12) {
        fundPoints += 2;
        reasons.push(language === 'id' ? 'P/E rendah (< 12x)' : 'Low P/E (< 12x)');
      } else if (pe < 22) {
        fundPoints += 1;
        reasons.push(language === 'id' ? 'P/E wajar (12x - 22x)' : 'Fair P/E (12x - 22x)');
      } else {
        fundPoints -= 1;
        reasons.push(language === 'id' ? 'P/E tinggi (> 22x)' : 'High P/E (> 22x)');
      }
    }

    const pb = fundamentals.pbRatio;
    if (pb !== null && pb !== undefined) {
      fundMaxPoints += 2;
      if (pb < 1.2) {
        fundPoints += 2;
        reasons.push(language === 'id' ? 'PBV sangat murah (< 1.2x)' : 'Very cheap PBV (< 1.2x)');
      } else if (pb < 3.0) {
        fundPoints += 1;
        reasons.push(language === 'id' ? 'PBV wajar (1.2x - 3.0x)' : 'Fair PBV (1.2x - 3.0x)');
      } else {
        fundPoints -= 1;
        reasons.push(language === 'id' ? 'PBV tinggi (> 3.0x)' : 'High PBV (> 3.0x)');
      }
    }

    const roe = fundamentals.roe;
    if (roe !== null && roe !== undefined) {
      fundMaxPoints += 2;
      if (roe > 15) {
        fundPoints += 2;
        reasons.push(language === 'id' ? 'ROE tinggi (> 15%)' : 'High ROE (> 15%)');
      } else if (roe > 8) {
        fundPoints += 1;
        reasons.push(language === 'id' ? 'ROE sehat (8% - 15%)' : 'Healthy ROE (8% - 15%)');
      } else if (roe <= 0) {
        fundPoints -= 2;
        reasons.push(language === 'id' ? 'ROE negatif' : 'Negative ROE');
      }
    }

    const der = fundamentals.der;
    if (der !== null && der !== undefined) {
      fundMaxPoints += 1;
      if (der < 80) {
        fundPoints += 1;
        reasons.push(language === 'id' ? 'DER rendah (< 80%)' : 'Low DER (< 80%)');
      } else if (der > 200) {
        fundPoints -= 1;
        reasons.push(language === 'id' ? 'DER tinggi (> 200%)' : 'High DER (> 200%)');
      }
    }

    const pm = fundamentals.profitMargin;
    if (pm !== null && pm !== undefined) {
      fundMaxPoints += 1;
      if (pm > 15) {
        fundPoints += 1;
        reasons.push(language === 'id' ? 'NPM tinggi (> 15%)' : 'High NPM (> 15%)');
      } else if (pm < 0) {
        fundPoints -= 1;
        reasons.push(language === 'id' ? 'NPM negatif' : 'Negative NPM');
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
      : (language === 'id' ? 'rasio fundamental berada pada level netral' : 'fundamental ratios are at a neutral level');

    // 2. TECHNICAL EVALUATION
    const techScore = technicals?.summary?.score ?? 50;
    const techRating = technicals?.summary?.rating ?? 'NEUTRAL';
    let techDesc = language === 'id' ? 'kondisi RSI netral dan MA berkonsolidasi' : 'RSI is neutral and MA is consolidating';
    if (technicals) {
      const rsiVal = technicals.rsi?.value;
      const rsiSig = technicals.rsi?.signal;
      const macdSig = technicals.macd?.signalName;
      techDesc = language === 'id'
        ? `RSI di level ${rsiVal?.toFixed(1)} (${rsiSig}), tren MACD ${macdSig || 'Netral'}, serta Moving Averages harian`
        : `RSI level ${rsiVal?.toFixed(1)} (${rsiSig}), MACD trend ${macdSig || 'Neutral'}, and daily Moving Averages`;
    }

    // 3. BANDARMOLOGY EVALUATION
    const bandarScore = technicals?.bandarmologySummary?.score ?? 50;
    const bandarRating = technicals?.bandarmologySummary?.rating ?? 'NEUTRAL';
    let bandarDesc = language === 'id' ? 'aliran dana masuk dan keluar terpantau seimbang' : 'inflow and outflow of funds are balanced';
    if (technicals) {
      const bandarStatus = technicals.bandarmology?.status || 'NEUTRAL';
      const foreignNet = technicals.bandarmology?.foreignNetBuy || 0;
      const mfiVal = technicals.moneyFlow?.mfi || 50;
      bandarDesc = language === 'id'
        ? `aktivitas Bandarmology berstatus ${bandarStatus}, akumulasi asing bersih sebesar ${formatShort(foreignNet, language)}, dan Money Flow Index (MFI) di level ${mfiVal.toFixed(1)}`
        : `Bandarmology activity status is ${bandarStatus}, net foreign accumulation of ${formatShort(foreignNet, language)}, and Money Flow Index (MFI) at ${mfiVal.toFixed(1)}`;
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

    const sentimentTranslated = language === 'id'
      ? (sentiment === 'Bullish' ? 'Bullish' : sentiment === 'Bearish' ? 'Bearish' : 'Netral')
      : (sentiment === 'Bullish' ? 'Bullish' : sentiment === 'Bearish' ? 'Bearish' : 'Neutral');

    const narrDesc = analysis?.summary 
      ? (language === 'id' ? `sentimen cenderung ${sentimentTranslated.toLowerCase()}` : `sentiment tends to be ${sentimentTranslated.toLowerCase()}`)
      : (language === 'id' ? `sentimen pasar terpantau ${sentimentTranslated.toLowerCase()}` : `market sentiment observed is ${sentimentTranslated.toLowerCase()}`);

    // 5. UNIFIED CONSENSUS (25% Fundamental, 25% Technical, 25% Bandarmology, 25% Narrative)
    const unifiedScore = Math.round((fundScore * 0.25) + (techScore * 0.25) + (bandarScore * 0.25) + (narrScore * 0.25));
    
    let unifiedRating = 'HOLD';
    if (unifiedScore >= 75) unifiedRating = 'STRONG BUY';
    else if (unifiedScore >= 55) unifiedRating = 'BUY';
    else if (unifiedScore <= 25) unifiedRating = 'STRONG SELL';
    else if (unifiedScore <= 45) unifiedRating = 'SELL';

    const tickerName = activeTicker.split('.')[0];
    const unifiedDesc = language === 'id'
      ? `Sinyal utama gabungan untuk ${tickerName} merekomendasikan ${unifiedRating} dengan skor akumulasi ${unifiedScore}%. Secara fundamental dinilai ${fundRating} karena ${fundDesc}. Dari sisi teknikal, indikator menunjukkan status ${techRating} berdasarkan ${techDesc}. Di sisi Bandarmology, transaksi berstatus ${bandarRating} dengan ${bandarDesc}. Sedangkan aspek narasi/berita merekomendasikan ${narrRating} dengan sentimen pasar cenderung ${sentiment.toLowerCase()}.`
      : `Unified consensus signals for ${tickerName} recommend ${unifiedRating} with an accumulated score of ${unifiedScore}%. Fundamentally rated ${fundRating} due to ${fundDesc}. Technically, indicators show a status of ${techRating} based on ${techDesc}. In Bandarmology, transactions are ${bandarRating} with ${bandarDesc}. Meanwhile, the narrative/news aspect recommends ${narrRating} with market sentiment tending to be ${sentiment.toLowerCase()}.`;

    // Pros & Cons calculation
    const pros: string[] = [];
    const cons: string[] = [];

    // Fundamental Pros & Cons
    if (pe !== null && pe !== undefined) {
      if (pe < 0) cons.push(language === 'id' ? 'Laba EPS negatif (perusahaan merugi)' : 'Negative EPS earnings (company losing money)');
      else if (pe < 12) pros.push(language === 'id' ? `Valuasi P/E murah (${pe.toFixed(1)}x)` : `Cheap P/E valuation (${pe.toFixed(1)}x)`);
      else if (pe < 22) pros.push(language === 'id' ? `Valuasi P/E wajar (${pe.toFixed(1)}x)` : `Fair P/E valuation (${pe.toFixed(1)}x)`);
      else cons.push(language === 'id' ? `Valuasi P/E tinggi/mahal (${pe.toFixed(1)}x)` : `High/expensive P/E valuation (${pe.toFixed(1)}x)`);
    }
    if (pb !== null && pb !== undefined) {
      if (pb < 1.2) pros.push(language === 'id' ? `Valuasi PBV sangat murah (${pb.toFixed(1)}x)` : `Very cheap PBV valuation (${pb.toFixed(1)}x)`);
      else if (pb < 3.0) pros.push(language === 'id' ? `Valuasi PBV wajar (${pb.toFixed(1)}x)` : `Fair PBV valuation (${pb.toFixed(1)}x)`);
      else cons.push(language === 'id' ? `Valuasi PBV tinggi/mahal (${pb.toFixed(1)}x)` : `High/expensive PBV valuation (${pb.toFixed(1)}x)`);
    }
    if (roe !== null && roe !== undefined) {
      if (roe > 15) pros.push(language === 'id' ? `Profitabilitas ROE tinggi (${roe.toFixed(1)}%)` : `High ROE profitability (${roe.toFixed(1)}%)`);
      else if (roe > 8) pros.push(language === 'id' ? `Profitabilitas ROE sehat (${roe.toFixed(1)}%)` : `Healthy ROE profitability (${roe.toFixed(1)}%)`);
      else if (roe <= 0) cons.push(language === 'id' ? `Profitabilitas ROE negatif (${roe.toFixed(1)}%)` : `Negative ROE profitability (${roe.toFixed(1)}%)`);
      else cons.push(language === 'id' ? `Profitabilitas ROE rendah (${roe.toFixed(1)}%)` : `Low ROE profitability (${roe.toFixed(1)}%)`);
    }
    if (der !== null && der !== undefined) {
      if (der < 80) pros.push(language === 'id' ? `Rasio utang DER rendah/aman (${der.toFixed(1)}%)` : `Low/safe DER debt ratio (${der.toFixed(1)}%)`);
      else if (der > 200) cons.push(language === 'id' ? `Rasio utang DER tinggi/berisiko (${der.toFixed(1)}%)` : `High/risky DER debt ratio (${der.toFixed(1)}%)`);
    }
    if (pm !== null && pm !== undefined) {
      if (pm > 15) pros.push(language === 'id' ? `Margin laba bersih NPM tinggi (${pm.toFixed(1)}%)` : `High NPM net profit margin (${pm.toFixed(1)}%)`);
      else if (pm < 0) cons.push(language === 'id' ? `Margin laba bersih NPM negatif (${pm.toFixed(1)}%)` : `Negative NPM net profit margin (${pm.toFixed(1)}%)`);
    }

    // Technical Pros & Cons
    if (technicals) {
      const rsiVal = technicals.rsi?.value;
      if (rsiVal !== undefined) {
        if (rsiVal < 30) pros.push(language === 'id' ? `Momentum RSI Jenuh Jual / Oversold (${rsiVal.toFixed(1)})` : `RSI Momentum Oversold (${rsiVal.toFixed(1)})`);
        else if (rsiVal > 70) cons.push(language === 'id' ? `Momentum RSI Jenuh Beli / Overbought (${rsiVal.toFixed(1)})` : `RSI Momentum Overbought (${rsiVal.toFixed(1)})`);
      }
      const macdSig = technicals.macd?.signalName;
      if (macdSig) {
        if (macdSig.includes('Bullish')) pros.push(language === 'id' ? `Indikator MACD: ${macdSig}` : `MACD Indicator: ${macdSig}`);
        else if (macdSig.includes('Bearish')) cons.push(language === 'id' ? `Indikator MACD: ${macdSig}` : `MACD Indicator: ${macdSig}`);
      }
      const curPrice = technicals.price || fundamentals.price || 0;
      const sma20 = technicals.movingAverages?.sma20;
      const sma50 = technicals.movingAverages?.sma50;
      if (curPrice && sma20 && sma50) {
        if (curPrice > sma20 && curPrice > sma50) pros.push(language === 'id' ? 'Moving Averages: Uptrend kuat (di atas SMA 20 & 50)' : 'Moving Averages: Strong uptrend (above SMA 20 & 50)');
        else if (curPrice < sma20 && curPrice < sma50) cons.push(language === 'id' ? 'Moving Averages: Downtrend kuat (di bawah SMA 20 & 50)' : 'Moving Averages: Strong downtrend (below SMA 20 & 50)');
      }
      const w = technicals.multiTimeframe?.weekly;
      const d = technicals.multiTimeframe?.daily;
      if (w === 'BULLISH') pros.push(language === 'id' ? 'Tren Mingguan (Weekly): Bullish' : 'Weekly Trend (Weekly): Bullish');
      if (w === 'BEARISH') cons.push(language === 'id' ? 'Tren Mingguan (Weekly): Bearish' : 'Weekly Trend (Weekly): Bearish');
      if (d === 'BULLISH') pros.push(language === 'id' ? 'Tren Harian (Daily): Bullish' : 'Daily Trend (Daily): Bullish');
      if (d === 'BEARISH') cons.push(language === 'id' ? 'Tren Harian (Daily): Bearish' : 'Daily Trend (Daily): Bearish');
    }

    // Bandarmology Pros & Cons
    if (technicals) {
      const status = technicals.bandarmology?.status || '';
      if (status.includes('ACCUMULATION')) pros.push(language === 'id' ? `Bandarmology: Akumulasi volume (${status})` : `Bandarmology: Volume accumulation (${status})`);
      else if (status.includes('DISTRIBUTION')) cons.push(language === 'id' ? `Bandarmology: Distribusi volume (${status})` : `Bandarmology: Volume distribution (${status})`);

      const foreignNet = technicals.bandarmology?.foreignNetBuy || 0;
      if (foreignNet > 0) pros.push(language === 'id' ? `Aliran Asing (Net Foreign Buy): +${formatShort(foreignNet, language)}` : `Net Foreign Buy: +${formatShort(foreignNet, language)}`);
      else if (foreignNet < 0) cons.push(language === 'id' ? `Aliran Asing (Net Foreign Sell): ${formatShort(foreignNet, language)}` : `Net Foreign Sell: ${formatShort(foreignNet, language)}`);

      const mfiVal = technicals.moneyFlow?.mfi;
      if (mfiVal !== undefined) {
        if (mfiVal < 30) pros.push(language === 'id' ? `Aliran Dana (MFI) Jenuh Jual (${mfiVal.toFixed(1)})` : `Money Flow (MFI) Oversold (${mfiVal.toFixed(1)})`);
        else if (mfiVal > 70) cons.push(language === 'id' ? `Aliran Dana (MFI) Jenuh Beli (${mfiVal.toFixed(1)})` : `Money Flow (MFI) Overbought (${mfiVal.toFixed(1)})`);
      }
    }

    // Sentiment Pros & Cons
    if (sentiment === 'Bullish') pros.push(language === 'id' ? 'Sentimen Media/Berita: Positif/Bullish' : 'Media/News Sentiment: Positive/Bullish');
    else if (sentiment === 'Bearish') cons.push(language === 'id' ? 'Sentimen Media/Berita: Negatif/Bearish' : 'Media/News Sentiment: Negative/Bearish');

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
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card-bg via-[#161b22] to-[#0d1117] p-6 md:p-8 shadow-2xl w-full z-50">
        <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 w-full">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              <BarChart2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>{language === 'id' ? 'Analisis Finansial & Teknikal Saham' : 'Stock Financial & Technical Analysis'}</span>
            </div>
            
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
              {t('analysis.title')}
              <Sparkles className="h-6 w-6 text-emerald-400 shrink-0" />
            </h1>
            
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed w-full">
              {language === 'id' ? 'Emiten aktif' : 'Active Ticker'}: <span className="font-bold text-emerald-400">{activeTicker.split('.')[0]}</span> - {language === 'id' ? 'Bursa Efek Indonesia (BEI / IDX)' : 'Indonesia Stock Exchange (IDX)'}
            </p>
          </div>

          {/* Refresh and Smart Search Bar Container */}
          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
            {hasAnalyzed && (
              <button
                onClick={() => fetchAnalysisData(activeTicker)}
                disabled={loading}
                className="p-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}

            {/* Smart Search Bar */}
            <div ref={containerRef} className="relative w-full md:w-80">
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('analysis.searchPlaceholder')}
                    value={tickerQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-input-bg border border-border-color rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
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
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">{cleanCompanyName(item.name)}</span>
                  </button>
                ))}
                
                {/* Fallback Option for Custom Query */}
                {tickerQuery.trim().length > 0 && !suggestions.some(item => item.symbol.toUpperCase() === tickerQuery.toUpperCase().trim()) && (
                  <button
                    onClick={() => handleSelectSuggestion(tickerQuery)}
                    className="w-full text-left px-4 py-3 hover:bg-brand-purple/10 transition-colors flex items-center gap-2 text-brand-purple font-medium"
                  >
                    <Search className="w-4 h-4 text-brand-purple" />
                    <span className="text-sm">{language === 'id' ? 'Analisis Saham' : 'Analyze Stock'} &quot;{tickerQuery.toUpperCase().trim()}&quot;</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
            {t('analysis.popularTitle')}
          </h3>
          <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            {t('analysis.popularDesc')}
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
              <div className="relative overflow-hidden border border-border-color bg-card-bg rounded-2xl p-6 w-full animate-fadeIn">
                {/* Top gradient strip */}
                <div className="absolute top-0 left-0 w-full h-1 bg-brand-purple" />
                
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  {/* Left Side: Summary & Sinyal Utama */}
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-brand-purple animate-pulse" />
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('analysis.consensusTitle')}</span>
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
                        {t('analysis.consensusScore').replace('{score}', String(recs.unified.score))}
                      </span>
                    </div>
  
                    <p className="text-xs sm:text-sm text-slate-350 leading-relaxed max-w-3xl border-l-2 border-brand-purple/40 pl-3">
                      {language === 'id' ? (
                        <>
                          Sinyal utama gabungan untuk <span className="font-bold text-white">{activeTicker.split('.')[0]}</span> menyimpulkan rekomendasi <span className={`font-black uppercase ${recs.unified.rating.includes('BUY') ? 'text-emerald-400' : recs.unified.rating.includes('SELL') ? 'text-rose-400' : 'text-yellow-400'}`}>{recs.unified.rating}</span> (Skor: {recs.unified.score}%).
                        </>
                      ) : (
                        <>
                          Unified consensus signals for <span className="font-bold text-white">{activeTicker.split('.')[0]}</span> recommend <span className={`font-black uppercase ${recs.unified.rating.includes('BUY') ? 'text-emerald-400' : recs.unified.rating.includes('SELL') ? 'text-rose-400' : 'text-yellow-400'}`}>{recs.unified.rating}</span> (Score: {recs.unified.score}%).
                        </>
                      )}
                    </p>

                    {/* Visual Pros & Cons Grid for Quick Digest */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-w-4xl w-full">
                      {/* Pros (Kekuatan) */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-500/10 pb-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> {t('analysis.prosTitle')}
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
                            <li className="text-[11px] text-slate-500 italic">{t('analysis.noPros')}</li>
                          )}
                        </ul>
                      </div>

                      {/* Cons (Risiko) */}
                      <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-500/10 pb-1.5">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> {language === 'id' ? 'Sinyal Risiko & Kelemahan' : 'Risk & Weakness Signals'}
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
                            <li className="text-[11px] text-slate-500 italic">{language === 'id' ? 'Tidak ada risiko kritis yang terdeteksi.' : 'No critical risks detected.'}</li>
                          )}
                        </ul>
                      </div>
                    </div>
  
                    {/* Sub-breakdowns */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 w-full">
                      {/* Fundamental */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{language === 'id' ? 'Analisa Fundamental' : 'Fundamental Analysis'}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-xs font-bold ${
                            recs.fundamental.rating.includes('BUY') ? 'text-emerald-400' : recs.fundamental.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'
                          }`}>{recs.fundamental.rating}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">{recs.fundamental.score}%</span>
                        </div>
                      </div>
  
                      {/* Teknikal */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900/60 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{language === 'id' ? 'Analisa Teknikal' : 'Technical Analysis'}</div>
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
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{language === 'id' ? 'Analisa Narasi' : 'Narrative Analysis'}</div>
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
                    
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">{language === 'id' ? 'Sinyal Konsensus Meter' : 'Consensus Signal Meter'}</span>
                    
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
                      <span className="text-[11px] text-slate-400 font-medium">{language === 'id' ? 'Kesimpulan: ' : 'Verdict: '}</span>
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
              <TrendingUp className="w-4 h-4 text-emerald-400" /> {language === 'id' ? 'Chart Teknikal Profesional (TradingView)' : 'Professional Technical Chart (TradingView)'}
            </span>
          </div>
          
          <div className="flex-1 bg-slate-950 relative">
            {/* Embedded TradingView Interactive Widget */}
            <iframe
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tradingViewSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e293b&theme=dark&style=1&timezone=Asia%2FJakarta&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22PivotPointsStandard%40tv-basicstudies%22%5D&locale=${language === 'id' ? 'id' : 'en'}`}
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
              <span className="text-sm font-semibold">{language === 'id' ? 'Dashboard Indikator Teknikal Harian' : 'Daily Technical Indicators Dashboard'}</span>
            </div>
            {technicals?.summary && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                technicals.summary.rating.includes('BUY') 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : technicals.summary.rating.includes('SELL')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {language === 'id' ? 'Rekomendasi' : 'Recommendation'}: {technicals.summary.rating} ({technicals.summary.score}%)
              </span>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Oscillators (RSI & MACD) */}
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                {language === 'id' ? 'Osilator (RSI & MACD)' : 'Oscillators (RSI & MACD)'}
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
                    <span>{language === 'id' ? 'Jenuh Jual (30)' : 'Oversold (30)'}</span>
                    <span>{language === 'id' ? 'Netral (50)' : 'Neutral (50)'}</span>
                    <span>{language === 'id' ? 'Jenuh Beli (70)' : 'Overbought (70)'}</span>
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
                          : 'bg-brand-purple'
                      }`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {(technicals?.rsi?.value || 50) < 30 
                    ? (language === 'id' ? 'Harga berada di area jenuh jual (Oversold), peluang untuk akumulasi beli.' : 'Price is in the oversold area, opportunity for buy accumulation.') 
                    : (technicals?.rsi?.value || 50) > 70 
                    ? (language === 'id' ? 'Harga berada di area jenuh beli (Overbought), rawan aksi ambil untung (profit taking).' : 'Price is in the overbought area, prone to profit-taking actions.') 
                    : (language === 'id' ? 'Momentum harga netral, cenderung konsolidasi.' : 'Price momentum is neutral, tending to consolidate.')}
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
                    ? (language === 'id'
                        ? `Terjadi crossover ${technicals.macd.signalName.toLowerCase()}, sinyal perubahan tren kuat!`
                        : `Crossover occurred ${technicals.macd.signalName.toLowerCase()}, strong trend reversal signal!`)
                    : (technicals?.macd?.histogram || 0) >= 0
                    ? (language === 'id'
                        ? 'Histogram positif menunjukkan momentum kenaikan (bullish) masih berlanjut.'
                        : 'Positive histogram indicates upward (bullish) momentum continues.')
                    : (language === 'id'
                        ? 'Histogram negatif menunjukkan tekanan jual (bearish) masih berlanjut.'
                        : 'Negative histogram indicates downward (bearish) pressure continues.')}
                </p>
              </div>
            </div>

            {/* Column 2: Pivot Points (Support & Resistance) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-purple" /> Support & Resistance
                </h4>
                <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[9px] font-bold">
                  <button
                    onClick={() => setPivotMethod('standard')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      pivotMethod === 'standard' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {language === 'id' ? 'Standar' : 'Standard'}
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
                        <span className="text-rose-400 font-semibold">{language === 'id' ? 'Resistansi 3 (R3)' : 'Resistance 3 (R3)'}</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r3 ? `Rp ${Math.round(levels.r3).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>
                      {/* R2 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-rose-400/80 font-semibold">{language === 'id' ? 'Resistansi 2 (R2)' : 'Resistance 2 (R2)'}</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r2 ? `Rp ${Math.round(levels.r2).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>
                      {/* R1 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-rose-400/60 font-semibold">{language === 'id' ? 'Resistansi 1 (R1)' : 'Resistance 1 (R1)'}</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.r1 ? `Rp ${Math.round(levels.r1).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>
                      
                      {/* Pivot Point */}
                      <div className="flex justify-between items-center py-1 bg-slate-950/60 px-2 rounded border border-slate-800/60 my-1">
                        <span className="text-cyan-400 font-bold">Pivot Point (PP)</span>
                        <span className="font-bold text-white">
                          {loading ? '...' : levels.pp ? `Rp ${Math.round(levels.pp).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>

                      {/* S1 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-emerald-500/60 font-semibold">Support 1 (S1)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s1 ? `Rp ${Math.round(levels.s1).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>
                      {/* S2 */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                        <span className="text-emerald-500/80 font-semibold">Support 2 (S2)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s2 ? `Rp ${Math.round(levels.s2).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>
                      {/* S3 */}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-emerald-500 font-semibold">Support 3 (S3)</span>
                        <span className="text-slate-200">
                          {loading ? '...' : levels.s3 ? `Rp ${Math.round(levels.s3).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
                        </span>
                      </div>

                      {/* Current Price Comparison */}
                      {currentPrice > 0 && (
                        <div className="text-[10px] text-slate-400 text-center pt-3 border-t border-slate-800 mt-2 font-sans">
                          {language === 'id' ? 'Harga saat ini' : 'Current price'} (<span className="text-slate-200 font-bold font-mono">Rp {currentPrice.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}</span>){' '}
                          {currentPrice > levels.pp 
                            ? (language === 'id' ? 'berada di atas Pivot Point (Tren Bullish jangka pendek).' : 'is above Pivot Point (Short-term Bullish Trend).') 
                            : (language === 'id' ? 'berada di bawah Pivot Point (Tren Bearish jangka pendek).' : 'is below Pivot Point (Short-term Bearish Trend).')}
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
                        {loading ? '...' : technicals?.movingAverages?.sma20 ? `Rp ${Math.round(technicals.movingAverages.sma20).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
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
                        {loading ? '...' : technicals?.movingAverages?.ema20 ? `Rp ${Math.round(technicals.movingAverages.ema20).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
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
                        {loading ? '...' : technicals?.movingAverages?.sma50 ? `Rp ${Math.round(technicals.movingAverages.sma50).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
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
                        {loading ? '...' : technicals?.movingAverages?.ema50 ? `Rp ${Math.round(technicals.movingAverages.ema50).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}` : '-'}
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
                      return language === 'id'
                        ? 'Harga berada di atas rata-rata jangka pendek dan menengah. Ini mengonfirmasi tren naik (uptrend) yang kuat.'
                        : 'Price is above short-term and medium-term averages. This confirms a strong uptrend.';
                    } else if (curPrice < sma20 && curPrice < sma50) {
                      return language === 'id'
                        ? 'Harga berada di bawah rata-rata jangka pendek dan menengah. Sinyal tren turun (downtrend) dominan.'
                        : 'Price is below short-term and medium-term averages. Dominant downtrend signal.';
                    } else {
                      return language === 'id'
                        ? 'Harga berada di antara rata-rata jangka pendek dan menengah, mengindikasikan fase konsolidasi.'
                        : 'Price is between short-term and medium-term averages, indicating a consolidation phase.';
                    }
                  })()}
                </div>
            </div>

          </div>

          {/* Column 4: Multi-Timeframe Trend */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> {language === 'id' ? 'Analisis Multi-Timeframe (MTF)' : 'Multi-Timeframe Analysis (MTF)'}
            </h4>
            
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-4">
              <div className="space-y-3">
                {/* Weekly (Long-Term) */}
                <div className="flex justify-between items-center text-xs border-b border-slate-800/30 pb-2">
                  <span className="font-semibold text-slate-300 font-sans">{language === 'id' ? 'Weekly (Jangka Panjang)' : 'Weekly (Long-Term)'}</span>
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
                  <span className="font-semibold text-slate-300 font-sans">{language === 'id' ? 'Daily (Jangka Menengah)' : 'Daily (Medium-Term)'}</span>
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
                  <span className="font-semibold text-slate-300 font-sans">{language === 'id' ? 'Hourly (Jangka Pendek)' : 'Hourly (Short-Term)'}</span>
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
                    return language === 'id'
                      ? 'Tren utama mingguan dan harian selaras dalam kondisi BULLISH. Menawarkan tingkat probabilitas transaksi beli yang paling tinggi.'
                      : 'Weekly and daily primary trends align in BULLISH condition. Offers the highest probability of buy transactions.';
                  } else if (w === 'BEARISH' && d === 'BEARISH') {
                    return language === 'id'
                      ? 'Tren utama mingguan dan harian dalam kondisi BEARISH. Sebaiknya hindari pembelian, tren turun jangka menengah masih dominan.'
                      : 'Weekly and daily primary trends in BEARISH condition. Avoid buying, medium-term downtrend is still dominant.';
                  } else {
                    return language === 'id'
                      ? 'Terjadi divergensi timeframe (tren mingguan dan harian tidak sejalan). Kondisi ini biasa menunjukkan konsolidasi besar atau transisi pembalikan tren.'
                      : 'Timeframe divergence occurred (weekly and daily trends do not align). This condition usually indicates major consolidation or trend reversal transition.';
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Bottom narrative for Technical */}
          <div className="px-5 pb-5">
            <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
              <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
                <Activity className="w-3.5 h-3.5" /> {language === 'id' ? 'Analisis Kesimpulan Teknikal' : 'Technical Analysis Conclusion'}
              </span>
              {language === 'id' ? (
                <>
                  Secara teknikal, indikator menunjukkan status <span className={`font-bold ${recs.technical.rating.includes('BUY') ? 'text-emerald-400' : recs.technical.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.technical.rating}</span> dengan skor kekuatan sinyal sebesar {recs.technical.score}%. Indikator momentum menunjukkan {recs.technical.desc.charAt(0).toLowerCase() + recs.technical.desc.slice(1)}.
                </>
              ) : (
                <>
                  Technically, the indicators show a status of <span className={`font-bold ${recs.technical.rating.includes('BUY') ? 'text-emerald-400' : recs.technical.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.technical.rating}</span> with a signal strength score of {recs.technical.score}%. Momentum indicators show {recs.technical.desc.charAt(0).toLowerCase() + recs.technical.desc.slice(1)}.
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bandarmology & Cash Flow Dashboard (Fully Separated Section) */}
      <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg flex flex-col h-auto w-full">
        <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-brand-purple" />
            <span className="text-sm font-semibold">{language === 'id' ? 'Analisis Bandarmology & Arus Kas Transaksi' : 'Bandarmology & Transaction Cash Flow Analysis'}</span>
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
              {language === 'id' ? 'Aliran Transaksi & Aliran Asing (Foreign Flow)' : 'Transaction Flow & Foreign Flow'}
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
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">{language === 'id' ? 'Aliran Asing (Net Foreign)' : 'Net Foreign Flow'}</span>
                  <span className={`text-xs font-bold mt-1.5 ${
                    (technicals?.bandarmology?.foreignNetBuy || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {loading ? '...' : (technicals?.bandarmology?.foreignNetBuy !== undefined) 
                      ? `${(technicals.bandarmology.foreignNetBuy >= 0 ? '+' : '')}${formatShort(technicals.bandarmology.foreignNetBuy, language)}` 
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
                          : 'bg-brand-purple'
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
                <span className="font-semibold text-slate-400 font-sans">{language === 'id' ? `Order Flow (Top 3 Broker ${activeTicker.split('.')[0]})` : `Order Flow (Top 3 Brokers for ${activeTicker.split('.')[0]})`}</span>
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
                        <span>{language === 'id' ? 'Broker Buy' : 'Brokers (Buy)'}</span>
                        <span>{language === 'id' ? 'Estimasi (Lot)' : 'Est. (Lots)'}</span>
                      </div>
                      <div className="space-y-1.5">
                        {detailedBrokers.buy.map((b: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{b.code}</span>
                            <span className="text-slate-200 font-bold">+{b.lots.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sellers Column */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-2">
                      <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider border-b border-slate-900 pb-1 flex justify-between">
                        <span>{language === 'id' ? 'Broker Sell' : 'Brokers (Sell)'}</span>
                        <span>{language === 'id' ? 'Estimasi (Lot)' : 'Est. (Lots)'}</span>
                      </div>
                      <div className="space-y-1.5">
                        {detailedBrokers.sell.map((s: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">{s.code}</span>
                            <span className="text-slate-200 font-bold">-{s.lots.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}</span>
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
              <Compass className="w-3.5 h-3.5" /> {language === 'id' ? 'Analisis Kesimpulan Bandarmology' : 'Bandarmology Analysis Conclusion'}
            </span>
            {language === 'id' ? (
              <>
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
              </>
            ) : (
              <>
                Bandarmology activity is observed to show a status of <span className={`font-bold ${recs.bandarmology?.rating?.includes('ACCUMULATION') ? 'text-emerald-400' : recs.bandarmology?.rating?.includes('DISTRIBUTION') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.bandarmology?.rating || 'NEUTRAL'}</span>. Based on transaction flow data, {recs.bandarmology ? recs.bandarmology.desc.charAt(0).toLowerCase() + recs.bandarmology.desc.slice(1) : ''}. {(() => {
                  const status = technicals?.bandarmology?.status || '';
                  if (status.includes('ACCUMULATION')) {
                    return 'This indicates that buy volume from big brokers (Bandar) dominates the market, showing potential that price is being accumulated before an increase.';
                  } else if (status.includes('DISTRIBUTION')) {
                    return 'This indicates that sell volume from big brokers (Bandar) dominates the market, showing risk of a major distribution action by institutions.';
                  } else {
                    return 'Big broker transaction flows are observed to be balanced without any aggressive dominance of accumulation or distribution.';
                  }
                })()}
              </>
            )}
          </div>
        </div>
      </div>

        {/* AI Narrative & Realtime Sentiment Card (Full width, 2 columns inner on desktop) */}
        <div className="border border-border-color rounded-2xl bg-card-bg flex flex-col h-auto w-full">
          <div className="px-5 py-4 border-b border-border-color bg-card-bg flex items-center justify-between text-white">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-purple" /> {language === 'id' ? 'Sentimen & Narasi Terkini' : 'Current Sentiment & Narratives'}
            </span>
            {fundamentals && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                recs.narrative.rating.includes('BUY') 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : recs.narrative.rating.includes('SELL')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {language === 'id' ? 'Analisis Berita' : 'News Analysis'}: {recs.narrative.rating} ({recs.narrative.score}%)
              </span>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Sentiment & AI Summary */}
            <div className="space-y-4">
              {/* Sentiment Gauge */}
              <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-800/40">
                <span className="text-xs text-slate-400">{language === 'id' ? 'Rangkuman Sentimen' : 'Sentiment Summary'}</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  analysis?.sentiment === 'Bullish' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : analysis?.sentiment === 'Bearish'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {analysis?.sentiment ? (language === 'id' ? (analysis.sentiment === 'Bullish' ? 'Bullish' : analysis.sentiment === 'Bearish' ? 'Bearish' : 'Netral') : analysis.sentiment) : (language === 'id' ? 'Netral' : 'Neutral')}
                </span>
              </div>

              {/* AI Summary Text */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-purple">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {language === 'id' ? 'Analisis AI' : 'AI Analysis'} {
                      analysis?.isAI 
                        ? `(${analysis.modelUsed?.includes('gemini') ? 'Gemini' : analysis.modelUsed?.includes('llama') ? 'Groq' : 'OpenAI'})` 
                        : (language === 'id' ? '(Sistem Lokal)' : '(Local System)')
                    }
                  </span>
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
                <Clock className="w-3.5 h-3.5 text-slate-500" /> {language === 'id' ? 'Berita Terkait' : 'Related News'}
              </span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-10 bg-slate-900/60 border border-slate-900 rounded-lg animate-pulse" />
                  ))
                ) : news.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">{language === 'id' ? 'Tidak ada berita yang ditemukan.' : 'No news found.'}</div>
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
                        <span>{item.pubDate ? new Date(item.pubDate).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US') : ''}</span>
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
                <Sparkles className="w-3.5 h-3.5" /> {language === 'id' ? 'Analisis Kesimpulan Sentimen & Narasi' : 'Sentiment & Narrative Summary Analysis'}
              </span>
              {language === 'id' ? (
                <>
                  Berdasarkan analisis sentimen berita terkini, saham ini memiliki rating sentimen <span className={`font-bold ${recs.narrative.rating.includes('BUY') ? 'text-emerald-400' : recs.narrative.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.narrative.rating}</span>. {recs.narrative.desc.charAt(0).toUpperCase() + recs.narrative.desc.slice(1)}. {analysis?.summary ? 'Analisis sentimen mendeteksi poin-poin utama seperti tercantum dalam rangkuman AI di atas.' : ''}
                </>
              ) : (
                <>
                  Based on current news sentiment analysis, this stock has a sentiment rating of <span className={`font-bold ${recs.narrative.rating.includes('BUY') ? 'text-emerald-400' : recs.narrative.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.narrative.rating}</span>. {recs.narrative.desc.charAt(0).toUpperCase() + recs.narrative.desc.slice(1)}. {analysis?.summary ? 'Sentiment analysis detected main points as listed in the AI summary above.' : ''}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Fundamental Section */}
      <div className="border border-slate-800/60 rounded-2xl bg-slate-950/40 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-900 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-teal-400" /> {language === 'id' ? 'Ringkasan Fundamental & Keuangan' : 'Fundamental & Financial Summary'}
          </h3>
          {fundamentals && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full max-w-fit ${
              recs.fundamental.rating.includes('BUY') 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : recs.fundamental.rating.includes('SELL')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}>
              {language === 'id' ? 'Analisis Fundamental' : 'Fundamental Analysis'}: {recs.fundamental.rating} ({recs.fundamental.score}%)
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
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Valuasi Laba' : 'Earnings Valuation'}</span>
            </div>

            {/* PBV Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Price to Book (PBV)</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.pbRatio ? `${fundamentals.pbRatio.toFixed(2)}x` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Valuasi Aset' : 'Asset Valuation'}</span>
            </div>

            {/* ROE Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ROE</span>
              <span className={`text-lg font-bold mt-1 ${
                fundamentals?.roe > 15 ? 'text-emerald-400' : 'text-white'
              }`}>
                {loading ? '...' : fundamentals?.roe ? `${fundamentals.roe.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Efisiensi Ekuitas' : 'Equity Efficiency'}</span>
            </div>

            {/* ROA Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ROA</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.roa ? `${fundamentals.roa.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Efisiensi Aset' : 'Asset Efficiency'}</span>
            </div>

            {/* DER Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">DER (Leverage)</span>
              <span className={`text-lg font-bold mt-1 ${
                fundamentals?.der > 200 ? 'text-rose-400' : 'text-white'
              }`}>
                {loading ? '...' : fundamentals?.der ? `${(fundamentals.der).toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Rasio Utang / Modal' : 'Debt / Equity Ratio'}</span>
            </div>

            {/* Div Yield Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dividend Yield</span>
              <span className="text-lg font-bold text-teal-400 mt-1">
                {loading ? '...' : fundamentals?.dividendYield ? `${fundamentals.dividendYield.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Yield Dividen' : 'Dividend Yield'}</span>
            </div>

            {/* EPS Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">EPS (Trailing)</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.eps ? `Rp ${fundamentals.eps.toFixed(1)}` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Laba Per Saham' : 'Earnings Per Share'}</span>
            </div>

            {/* Profit Margin Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Net Profit Margin</span>
              <span className="text-lg font-bold text-white mt-1">
                {loading ? '...' : fundamentals?.profitMargin ? `${fundamentals.profitMargin.toFixed(2)}%` : '-'}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Marjin Laba Bersih' : 'Net Profit Margin'}</span>
            </div>

            {/* Market Cap Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col justify-between col-span-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Market Cap</span>
              <span className="text-sm font-bold text-white mt-1 truncate">
                {loading ? '...' : formatFinancialNumber(fundamentals?.marketCap, language)}
              </span>
              <span className="text-[9px] text-slate-400 mt-2">{language === 'id' ? 'Kapitalisasi Pasar' : 'Market Cap'}</span>
            </div>
          </div>

          {/* Performance Charts */}
          <div className="border border-slate-900 bg-slate-950/20 p-5 rounded-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400">{language === 'id' ? 'Kinerja Pendapatan & Laba Bersih' : 'Revenue & Net Income Performance'}</span>
              
              {/* Yearly/Quarterly Switcher */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  onClick={() => setHistoryType('annual')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    historyType === 'annual' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'id' ? 'Tahunan' : 'Annual'}
                </button>
                <button
                  onClick={() => setHistoryType('quarterly')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    historyType === 'quarterly' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'id' ? 'Kuartalan' : 'Quarterly'}
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
                  language={language}
                />
              ) : (
                <div className="flex h-[200px] items-center justify-center text-slate-500 text-xs">
                  {language === 'id' ? 'Gagal mengambil riwayat finansial' : 'Failed to retrieve financial history'}
                </div>
              )}
            </div>

            {/* Chart Legend */}
            <div className="flex justify-center gap-6 mt-4 text-[10px] font-semibold text-slate-400 border-t border-border-color pt-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-brand-purple rounded-sm" />
                <span>{language === 'id' ? 'Pendapatan' : 'Revenue'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-teal-500 rounded-sm" />
                <span>{language === 'id' ? 'Laba Bersih' : 'Net Income'}</span>
              </div>
            </div>
          </div>

          {/* Bottom narrative for Fundamental */}
          <div className="text-[11px] text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900 leading-relaxed font-sans font-medium">
            <span className="font-bold text-brand-purple flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
              <Building className="w-3.5 h-3.5" /> {language === 'id' ? 'Analisis Kesimpulan Fundamental' : 'Fundamental Analysis Conclusion'}
            </span>
            {language === 'id' ? (
              <>
                Secara fundamental, kinerja keuangan emiten dinilai berada pada kondisi <span className={`font-bold ${recs.fundamental.rating.includes('BUY') ? 'text-emerald-400' : recs.fundamental.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.fundamental.rating}</span> dengan skor fundamental sebesar {recs.fundamental.score}%. Hal ini dipengaruhi oleh beberapa faktor rasio utama: {recs.fundamental.desc.charAt(0).toUpperCase() + recs.fundamental.desc.slice(1)}.
              </>
            ) : (
              <>
                Fundamentally, the issuer&apos;s financial performance is assessed to be in <span className={`font-bold ${recs.fundamental.rating.includes('BUY') ? 'text-emerald-400' : recs.fundamental.rating.includes('SELL') ? 'text-rose-400' : 'text-slate-400'}`}>{recs.fundamental.rating}</span> condition with a fundamental score of {recs.fundamental.score}%. This is influenced by several key ratio factors: {recs.fundamental.desc.charAt(0).toUpperCase() + recs.fundamental.desc.slice(1)}.
              </>
            )}
          </div>

        </div>
      </div>
      </>
      )}
    </div>
  );
}
