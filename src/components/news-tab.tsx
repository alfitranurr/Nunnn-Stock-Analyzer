'use client';

import * as React from 'react';
import { 
  Search, 
  BookOpen, 
  Clock, 
  Sparkles, 
  Lock, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

interface NewsTabProps {
  user: any;
  onSignInClick: () => void;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface AISummary {
  highlight: string;
  context: string;
  keyFindings: string[];
  takeaway: string;
  isAI?: boolean;
  isMock?: boolean;
  modelUsed?: string;
}

export function NewsTab({ user, onSignInClick }: NewsTabProps) {
  const { language, t } = useLanguage();
  const [category, setCategory] = React.useState<'saham' | 'foreign' | 'domestik' | 'global' | 'politik'>('saham');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Track expanded state and summaries by news title or URL
  const [expandedArticles, setExpandedArticles] = React.useState<{ [key: string]: boolean }>({});
  const [summaries, setSummaries] = React.useState<{ [key: string]: AISummary }>({});
  const [summaryLoading, setSummaryLoading] = React.useState<{ [key: string]: boolean }>({});
  const [summaryError, setSummaryError] = React.useState<{ [key: string]: string | null }>({});

  const tabsRef = React.useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(true);

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 2);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 2);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 150;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  React.useEffect(() => {
    const tabs = tabsRef.current;
    if (tabs) {
      tabs.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      // Run initial check
      checkScroll();
    }
    return () => {
      if (tabs) {
        tabs.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  React.useEffect(() => {
    setTimeout(checkScroll, 100);
  }, [category, news]);

  const fetchNews = async (cat: 'saham' | 'foreign' | 'domestik' | 'global' | 'politik', queryStr: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = queryStr.trim()
        ? `/api/news?q=${encodeURIComponent(queryStr)}`
        : `/api/news?category=${cat}`;
        
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch news (Status ${res.status})`);
      }
      const data = await res.json();
      setNews(data.news || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'id' ? 'Gagal memuat berita finansial.' : 'Failed to load financial news.'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch news on category change
  React.useEffect(() => {
    if (!searchQuery) {
      fetchNews(category);
    }
  }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNews(category, searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchNews(category, '');
  };

  const handleToggleSummary = async (article: NewsItem) => {
    const articleKey = article.title;
    
    // Check expanded status
    const isExpanded = !!expandedArticles[articleKey];
    
    // Toggle
    setExpandedArticles(prev => ({
      ...prev,
      [articleKey]: !isExpanded
    }));

    // If it's expanding and we don't have the summary yet, fetch it
    if (!isExpanded && !summaries[articleKey]) {
      setSummaryLoading(prev => ({ ...prev, [articleKey]: true }));
      setSummaryError(prev => ({ ...prev, [articleKey]: null }));

      try {
        const res = await fetch('/api/news/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: article.title,
            source: article.source,
            link: article.link
          })
        });

        if (!res.ok) {
          throw new Error(language === 'id' ? 'Gagal menghasilkan rangkuman AI.' : 'Failed to generate AI summary.');
        }

        const data = await res.json();
        setSummaries(prev => ({
          ...prev,
          [articleKey]: data
        }));
      } catch (err: any) {
        console.error(err);
        setSummaryError(prev => ({
          ...prev,
          [articleKey]: err.message || (language === 'id' ? 'Terjadi kesalahan jaringan.' : 'Network error occurred.')
        }));
      } finally {
        setSummaryLoading(prev => ({ ...prev, [articleKey]: false }));
      }
    }
  };

  const categories = [
    { id: 'saham' },
    { id: 'foreign' },
    { id: 'domestik' },
    { id: 'global' },
    { id: 'politik' }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border border-border-color p-5 rounded-2xl bg-card-bg relative z-10 animate-fadeIn flex flex-col gap-4">
        {/* Row 1: Title and Search/Refresh controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-purple animate-pulse" /> {t('news.title')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('news.desc')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder={t('news.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/60 transition-all duration-200"
              />
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </form>

            <button
              onClick={() => fetchNews(category, searchQuery)}
              disabled={loading}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer"
              title={t('news.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Divider and Category Tabs */}
        <div className="border-t border-slate-900/60 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!showLeftArrow}
              className={`p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                showLeftArrow 
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer' 
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title={language === 'id' ? 'Scroll Kiri' : 'Scroll Left'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div 
              ref={tabsRef}
              className="flex-1 flex bg-slate-900/60 p-1 border border-slate-800/80 rounded-xl text-xs overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategory(cat.id);
                    setSearchQuery(''); 
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer text-center select-none whitespace-nowrap ${
                    category === cat.id && !searchQuery
                      ? 'bg-brand-purple text-white shadow-md font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.id === 'saham' ? t('news.tabSaham') :
                   cat.id === 'foreign' ? t('news.tabForeign') :
                   cat.id === 'domestik' ? t('news.tabDomestik') :
                   cat.id === 'global' ? t('news.tabGlobal') :
                   t('news.tabPolitik')}
                </button>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!showRightArrow}
              className={`p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                showRightArrow 
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer' 
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title={language === 'id' ? 'Scroll Kanan' : 'Scroll Right'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {searchQuery && (
            <div className="text-xs text-slate-400">
              {language === 'id' ? 'Hasil pencarian untuk:' : 'Search results for:'} <span className="text-brand-purple font-semibold">"{searchQuery}"</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200">{error}</div>
        </div>
      )}

      {/* News Feed Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div 
              key={i} 
              className="border border-slate-900/60 bg-slate-950/20 rounded-2xl p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-slate-850 rounded w-3/4"></div>
              <div className="h-3 bg-slate-850 rounded w-1/4"></div>
              <div className="h-8 bg-slate-850 rounded w-32 mt-3"></div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="border border-border-color bg-card-bg rounded-2xl p-12 text-center max-w-2xl mx-auto my-6 flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-brand-purple/10 border border-brand-purple/20 rounded-full text-brand-purple">
            <BookOpen className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-white">{t('news.noNews')}</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            {t('news.noNewsDesc')}
          </p>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-all duration-200"
            >
              {t('news.clearSearch')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((item, idx) => {
            const articleKey = item.title;
            const isExpanded = !!expandedArticles[articleKey];
            const summary = summaries[articleKey];
            const isSumLoading = !!summaryLoading[articleKey];
            const sumError = summaryError[articleKey];

            return (
              <div
                key={idx}
                className="border border-border-color bg-card-bg rounded-2xl hover:border-brand-purple/30 transition-all duration-300 overflow-hidden flex flex-col animate-fadeIn"
              >
                {/* Main Card Body */}
                <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2.5 flex-1">
                    <h3 className="font-bold text-slate-100 text-sm md:text-base leading-snug hover:text-brand-purple transition-colors">
                      {item.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-medium">
                      <span className="bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded border border-brand-purple/20">
                        {item.source}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {item.pubDate ? new Date(item.pubDate).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-3 shrink-0 md:self-center">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                    >
                      {t('news.readSource')} <ArrowRight className="w-3 h-3" />
                    </a>

                    {/* AI Summary Button */}
                    <button
                      onClick={() => {
                        if (!user) {
                          onSignInClick();
                        } else {
                          handleToggleSummary(item);
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all duration-300 select-none ${
                        isExpanded
                          ? 'bg-brand-purple/15 border-brand-purple/35 text-brand-purple'
                          : 'bg-input-bg border-border-color hover:border-brand-purple/25 text-slate-300 hover:text-white'
                      }`}
                      title={!user ? (language === 'id' ? 'Masuk untuk membuka Rangkuman AI' : 'Sign in to unlock AI Summary') : undefined}
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-brand-purple" />
                      <span>{t('news.aiSummary')}</span>
                      {user ? (
                        isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Summary Expandable Area */}
                <AnimatePresence>
                  {isExpanded && user && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="border-t border-slate-900/60 bg-slate-950/80 overflow-hidden"
                    >
                      <div className="p-5 border-l-4 border-emerald-500/80 space-y-5">
                        
                        {/* Loading State */}
                        {isSumLoading && (
                           <div className="space-y-4 py-2">
                            <div className="flex items-center gap-2.5 text-xs font-bold text-brand-purple animate-pulse">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>{t('news.aiGenerating')}</span>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="h-6 bg-slate-900 rounded w-2/3 animate-pulse border border-slate-850"></div>
                              <div className="h-4 bg-slate-900 rounded w-full animate-pulse"></div>
                              <div className="h-4 bg-slate-900 rounded w-5/6 animate-pulse"></div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                <div className="h-10 bg-slate-900 rounded w-full animate-pulse border border-slate-850"></div>
                                <div className="h-10 bg-slate-900 rounded w-full animate-pulse border border-slate-850"></div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error State */}
                        {sumError && (
                          <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-xl text-rose-400 text-xs flex gap-2.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                            <div>
                              <p className="font-bold">{t('news.aiFailed')}</p>
                              <p className="mt-0.5 text-slate-400">{sumError}</p>
                              <button
                                onClick={() => {
                                  setSummaries(prev => {
                                    const next = { ...prev };
                                    delete next[articleKey];
                                    return next;
                                  });
                                  setExpandedArticles(prev => ({ ...prev, [articleKey]: false }));
                                  setTimeout(() => handleToggleSummary(item), 100);
                                }}
                                className="mt-2 text-brand-purple font-bold hover:underline cursor-pointer"
                              >
                                {t('news.aiRetry')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* AI Summary Content (Styled like Stockbit Reports) */}
                        {summary && !isSumLoading && !sumError && (
                          <div className="space-y-4.5 animate-fadeIn">
                            
                            {/* Beta / AI Badge */}
                            <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase">
                                  {t('news.aiSummary')}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                                  Beta
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-500 font-semibold font-mono">
                                {summary.isMock 
                                  ? '★ Heuristic Engine' 
                                  : summary.modelUsed 
                                    ? `⚡ ${summary.modelUsed.includes('gemini') ? 'Gemini' : summary.modelUsed.includes('llama') ? 'Groq' : 'OpenAI'}-Powered`
                                    : '⚡ AI-Powered'}
                              </span>
                            </div>

                            {/* 1. Highlight Utama */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest pl-0.5">
                                {t('news.aiHighlight')}
                              </div>
                              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl shadow-sm">
                                <p className="text-xs md:text-sm font-bold text-emerald-300">
                                  {summary.highlight}
                                </p>
                              </div>
                            </div>

                            {/* 2. Konteks Singkat */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                                {t('news.aiContext')}
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed pl-1.5 border-l-2 border-slate-800">
                                {summary.context}
                              </p>
                            </div>

                            {/* 3. Key Findings dalam poin bernomor */}
                            <div className="space-y-2">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                                {t('news.aiFindings')}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-0.5">
                                {summary.keyFindings.map((finding, fidx) => (
                                  <div 
                                    key={fidx} 
                                    className="flex items-start gap-3.5 p-3.5 bg-slate-900/30 border border-slate-900 hover:border-slate-850 rounded-xl hover:bg-slate-900/60 transition-all duration-200"
                                  >
                                    <div className="w-5.5 h-5.5 rounded bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 font-mono text-[10px] font-extrabold text-emerald-400 select-none shadow-sm">
                                      {String(fidx + 1).padStart(2, '0')}
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                                      {finding}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 4. Kesimpulan Inti (KEY TAKEAWAY) */}
                            <div className="space-y-1.5 pt-1.5">
                              <div className="p-4 bg-emerald-500/[0.02] border border-emerald-500/20 rounded-xl relative overflow-hidden shadow-inner">
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500" />
                                <div className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <span>{t('news.aiTakeaway')}</span>
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed font-semibold italic">
                                  "{summary.takeaway}"
                                </p>
                              </div>
                            </div>

                            {/* AI Disclaimer */}
                            <div className="text-[8px] text-slate-500 italic text-center pt-2.5 border-t border-slate-900/40">
                              {t('news.aiDisclaimer')}
                            </div>

                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
