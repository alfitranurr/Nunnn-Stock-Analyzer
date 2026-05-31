'use client';

import * as React from 'react';
import { Sidebar } from '@/components/sidebar';
import { CalculatorForm } from '@/components/calculator-form';
import { ResultsDisplay } from '@/components/results-display';
import { HistoryTable, SavedPlan } from '@/components/history-table';
import { AuthModal } from '@/components/auth-modal';
import { PortfolioTab } from '@/components/portfolio-tab';
import { ConfirmModal } from '@/components/confirm-modal';
import { calculateAvgDown, AvgDownInput, AvgDownResult } from '@/lib/calculator';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Sparkles, BookOpen, AlertCircle, Info, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const [currentTab, setCurrentTab] = React.useState('avg-down');
  const [user, setUser] = React.useState<any>(null);
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
        // Cek apakah ada mock user di localStorage
        const storedMockUser = localStorage.getItem('nunnn_stock_mock_user');
        if (storedMockUser) {
          try {
            setUser(JSON.parse(storedMockUser));
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
          setUser(data.session.user);
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
      {/* Background decoration elements */}
      <div className="mesh-bg" />

      {/* Collapsible Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab}
        user={user}
        onSignOut={handleSignOut}
        onSignInClick={() => setIsAuthModalOpen(true)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Dashboard Panel */}
      <main className={`flex-1 min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pt-16 md:pt-0 ${isSidebarCollapsed ? 'md:pl-[80px]' : 'md:pl-[260px]'}`}>
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8"
        >
          {currentTab === 'avg-down' ? (
            <>
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
                <div className="p-4.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-brand-indigo/35 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm">
                  <Info className="h-5 w-5 text-brand-indigo shrink-0 mt-0.5" />
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
            </>
          ) : (
            <PortfolioTab
              user={user}
              onSignInClick={() => setIsAuthModalOpen(true)}
              onAvgDownClick={handleAvgDownFromPortfolio}
            />
          )}
          
          {/* Footer branding */}
          <div className="text-center text-[10px] text-slate-500 pt-6 pb-2 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-center gap-1.5">
            <span>© 2025 Al Fitra Nur Ramadhani. All rights reserved.</span>
          </div>

        </motion.div>
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
    </div>
  );
}
