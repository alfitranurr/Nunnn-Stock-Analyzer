'use client';

import * as React from 'react';
import { GlobalRefreshButton } from '@/components/global-refresh-button';
import { 
  Calculator,
  Briefcase,
  Star,
  ChartCandlestick,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User,
  Lock,
  Newspaper,
  ShieldCheck,
  Percent,
  Sprout,
  HandCoins,
  Rocket,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

/** Logo Nunnn: ubin hijau dengan huruf N dan panah naik (sama dengan app/icon.svg). */
function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="rounded-[11px] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" style={{ width: size * 0.6, height: size * 0.6 }}>
        <path d="M15 47V19L41 46V25" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M31 27L41 14L51 27Z" fill="#fff" />
      </svg>
    </span>
  );
}

function BrandName({ language }: { language: string }) {
  return (
    <span className="min-w-0 leading-tight">
      <span className="block font-display font-semibold text-base text-white tracking-tight">Nunnn Stock</span>
      <span className="block text-[11px] text-slate-500">{language === 'id' ? 'Analyzer saham BEI' : 'IDX stock analyzer'}</span>
    </span>
  );
}

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: AppUser | null;
  onSignOut: () => void;
  onSignInClick: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onLogoClick?: () => void;
}

export function Sidebar({ currentTab, setCurrentTab, user, onSignOut, onSignInClick, isCollapsed, setIsCollapsed, onLogoClick }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
  const isAdmin = user && user.email && user.email.toLowerCase() === adminEmail;

  type MenuGroup = 'market' | 'calc' | 'account';
  const menuItems: Array<{ id: string; label: string; icon: typeof Home; active: boolean; isLocked?: boolean; group: MenuGroup }> = [
    // Pasar
    { id: 'home', label: t('sidebar.home') || 'Home', icon: Home, active: true, group: 'market' },
    { id: 'news', label: t('sidebar.news'), icon: Newspaper, active: true, group: 'market' },
    { id: 'analysis', label: t('sidebar.analysis'), icon: ChartCandlestick, active: true, isLocked: !user, group: 'market' },
    { id: 'watchlist', label: t('sidebar.watchlist'), icon: Star, active: true, group: 'market' },
    // Kalkulator
    { id: 'avg-down', label: t('sidebar.avgDown'), icon: Calculator, active: true, group: 'calc' },
    { id: 'compounding', label: t('sidebar.compounding'), icon: Sprout, active: true, group: 'calc' },
    { id: 'percentage', label: t('sidebar.percentage'), icon: Percent, active: true, group: 'calc' },
    { id: 'dividend', label: t('sidebar.dividend'), icon: HandCoins, active: true, group: 'calc' },
    { id: 'ipo', label: t('sidebar.ipo'), icon: Rocket, active: true, group: 'calc' },
    // Akun (Admin selalu paling bawah)
    { id: 'portfolio', label: t('sidebar.portfolio'), icon: Briefcase, active: true, isLocked: !user, group: 'account' },
    ...(isAdmin ? [{ id: 'admin', label: t('sidebar.admin'), icon: ShieldCheck, active: true, group: 'account' as const }] : []),
  ];
  const GROUP_LABEL: Record<MenuGroup, string> = {
    market: language === 'id' ? 'Pasar' : 'Market',
    calc: language === 'id' ? 'Kalkulator' : 'Calculators',
    account: language === 'id' ? 'Akun' : 'Account',
  };
  /** Judul kelompok sebelum item pertama tiap kelompok. */
  const groupStart = (index: number) => index === 0 || menuItems[index - 1].group !== menuItems[index].group;

  // Menu bawah di HP: 4 halaman yang paling sering dibuka + tombol Menu (laci lengkap).
  const bottomNav = ['home', 'news', 'analysis', 'watchlist']
    .map((id) => menuItems.find((m) => m.id === id))
    .filter((m): m is (typeof menuItems)[number] => !!m);
  const shortLabel: Record<string, string> = {
    home: language === 'id' ? 'Beranda' : 'Home',
    news: language === 'id' ? 'Berita' : 'News',
    analysis: language === 'id' ? 'Analisis' : 'Analysis',
    watchlist: 'Watchlist',
  };

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 80 }
  };

  return (
    <>
      {/* Mobile Header (Fixed Top) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar-bg/95 backdrop-blur border-b border-white/[0.06] flex items-center justify-between px-4 z-40">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-left bg-transparent border-0 p-0"
        >
          <BrandMark size={32} />
          <BrandName language={language} />
        </button>
        <div className="flex items-center gap-2">
          <GlobalRefreshButton language={language} variant="icon" isAdmin={!!isAdmin} />
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl bg-surface-2 text-foreground cursor-pointer"
            aria-label={language === 'id' ? 'Buka menu' : 'Open menu'}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Menu bawah HP (Fixed Bottom) */}
      <nav
        aria-label={language === 'id' ? 'Navigasi utama' : 'Main navigation'}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar-bg/95 backdrop-blur border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16 px-1.5 py-1.5 gap-1">
          {bottomNav.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold cursor-pointer transition-colors',
                  active ? 'bg-surface-3 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.isLocked && <Lock className="absolute -right-2 -top-1 h-2.5 w-2.5 text-slate-500" />}
                </span>
                {shortLabel[item.id]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold cursor-pointer transition-colors',
              bottomNav.some((m) => m.id === currentTab) ? 'text-slate-400 hover:text-white' : 'bg-surface-3 text-white'
            )}
          >
            <Menu className="h-5 w-5" />
            {language === 'id' ? 'Menu' : 'Menu'}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer (Overlay + Panel) */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden fixed inset-0 bg-black z-50"
            />
            {/* Drawer Content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="md:hidden fixed top-0 bottom-0 left-0 w-[280px] bg-sidebar-bg border-r border-border-color z-50 flex flex-col py-5 px-4 text-white"
            >
              <div className="flex items-center justify-between mb-5 px-2">
                <button
                  onClick={() => {
                    onLogoClick?.();
                    setIsMobileOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-left bg-transparent border-0 p-0"
                >
                  <BrandMark />
                  <BrandName language={language} />
                </button>
                <button 
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded-lg hover:bg-input-bg text-white cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Menu items */}
              <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {menuItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                  {groupStart(index) && (
                    <p className={cn('px-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500', index > 0 ? 'pt-3' : 'pt-0')}>{GROUP_LABEL[item.group]}</p>
                  )}
                  <button
                    onClick={() => {
                      if (item.active) {
                        setCurrentTab(item.id);
                        setIsMobileOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-colors duration-200 cursor-pointer text-left",
                      currentTab === item.id && item.active
                        ? "bg-surface-2 text-white"
                        : "text-slate-400 hover:text-white hover:bg-card-bg",
                      !item.active && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-5 w-5", currentTab === item.id && "text-accent")} />
                      <span className="font-medium text-sm text-left">{item.label}</span>
                    </div>
                    {item.isLocked && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-2 text-[10px] font-semibold text-slate-400 shrink-0">Login</span>
                    )}
                  </button>
                  </React.Fragment>
                ))}
              </nav>

              {/* Mobile Bottom Section */}
              <div className="mt-auto pt-4 border-t border-white/10 space-y-4">
                {/* Language Switcher */}
                <div className="flex flex-col gap-1.5 px-1 pb-1">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-400">{t('sidebar.language')}</span>
                  <div className="flex bg-surface-2 p-1 rounded-full text-xs font-semibold select-none">
                    <button
                      type="button"
                      onClick={() => setLanguage('id')}
                      className={cn(
                        "flex-1 py-1.5 rounded-full transition-colors cursor-pointer text-center",
                        language === 'id' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                      )}
                    >
                      Indonesia
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={cn(
                        "flex-1 py-1.5 rounded-full transition-colors cursor-pointer text-center",
                        language === 'en' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                      )}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Profile Footer */}
                {user ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/40">
                        <User className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-400 truncate">{t('sidebar.user')}</p>
                        <p className="text-sm font-semibold truncate text-white">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        onSignOut();
                        setIsMobileOpen(false);
                      }} 
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onSignInClick();
                      setIsMobileOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-all duration-300 shadow-md"
                  >
                    <User className="h-4 w-4" />
                    <span>{t('sidebar.login')}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Left-pinned) */}
      <motion.aside
        initial="expanded"
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "hidden md:flex flex-col fixed top-0 bottom-0 left-0 bg-sidebar-bg border-r border-white/[0.06] py-5 z-30 group transition-all duration-300",
          isCollapsed ? "px-0 items-center" : "px-3"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn("flex items-center mb-5 transition-all duration-300 relative w-full", isCollapsed ? "justify-center px-0" : "justify-between px-2")}>
          <button
            onClick={onLogoClick}
            className={cn("flex items-center cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all bg-transparent border-0 p-0", isCollapsed ? "justify-center w-full" : "gap-2.5 text-left")}
          >
            <BrandMark />
            {!isCollapsed && <BrandName language={language} />}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden group-hover:flex p-1 rounded-lg bg-input-bg hover:bg-glass-border border border-border-color text-foreground cursor-pointer transition-all duration-200 absolute -right-3.5 top-0.5 z-40 shadow-md"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Menu (Scrollable if screen is short) */}
        <nav className={cn(
          "flex-1 overflow-y-auto space-y-1 custom-scrollbar w-full",
          isCollapsed ? "px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" : "pr-1.5"
        )}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.id}>
            {groupStart(index) && (
              isCollapsed
                ? index > 0 && <div className="mx-auto my-2 h-px w-8 bg-border-color" aria-hidden />
                : <p className={cn('px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500', index > 0 ? 'pt-3' : 'pt-0')}>{GROUP_LABEL[item.group]}</p>
            )}
            <button
              onClick={() => item.active && setCurrentTab(item.id)}
              className={cn(
                "flex items-center transition-colors duration-200 relative group/item cursor-pointer",
                isCollapsed
                  ? "w-11 h-11 mx-auto justify-center rounded-xl p-0 shrink-0"
                  : "w-full justify-between px-3 py-2 rounded-xl text-left",
                currentTab === item.id && item.active
                  ? "bg-surface-2 text-white"
                  : "text-slate-400 hover:text-white hover:bg-card-bg",
                !item.active && "opacity-45 cursor-not-allowed"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={cn("flex items-center justify-center", isCollapsed ? "w-full h-full" : "gap-3")}>
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", currentTab === item.id && "text-accent")} />
                {!isCollapsed && <span className="text-sm font-medium text-left whitespace-nowrap">{item.label}</span>}
              </div>
              {!isCollapsed && item.isLocked && (
                <span className="px-2 py-0.5 rounded-full bg-surface-2 text-[10px] font-semibold text-slate-400 shrink-0">Login</span>
              )}
            </button>
            </React.Fragment>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto pt-3 border-t border-white/[0.06] space-y-3 shrink-0 w-full">
          {/* Refresh data terpusat (semua halaman) */}
          {isCollapsed ? (
            <div className="flex justify-center w-full">
              <GlobalRefreshButton language={language} variant="icon" isAdmin={!!isAdmin} />
            </div>
          ) : (
            <div className="px-2.5">
              <GlobalRefreshButton language={language} variant="full" isAdmin={!!isAdmin} />
            </div>
          )}

          {/* Language Switcher */}
          {!isCollapsed ? (
            <div className="px-2.5">
              <div className="flex bg-surface-2 p-1 rounded-full text-[11px] font-semibold select-none" role="group" aria-label={t('sidebar.language')}>
                <button
                  type="button"
                  onClick={() => setLanguage('id')}
                  className={cn(
                    "flex-1 py-1.5 rounded-full transition-colors cursor-pointer text-center",
                    language === 'id' ? "bg-white text-slate-950" : "text-slate-500 hover:text-white"
                  )}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "flex-1 py-1.5 rounded-full transition-colors cursor-pointer text-center",
                    language === 'en' ? "bg-white text-slate-950" : "text-slate-500 hover:text-white"
                  )}
                >
                  EN
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <button
                type="button"
                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                className="w-11 h-11 rounded-xl border border-border-color bg-input-bg flex items-center justify-center text-xs font-black text-emerald-400 hover:bg-glass-border hover:text-white transition-all cursor-pointer shadow-sm mx-auto"
                title={language === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
              >
                {language.toUpperCase()}
              </button>
            </div>
          )}

          {/* Profile Footer */}
          {user ? (
            <div className={cn("flex items-center overflow-hidden w-full", isCollapsed ? "justify-center" : "justify-between gap-2.5 px-2.5")}>
              <div className={cn("flex items-center overflow-hidden", isCollapsed ? "justify-center w-full" : "gap-2.5")}>
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-md mx-auto" title={user.email}>
                  <User className="h-5 w-5 text-emerald-400" />
                </div>
                {!isCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{t('sidebar.user')}</p>
                    <p className="text-xs font-semibold truncate text-slate-700 dark:text-slate-300">{user.email}</p>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button 
                  onClick={onSignOut} 
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl cursor-pointer transition-all duration-300"
                  title="Sign Out"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onSignInClick}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all duration-300 shadow-md cursor-pointer",
                isCollapsed ? "w-11 h-11 p-0 mx-auto" : "w-full py-2.5 px-3.5"
              )}
              title={t('sidebar.login')}
            >
              <User className="h-5 w-5" />
              {!isCollapsed && <span>{t('sidebar.login')}</span>}
            </button>
          )}
        </div>
      </motion.aside>

    </>
  );
}
