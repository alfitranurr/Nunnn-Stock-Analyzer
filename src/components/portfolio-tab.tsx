'use client';

import * as React from 'react';
import { 
  Briefcase, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Trash2, 
  Edit3, 
  Calculator, 
  Lock, 
  UserPlus, 
  Info, 
  Coins, 
  ArrowRight,
  Loader2,
  RefreshCw,
  LineChart,
  X
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from './confirm-modal';
import { cleanCompanyName } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

interface Holding {
  id: string;
  ticker: string;
  company_name?: string;
  lot: number;
  avg_price: number;
}

interface PortfolioTabProps {
  user: any;
  onSignInClick: () => void;
  onAvgDownClick: (ticker: string, lot: number, avgPrice: number) => void;
  onAnalyzeClick: (ticker: string) => void;
}

function PortfolioEmitenLogo({ symbol }: { symbol: string }) {
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

export function PortfolioTab({ user, onSignInClick, onAvgDownClick, onAnalyzeClick }: PortfolioTabProps) {
  const { language, t } = useLanguage();
  const [holdings, setHoldings] = React.useState<Holding[]>([]);
  const [cashBalance, setCashBalance] = React.useState<number>(0);
  const [currentPrices, setCurrentPrices] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [isLocalMode, setIsLocalMode] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = React.useState(false);
  const [editingHolding, setEditingHolding] = React.useState<Holding | null>(null);
  
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  // Form Ticker State
  const [formTicker, setFormTicker] = React.useState('');
  const [formCompanyName, setFormCompanyName] = React.useState('');
  const [formLot, setFormLot] = React.useState('');
  const [formAvgPrice, setFormAvgPrice] = React.useState('');
  const [isFetchingTicker, setIsFetchingTicker] = React.useState(false);

  // Format ke Rupiah
  const formatIDR = (value: number) => {
    const loc = language === 'id' ? 'id-ID' : 'en-US';
    const formatted = new Intl.NumberFormat(loc, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
  };

  const loadLocalStorageData = React.useCallback(() => {
    if (!user) return;
    const storedCash = localStorage.getItem(`nunnn_stock_portfolio_cash_${user.id}`);
    setCashBalance(storedCash ? parseFloat(storedCash) : 100000000); // Default simulated Rp 100M RDN cash

    const storedHoldings = localStorage.getItem(`nunnn_stock_portfolio_holdings_${user.id}`);
    if (storedHoldings) {
      try {
        setHoldings(JSON.parse(storedHoldings));
      } catch {
        setHoldings([]);
      }
    } else {
      // Add default mock holding to look premium on first load
      const mockData = [
        { id: 'mock-1', ticker: 'BBRI', company_name: 'Bank Rakyat Indonesia Tbk', lot: 50, avg_price: 4300 },
        { id: 'mock-2', ticker: 'ANTM', company_name: 'Aneka Tambang Tbk', lot: 100, avg_price: 1550 }
      ];
      localStorage.setItem(`nunnn_stock_portfolio_holdings_${user.id}`, JSON.stringify(mockData));
      setHoldings(mockData);
    }
  }, [user]);

  // Fetch holdings & cash
  const fetchData = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);

    if (isSupabaseConfigured && !user.isMock) {
      try {
        // Fetch Cash
        const { data: cashDataArray, error: cashError } = await supabase
          .from('portfolio_cash')
          .select('cash_balance')
          .eq('user_id', user.id);

        if (cashError) {
          // If table does not exist or relation error occurs
          if (cashError.code === 'PGRST205' || cashError.message?.includes('portfolio_cash')) {
            console.warn('Supabase portfolio_cash table not found, falling back to LocalStorage.');
            setIsLocalMode(true);
            loadLocalStorageData();
            setLoading(false);
            return;
          }
          console.error('Error fetching cash:', cashError);
        } else if (cashDataArray && cashDataArray.length > 0) {
          setCashBalance(Number(cashDataArray[0].cash_balance));
        } else {
          // Initialize cash row with default Rp 100M if not exist
          const defaultCash = 100000000;
          const { error: insertError } = await supabase
            .from('portfolio_cash')
            .insert({ user_id: user.id, cash_balance: defaultCash });
          
          if (insertError) {
            console.error('Error initializing cash:', insertError);
            setCashBalance(0);
          } else {
            setCashBalance(defaultCash);
          }
        }

        // Fetch Holdings
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('portfolio_holdings')
          .select('*')
          .order('ticker');

        if (holdingsError) {
          console.warn('Supabase portfolio_holdings table not found, falling back to LocalStorage.');
          setIsLocalMode(true);
          loadLocalStorageData();
          setLoading(false);
          return;
        }
        
        // Map database schema to frontend holding structure
        setHoldings(
          (holdingsData || []).map(h => ({
            id: h.id,
            ticker: h.ticker,
            company_name: h.company_name,
            lot: h.lot,
            avg_price: Number(h.avg_price)
          }))
        );
        setIsLocalMode(false);
      } catch (e) {
        console.error('Error fetching from Supabase, falling back to LocalStorage:', e);
        setIsLocalMode(true);
        loadLocalStorageData();
        setLoading(false);
      }
    } else {
      // Local Storage Fallback
      setIsLocalMode(true);
      loadLocalStorageData();
      setLoading(false);
    }
  }, [user, loadLocalStorageData]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch prices dynamically for each ticker
  React.useEffect(() => {
    if (holdings.length === 0) return;

    holdings.forEach(async (h) => {
      const symbol = h.ticker.toUpperCase();
      if (currentPrices[symbol] === undefined) {
        try {
          const res = await fetch(`/api/ticker?symbol=${symbol}`);
          if (res.ok) {
            const data = await res.json();
            if (data.price) {
              setCurrentPrices(prev => ({ ...prev, [symbol]: data.price }));
            }
          }
        } catch (e) {
          console.error('Error fetching price for', symbol, e);
        }
      }
    });
  }, [holdings, currentPrices]);

  // Fetch company name & price when user types ticker in Form modal
  React.useEffect(() => {
    const val = formTicker.toUpperCase().trim();
    if (val.length >= 4 && !editingHolding) {
      const fetchFormTicker = async () => {
        setIsFetchingTicker(true);
        try {
          const res = await fetch(`/api/ticker?symbol=${val}`);
          if (res.ok) {
            const data = await res.json();
            if (data.name) setFormCompanyName(data.name);
            if (data.price && !formAvgPrice) setFormAvgPrice(data.price.toString());
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsFetchingTicker(false);
        }
      };
      fetchFormTicker();
    }
  }, [formTicker, editingHolding]);

  // Handle Add/Edit submit
  const handleAddEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const tickerUpper = formTicker.toUpperCase().trim();
    const parsedLot = parseInt(formLot) || 0;
    const parsedPrice = parseFloat(formAvgPrice.replace(/,/g, '')) || 0;

    if (editingHolding) {
      // Edit mode
      const updatedHoldings = holdings.map(h => {
        if (h.id === editingHolding.id) {
          return { ...h, lot: parsedLot, avg_price: parsedPrice };
        }
        return h;
      });

      if (isSupabaseConfigured && !user.isMock && !isLocalMode) {
        const { error } = await supabase
          .from('portfolio_holdings')
          .update({ lot: parsedLot, avg_price: parsedPrice })
          .eq('id', editingHolding.id);
        
        if (error) {
          console.error('Error updating stock in Supabase:', error);
          alert(language === 'id' ? `Gagal mengubah posisi saham: ${error.message}` : `Failed to update stock position: ${error.message}`);
        } else {
          fetchData();
        }
      } else {
        localStorage.setItem(`nunnn_stock_portfolio_holdings_${user.id}`, JSON.stringify(updatedHoldings));
      }
      setHoldings(updatedHoldings);
    } else {
      // Add mode
      const newHolding: Holding = {
        id: crypto.randomUUID(),
        ticker: tickerUpper,
        company_name: cleanCompanyName(formCompanyName || `${tickerUpper} Emiten`),
        lot: parsedLot,
        avg_price: parsedPrice
      };

      const updatedHoldings = [...holdings, newHolding];

      if (isSupabaseConfigured && !user.isMock && !isLocalMode) {
        const { error } = await supabase
          .from('portfolio_holdings')
          .insert({
            user_id: user.id,
            ticker: tickerUpper,
            company_name: newHolding.company_name,
            lot: parsedLot,
            avg_price: parsedPrice
          });
        if (error) {
          console.error('Error inserting stock into Supabase:', error);
          alert(
            language === 'id'
              ? `Gagal menyimpan saham ke cloud database: ${error.message}\n\nTips: Pastikan kolom 'company_name' sudah ditambahkan ke tabel 'portfolio_holdings' di Supabase Anda.`
              : `Failed to save stock to cloud database: ${error.message}\n\nTips: Ensure that the 'company_name' column has been added to the 'portfolio_holdings' table in your Supabase.`
          );
        } else {
          fetchData();
        }
      } else {
        localStorage.setItem(`nunnn_stock_portfolio_holdings_${user.id}`, JSON.stringify(updatedHoldings));
        setHoldings(updatedHoldings);
      }
    }

    setIsAddEditOpen(false);
    resetForm();
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!user || !confirmDeleteId) return;

    const updated = holdings.filter(h => h.id !== confirmDeleteId);

    if (isSupabaseConfigured && !user.isMock && !isLocalMode) {
      const { error } = await supabase
        .from('portfolio_holdings')
        .delete()
        .eq('id', confirmDeleteId);
      if (error) {
        console.error('Error deleting stock from Supabase:', error);
        alert(language === 'id' ? `Gagal menghapus saham: ${error.message}` : `Failed to delete stock: ${error.message}`);
      } else {
        fetchData();
      }
    } else {
      localStorage.setItem(`nunnn_stock_portfolio_holdings_${user.id}`, JSON.stringify(updated));
    }
    setHoldings(updated);
    setConfirmDeleteId(null);
  };

  const openAddModal = () => {
    setEditingHolding(null);
    resetForm();
    setIsAddEditOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setEditingHolding(holding);
    setFormTicker(holding.ticker);
    setFormCompanyName(holding.company_name || '');
    setFormLot(holding.lot.toString());
    setFormAvgPrice(holding.avg_price.toString());
    setIsAddEditOpen(true);
  };

  const resetForm = () => {
    setFormTicker('');
    setFormCompanyName('');
    setFormLot('');
    setFormAvgPrice('');
  };

  // Math Calculations for Dashboard
  const totalStocksCapital = holdings.reduce((sum, h) => sum + (h.lot * 100 * h.avg_price), 0);
  const totalStocksMarketValue = holdings.reduce((sum, h) => {
    const currentPrice = currentPrices[h.ticker.toUpperCase()] || h.avg_price;
    return sum + (h.lot * 100 * currentPrice);
  }, 0);

  const totalPortfolioValue = totalStocksMarketValue;
  const totalReturnRp = totalStocksMarketValue - totalStocksCapital;
  const totalReturnPct = totalStocksCapital > 0 ? (totalReturnRp / totalStocksCapital) * 100 : 0;
  
  // Render Lock Shield Screen if Guest
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[480px] max-w-lg mx-auto space-y-6 animate-fadeIn">
        <div className="w-20 h-20 rounded-3xl bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-center shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-brand-purple/5 blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
          <Lock className="h-9 w-9 text-brand-purple animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-black text-white">{t('portfolio.portfolioLocked')}</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            {t('portfolio.portfolioLockedDesc')}
          </p>
        </div>
        <button
          onClick={onSignInClick}
          className="px-6 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-sm transition-all duration-300 shadow-md cursor-pointer hover:scale-[1.03] active:scale-[0.97] flex items-center gap-2"
        >
          <UserPlus className="h-4.5 w-4.5" />
          <span>{t('portfolio.loginButton')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn">
      {/* Portfolio Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4.5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            {t('portfolio.title')}
            <Briefcase className="h-6.5 w-6.5 text-brand-purple shrink-0" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('portfolio.desc')}
          </p>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex gap-2.5 w-full sm:w-auto">
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs transition-all cursor-pointer shadow-md hover:scale-[1.02]"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>{t('portfolio.addStock')}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
        {/* Card 1: Total Equity */}
        <div className="glass-card p-5 bg-card-bg relative overflow-hidden flex flex-col justify-center min-h-[96px]">
          <span className="text-[9px] font-bold text-brand-purple uppercase tracking-widest block">
            {t('portfolio.totalEquity')}
          </span>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-white mt-1.5 whitespace-nowrap">
            {formatIDR(totalPortfolioValue)}
          </h3>
          <span className="text-[9px] text-slate-500 mt-0.5">
            {language === 'id' ? 'Total Nilai Pasar Saham Saat Ini' : 'Total Market Value of Current Stocks'}
          </span>
        </div>

        {/* Card 2: Modal Terinvestasi (Capital) */}
        <div className="glass-card p-5 border-white/5 relative overflow-hidden flex flex-col justify-center min-h-[96px]">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
            {t('portfolio.investedCapital')}
          </span>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-200 mt-1.5 whitespace-nowrap">
            {formatIDR(totalStocksCapital)}
          </h3>
          <span className="text-[9px] text-slate-500 mt-0.5">
            {language === 'id' ? 'Total Modal Pembelian Saham' : 'Total Cost of Stock Purchases'}
          </span>
        </div>

        {/* Card 3: Total Return / P&L */}
        <div className="glass-card p-5 border-white/5 relative overflow-hidden flex flex-col justify-center min-h-[96px]">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
            {t('portfolio.totalReturn')}
          </span>
          <h3 className={`text-lg sm:text-xl lg:text-2xl font-black mt-1.5 flex items-center gap-1.5 whitespace-nowrap ${totalReturnRp >= 0 ? 'text-bullish-green dark:text-bullish-neon text-profit-glow' : 'text-bearish-red dark:text-bearish-crimson text-loss-glow'}`}>
            {totalReturnRp >= 0 ? <TrendingUp className="h-5 w-5 shrink-0" /> : <TrendingDown className="h-5 w-5 shrink-0" />}
            <span>{formatIDR(totalReturnRp)}</span>
          </h3>
          <span className={`text-[10px] font-bold mt-0.5 ${totalReturnRp >= 0 ? 'text-bullish-green' : 'text-bearish-red'}`}>
            {totalReturnRp >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="glass-card p-6 w-full border border-white/5 overflow-hidden">
        <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-white/5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            {language === 'id' ? 'Kepemilikan Saham Aktif' : 'Active Stock Holdings'}
          </h3>
          <button
            onClick={async () => {
              setIsRefreshing(true);
              setCurrentPrices({});
              await fetchData();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer border border-white/5 flex items-center justify-center ${
              isRefreshing ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.97]'
            }`}
            title={language === 'id' ? 'Refresh Portofolio & Harga' : 'Refresh Portfolio & Prices'}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-brand-purple' : ''}`} />
          </button>
        </div>

        {loading && holdings.length === 0 ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-purple" />
          </div>
        ) : holdings.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 border border-dashed border-white/5 rounded-xl">
            <Briefcase className="h-10 w-10 text-slate-700 mb-3 animate-pulse" />
            <p className="text-sm font-semibold">{language === 'id' ? 'Belum Ada Saham Tersimpan' : 'No Saved Stocks'}</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              {language === 'id'
                ? 'Klik tombol "Tambah Saham" di atas untuk menambahkan posisi kepemilikan aset portofolio Anda.'
                : 'Click "Add Stock" above to add your asset position to portfolio tracking.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto">
              <div className="inline-block min-w-full align-middle md:px-0">
                <div className="overflow-hidden border border-white/5 rounded-xl">
                  <table className="min-w-full divide-y divide-white/5">
                    <thead className="bg-black/45">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableSaham')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableLot')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableAvgPrice')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableLastPrice')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableInvested')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tableMarketValue')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('portfolio.tablePl')}</th>
                        <th scope="col" className="px-4 py-3 scope-row text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-transparent">
                      {holdings.map((h) => {
                        const tickerUpper = h.ticker.toUpperCase();
                        const currentPrice = currentPrices[tickerUpper] || h.avg_price;
                        const investedValue = h.lot * 100 * h.avg_price;
                        const marketValue = h.lot * 100 * currentPrice;
                        const plRp = marketValue - investedValue;
                        const plPct = investedValue > 0 ? (plRp / investedValue) * 100 : 0;
                        
                        return (
                           <tr key={h.id} className="hover:bg-white/3 transition-colors">
                            {/* Saham */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <PortfolioEmitenLogo symbol={h.ticker} />
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-sm text-brand-purple dark:text-brand-purple tracking-wider leading-tight">
                                    {tickerUpper}
                                  </span>
                                  <span className="text-[9px] text-slate-400 truncate max-w-[120px] leading-tight" title={cleanCompanyName(h.company_name)}>
                                    {cleanCompanyName(h.company_name) || '-'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Lot */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-300 font-semibold">
                              {h.lot.toLocaleString('en-US')} Lot
                              <span className="text-[10px] text-slate-500 font-normal block">
                                {language === 'id' 
                                  ? `(${(h.lot * 100).toLocaleString('en-US')} lembar)` 
                                  : `(${(h.lot * 100).toLocaleString('en-US')} shares)`}
                              </span>
                            </td>

                            {/* Avg Price */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-300 font-bold">
                              {formatIDR(h.avg_price)}
                            </td>

                            {/* Last Price */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-300 font-bold">
                              {formatIDR(currentPrice)}
                              {currentPrices[tickerUpper] === undefined && (
                                <span className="text-[8px] text-slate-500 font-normal block leading-none mt-0.5">
                                  {language === 'id' ? '(Menggunakan Avg)' : '(Using Avg)'}
                                </span>
                              )}
                            </td>

                            {/* Invested */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-extrabold text-slate-300">
                              {formatIDR(investedValue)}
                            </td>

                            {/* Market Value */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-extrabold text-slate-200">
                              {formatIDR(marketValue)}
                            </td>

                            {/* P&L */}
                            <td className="px-4 py-4 whitespace-nowrap text-xs">
                              <span className={`font-bold block ${plRp >= 0 ? 'text-bullish-green' : 'text-bearish-red'}`}>
                                {formatIDR(plRp)}
                              </span>
                              <span className={`text-[9px] font-bold ${plRp >= 0 ? 'text-bullish-green' : 'text-bearish-red'}`}>
                                {plRp >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-4 whitespace-nowrap text-right text-xs">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Analisis Action */}
                                <button
                                  onClick={() => onAnalyzeClick(h.ticker)}
                                  className="p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 dark:text-teal-400 border border-teal-500/20 transition-all cursor-pointer flex items-center justify-center"
                                  title={language === 'id' ? 'Analisis Saham Pro' : 'Pro Stock Analysis'}
                                >
                                  <LineChart className="h-4.5 w-4.5" />
                                </button>

                                {/* Avg Down Action */}
                                <button
                                  onClick={() => onAvgDownClick(h.ticker, h.lot, h.avg_price)}
                                  className="p-2 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple dark:text-brand-purple border border-brand-purple/20 transition-all cursor-pointer flex items-center justify-center"
                                  title={language === 'id' ? 'Avg Down Saham Ini' : 'Avg Down This Stock'}
                                >
                                  <Calculator className="h-4.5 w-4.5" />
                                </button>

                                {/* Edit Action */}
                                <button
                                  onClick={() => openEditModal(h)}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-all cursor-pointer flex items-center justify-center"
                                  title={language === 'id' ? 'Ubah Posisi' : 'Edit Position'}
                                >
                                  <Edit3 className="h-4.5 w-4.5" />
                                </button>

                                {/* Delete Action */}
                                <button
                                  onClick={() => setConfirmDeleteId(h.id)}
                                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                                  title={language === 'id' ? 'Hapus Saham' : 'Delete Stock'}
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="block md:hidden space-y-3">
              {holdings.map((h) => {
                const tickerUpper = h.ticker.toUpperCase();
                const currentPrice = currentPrices[tickerUpper] || h.avg_price;
                const investedValue = h.lot * 100 * h.avg_price;
                const marketValue = h.lot * 100 * currentPrice;
                const plRp = marketValue - investedValue;
                const plPct = investedValue > 0 ? (plRp / investedValue) * 100 : 0;

                return (
                  <div 
                    key={h.id}
                    className="p-4 rounded-xl border border-white/5 bg-white/2 dark:bg-black/15 space-y-3"
                  >
                    {/* Ticker & Logo & Company Name */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <PortfolioEmitenLogo symbol={h.ticker} />
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm text-brand-purple tracking-wider leading-none">
                            {tickerUpper}
                          </span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[155px] mt-0.5" title={cleanCompanyName(h.company_name)}>
                            {cleanCompanyName(h.company_name) || '-'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-200">
                        {h.lot.toLocaleString('en-US')} Lot
                        <span className="text-[9px] text-slate-400 font-normal block text-right mt-0.5">
                          {language === 'id' 
                            ? `(${(h.lot * 100).toLocaleString('en-US')} lbr)` 
                            : `(${(h.lot * 100).toLocaleString('en-US')} shrs)`}
                        </span>
                      </span>
                    </div>

                    {/* Price Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Avg Price</span>
                        <span className="font-bold text-slate-350">{formatIDR(h.avg_price)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Last Price</span>
                        <span className="font-bold text-slate-350">{formatIDR(currentPrice)}</span>
                      </div>
                    </div>

                    {/* Financial Values Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-black/10 -mx-4 px-4 py-2.5">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Invested</span>
                        <span className="font-bold text-slate-300">{formatIDR(investedValue)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Market Value</span>
                        <span className="font-bold text-slate-205">{formatIDR(marketValue)}</span>
                      </div>
                    </div>

                    {/* Floating P&L Row */}
                    <div className="py-1 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-bold leading-none mb-1">Floating P&L</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${plRp >= 0 ? 'text-bullish-green' : 'text-bearish-red'}`}>
                            {formatIDR(plRp)}
                          </span>
                          <span className={`text-[10px] font-extrabold ${plRp >= 0 ? 'text-bullish-green bg-bullish-green/10' : 'text-bearish-red bg-bearish-red/10'} px-1.5 py-0.5 rounded`}>
                            {plRp >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Footer Grid */}
                    <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-white/5">
                      {/* Analisis Action */}
                      <button
                        onClick={() => onAnalyzeClick(h.ticker)}
                        className="py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 dark:text-teal-400 border border-teal-500/20 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 cursor-pointer transition-all duration-200"
                        title={language === 'id' ? 'Analisis Saham Pro' : 'Pro Stock Analysis'}
                      >
                        <LineChart className="h-3 w-3" />
                        <span className="text-[8px] font-bold tracking-wider uppercase">{language === 'id' ? 'Analisis' : 'Analysis'}</span>
                      </button>

                      {/* Avg Down Action */}
                      <button
                        onClick={() => onAvgDownClick(h.ticker, h.lot, h.avg_price)}
                        className="py-1.5 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple dark:text-brand-purple border border-brand-purple/20 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 cursor-pointer transition-all duration-200"
                        title={language === 'id' ? 'Avg Down Saham Ini' : 'Avg Down This Stock'}
                      >
                        <Calculator className="h-3 w-3" />
                        <span className="text-[8px] font-bold tracking-wider uppercase">Avg Down</span>
                      </button>

                      {/* Edit Action */}
                      <button
                        onClick={() => openEditModal(h)}
                        className="py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 cursor-pointer transition-all duration-200"
                        title={language === 'id' ? 'Ubah Posisi' : 'Edit Position'}
                      >
                        <Edit3 className="h-3 w-3" />
                        <span className="text-[8px] font-bold tracking-wider uppercase">{language === 'id' ? 'Ubah' : 'Edit'}</span>
                      </button>

                      {/* Delete Action */}
                      <button
                        onClick={() => setConfirmDeleteId(h.id)}
                        className="py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 cursor-pointer transition-all duration-200"
                        title={language === 'id' ? 'Hapus Saham' : 'Delete Stock'}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="text-[8px] font-bold tracking-wider uppercase">{language === 'id' ? 'Hapus' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 1. Modal Tambah/Edit Saham */}
      <AnimatePresence>
        {isAddEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsAddEditOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative border border-white/10 p-6 w-full max-w-md bg-slate-950 dark:bg-black shadow-2xl text-white z-10 animate-scaleIn rounded-2xl"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-bold text-white mb-6 border-b border-white/5 pb-3">
                {editingHolding 
                  ? `${t('portfolio.modalEditTitle')} ${editingHolding.ticker}` 
                  : t('portfolio.modalAddTitle')}
              </h3>

              <form onSubmit={handleAddEditSubmit} className="space-y-4">
                 {/* Ticker Input */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('portfolio.formTicker')}</label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      required
                      disabled={!!editingHolding}
                      value={formTicker}
                      onChange={(e) => setFormTicker(e.target.value.toUpperCase())}
                      placeholder={language === 'id' ? 'Contoh: BBCA' : 'e.g. BBCA'}
                      className={`w-full glass-input px-3.5 py-2.5 text-base md:text-sm font-bold uppercase ${
                        editingHolding ? 'bg-white/5 opacity-50 cursor-not-allowed border-none' : 'bg-black/40 border-white/10'
                      }`}
                    />
                    {isFetchingTicker && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-brand-purple" />
                    )}
                  </div>
                </div>
 
                {/* Company Name Input */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('portfolio.formCompanyName')}</label>
                  <input
                    type="text"
                    disabled={!!editingHolding}
                    value={formCompanyName}
                    onChange={(e) => setFormCompanyName(e.target.value)}
                    placeholder={t('portfolio.formCompanyName')}
                    className="w-full glass-input px-3.5 py-2.5 mt-1.5 text-base md:text-sm font-medium bg-black/40 border-white/10 disabled:opacity-50"
                  />
                </div>
 
                <div className="grid grid-cols-2 gap-4">
                  {/* Lot Input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('portfolio.formLot')}</label>
                    <input
                      type="text"
                      required
                      value={formLot}
                      onChange={(e) => setFormLot(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={language === 'id' ? 'Contoh: 10' : 'e.g. 10'}
                      className="w-full glass-input px-3.5 py-2.5 mt-1.5 text-base md:text-sm text-center font-bold bg-black/40 border-white/10"
                    />
                  </div>
 
                  {/* Avg Price Input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('portfolio.formAvgPrice')}</label>
                    <input
                      type="text"
                      required
                      value={formAvgPrice}
                      onChange={(e) => setFormAvgPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                      placeholder={language === 'id' ? 'Contoh: 4300' : 'e.g. 4300'}
                      className="w-full glass-input px-3.5 py-2.5 mt-1.5 text-base md:text-sm text-center font-bold bg-black/40 border-white/10"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddEditOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
                  >
                    {language === 'id' ? 'Simpan Posisi' : 'Save Position'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title={language === 'id' ? 'Hapus Saham dari Portofolio' : 'Delete Stock from Portfolio'}
        message={
          language === 'id'
            ? 'Apakah Anda yakin ingin menghapus kepemilikan emiten ini? Tindakan ini akan menghapus aset ini dari pelacakan portofolio Anda secara permanen.'
            : 'Are you sure you want to delete this stock holding? This action will permanently delete this asset from your portfolio tracking.'
        }
        confirmText={language === 'id' ? 'Ya, Hapus' : 'Yes, Delete'}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </div>
  );
}
