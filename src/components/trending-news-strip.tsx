'use client';

import * as React from 'react';
import { Newspaper, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';

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
  const refreshEpoch = useDataRefreshEpoch();

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
  }, [refreshEpoch]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[20px] bg-card-bg border border-white/[0.04] p-4 animate-pulse h-[100px]" />
        ))}
      </div>
    );
  }

  if (error || news.length === 0) {
    return (
      <div className="rounded-[20px] bg-card-bg border border-white/[0.04] p-4 text-center text-xs text-slate-500">
        {error
          ? (isId ? 'Gagal memuat berita terkini.' : 'Failed to load latest news.')
          : (isId ? 'Belum ada berita terbaru.' : 'No recent news yet.')}
      </div>
    );
  }

  return (
    <div>
      <h2 className="flex items-center gap-2 mb-3 title-display text-lg text-white">
        <Newspaper className="h-4 w-4 text-accent" aria-hidden />
        {isId ? 'Berita pasar terkini' : 'Latest market news'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {news.map((item, i) => (
          <motion.a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="group rounded-[20px] bg-card-bg border border-white/[0.04] hover:bg-surface-2 p-4 md:p-5 transition-colors flex flex-col gap-2 cursor-pointer h-full"
          >
            <span className="text-sm font-medium text-white line-clamp-2 leading-snug">
              {item.title}
            </span>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-xs text-slate-500 truncate max-w-[60%]">
                {item.source}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {fmtTime(item.pubDate)}
              </span>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
