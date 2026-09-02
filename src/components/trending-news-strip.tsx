'use client';

import * as React from 'react';
import { Newspaper, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export function TrendingNewsStrip({ language }: { language: 'id' | 'en' }) {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const isId = language === 'id';

  const fmtTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffM = Math.floor(diffMs / (1000 * 60));

    if (diffH > 24) return d.toLocaleDateString(isId ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' });
    if (diffH > 0) return isId ? `${diffH} jam lalu` : `${diffH}h ago`;
    if (diffM > 0) return isId ? `${diffM} mnt lalu` : `${diffM}m ago`;
    return isId ? 'Baru saja' : 'Just now';
  };

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setError(false);
        const res = await fetch('/api/news?category=saham');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setNews((data.news || []).slice(0, 4));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 animate-pulse h-[100px]" />
        ))}
      </div>
    );
  }

  if (error || news.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-center text-xs text-slate-500">
        {isId ? 'Gagal memuat berita terkini.' : 'Failed to load latest news.'}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Newspaper className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          {isId ? 'Berita Pasar Terkini' : 'Latest Market News'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {news.map((item, i) => (
          <motion.a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="group rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] p-4 transition-all flex flex-col gap-2 cursor-pointer h-full"
          >
            <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
              {item.title}
            </span>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[60%]">
                {item.source}
              </span>
              <span className="text-[10px] text-slate-600 flex items-center gap-0.5 shrink-0">
                <Clock className="h-2.5 w-2.5" />
                {fmtTime(item.pubDate)}
              </span>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
