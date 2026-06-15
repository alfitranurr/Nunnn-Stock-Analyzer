'use client';

import * as React from 'react';
import { Sidebar } from '@/components/sidebar';
import { CalculatorForm } from '@/components/calculator-form';
import { ResultsDisplay } from '@/components/results-display';
import { HistoryTable, SavedPlan } from '@/components/history-table';
import { AuthModal } from '@/components/auth-modal';
import { PortfolioTab } from '@/components/portfolio-tab';
import { AnalysisTab } from '@/components/analysis-tab';
import { NewsTab } from '@/components/news-tab';
import { AdminPanelTab } from '@/components/admin-panel-tab';
import { ConfirmModal } from '@/components/confirm-modal';
import { calculateAvgDown, AvgDownInput, AvgDownResult } from '@/lib/calculator';
import { CompoundingTab } from '@/components/compounding-tab';
import { IpoTab } from '@/components/ipo-tab';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Sparkles, BookOpen, AlertCircle, Info, Database, ChevronUp, ArrowRight, Percent, TrendingUp, FileText, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TickerConfig {
  symbol: string;
  x: string;
  y: string;
  pathX: number[];
  pathY: number[];
  duration: number;
  delay: number;
}

const INITIAL_TICKERS = [
  { symbol: 'BBRI', x: '5%', y: '15%' },
  { symbol: 'BBCA', x: '82%', y: '12%' },
  { symbol: 'GOTO', x: '88%', y: '65%' },
  { symbol: 'TLKM', x: '8%', y: '72%' },
  { symbol: 'ASII', x: '78%', y: '45%' },
  { symbol: 'ANTM', x: '15%', y: '48%' },
  { symbol: 'BMRI', x: '45%', y: '72%' },
  { symbol: 'BBNI', x: '42%', y: '10%' },
  // Barito Group
  { symbol: 'BREN', x: '75%', y: '70%' },
  { symbol: 'BRPT', x: '22%', y: '75%' },
  { symbol: 'TPIA', x: '4%', y: '35%' },
  { symbol: 'CUAN', x: '52%', y: '25%' },
  // Happy Hapsoro Group
  { symbol: 'RAJA', x: '30%', y: '58%' },
  { symbol: 'PSAB', x: '68%', y: '25%' },
  // Additional Tickers
  { symbol: 'ADRO', x: '18%', y: '8%' },
  { symbol: 'PTBA', x: '28%', y: '22%' },
  { symbol: 'ITMG', x: '62%', y: '10%' },
  { symbol: 'UNVR', x: '92%', y: '28%' },
  { symbol: 'INDF', x: '90%', y: '50%' },
  { symbol: 'ICBP', x: '70%', y: '55%' },
  { symbol: 'KLBF', x: '60%', y: '42%' },
  { symbol: 'AMRT', x: '50%', y: '68%' },
  { symbol: 'PGAS', x: '35%', y: '45%' },
  { symbol: 'MEDC', x: '25%', y: '33%' },
  { symbol: 'MDKA', x: '12%', y: '60%' },
  { symbol: 'HRUM', x: '16%', y: '28%' },
  { symbol: 'ARTO', x: '38%', y: '30%' },
  { symbol: 'BUKA', x: '56%', y: '12%' },
  { symbol: 'ISAT', x: '72%', y: '8%' },
  { symbol: 'EXCL', x: '84%', y: '35%' },
  { symbol: 'JSMR', x: '48%', y: '52%' },
  { symbol: 'BSDE', x: '38%', y: '78%' },
  { symbol: 'PWON', x: '10%', y: '80%' },
  { symbol: 'CTRA', x: '58%', y: '76%' },
  { symbol: 'TINS', x: '2%', y: '52%' },
  { symbol: 'BRMS', x: '82%', y: '78%' },
  { symbol: 'BUMI', x: '94%', y: '72%' },
  { symbol: 'ACES', x: '66%', y: '74%' },
  { symbol: 'MAPI', x: '28%', y: '45%' },
  { symbol: 'MYOR', x: '48%', y: '8%' },
  { symbol: 'PNLF', x: '34%', y: '18%' },
  { symbol: 'BBTN', x: '2%', y: '10%' },
  { symbol: 'BDMN', x: '64%', y: '32%' },
  { symbol: 'ADHI', x: '22%', y: '65%' },
  { symbol: 'WIKA', x: '14%', y: '72%' },
  { symbol: 'PTPP', x: '30%', y: '72%' },
  { symbol: 'SMGR', x: '44%', y: '40%' },
  { symbol: 'BELI', x: '74%', y: '48%' },
];

function EmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);

  return (
    <div className="w-5.5 h-5.5 md:w-7 md:h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {!hasError ? (
        <img
          src={`https://assets.stockbit.com/logos/companies/${symbol}.png`}
          alt={symbol}
          className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 object-contain opacity-60 filter brightness-125 saturate-50"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[10px] md:text-[12px] text-[#00b15b]/40">
          {symbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [showCover, setShowCover] = React.useState(true);
  const [currentTab, setCurrentTab] = React.useState('news');
  const [user, setUser] = React.useState<any>(null);

  const [tickers, setTickers] = React.useState<TickerConfig[]>([]);

  React.useEffect(() => {
    // Generate random paths on client load to prevent SSR mismatch
    const randomized = INITIAL_TICKERS.map((t) => {
      // Build a 5-point random floating trajectory
      const pathX = [
        0,
        (Math.random() - 0.5) * 350, // random offset up to 175px
        (Math.random() - 0.5) * 350,
        (Math.random() - 0.5) * 350,
        (Math.random() - 0.5) * 350,
        0
      ];
      const pathY = [
        0,
        (Math.random() - 0.5) * 250, // random offset up to 125px
        (Math.random() - 0.5) * 250,
        (Math.random() - 0.5) * 250,
        (Math.random() - 0.5) * 250,
        0
      ];
      const duration = 25 + Math.random() * 25; // 25s to 50s duration for slower, smoother drift
      const delay = Math.random() * 5;
      return {
        ...t,
        pathX,
        pathY,
        duration,
        delay
      };
    });
    setTickers(randomized);
  }, []);

  React.useEffect(() => {
    const entered = sessionStorage.getItem('nunnn_stock_entered_dashboard');
    if (entered === 'true') {
      setShowCover(false);
    }
  }, []);

  const handleEnterDashboard = () => {
    sessionStorage.setItem('nunnn_stock_entered_dashboard', 'true');
    setShowCover(false);
  };
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [plans, setPlans] = React.useState<SavedPlan[]>([]);
  const [activePlanToLoad, setActivePlanToLoad] = React.useState<SavedPlan | null>(null);
  
  const [calculatorInput, setCalculatorInput] = React.useState<AvgDownInput | null>(null);
  const [calculatorResult, setCalculatorResult] = React.useState<AvgDownResult | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // States for Confirmation Modals
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);
  const [planIdToDelete, setPlanIdToDelete] = React.useState<string | null>(null);
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  
  // Custom toast notification state
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedAnalysisTicker, setSelectedAnalysisTicker] = React.useState<string | null>(null);

  // Scroll to top state & effect
  const [showScrollTop, setShowScrollTop] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistent active tab on page refresh
  React.useEffect(() => {
    const savedTab = localStorage.getItem('nunnn_stock_active_tab');
    if (savedTab) {
      setCurrentTab(savedTab);
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem('nunnn_stock_active_tab', currentTab);
    // Scroll ke paling atas secara instan saat berpindah tab/halaman
    window.scrollTo(0, 0);
  }, [currentTab]);

  // Check user session on mount
  React.useEffect(() => {
    let subscription: any = null;

    const clearSupabaseAuthKeys = () => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth.token'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        setUser(null);
      } catch (e) {
        console.error('Failed to clear invalid supabase session keys:', e);
      }
    };

    const checkSession = async () => {
      if (!isSupabaseConfigured) {
        const storedMockUser = localStorage.getItem('nunnn_stock_mock_user');
        if (storedMockUser) {
          try {
            const parsedMockUser = JSON.parse(storedMockUser);
            const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
            
            if (parsedMockUser.email?.toLowerCase() === adminEmail) {
              const storedSimUsers = localStorage.getItem('nunnn_stock_simulated_users');
              let simUsers = storedSimUsers ? JSON.parse(storedSimUsers) : [];
              const adminUserIndex = simUsers.findIndex((u: any) => u.email.toLowerCase() === adminEmail);
              if (adminUserIndex === -1) {
                simUsers.push({ email: adminEmail, password: 'adminpassword', approved: true });
                localStorage.setItem('nunnn_stock_simulated_users', JSON.stringify(simUsers));
              } else if (!simUsers[adminUserIndex].approved) {
                simUsers[adminUserIndex].approved = true;
                localStorage.setItem('nunnn_stock_simulated_users', JSON.stringify(simUsers));
              }
            } else {
              const storedSimUsers = localStorage.getItem('nunnn_stock_simulated_users');
              const simUsers = storedSimUsers ? JSON.parse(storedSimUsers) : [];
              const simUser = simUsers.find((u: any) => u.email.toLowerCase() === parsedMockUser.email.toLowerCase());
              
              if (!simUser || !simUser.approved) {
                localStorage.removeItem('nunnn_stock_mock_user');
                setUser(null);
                showToast('Akun simulasi Anda belum disetujui oleh Administrator.', 'error');
                return;
              }
            }
            setUser(parsedMockUser);
          } catch {
            localStorage.removeItem('nunnn_stock_mock_user');
          }
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase session recovery error:', error.message);
          if (error.message.includes('Refresh Token') || error.message.includes('refresh_token') || error.status === 400 || error.status === 401) {
            clearSupabaseAuthKeys();
          }
        } else if (data?.session) {
          const sessionUser = data.session.user;
          const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
          
          if (sessionUser.email?.toLowerCase() === adminEmail) {
            const { data: adminApproval } = await supabase
              .from('user_approvals')
              .select('approved')
              .eq('email', sessionUser.email)
              .single();
              
            if (!adminApproval) {
              await supabase.from('user_approvals').insert({ email: sessionUser.email, approved: true });
            } else if (!adminApproval.approved) {
              await supabase.from('user_approvals').update({ approved: true }).eq('email', sessionUser.email);
            }
          } else {
            const { data: approvalData, error: dbError } = await supabase
              .from('user_approvals')
              .select('approved')
              .eq('email', sessionUser.email)
              .single();

            if (dbError || !approvalData || !approvalData.approved) {
              if (!approvalData && sessionUser.email) {
                await supabase.from('user_approvals').insert({ email: sessionUser.email, approved: false });
              }
              await supabase.auth.signOut();
              setUser(null);
              showToast('Akun Anda belum disetujui oleh Administrator.', 'error');
              return;
            }
          }
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error('Unhandled error during Supabase session recovery:', err);
        clearSupabaseAuthKeys();
      }

      // Listen for auth state changes
      try {
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setUser(session.user);
          } else {
            setUser(null);
          }
        });
        subscription = sub;
      } catch (err) {
        console.error('Error subscribing to auth state changes:', err);
      }
    };

    checkSession();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Fetch plans when user changes
  React.useEffect(() => {
    fetchPlans();
  }, [user]);

  const fetchPlans = async () => {
    // 1. Jika Supabase Terkonfigurasi & User Logged In riil
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { data, error } = await supabase
          .from('avg_down_plans')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPlans(data || []);
      } catch (err: any) {
        console.error('Error fetching plans:', err.message);
        showToast('Gagal memuat rencana dari cloud database', 'error');
      }
    } else {
      // 2. Fallback: Gunakan Local Storage
      const stored = localStorage.getItem('nunnn_stock_saved_plans');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPlans(parsed);
        } catch {
          setPlans([]);
        }
      } else {
        setPlans([]);
      }
    }
  };

  const handleCalculate = React.useCallback((input: AvgDownInput) => {
    setCalculatorInput(input);
    const res = calculateAvgDown(input);
    setCalculatorResult(res);
  }, []);

  const handleSavePlan = async (title: string) => {
    if (!calculatorInput || !calculatorResult) return;
    setIsSaving(true);

    let lotBaruSave = calculatorInput.lotBaru;
    let hargaBeliBaruSave = calculatorInput.hargaBeliBaru;

    if (calculatorInput.tranches && calculatorInput.tranches.length > 0) {
      let totalShares = 0;
      let totalCost = 0;
      calculatorInput.tranches.forEach(t => {
        totalShares += t.lot * 100;
        totalCost += t.lot * 100 * t.price;
      });
      lotBaruSave = totalShares / 100;
      hargaBeliBaruSave = totalShares > 0 ? totalCost / totalShares : 0;
    }

    const newPlanData = {
      ticker: calculatorInput.ticker,
      company_name: calculatorInput.companyName || 'Emiten BEI',
      lot_awal: calculatorInput.lotAwal,
      avg_price_awal: calculatorInput.avgPriceAwal,
      current_price: calculatorInput.currentPrice,
      lot_baru: lotBaruSave,
      harga_beli_baru: hargaBeliBaruSave,
      fee_beli: calculatorInput.feeBeli,
      fee_jual: calculatorInput.feeJual,
    };

    // 1. Menyimpan ke Supabase Database
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('avg_down_plans')
          .insert({
            ...newPlanData,
            user_id: user.id
          });

        if (error) throw error;
        showToast(`Rencana ${calculatorInput.ticker} berhasil disimpan ke cloud database!`);
        fetchPlans();
      } catch (err: any) {
        showToast(`Gagal menyimpan: ${err.message}`, 'error');
      } finally {
        setIsSaving(false);
      }
    } else {
      // 2. Menyimpan ke Local Storage (User Offline atau Mock Mode)
      setTimeout(() => {
        const newLocalPlan: SavedPlan = {
          id: crypto.randomUUID(),
          ...newPlanData,
          avgPriceAwalIncludesFee: calculatorInput.avgPriceAwalIncludesFee,
          created_at: new Date().toISOString()
        };

        const existingPlans = [...plans];
        existingPlans.unshift(newLocalPlan);
        localStorage.setItem('nunnn_stock_saved_plans', JSON.stringify(existingPlans));
        setPlans(existingPlans);
        showToast(`Rencana ${calculatorInput.ticker} berhasil disimpan secara lokal!`);
        setIsSaving(false);
      }, 600);
    }
  };

  const handleDeletePlan = (id: string) => {
    setPlanIdToDelete(id);
  };

  const executeDeletePlan = async () => {
    if (!planIdToDelete) return;
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('avg_down_plans')
          .delete()
          .eq('id', planIdToDelete);

        if (error) throw error;
        showToast('Rencana berhasil dihapus.');
        fetchPlans();
      } catch (err: any) {
        showToast('Gagal menghapus rencana.', 'error');
      }
    } else {
      // Local Storage delete
      const updated = plans.filter(p => p.id !== planIdToDelete);
      localStorage.setItem('nunnn_stock_saved_plans', JSON.stringify(updated));
      setPlans(updated);
      showToast('Rencana berhasil dihapus dari browser.');
    }
    setPlanIdToDelete(null);
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    setActivePlanToLoad(plan);
    showToast(`Parameter saham ${plan.ticker} berhasil dimuat ke kalkulator.`);
  };

  const handleAvgDownFromPortfolio = (ticker: string, lot: number, avgPrice: number) => {
    const mockPlan: SavedPlan = {
      id: 'mock-portfolio-transfer',
      ticker: ticker,
      lot_awal: lot,
      avg_price_awal: avgPrice,
      current_price: avgPrice,
      lot_baru: 0,
      harga_beli_baru: 0,
      fee_beli: 0.15,
      fee_jual: 0.25,
      created_at: new Date().toISOString()
    };
    setActivePlanToLoad(mockPlan);
    setCurrentTab('avg-down');
    showToast(`Parameter saham ${ticker} berhasil dimuat ke kalkulator.`);
  };

  const handleAnalyzeFromPortfolio = (ticker: string) => {
    setSelectedAnalysisTicker(ticker);
    setCurrentTab('analysis');
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
    if (authUser.isMock) {
      localStorage.setItem('nunnn_stock_mock_user', JSON.stringify(authUser));
      showToast('Berhasil masuk ke simulasi akun lokal.');
    } else {
      showToast('Berhasil masuk menggunakan Supabase Auth!');
    }
  };

  const handleSignOut = () => {
    setIsLogoutConfirmOpen(true);
  };

  const executeSignOut = async () => {
    try {
      if (isSupabaseConfigured && user && !user.isMock) {
        await supabase.auth.signOut();
      } else {
        localStorage.removeItem('nunnn_stock_mock_user');
      }
    } catch (err) {
      console.error('Error during signOut:', err);
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth.token'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {
          console.error('Failed to clear keys on signOut error:', e);
        }
      }
    } finally {
      setUser(null);
      showToast('Anda telah keluar dari akun.');
      setIsLogoutConfirmOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AnimatePresence>
        {showCover && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] flex flex-col justify-between bg-[#121518] text-white pt-4 px-4 pb-1 sm:pt-6 sm:px-6 sm:pb-1.5 md:pt-8 md:px-10 md:pb-2 overflow-hidden select-none h-screen w-screen"
          >
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[#00b15b]/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] rounded-full bg-[#00b15b]/10 blur-[120px] pointer-events-none" />

            {/* Floating Emiten Tickers (Background Animation) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              {tickers.map((ticker) => (
                <motion.div
                  key={ticker.symbol}
                  className="absolute px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-[0.5px] shadow-sm flex items-center gap-2 md:gap-2.5 text-[9.5px] md:text-[11.5px] font-bold select-none pointer-events-none z-0"
                  style={{ left: ticker.x, top: ticker.y }}
                  initial={{ opacity: 0 }}
                  animate={{
                    y: ticker.pathY,
                    x: ticker.pathX,
                    opacity: [0, 0.12, 0.32, 0.12, 0]
                  }}
                  transition={{
                    duration: ticker.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: ticker.delay
                  }}
                >
                  {/* Micro Logo Badge */}
                  <EmitenLogo symbol={ticker.symbol} />
                  <span className="text-white/25 font-black tracking-wider">{ticker.symbol}</span>
                </motion.div>
              ))}
            </div>

            {/* Top Bar Branding */}
            <div className="flex justify-between items-center no-print shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#00b15b] flex items-center justify-center shadow-lg shadow-[#00b15b]/20">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <span className="font-extrabold text-xs tracking-wider uppercase bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  NUNNN STOCK ANALYZER
                </span>
              </div>
              <div className="text-[9px] text-slate-500 font-bold border border-white/5 bg-white/2 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                v1.2.0 Stable
              </div>
            </div>

            {/* Middle Main Landing Info */}
            <div className="max-w-4xl mx-auto text-center flex-1 flex flex-col justify-center items-center gap-3 sm:gap-4 md:gap-6 relative z-10 w-full py-1">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="space-y-1 md:space-y-3"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00b15b]/10 border border-[#00b15b]/20 text-[9px] font-extrabold uppercase tracking-widest text-[#05fa7b] mb-1">
                  <Sparkles className="h-2.5 w-2.5 text-[#05fa7b] animate-pulse" />
                  Sistem Analisis Saham Modern
                </div>
                <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-none text-white">
                  Kuasai Analisis Saham & <br className="hidden sm:inline" />
                  <span className="text-profit-glow">Perencanaan Keuangan</span>
                </h1>
                <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 max-w-sm sm:max-w-lg md:max-w-xl mx-auto leading-relaxed">
                  Hitung secara presisi floating loss dengan kalkulator Average Down, proyeksikan pertumbuhan portofolio secara compounding, dan pantau berita emiten BEI.
                </p>
              </motion.div>

              {/* Call to Action Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="shrink-0"
              >
                <button
                  onClick={handleEnterDashboard}
                  className="group relative flex items-center gap-2 md:gap-3 bg-[#00b15b] hover:bg-[#05fa7b] text-white hover:text-black font-extrabold text-[11px] md:text-xs py-2.5 px-5 md:py-3.5 md:px-7 rounded-xl md:rounded-2xl shadow-xl shadow-[#00b15b]/25 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Mulai Analisis Sekarang</span>
                  <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </motion.div>

              {/* Features Preview Cards Grid */}
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 w-full mt-1 md:mt-3"
              >
                <div className="glass-card p-2 md:p-4 border border-white/5 bg-white/2 text-left flex flex-col justify-between min-h-[75px] sm:min-h-[90px] md:min-h-[120px] transition-colors hover:border-[#00b15b]/30">
                  <div className="h-5 w-5 md:h-8 md:w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <TrendingUp className="h-3 w-3 md:h-4.5 md:w-4.5" />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <h3 className="font-extrabold text-[8.5px] md:text-[11px] uppercase tracking-wider text-slate-200">Average Down</h3>
                    <p className="hidden md:block text-[9.5px] text-slate-400 leading-normal mt-0.5">
                      Hitung persentase avg down secara bertahap terintegrasi dengan broker fee beli & jual bursa Indonesia secara presisi.
                    </p>
                  </div>
                </div>

                <div className="glass-card p-2 md:p-4 border border-white/5 bg-white/2 text-left flex flex-col justify-between min-h-[75px] sm:min-h-[90px] md:min-h-[120px] transition-colors hover:border-[#00b15b]/30">
                  <div className="h-5 w-5 md:h-8 md:w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                    <Percent className="h-3 w-3 md:h-4.5 md:w-4.5" />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <h3 className="font-extrabold text-[8.5px] md:text-[11px] uppercase tracking-wider text-slate-200">Compounding</h3>
                    <p className="hidden md:block text-[9.5px] text-slate-400 leading-normal mt-0.5">
                      Proyeksikan pertumbuhan dana investasi jangka panjang atau rencana trading harian yang disesuaikan dengan pajak & inflasi.
                    </p>
                  </div>
                </div>

                <div className="glass-card p-2 md:p-4 border border-white/5 bg-white/2 text-left flex flex-col justify-between min-h-[75px] sm:min-h-[90px] md:min-h-[120px] transition-colors hover:border-[#00b15b]/30">
                  <div className="h-5 w-5 md:h-8 md:w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <Coins className="h-3 w-3 md:h-4.5 md:w-4.5" />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <h3 className="font-extrabold text-[8.5px] md:text-[11px] uppercase tracking-wider text-slate-200">Penjatahan E-IPO</h3>
                    <p className="hidden md:block text-[9.5px] text-slate-400 leading-normal mt-0.5">
                      Hitung jatah saham IPO terpusat (pooling) menggunakan regulasi OJK terbaru secara presisi.
                    </p>
                  </div>
                </div>

                <div className="glass-card p-2 md:p-4 border border-white/5 bg-white/2 text-left flex flex-col justify-between min-h-[75px] sm:min-h-[90px] md:min-h-[120px] transition-colors hover:border-[#00b15b]/30">
                  <div className="h-5 w-5 md:h-8 md:w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                    <FileText className="h-3 w-3 md:h-4.5 md:w-4.5" />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <h3 className="font-extrabold text-[8.5px] md:text-[11px] uppercase tracking-wider text-slate-200">Emiten & Berita</h3>
                    <p className="hidden md:block text-[9.5px] text-slate-400 leading-normal mt-0.5">
                      Pantau sentimen pasar berdasarkan rangkuman berita terintegrasi untuk emiten BEI.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom Footer Credits */}
            <div className="text-center text-[10px] text-slate-500 py-1.5 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>© 2026 Al Fitra Nur Ramadhani. All rights reserved.</span>
              <div className="flex gap-4">
                <span className="hover:text-slate-400 cursor-pointer">Syarat & Ketentuan</span>
                <span className="hover:text-slate-400 cursor-pointer">Kebijakan Privasi</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background decoration elements */}
      <div className="mesh-bg" />

      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab}
        user={user}
        onSignOut={handleSignOut}
        onSignInClick={() => setIsAuthModalOpen(true)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onLogoClick={() => {
          sessionStorage.removeItem('nunnn_stock_entered_dashboard');
          setShowCover(true);
        }}
      />

      {/* Main Dashboard Panel */}
      <main className={`flex-1 min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pt-16 md:pt-0 ${isSidebarCollapsed ? 'md:pl-[80px]' : 'md:pl-[260px]'}`}>
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8">
          
          {/* 1. News & Sentiment Tab */}
          <div className={currentTab === 'news' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'news' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <NewsTab
                user={user}
                onSignInClick={() => setIsAuthModalOpen(true)}
              />
            </motion.div>
          </div>

          {/* 2. Average Down Tab */}
          <div className={currentTab === 'avg-down' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'avg-down' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              {/* Header */}
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
                  Kalkulator Average Down
                  <Sparkles className="h-6 w-6 text-brand-purple animate-pulse shrink-0" />
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 w-full">
                  Alat bantu hitung rencana average down (pembelian bertahap) untuk meminimalkan kerugian floating loss secara presisi, terintegrasi dengan pajak transaksi bursa Indonesia.
                </p>
              </div>

              {/* Alert Status Konfigurasi Supabase */}
              {!isSupabaseConfigured && (
                <div className="p-4.5 rounded-2xl bg-brand-purple/5 border border-brand-purple/20 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm">
                  <Info className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">Tips Uji Coba Mandiri:</span>
                    <p className="mt-1">
                      Aplikasi ini mendeteksi Anda belum menghubungkan proyek Supabase (PostgreSQL) riil. 
                      Jangan khawatir! Seluruh fitur **Average Down**, perhitungan presisi **Broker Fee**, 
                      dan **Penyimpanan Riwayat** telah dilengkapi dengan simulasi lokal menggunakan *localStorage* browser. 
                      Anda dapat mencoba alur kerja full-stack secara utuh langsung sekarang.
                    </p>
                  </div>
                </div>
              )}

              {/* Content Area Stack (Form on top, Results on bottom) */}
              <div className="flex flex-col gap-6 w-full">
                <CalculatorForm 
                  onCalculate={handleCalculate}
                  onSavePlan={handleSavePlan}
                  isSaving={isSaving}
                  user={user}
                  initialValues={activePlanToLoad}
                />

                <ResultsDisplay 
                  result={calculatorResult} 
                  ticker={calculatorInput?.ticker || 'ANTM'} 
                  companyName={calculatorInput?.companyName}
                />
              </div>

              {/* History List */}
              <div className="w-full">
                <HistoryTable 
                  plans={plans}
                  onDeletePlan={handleDeletePlan}
                  onLoadPlan={handleLoadPlan}
                  user={user}
                />
              </div>
            </motion.div>
          </div>

          {/* 3. Compounding Tab */}
          <div className={currentTab === 'compounding' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'compounding' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <CompoundingTab
                user={user}
                onSignInClick={() => setIsAuthModalOpen(true)}
              />
            </motion.div>
          </div>

          {/* 3.5. E-IPO Tab */}
          <div className={currentTab === 'ipo' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'ipo' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <IpoTab
                user={user}
                onSignInClick={() => setIsAuthModalOpen(true)}
              />
            </motion.div>
          </div>

          {/* 4. Portfolio Tab */}
          <div className={currentTab === 'portfolio' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'portfolio' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <PortfolioTab
                user={user}
                onSignInClick={() => setIsAuthModalOpen(true)}
                onAvgDownClick={handleAvgDownFromPortfolio}
                onAnalyzeClick={handleAnalyzeFromPortfolio}
              />
            </motion.div>
          </div>

          {/* 5. Analysis Tab */}
          <div className={currentTab === 'analysis' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'analysis' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <AnalysisTab
                user={user}
                onSignInClick={() => setIsAuthModalOpen(true)}
                initialTicker={selectedAnalysisTicker}
              />
            </motion.div>
          </div>

          {/* 6. Admin Panel Tab */}
          <div className={currentTab === 'admin' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'admin' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <AdminPanelTab user={user} />
            </motion.div>
          </div>

          {/* Footer branding */}
          <div className="text-center text-[10px] text-slate-500 pt-6 pb-2 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-center gap-1.5">
            <span>© 2026 Al Fitra Nur Ramadhani. All rights reserved.</span>
          </div>

        </div>
      </main>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={executeSignOut}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun? Anda perlu masuk kembali untuk mengakses cloud database."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        type="warning"
      />

      <ConfirmModal
        isOpen={planIdToDelete !== null}
        onClose={() => setPlanIdToDelete(null)}
        onConfirm={executeDeletePlan}
        title="Hapus Rencana"
        message="Apakah Anda yakin ingin menghapus rencana simulasi ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 backdrop-blur-md text-xs font-bold ${
              toast.type === 'success' 
                ? 'bg-bullish-green/90 border-bullish-green/30 text-white' 
                : toast.type === 'error'
                  ? 'bg-rose-600/90 border-rose-500/30 text-white'
                  : 'bg-slate-900/90 border-white/10 text-white'
            }`}
          >
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className={`fixed right-6 md:right-8 z-40 p-3 rounded-full bg-brand-purple hover:bg-brand-purple/95 text-white shadow-lg shadow-brand-purple/20 cursor-pointer transition-all duration-500 border border-white/10 flex items-center justify-center ${
              toast ? 'bottom-24 md:bottom-26' : 'bottom-6 md:bottom-8'
            }`}
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-5.5 w-5.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
