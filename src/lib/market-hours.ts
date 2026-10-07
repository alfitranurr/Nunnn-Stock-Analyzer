/**
 * Jam perdagangan Bursa Efek Indonesia (WIB, UTC+7).
 *
 * Senin–Kamis: pra-pembukaan 08:45, sesi 1 09:00–12:00, sesi 2 13:30–15:50, pra-penutupan 15:50–16:00.
 * Jumat: sesi 1 09:00–11:30, sesi 2 14:00–15:50.
 * Hari libur bursa tidak diketahui di sini; dideteksi dari waktu transaksi terakhir IHSG.
 */

export type IdxSession = 'pre-open' | 'session1' | 'break' | 'session2' | 'pre-close' | 'closed' | 'holiday';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const at = (h: number, m: number) => h * 60 + m;

function wibParts(ms: number) {
  const d = new Date(ms + WIB_OFFSET_MS);
  return {
    day: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dateKey: d.toISOString().slice(0, 10),
    hh: String(d.getUTCHours()).padStart(2, '0'),
    mm: String(d.getUTCMinutes()).padStart(2, '0'),
    ss: String(d.getUTCSeconds()).padStart(2, '0'),
  };
}

export function getIdxSession(ms: number): IdxSession {
  const { day, minutes } = wibParts(ms);
  if (day === 0 || day === 6) return 'closed';
  const isFriday = day === 5;
  if (minutes < at(8, 45)) return 'closed';
  if (minutes < at(9, 0)) return 'pre-open';
  if (minutes < (isFriday ? at(11, 30) : at(12, 0))) return 'session1';
  if (minutes < (isFriday ? at(14, 0) : at(13, 30))) return 'break';
  if (minutes < at(15, 50)) return 'session2';
  if (minutes < at(16, 0)) return 'pre-close';
  return 'closed';
}

/**
 * Sesi efektif: bila menurut jadwal bursa buka tetapi IHSG belum bertransaksi
 * hari ini (lewat 09:30 WIB), anggap hari libur bursa.
 */
export function getEffectiveIdxSession(ms: number, lastIndexTradeSec: number | null | undefined): IdxSession {
  const session = getIdxSession(ms);
  if (session === 'closed' || session === 'pre-open' || !lastIndexTradeSec) return session;
  const now = wibParts(ms);
  if (now.minutes < at(9, 30)) return session;
  return wibParts(lastIndexTradeSec * 1000).dateKey === now.dateKey ? session : 'holiday';
}

/** Bursa sedang dalam jam perdagangan (termasuk istirahat), sehingga data perlu di-refresh berkala. */
export const isTradingWindow = (session: IdxSession) => session !== 'closed' && session !== 'holiday';

export const isSessionOpen = (session: IdxSession) =>
  session === 'session1' || session === 'session2' || session === 'pre-close';

export const SESSION_LABEL: Record<IdxSession, { id: string; en: string }> = {
  'pre-open': { id: 'Pra-Pembukaan', en: 'Pre-Opening' },
  session1: { id: 'Sesi 1', en: 'Session 1' },
  break: { id: 'Istirahat', en: 'Lunch Break' },
  session2: { id: 'Sesi 2', en: 'Session 2' },
  'pre-close': { id: 'Pra-Penutupan', en: 'Pre-Closing' },
  closed: { id: 'Bursa Tutup', en: 'Market Closed' },
  holiday: { id: 'Libur Bursa', en: 'Market Holiday' },
};

export function formatWibTime(ms: number, withSeconds = false): string {
  const { hh, mm, ss } = wibParts(ms);
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

/** Sapaan sesuai jam WIB. */
export function getWibGreeting(ms: number, language: 'id' | 'en'): string {
  const hour = Math.floor(wibParts(ms).minutes / 60);
  if (language === 'id') {
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
