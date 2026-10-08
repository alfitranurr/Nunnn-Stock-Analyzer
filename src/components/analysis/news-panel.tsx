'use client';

import * as React from 'react';
import { ExternalLink, Loader2, Newspaper, Sparkles } from 'lucide-react';
import { Badge, Card, CardTitle, pick, type Lang } from '@/components/shared/calc-ui';

export interface AnalysisNewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

/** Status AI dari server (lihat route `/api/analysis/news`). */
export type AiState = 'fresh' | 'cached' | 'not_requested' | 'quota_exhausted' | 'unavailable' | 'no_news';

export interface AnalysisSentiment {
  sentiment: 'Bullish' | 'Bearish' | 'Netral';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  keyPoints: string[];
  method: 'ai' | 'keyword' | 'none';
  model?: string;
  generatedAt: string;
}

/** Sentimen berita (AI terstruktur atau hitungan kata) dan daftar berita relevan 7 hari terakhir. */
export function NewsPanel({
  language,
  news,
  analysis,
  aiState,
  aiBusy,
  onRequestAi,
}: {
  language: Lang;
  news: AnalysisNewsItem[];
  analysis: AnalysisSentiment;
  aiState: AiState;
  aiBusy: boolean;
  onRequestAi: () => void;
}) {
  const L = (id: string, en: string) => pick(language, id, en);
  const tone = analysis.sentiment === 'Bullish' ? 'emerald' : analysis.sentiment === 'Bearish' ? 'amber' : 'slate';
  const confidence = { high: L('tinggi', 'high'), medium: L('sedang', 'medium'), low: L('rendah', 'low') }[analysis.confidence];
  const method = analysis.method === 'ai' ? `AI (${analysis.model ?? ''})` : analysis.method === 'keyword' ? L('kata kunci judul', 'headline keywords') : L('tanpa berita', 'no news');
  const fmtDate = (iso: string) => (iso ? new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(iso)) : '');

  return (
    <Card>
      <CardTitle
        icon={<Newspaper className="h-5 w-5 text-emerald-400" />}
        title={L('Sentimen Berita', 'News Sentiment')}
        subtitle={L('Berita 7 hari terakhir yang benar-benar menyebut kode atau nama emiten.', 'News from the last 7 days that actually mentions the ticker or company name.')}
        right={<span className="self-start"><Badge tone={tone}>{analysis.sentiment === 'Netral' ? L('Netral', 'Neutral') : analysis.sentiment}</Badge></span>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 lg:self-start p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
          <p className="text-xs text-slate-200 leading-relaxed">{analysis.summary}</p>
          {analysis.keyPoints.length > 0 && (
            <ul className="mt-3 space-y-1 list-disc pl-4 text-[11px] text-slate-400">
              {analysis.keyPoints.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          <p className="text-[10px] text-slate-500 mt-3">
            {L('Metode', 'Method')}: {method} · {L('keyakinan', 'confidence')} {confidence}
            {aiState === 'cached' ? L(' · hasil AI tersimpan (tanpa kuota)', ' · saved AI result (no quota)') : ''}
          </p>
          {aiState === 'quota_exhausted' && (
            <p className="text-[11px] text-amber-400 mt-2">{L('Kuota AI kamu sedang habis, jadi ditampilkan perkiraan kata kunci. Coba lagi nanti.', 'Your AI quota is used up, so a keyword estimate is shown. Try again later.')}</p>
          )}
          {aiState === 'unavailable' && (
            <p className="text-[11px] text-amber-400 mt-2">{L('Layanan AI sedang tidak tersedia, jadi ditampilkan perkiraan kata kunci.', 'The AI service is unavailable, so a keyword estimate is shown.')}</p>
          )}
          {analysis.method === 'keyword' && aiState !== 'quota_exhausted' && (
            <button
              type="button"
              onClick={onRequestAi}
              disabled={aiBusy}
              className="mt-3 w-full px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/15 text-violet-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiBusy ? L('Menganalisis dengan AI…', 'Analyzing with AI…') : L('Analisis sentimen dengan AI (1 kuota)', 'Analyze sentiment with AI (1 quota)')}
            </button>
          )}
        </div>
        <div className="lg:col-span-3">
          {news.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10">{L('Tidak ada berita relevan dalam 7 hari terakhir.', 'No relevant news in the last 7 days.')}</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {news.map((n) => (
                <li key={n.id}>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 py-2.5 group">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-200 group-hover:text-emerald-400 leading-snug">{n.title}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{n.source} · {fmtDate(n.pubDate)}</span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
