'use client';

import * as React from 'react';

/** Event yang dikirim halaman utama setelah sesi login selesai diperiksa (aplikasi siap dipakai). */
export const APP_READY_EVENT = 'nunnn:app-ready';

/** Tandai aplikasi siap: splash awal menutup diri (dipanggil sekali oleh app/page.tsx). */
export function signalAppReady() {
  const w = window as Window & { __nunnnAppReady?: boolean };
  w.__nunnnAppReady = true;
  window.dispatchEvent(new Event(APP_READY_EVENT));
}

const MIN_VISIBLE_MS = 1300; // durasi urutan animasi logo, dihitung dari jam animasinya sendiri
const MAX_VISIBLE_MS = 6000; // pengaman bila sinyal siap tidak pernah datang
const EXIT_MS = 550;

/**
 * Animasi pemuatan awal saat web pertama dibuka / di-reload.
 * Dirender di server sehingga tampil seketika (sebelum JavaScript termuat), lalu menutup halus saat
 * aplikasi siap. Pindah tab di dalam aplikasi tidak memunculkannya lagi (layout tidak dimuat ulang).
 * Bila JavaScript gagal, CSS menutupnya sendiri setelah 10 detik.
 */
export function AppSplash() {
  const [phase, setPhase] = React.useState<'show' | 'leaving' | 'gone'>('show');

  React.useEffect(() => {
    let exitTimer: number | undefined;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      // Animasi CSS mulai saat splash pertama dilukis (bisa beberapa ratus ms setelah navigasi),
      // jadi pakai jam animasinya sendiri agar urutan logo selalu tampil utuh.
      const anim = document.querySelector('.app-splash__candle')?.getAnimations?.()[0];
      const elapsed = typeof anim?.currentTime === 'number' ? anim.currentTime : performance.now();
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      exitTimer = window.setTimeout(() => {
        setPhase('leaving');
        exitTimer = window.setTimeout(() => setPhase('gone'), EXIT_MS);
      }, wait);
    };

    const w = window as Window & { __nunnnAppReady?: boolean };
    window.addEventListener(APP_READY_EVENT, close);
    const ready = window.setTimeout(() => {
      if (w.__nunnnAppReady) close();
    }, 0);
    const failsafe = window.setTimeout(close, MAX_VISIBLE_MS);

    return () => {
      window.removeEventListener(APP_READY_EVENT, close);
      window.clearTimeout(ready);
      window.clearTimeout(failsafe);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className={`app-splash fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#121518] ${phase === 'leaving' ? 'app-splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Memuat Nunnn Stock"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="app-splash__glow absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      </div>

      <div className="app-splash__content relative flex flex-col items-center">
        {/* Logo: tiga candle naik bergantian + garis tren yang tergambar */}
        <svg viewBox="0 0 120 84" className="h-24 w-32 sm:h-28 sm:w-36" aria-hidden>
          <defs>
            <linearGradient id="splash-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <g className="app-splash__candle" style={{ animationDelay: '0.05s' }}>
            <line x1="24" y1="44" x2="24" y2="76" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
            <rect x="17" y="50" width="14" height="18" rx="2.5" fill="#f43f5e" />
          </g>
          <g className="app-splash__candle" style={{ animationDelay: '0.2s' }}>
            <line x1="52" y1="30" x2="52" y2="68" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <rect x="45" y="36" width="14" height="24" rx="2.5" fill="#10b981" />
          </g>
          <g className="app-splash__candle" style={{ animationDelay: '0.35s' }}>
            <line x1="80" y1="14" x2="80" y2="58" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <rect x="73" y="20" width="14" height="30" rx="2.5" fill="#10b981" />
          </g>
          <path
            className="app-splash__line"
            d="M6 70 L30 58 L46 62 L66 38 L84 30 L112 8"
            fill="none"
            stroke="url(#splash-line)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
          <circle className="app-splash__dot" cx="112" cy="8" r="4" fill="#34d399" />
        </svg>

        <div className="app-splash__word mt-5 text-2xl sm:text-3xl font-black tracking-[0.18em] text-emerald-400">NUNNN STOCK</div>

        <div className="app-splash__bar mt-7 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="app-splash__bar-fill h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500/20 via-emerald-400 to-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
        </div>
      </div>
    </div>
  );
}
