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
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onSignOut: () => void;
  onSignInClick: () => void;
}

export function Sidebar({ currentTab, setCurrentTab, user, onSignOut, onSignInClick }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const menuItems = [
    { id: 'avg-down', label: 'Kalkulator Avg Down', icon: Calculator, active: true },
    { id: 'portfolio', label: 'Portofolio Sync', icon: Briefcase, active: false, labelBadge: 'Soon' },
    { id: 'history', label: 'Riwayat Rencana', icon: History, active: false, labelBadge: 'Soon' },
    { id: 'watchlist', label: 'Watchlist Saham', icon: Star, active: false, labelBadge: 'Soon' },
    { id: 'analysis', label: 'Analisis Saham', icon: TrendingUp, active: false, labelBadge: 'Soon' },
  ];

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 80 }
  };

  return (
    <>
      {/* Mobile Header (Fixed Top) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl text-neon-gradient tracking-wider font-sans">
            NUNNN STOCK
          </span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-foreground cursor-pointer"
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
              className="md:hidden fixed top-0 bottom-0 left-0 w-[280px] bg-slate-900/90 dark:bg-black/95 backdrop-blur-xl border-r border-white/10 z-50 flex flex-col p-6 text-white"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-extrabold text-2xl text-neon-gradient tracking-wider">
                  NUNNN STOCK
                </span>
                <button 
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Menu items */}
              <nav className="flex-1 space-y-2">
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
                      "w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer",
                      currentTab === item.id && item.active
                        ? "bg-brand-purple/20 border-brand-purple/40 text-white"
                        : "bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5",
                      !item.active && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-5 w-5", currentTab === item.id && "text-brand-purple")} />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    {item.labelBadge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        {item.labelBadge}
                      </span>
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
        className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 bg-slate-900/60 dark:bg-black/40 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/5 py-6 px-4 z-30 group"
      >
        {/* Sidebar Header */}
        <div className={cn("flex items-center justify-between mb-8 transition-all duration-300", isCollapsed ? "px-2" : "px-3")}>
          {!isCollapsed ? (
            <span className="font-extrabold text-xl text-neon-gradient tracking-wider font-sans select-none animate-pulse">
              NUNNN STOCK
            </span>
          ) : (
            <span className="font-black text-2xl text-neon-gradient select-none">
              N
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden group-hover:flex p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-foreground cursor-pointer transition-all duration-200 absolute -right-3.5 top-6 z-40 shadow-md"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 space-y-2.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.active && setCurrentTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3.5 py-3 rounded-xl transition-all duration-300 border relative group/item cursor-pointer",
                isCollapsed ? "justify-center px-0" : "justify-between px-4.5",
                currentTab === item.id && item.active
                  ? "bg-brand-purple/15 border-brand-purple/30 text-brand-purple dark:text-violet-300 font-semibold shadow-inner"
                  : "bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-white/5",
                !item.active && "opacity-45 cursor-not-allowed"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-3.5">
                <item.icon className={cn("h-5.5 w-5.5 transition-transform duration-300 group-hover/item:scale-110", currentTab === item.id && "text-brand-purple")} />
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </div>
              {!isCollapsed && item.labelBadge && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                  {item.labelBadge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-4">
          {/* Profile Footer */}
          {user ? (
            <div className={cn("flex items-center justify-between gap-3 overflow-hidden", isCollapsed ? "justify-center" : "px-3")}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center shrink-0 border border-brand-purple/40 shadow-md">
                  <User className="h-5 w-5 text-brand-purple" />
                </div>
                {!isCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">User</p>
                    <p className="text-sm font-semibold truncate text-slate-700 dark:text-slate-200">{user.email}</p>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button 
                  onClick={onSignOut} 
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl cursor-pointer transition-all duration-300"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onSignInClick}
              className={cn(
                "flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold text-sm transition-all duration-300 shadow-md cursor-pointer",
                isCollapsed ? "w-11 h-11 px-0" : "w-full px-4"
              )}
              title="Masuk ke Akun"
            >
              <User className="h-5 w-5" />
              {!isCollapsed && <span>Masuk</span>}
            </button>
          )}
        </div>
      </motion.aside>

      {/* Adjust Main Layout Margin */}
      <style jsx global>{`
        main {
          margin-left: 0;
        }
        @media (min-width: 768px) {
          main {
            margin-left: ${isCollapsed ? '80px' : '260px'};
            transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }
      `}</style>
    </>
  );
}
