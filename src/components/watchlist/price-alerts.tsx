'use client';

import * as React from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { pick, type Lang } from '@/components/shared/calc-ui';
import { fetchQuotes } from '@/lib/quotes';
import { LIVE_POLL_MS } from '@/lib/refresh-signal';
import { formatNumberLocale } from '@/lib/format';
import { isTargetReached, useWatchlist } from '@/lib/watchlist-store';

/**
 * Alert harga incaran Watchlist.
 * - Pengawas global (dipasang sekali di page.tsx): saat jam bursa, harga saham yang punya harga incaran
 *   dicek tiap 30 detik, termasuk saat pengguna di halaman lain atau tab browser di latar belakang
 *   (browser membatasi timer latar belakang menjadi ±1 menit).
 * - Setiap target hanya memberi alert sekali per hari bursa (kunci: tanggal WIB + kode + jenis + harga).
 * - Alert selalu tampil sebagai toast di aplikasi; notifikasi browser bila pengguna mengaktifkannya.
 * - Hanya berjalan selama web terbuka (tanpa server push).
 */

const NOTIFY_KEY = 'nunnn_stock_alert_notify';
const FIRED_KEY = 'nunnn_stock_alerts_fired';

export type NotifyState = 'unsupported' | 'denied' | 'off' | 'on';

function readNotifyState(): NotifyState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return localStorage.getItem(NOTIFY_KEY) === 'on' && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

const notifyListeners = new Set<() => void>();
const emitNotify = () => notifyListeners.forEach((l) => l());

export function useNotifyState(): NotifyState {
  return React.useSyncExternalStore(
    (l) => {
      notifyListeners.add(l);
      return () => notifyListeners.delete(l);
    },
    readNotifyState,
    () => 'off' as NotifyState
  );
}

async function setNotify(on: boolean): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (on && Notification.permission === 'default') await Notification.requestPermission();
  try {
    localStorage.setItem(NOTIFY_KEY, on && Notification.permission === 'granted' ? 'on' : 'off');
  } catch {
    // Storage diblokir: preferensi hanya untuk sesi ini.
  }
  emitNotify();
}

const wibDay = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);

function readFired(day: string): Set<string> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(FIRED_KEY) || '[]');
    // Hanya simpan kunci hari ini agar tidak menumpuk.
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string' && k.startsWith(day)) : []);
  } catch {
    return new Set();
  }
}

function writeFired(keys: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...keys]));
  } catch {
    // Abaikan: paling buruk alert muncul lagi setelah reload.
  }
}

/** Pengawas global; tidak merender apa pun. */
export function PriceAlertWatcher({ language, onAlert }: { language: Lang; onAlert: (message: string) => void }) {
  const watchlist = useWatchlist();
  const targets = watchlist.entries.filter((e) => e.target);
  const { trading } = useIdxSessionState(targets.length > 0);
  const targetsKey = targets.map((e) => `${e.symbol}:${e.target!.kind}:${e.target!.price}`).join(',');
  const onAlertRef = React.useRef(onAlert);
  React.useLayoutEffect(() => {
    onAlertRef.current = onAlert;
  });

  React.useEffect(() => {
    if (!trading || targetsKey === '') return;
    const list = targetsKey.split(',').map((s) => {
      const [symbol, kind, price] = s.split(':');
      return { symbol, kind: kind as 'buy' | 'sell', price: Number(price) };
    });
    let cancelled = false;

    const check = async () => {
      let quotes;
      try {
        quotes = await fetchQuotes(list.map((t) => t.symbol));
      } catch {
        return; // Coba lagi di putaran berikutnya.
      }
      if (cancelled) return;
      const day = wibDay(Date.now());
      const fired = readFired(day);
      let changed = false;
      for (const t of list) {
        const q = quotes[t.symbol];
        if (!q || q.suspect || q.stale || !isTargetReached({ kind: t.kind, price: t.price }, q.price)) continue;
        const key = `${day}|${t.symbol}|${t.kind}|${t.price}`;
        if (fired.has(key)) continue;
        fired.add(key);
        changed = true;
        const priceTxt = `Rp${formatNumberLocale(q.price, language, 0)}`;
        const targetTxt = `Rp${formatNumberLocale(t.price, language, 0)}`;
        const title = t.kind === 'buy'
          ? pick(language, `${t.symbol} menyentuh harga incaran beli`, `${t.symbol} hit your buy target`)
          : pick(language, `${t.symbol} menyentuh harga incaran jual`, `${t.symbol} hit your sell target`);
        const body = pick(
          language,
          `Harga ${priceTxt} (${t.kind === 'buy' ? '≤' : '≥'} incaran ${targetTxt}).`,
          `Price ${priceTxt} (${t.kind === 'buy' ? '≤' : '≥'} target ${targetTxt}).`
        );
        onAlertRef.current(`${title}: ${body}`);
        if (readNotifyState() === 'on') {
          try {
            new Notification(title, { body, tag: key });
          } catch {
            // Sebagian browser HP hanya mengizinkan notifikasi lewat service worker; toast tetap tampil.
          }
        }
      }
      if (changed) writeFired(fired);
    };

    void check();
    const interval = window.setInterval(() => void check(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [trading, targetsKey, language]);

  return null;
}

/** Baris pengaturan alert di halaman Watchlist. */
export function PriceAlertSettings({ language, targetCount }: { language: Lang; targetCount: number }) {
  const L = (id: string, en: string) => pick(language, id, en);
  const state = useNotifyState();
  const [busy, setBusy] = React.useState(false);

  const toggle = async () => {
    setBusy(true);
    await setNotify(state !== 'on');
    setBusy(false);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
          <BellRing className="h-4 w-4 text-amber-300" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">
            {L('Alert harga incaran', 'Target price alerts')}
            <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
              {targetCount > 0 ? L(`${targetCount} target aktif`, `${targetCount} active`) : L('belum ada target', 'no targets yet')}
            </span>
          </p>
          <p className="text-[11px] text-slate-400 leading-snug">
            {state === 'unsupported'
              ? L('Browser ini tidak mendukung notifikasi; alert tetap muncul di dalam web.', 'This browser has no notifications; alerts still show inside the app.')
              : state === 'denied'
                ? L('Notifikasi diblokir di pengaturan browser. Izinkan untuk situs ini agar alert muncul walau tab tidak dibuka.', 'Notifications are blocked in your browser settings. Allow them for this site to get alerts in the background.')
                : L(
                    'Dicek tiap 30 detik saat jam bursa selama web terbuka (halaman mana pun). Tiap target memberi alert sekali per hari.',
                    'Checked every 30 seconds during market hours while the app is open (any page). Each target alerts once per day.'
                  )}
          </p>
        </div>
      </div>
      {state !== 'unsupported' && state !== 'denied' && (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          aria-pressed={state === 'on'}
          className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer border transition-colors disabled:opacity-60 ${
            state === 'on'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/20'
              : 'bg-emerald-500 border-emerald-500 text-slate-950 hover:bg-emerald-400'
          }`}
        >
          {state === 'on' ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          {state === 'on' ? L('Matikan notifikasi browser', 'Turn off browser notifications') : L('Aktifkan notifikasi browser', 'Enable browser notifications')}
        </button>
      )}
    </div>
  );
}
