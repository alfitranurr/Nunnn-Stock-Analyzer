'use client';

import * as React from 'react';
import { 
  Calculator, 
  Briefcase, 
  History, 
  Star, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X,
  LogOut,
  User,
  Lock,
  BookOpen,
  ShieldCheck,
  Percent,
  Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onSignOut: () => void;
  onSignInClick: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onLogoClick?: () => void;
}

export function Sidebar({ currentTab, setCurrentTab, user, onSignOut, onSignInClick, isCollapsed, setIsCollapsed, onLogoClick }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
  const isAdmin = user && user.email && user.email.toLowerCase() === adminEmail;

  const menuItems = [
    { id: 'news', label: 'Berita & Sentimen', icon: BookOpen, active: true },
    { id: 'avg-down', label: 'Kalkulator Avg Down', icon: Calculator, active: true },
    { id: 'compounding', label: 'Kalkulator Compounding', icon: Percent, active: true },
    { id: 'ipo', label: 'Kalkulator E-IPO', icon: Coins, active: true },
    { id: 'analysis', label: 'Analisis Saham', icon: TrendingUp, active: true, isLocked: !user },
    { id: 'portfolio', label: 'Portofolio Saya', icon: Briefcase, active: true, isLocked: !user },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: ShieldCheck, active: true }] : []),
    { id: 'history', label: 'Riwayat Rencana', icon: History, active: false, labelBadge: 'Soon' },
    { id: 'watchlist', label: 'Watchlist Saham', icon: Star, active: false, labelBadge: 'Soon' },
  ];

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 80 }
  };

  return (
    <>
      {/* Mobile Header (Fixed Top) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar-bg border-b border-border-color flex items-center justify-between px-4 z-40">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-left bg-transparent border-0 p-0"
        >
          <span className="font-extrabold text-xl text-brand-purple tracking-wider font-sans">
            NUNNN STOCK
          </span>
        </button>
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg bg-input-bg border border-border-color text-foreground cursor-pointer"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

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
                  <span className="font-extrabold text-2xl text-brand-purple tracking-wider font-sans">
                    NUNNN STOCK
                  </span>
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
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.active) {
                        setCurrentTab(item.id);
                        setIsMobileOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left",
                      currentTab === item.id && item.active
                        ? "bg-brand-purple/10 border-brand-purple/30 text-brand-purple"
                        : "bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-input-bg",
                      !item.active && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-5 w-5", currentTab === item.id && "text-brand-purple")} />
                      <span className="font-medium text-sm text-left">{item.label}</span>
                    </div>
                    {item.labelBadge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        {item.labelBadge}
                      </span>
                    )}
                    {item.isLocked && (
                      <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    )}
                  </button>
                ))}
              </nav>

              {/* Mobile Bottom Section */}
              <div className="mt-auto pt-4 border-t border-white/10 space-y-4">
                {/* Profile Footer */}
                {user ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-brand-purple/20 flex items-center justify-center shrink-0 border border-brand-purple/40">
                        <User className="h-4 w-4 text-brand-purple" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-400 truncate">Logged in as</p>
                        <p className="text-sm font-semibold truncate text-white">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        onSignOut();
                        setIsMobileOpen(false);
                      }} 
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
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
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold text-sm transition-all duration-300 shadow-md"
                  >
                    <User className="h-4 w-4" />
                    <span>Masuk ke Akun</span>
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
        className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 bg-sidebar-bg border-r border-border-color py-4 px-3 z-30 group"
      >
        {/* Sidebar Header */}
        <div className={cn("flex items-center justify-between mb-5 transition-all duration-300", isCollapsed ? "px-1" : "px-2")}>
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all text-left bg-transparent border-0 p-0"
          >
            {!isCollapsed ? (
              <span className="font-extrabold text-lg text-brand-purple tracking-wider font-sans select-none">
                NUNNN STOCK
              </span>
            ) : (
              <span className="font-black text-xl text-brand-purple select-none">
                N
              </span>
            )}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden group-hover:flex p-1 rounded-lg bg-input-bg hover:bg-glass-border border border-border-color text-foreground cursor-pointer transition-all duration-200 absolute -right-3.5 top-4 z-40 shadow-md"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Menu (Scrollable if screen is short) */}
        <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.active && setCurrentTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-300 border relative group/item cursor-pointer text-left",
                isCollapsed ? "justify-center px-0" : "justify-between px-3.5",
                currentTab === item.id && item.active
                  ? "bg-brand-purple/10 border-brand-purple/20 text-brand-purple dark:text-brand-purple font-semibold"
                  : "bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-input-bg",
                !item.active && "opacity-45 cursor-not-allowed"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover/item:scale-110", currentTab === item.id && "text-brand-purple")} />
                {!isCollapsed && <span className="text-[13px] font-semibold text-left whitespace-nowrap">{item.label}</span>}
              </div>
              {!isCollapsed && item.labelBadge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                  {item.labelBadge}
                </span>
              )}
              {!isCollapsed && item.isLocked && (
                <Lock className="h-3 w-3 text-slate-500 dark:text-slate-600 shrink-0" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto pt-3 border-t border-border-color space-y-3 shrink-0">
          {/* Profile Footer */}
          {user ? (
            <div className={cn("flex items-center justify-between gap-2.5 overflow-hidden", isCollapsed ? "justify-center" : "px-2.5")}>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8.5 h-8.5 rounded-full bg-brand-purple/10 flex items-center justify-center shrink-0 border border-brand-purple/20 shadow-md">
                  <User className="h-4.5 w-4.5 text-brand-purple" />
                </div>
                {!isCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">User</p>
                    <p className="text-xs font-semibold truncate text-slate-700 dark:text-slate-200">{user.email}</p>
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
                "flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold text-xs transition-all duration-300 shadow-md cursor-pointer",
                isCollapsed ? "w-9 h-9 px-0" : "w-full px-3.5"
              )}
              title="Masuk ke Akun"
            >
              <User className="h-4.5 w-4.5" />
              {!isCollapsed && <span>Masuk</span>}
            </button>
          )}
        </div>
      </motion.aside>

    </>
  );
}
