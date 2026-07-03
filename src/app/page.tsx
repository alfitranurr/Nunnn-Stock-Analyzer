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
import { DividendTab } from '@/components/dividend-tab';
import { IpoTab } from '@/components/ipo-tab';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Sparkles, BookOpen, AlertCircle, Info, Database, ChevronUp, ArrowRight, Percent, TrendingUp, FileText, Coins, Home, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

export default function Dashboard() {
  const [currentTab, setCurrentTab] = React.useState('home');
  const [user, setUser] = React.useState<any>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();

  const languageRef = React.useRef(language);
  React.useEffect(() => {
    languageRef.current = language;
  }, [language]);

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

  // Persistent active tab on page refresh/reload using sessionStorage.
  // This preserves the current tab on F5/reload, but defaults to 'home' when opening in a new tab/session.
  React.useEffect(() => {
    const savedTab = sessionStorage.getItem('nunnn_stock_active_tab');
    if (savedTab) {
      setTimeout(() => {
        setCurrentTab(savedTab);
      }, 0);
    }
  }, []);

  React.useEffect(() => {
    sessionStorage.setItem('nunnn_stock_active_tab', currentTab);
    // Scroll ke paling atas secara instan saat berpindah tab/halaman
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
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
              const simUsers = storedSimUsers ? JSON.parse(storedSimUsers) : [];
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
                showToast(
                  languageRef.current === 'id'
                    ? 'Akun simulasi Anda belum disetujui oleh Administrator.'
                    : 'Your simulated account has not been approved by the Administrator.',
                  'error'
                );
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
          const isRefreshTokenError = error.message.includes('Refresh Token') || 
                                     error.message.includes('refresh_token') || 
                                     error.status === 400 || 
                                     error.status === 401;
          if (!isRefreshTokenError) {
            console.warn('Supabase session recovery error:', error.message);
          }
          if (isRefreshTokenError) {
            clearSupabaseAuthKeys();
          }
        } else if (data?.session) {
          const sessionUser = data.session.user;
          const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
          
          if (sessionUser.email?.toLowerCase() === adminEmail) {
            const { data: adminApprovalArray } = await supabase
              .from('user_approvals')
              .select('approved')
              .eq('email', sessionUser.email);
              
            const adminApproval = adminApprovalArray && adminApprovalArray.length > 0 ? adminApprovalArray[0] : null;
              
            if (!adminApproval) {
              await supabase.from('user_approvals').insert({ email: sessionUser.email, approved: true });
            } else if (!adminApproval.approved) {
              await supabase.from('user_approvals').update({ approved: true }).eq('email', sessionUser.email);
            }
          } else {
            const { data: approvalDataArray, error: dbError } = await supabase
              .from('user_approvals')
              .select('approved')
              .eq('email', sessionUser.email);

            const approvalData = approvalDataArray && approvalDataArray.length > 0 ? approvalDataArray[0] : null;

            if (dbError || !approvalData || !approvalData.approved) {
              if (!approvalData && sessionUser.email) {
                await supabase.from('user_approvals').insert({ email: sessionUser.email, approved: false });
              }
              await supabase.auth.signOut();
              setUser(null);
              showToast(
                languageRef.current === 'id'
                  ? 'Akun Anda belum disetujui oleh Administrator.'
                  : 'Your account has not been approved by the Administrator.',
                'error'
              );
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

  const fetchPlans = React.useCallback(async () => {
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
  }, [user]);

  // Fetch plans when user changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlans();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPlans]);

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
      company_name: calculatorInput.companyName || (language === 'id' ? 'Emiten BEI' : 'IDX Company'),
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
        showToast(
          language === 'id'
            ? `Rencana ${calculatorInput.ticker} berhasil disimpan ke cloud database!`
            : `Plan ${calculatorInput.ticker} successfully saved to cloud database!`
        );
        fetchPlans();
      } catch (err: any) {
        showToast(
          language === 'id'
            ? `Gagal menyimpan: ${err.message}`
            : `Failed to save: ${err.message}`,
          'error'
        );
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
        showToast(
          language === 'id'
            ? `Rencana ${calculatorInput.ticker} berhasil disimpan secara lokal!`
            : `Plan ${calculatorInput.ticker} successfully saved locally!`
        );
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
        showToast(
          language === 'id'
            ? 'Rencana berhasil dihapus.'
            : 'Plan deleted successfully.'
        );
        fetchPlans();
      } catch (err: any) {
        showToast(
          language === 'id'
            ? 'Gagal menghapus rencana.'
            : 'Failed to delete plan.',
          'error'
        );
      }
    } else {
      // Local Storage delete
      const updated = plans.filter(p => p.id !== planIdToDelete);
      localStorage.setItem('nunnn_stock_saved_plans', JSON.stringify(updated));
      setPlans(updated);
      showToast(
        language === 'id'
          ? 'Rencana berhasil dihapus dari browser.'
          : 'Plan deleted successfully from browser.'
      );
    }
    setPlanIdToDelete(null);
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    setActivePlanToLoad(plan);
    showToast(
      language === 'id'
        ? `Parameter saham ${plan.ticker} berhasil dimuat ke kalkulator.`
        : `Stock parameters for ${plan.ticker} loaded into the calculator successfully.`
    );
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
    showToast(
      language === 'id'
        ? `Parameter saham ${ticker} berhasil dimuat ke kalkulator.`
        : `Stock parameters for ${ticker} loaded into the calculator successfully.`
    );
  };

  const handleAnalyzeFromPortfolio = (ticker: string) => {
    setSelectedAnalysisTicker(ticker);
    setCurrentTab('analysis');
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
    if (authUser.isMock) {
      localStorage.setItem('nunnn_stock_mock_user', JSON.stringify(authUser));
      showToast(
        language === 'id'
          ? 'Berhasil masuk ke simulasi akun lokal.'
          : 'Successfully signed in to local account simulation.'
      );
    } else {
      showToast(
        language === 'id'
          ? 'Berhasil masuk menggunakan Supabase Auth!'
          : 'Successfully signed in using Supabase Auth!'
      );
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
      showToast(
        language === 'id'
          ? 'Anda telah keluar dari akun.'
          : 'You have signed out from your account.'
      );
      setIsLogoutConfirmOpen(false);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden">
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
          setCurrentTab('home');
        }}
      />

      {/* Main Dashboard Panel */}
      <main className={`flex-1 h-dvh flex flex-col min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pt-16 md:pt-0 pb-0 ${isSidebarCollapsed ? 'md:pl-[80px]' : 'md:pl-[260px]'}`}>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-3 md:pb-4 max-w-7xl w-full mx-auto flex flex-col justify-between custom-scrollbar">
          
          {/* 0. Home Tab */}
          <div className={currentTab === 'home' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'home' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              {/* Premium Hero Banner Card */}
              <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-card-bg via-[#161a1d] to-[#121517] p-6 md:p-10 shadow-2xl">
                {/* Glow effects */}
                <div className="absolute top-0 right-0 w-[200px] md:w-[320px] h-[200px] md:h-[320px] rounded-full bg-brand-purple/10 blur-[80px] md:blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[180px] md:w-[250px] h-[180px] md:h-[250px] rounded-full bg-emerald-500/5 blur-[80px] md:blur-[100px] pointer-events-none" />
                
                <div className="relative z-10 w-full space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-[9px] font-extrabold uppercase tracking-widest text-brand-purple">
                    <Sparkles className="h-3 w-3 text-brand-purple animate-pulse" />
                    <span>{t('cover.sparkles')}</span>
                  </div>
                  
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
                    {t('cover.title1')} <span className="text-profit-glow">{t('cover.title2')}</span>
                  </h1>
                  
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed w-full">
                    {t('cover.desc')}
                  </p>
                  
                  {/* Status Banner */}
                  <div className="pt-2">
                    {user ? (
                      <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[10px] md:text-xs font-semibold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>
                          {language === 'id' 
                            ? `Terhubung: ${user.email} (${isSupabaseConfigured && !user.isMock ? 'Cloud DB' : 'Simulasi Lokal'})`
                            : `Connected: ${user.email} (${isSupabaseConfigured && !user.isMock ? 'Cloud DB' : 'Local Simulation'})`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                        <span className="text-[10px] md:text-xs text-slate-450">
                          {language === 'id'
                            ? 'Masuk ke akun Anda untuk menyimpan rencana & memantau portofolio riil.'
                            : 'Sign in to your account to save plans & monitor real portfolio.'}
                        </span>
                        <button
                          onClick={() => setIsAuthModalOpen(true)}
                          className="self-start px-4.5 py-1.5 rounded-lg bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-[10px] md:text-xs transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {t('sidebar.login')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feature Quick Navigation Grid (Horizontal Cards) */}
                  <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      onClick={() => setCurrentTab('avg-down')}
                      className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-emerald-400 transition-colors">Average Down</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Floating Loss & Fee</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                    <button
                      onClick={() => setCurrentTab('dividend')}
                      className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-emerald-400 transition-colors">
                          Kalkulator Dividen
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Passive Income & Pajak</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                    <button
                      onClick={() => setCurrentTab('compounding')}
                      className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-emerald-400 transition-colors">Compounding</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Pertumbuhan Investasi</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                    <button
                      onClick={() => setCurrentTab('ipo')}
                      className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-emerald-400 transition-colors">Jatah E-IPO</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Pooling Jatah Saham</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Ticker Marquee */}
                <div className="relative w-full overflow-hidden border-t border-white/5 pt-4 mt-4 select-none">
                  <style>{`
                    @keyframes marqueeLtr {
                      0% { transform: translate3d(-50%, 0, 0); }
                      100% { transform: translate3d(0%, 0, 0); }
                    }
                    .animate-marquee-ltr {
                      display: flex;
                      width: max-content;
                      animation: marqueeLtr 30s linear infinite;
                    }
                    .marquee-fade-left {
                      background: linear-gradient(to right, var(--card-bg) 0%, transparent 100%);
                    }
                    .marquee-fade-right {
                      background: linear-gradient(to left, var(--card-bg) 0%, transparent 100%);
                    }
                  `}</style>
                  
                  {/* Gradient Fade Overlays */}
                  <div className="absolute inset-y-0 left-0 w-8.5 marquee-fade-left z-10 pointer-events-none" />
                  <div className="absolute inset-y-0 right-0 w-8.5 marquee-fade-right z-10 pointer-events-none" />
                  
                  <div className="animate-marquee-ltr flex whitespace-nowrap">
                    <div className="flex items-center gap-6 pr-6 shrink-0">
                      {['BBRI', 'BBCA', 'GOTO', 'TLKM', 'ASII', 'ANTM', 'BMRI', 'BBNI', 'BREN', 'BRPT', 'TPIA', 'CUAN', 'ADRO', 'PTBA', 'ITMG', 'UNVR'].map((symbol) => (
                        <div key={`marquee-1-${symbol}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] shadow-sm shrink-0">
                          <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                              src={`https://assets.stockbit.com/logos/companies/${symbol}.png`}
                              alt={symbol}
                              className="w-4 h-4 object-contain opacity-60"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-white/30 tracking-wider uppercase">{symbol}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 pr-6 shrink-0" aria-hidden="true">
                      {['BBRI', 'BBCA', 'GOTO', 'TLKM', 'ASII', 'ANTM', 'BMRI', 'BBNI', 'BREN', 'BRPT', 'TPIA', 'CUAN', 'ADRO', 'PTBA', 'ITMG', 'UNVR'].map((symbol) => (
                        <div key={`marquee-2-${symbol}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] shadow-sm shrink-0">
                          <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                              src={`https://assets.stockbit.com/logos/companies/${symbol}.png`}
                              alt={symbol}
                              className="w-4 h-4 object-contain opacity-60"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-white/30 tracking-wider uppercase">{symbol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="max-w-2xl mx-auto w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-[9px] md:text-[10px] text-slate-500 leading-relaxed text-center">
                {t('common.disclaimer')}
              </div>
            </motion.div>
          </div>

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
              {/* Header Banner */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card-bg via-[#161b22] to-[#0d1117] p-6 md:p-8 shadow-2xl w-full">
                <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2 w-full">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                      <Calculator className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      <span>{language === 'id' ? 'Average Down & Floating Loss Analysis' : 'Average Down & Floating Loss Analysis'}</span>
                    </div>
                    
                    <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
                      {t('calculator.title')}
                      <Sparkles className="h-6 w-6 text-emerald-400 shrink-0" />
                    </h1>
                    
                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed w-full">
                      {t('calculator.desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alert Status Konfigurasi Supabase */}
              {!isSupabaseConfigured && (
                <div className="p-4.5 rounded-2xl bg-brand-purple/5 border border-brand-purple/20 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm">
                  <Info className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {language === 'id' ? 'Tips Uji Coba Mandiri:' : 'Self-Trial Tips:'}
                    </span>
                    <p className="mt-1">
                      {language === 'id'
                        ? 'Aplikasi ini mendeteksi Anda belum menghubungkan proyek Supabase (PostgreSQL) riil. Jangan khawatir! Seluruh fitur Average Down, perhitungan presisi Broker Fee, dan Penyimpanan Riwayat telah dilengkapi dengan simulasi lokal menggunakan localStorage browser. Anda dapat mencoba alur kerja full-stack secara utuh langsung sekarang.'
                        : 'This application detects that you have not connected a real Supabase (PostgreSQL) project. Do not worry! All features including Average Down, precise Broker Fee calculation, and History Saving are supported via browser localStorage simulation. You can try the full-stack workflow right now.'
                      }
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

          {/* 3.4. Dividend Calculator Tab */}
          <div className={currentTab === 'dividend' ? 'block' : 'hidden'}>
            <motion.div
              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
              animate={currentTab === 'dividend' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 15, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8"
            >
              <DividendTab
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
          <div className="max-w-xs mx-auto w-full text-center text-[10px] text-slate-500 pt-3 pb-1 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-center gap-1.5 no-print mt-auto shrink-0">
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
        title={language === 'id' ? 'Konfirmasi Keluar' : 'Confirm Sign Out'}
        message={
          language === 'id'
            ? 'Apakah Anda yakin ingin keluar dari akun? Anda perlu masuk kembali untuk mengakses cloud database.'
            : 'Are you sure you want to sign out? You will need to sign in again to access the cloud database.'
        }
        confirmText={language === 'id' ? 'Ya, Keluar' : 'Yes, Sign Out'}
        cancelText={language === 'id' ? 'Batal' : 'Cancel'}
        type="warning"
      />

      <ConfirmModal
        isOpen={planIdToDelete !== null}
        onClose={() => setPlanIdToDelete(null)}
        onConfirm={executeDeletePlan}
        title={language === 'id' ? 'Hapus Rencana' : 'Delete Plan'}
        message={
          language === 'id'
            ? 'Apakah Anda yakin ingin menghapus rencana simulasi ini? Tindakan ini tidak dapat dibatalkan.'
            : 'Are you sure you want to delete this simulation plan? This action cannot be undone.'
        }
        confirmText={language === 'id' ? 'Ya, Hapus' : 'Yes, Delete'}
        cancelText={language === 'id' ? 'Batal' : 'Cancel'}
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
