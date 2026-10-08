'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  DatabaseZap,
  HardDrive,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { ConfirmModal } from '@/components/confirm-modal';
import { PageHeader } from '@/components/shared/page-header';
import { Badge, Card, CardTitle, Segmented, Stat, pick } from '@/components/shared/calc-ui';
import { Pencil as PencilIcon, Building2 as BuildingIcon } from 'lucide-react';
import type { ListingCoverage } from '@/lib/listing-coverage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AppUser, SimUser } from '@/lib/types';
import { useLanguage } from '@/lib/language-context';
import { hashUserPassword, generateRandomPassword } from '@/lib/crypto';
import { getErrorMessage, isNetworkError } from '@/lib/utils';
import { authFetch } from '@/lib/auth-fetch';
import { bumpDataRefresh } from '@/lib/refresh-signal';

interface AdminPanelTabProps {
  user: AppUser | null;
  /** Tab sedang dibuka. Data hanya diambil saat aktif karena semua tab selalu ter-mount. */
  isActive?: boolean;
}

interface UserApproval {
  id: string;
  email: string;
  approved: boolean;
  is_admin?: boolean;
  created_at?: string | null;
}

type Section = 'users' | 'system';
type StatusFilter = 'all' | 'pending' | 'approved';

interface ProbeResult {
  status: 'ok' | 'missing' | 'error';
  detail: string | null;
}

interface UniverseSummary {
  count: number;
  source: 'tradingview' | 'static';
  fetchedAt: string;
  newSymbols: string[];
  inactiveCount: number;
  error: string | null;
}

interface RefreshResult {
  refreshedAt: string;
  durationMs: number;
  cleared: { caches: number; entries: number };
  /** Generasi refresh bersama tercatat: semua instance server ikut memuat data baru (≤ 10 detik). */
  allInstances?: boolean;
  universe: UniverseSummary;
  coverage?: ListingCoverage | null;
}

interface SupabaseResult {
  error: { message: string; code?: string } | null;
}

/** Pemeriksaan skema: setiap migrasi diwakili tabel/kolom/fungsi yang dibuatnya. */
const SCHEMA_PROBES: Array<{ id: string; label: string; migration: string; run: () => PromiseLike<SupabaseResult> }> = [
  { id: 'avg', label: 'avg_down_plans', migration: '20260531000000_create_calculations.sql', run: () => supabase.from('avg_down_plans').select('id').limit(1) },
  {
    id: 'portfolio',
    label: 'portfolio_holdings, portfolio_cash',
    migration: '20260531000001_create_portfolio.sql',
    run: async () => {
      const holdings = await supabase.from('portfolio_holdings').select('id').limit(1);
      return holdings.error ? holdings : supabase.from('portfolio_cash').select('user_id').limit(1);
    },
  },
  { id: 'compounding', label: 'compounding_plans', migration: '20260612000002_create_compounding_plans.sql', run: () => supabase.from('compounding_plans').select('id').limit(1) },
  { id: 'ipo', label: 'ipo_plans', migration: '20260613000003_create_ipo_plans.sql', run: () => supabase.from('ipo_plans').select('id').limit(1) },
  {
    id: 'approvals',
    label: 'user_approvals.is_admin, is_admin()',
    migration: '20260614000004_create_user_approvals.sql',
    run: async () => {
      const column = await supabase.from('user_approvals').select('is_admin').limit(1);
      return column.error ? column : supabase.rpc('is_admin');
    },
  },
  { id: 'watchlists', label: 'user_watchlists', migration: '20261007000007_create_user_watchlists.sql', run: () => supabase.from('user_watchlists').select('user_id').limit(1) },
  { id: 'ipo8', label: 'ipo_plans.retail_demand_pct, queue_pct', migration: '20261008000008_ipo_plans_allocation_inputs.sql', run: () => supabase.from('ipo_plans').select('retail_demand_pct, queue_pct').limit(1) },
];

const LOCAL_KEYS = {
  avgDown: 'nunnn_stock_saved_plans',
  compounding: 'nunnn_stock_compounding_plans',
  ipo: 'nunnn_stock_ipo_plans',
  users: 'nunnn_stock_simulated_users',
};

const countJsonArray = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const readSimUsers = (): SimUser[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.users);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SimUser[]) : [];
  } catch {
    return [];
  }
};

export function AdminPanelTab({ user, isActive = true }: AdminPanelTabProps) {
  const { language } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const cloud = isSupabaseConfigured;

  const [section, setSection] = React.useState<Section>('users');
  const [users, setUsers] = React.useState<UserApproval[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [oneTimePassword, setOneTimePassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [busyEmail, setBusyEmail] = React.useState<string | null>(null);
  const [toSuspend, setToSuspend] = React.useState<UserApproval | null>(null);
  const [toDelete, setToDelete] = React.useState<UserApproval | null>(null);
  const [confirmBulk, setConfirmBulk] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const [probes, setProbes] = React.useState<Record<string, ProbeResult>>({});
  const [ping, setPing] = React.useState<{ ms: number | null; ok: boolean; at: number } | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [localStats, setLocalStats] = React.useState({ avgDown: 0, compounding: 0, ipo: 0, holdings: 0, users: 0 });
  const [universe, setUniverse] = React.useState<UniverseSummary | null>(null);
  const [coverage, setCoverage] = React.useState<ListingCoverage | null>(null);
  const [officialForm, setOfficialForm] = React.useState<{ count: string; asOf: string; source: string } | null>(null);
  const [savingOfficial, setSavingOfficial] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<RefreshResult | null>(null);
  const [refreshingData, setRefreshingData] = React.useState(false);

  const showToast = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const reportError = React.useCallback(
    (err: unknown, fallbackId: string, fallbackEn: string) => {
      const message = getErrorMessage(err);
      if (isNetworkError(err)) {
        console.warn('[AdminPanel] Supabase tidak dapat dijangkau:', message);
        setError(L('Tidak dapat terhubung ke Supabase. Periksa koneksi internet atau NEXT_PUBLIC_SUPABASE_URL.', 'Cannot reach Supabase. Check your internet connection or NEXT_PUBLIC_SUPABASE_URL.'));
        return;
      }
      console.error('[AdminPanel]', message);
      setError(message || L(fallbackId, fallbackEn));
    },
    // L hanya bergantung pada bahasa
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  // ─── Data pengguna ───
  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!cloud) {
        setUsers(readSimUsers().map((u, i) => ({ id: `local-${i}-${u.email}`, email: u.email, approved: u.approved, created_at: null })));
      } else {
        const { data, error: dbError } = await supabase.from('user_approvals').select('*').order('created_at', { ascending: false });
        if (dbError) throw dbError;
        setUsers((data as UserApproval[]) ?? []);
      }
    } catch (err) {
      reportError(err, 'Gagal mengambil data pengguna.', 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [cloud, reportError]);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(() => void fetchUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers, isActive]);

  const setApproval = async (target: UserApproval, approved: boolean): Promise<boolean> => {
    if (!cloud) {
      const updated = readSimUsers().map((u) => (u.email.toLowerCase() === target.email.toLowerCase() ? { ...u, approved } : u));
      localStorage.setItem(LOCAL_KEYS.users, JSON.stringify(updated));
    } else {
      const { error: dbError } = await supabase.rpc('admin_set_user_approval', { p_email: target.email, p_approved: approved });
      if (dbError) throw dbError;
    }
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === target.email.toLowerCase() ? { ...u, approved } : u)));
    return true;
  };

  const toggleApproval = async (target: UserApproval, approved: boolean) => {
    setToSuspend(null);
    setBusyEmail(target.email);
    try {
      await setApproval(target, approved);
      showToast(approved ? L(`${target.email} disetujui.`, `${target.email} approved.`) : L(`Akses ${target.email} ditangguhkan.`, `${target.email} suspended.`));
    } catch (err) {
      reportError(err, 'Gagal mengubah status persetujuan.', 'Failed to change approval status.');
    } finally {
      setBusyEmail(null);
    }
  };

  const approveAllPending = async () => {
    setConfirmBulk(false);
    const pending = users.filter((u) => !u.approved);
    let done = 0;
    for (const u of pending) {
      setBusyEmail(u.email);
      try {
        await setApproval(u, true);
        done++;
      } catch (err) {
        reportError(err, `Gagal menyetujui ${u.email}.`, `Failed to approve ${u.email}.`);
        break;
      }
    }
    setBusyEmail(null);
    if (done > 0) showToast(L(`${done} pengguna disetujui.`, `${done} users approved.`));
  };

  const removeUser = async () => {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    setBusyEmail(target.email);
    try {
      if (!cloud) {
        localStorage.setItem(LOCAL_KEYS.users, JSON.stringify(readSimUsers().filter((u) => u.email.toLowerCase() !== target.email.toLowerCase())));
      } else {
        const { error: dbError } = await supabase.rpc('admin_delete_user', { p_email: target.email });
        if (dbError) throw dbError;
      }
      setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== target.email.toLowerCase()));
      showToast(L(`${target.email} dihapus.`, `${target.email} deleted.`));
    } catch (err) {
      reportError(err, 'Gagal menghapus pengguna.', 'Failed to delete user.');
    } finally {
      setBusyEmail(null);
    }
  };

  // ─── Sistem ───
  const refreshLocalStats = React.useCallback(() => {
    let holdings = 0;
    if (user?.id) holdings = countJsonArray(`nunnn_stock_portfolio_holdings_${user.id}`);
    setLocalStats({
      avgDown: countJsonArray(LOCAL_KEYS.avgDown),
      compounding: countJsonArray(LOCAL_KEYS.compounding),
      ipo: countJsonArray(LOCAL_KEYS.ipo),
      holdings,
      users: countJsonArray(LOCAL_KEYS.users),
    });
  }, [user]);

  const apiError = async (res: Response) => {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body.code === 'not_admin') message = L('Akun ini bukan admin di database.', 'This account is not an admin in the database.');
      else if (body.error) message = body.error;
    } catch {
      // bukan JSON
    }
    return message;
  };

  const loadUniverseStatus = React.useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/refresh');
      if (!res.ok) return;
      const json = (await res.json()) as { universe: UniverseSummary; coverage?: ListingCoverage | null };
      setUniverse(json.universe);
      if (json.coverage) setCoverage(json.coverage);
    } catch {
      // status hanya informasi tambahan
    }
  }, []);

  /** Simpan jumlah emiten resmi BEI (tabel app_settings, migrasi 000011). */
  const saveOfficial = async () => {
    if (!officialForm) return;
    setSavingOfficial(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/listed-official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: Number(officialForm.count.replace(/[^0-9]/g, '')), asOf: officialForm.asOf, source: officialForm.source }),
      });
      if (!res.ok) {
        let code = '';
        try {
          code = ((await res.clone().json()) as { code?: string }).code ?? '';
        } catch {
          // bukan JSON
        }
        const message =
          code === 'migration_missing'
            ? L('Jalankan dulu migrasi supabase/migrations/20261008000011_app_settings.sql di Supabase SQL Editor.', 'Run supabase/migrations/20261008000011_app_settings.sql in the Supabase SQL Editor first.')
            : code === 'no_database'
              ? L('Butuh Supabase: di mode demo angka resmi memakai nilai bawaan.', 'Requires Supabase: demo mode uses the built-in value.')
              : await apiError(res);
        setError(L(`Gagal menyimpan jumlah resmi: ${message}`, `Failed to save the official count: ${message}`));
        return;
      }
      setOfficialForm(null);
      await loadUniverseStatus();
      bumpDataRefresh();
      showToast(L('Jumlah emiten resmi BEI disimpan.', 'Official IDX listing count saved.'));
    } catch (err) {
      reportError(err, 'Gagal menyimpan jumlah resmi.', 'Failed to save the official count.');
    } finally {
      setSavingOfficial(false);
    }
  };

  /** Kosongkan semua cache server, muat ulang daftar emiten, lalu minta semua halaman mengambil data baru. */
  const refreshAllData = async () => {
    setRefreshingData(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/refresh', { method: 'POST' });
      if (!res.ok) {
        const message = await apiError(res);
        setError(L(`Refresh gagal: ${message}`, `Refresh failed: ${message}`));
        return;
      }
      const json = (await res.json()) as RefreshResult;
      setLastRefresh(json);
      setUniverse(json.universe);
      if (json.coverage) setCoverage(json.coverage);
      bumpDataRefresh();
      showToast(
        json.coverage
          ? L(`Data diperbarui: ${json.coverage.tracked} emiten terpantau (${json.coverage.active} aktif + ${json.coverage.suspended.length} suspensi) dari ${json.coverage.official.count} tercatat di BEI.`, `Data refreshed: ${json.coverage.tracked} stocks tracked (${json.coverage.active} active + ${json.coverage.suspended.length} suspended) of ${json.coverage.official.count} listed on IDX.`)
          : L(`Data diperbarui: ${json.universe.count} emiten aktif.`, `Data refreshed: ${json.universe.count} active stocks.`)
      );
    } catch (err) {
      reportError(err, 'Refresh data gagal.', 'Data refresh failed.');
    } finally {
      setRefreshingData(false);
    }
  };

  const runSystemCheck = React.useCallback(async () => {
    refreshLocalStats();
    void loadUniverseStatus();
    if (!cloud) return;
    setChecking(true);
    const started = performance.now();
    try {
      const { error: pingError } = await supabase.from('user_approvals').select('id', { count: 'exact', head: true });
      setPing({ ms: Math.round(performance.now() - started), ok: !pingError, at: Date.now() });
    } catch {
      setPing({ ms: null, ok: false, at: Date.now() });
    }
    const results: Record<string, ProbeResult> = {};
    await Promise.all(
      SCHEMA_PROBES.map(async (probe) => {
        try {
          const { error: probeError } = await probe.run();
          if (!probeError) results[probe.id] = { status: 'ok', detail: null };
          else {
            const missing = /does not exist|could not find|schema cache|PGRST20|42P01|42703|42883/i.test(`${probeError.code ?? ''} ${probeError.message}`);
            results[probe.id] = { status: missing ? 'missing' : 'error', detail: probeError.message };
          }
        } catch (err) {
          results[probe.id] = { status: 'error', detail: getErrorMessage(err) };
        }
      })
    );
    setProbes(results);
    setChecking(false);
  }, [cloud, refreshLocalStats, loadUniverseStatus]);

  React.useEffect(() => {
    if (!isActive || section !== 'system') return;
    const timer = window.setTimeout(() => void runSystemCheck(), 0);
    return () => window.clearTimeout(timer);
  }, [isActive, section, runSystemCheck]);

  const resetLocalData = async () => {
    setConfirmReset(false);
    try {
      Object.values(LOCAL_KEYS).forEach((k) => localStorage.removeItem(k));
      if (user?.id) {
        localStorage.removeItem(`nunnn_stock_portfolio_holdings_${user.id}`);
        localStorage.removeItem(`nunnn_stock_portfolio_cash_${user.id}`);
      }
      // Buat ulang akun admin demo dengan password acak (bukan hardcode).
      const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
      const password = generateRandomPassword();
      const passwordHash = await hashUserPassword(password);
      const adminUser: SimUser = { email: adminEmail, passwordHash, approved: true };
      localStorage.setItem(LOCAL_KEYS.users, JSON.stringify([adminUser]));
      setOneTimePassword(password);
      setCopied(false);
      refreshLocalStats();
      await fetchUsers();
    } catch (err) {
      reportError(err, 'Gagal membersihkan data lokal.', 'Failed to clear local data.');
    }
  };

  const copyPassword = async () => {
    if (!oneTimePassword) return;
    try {
      await navigator.clipboard.writeText(oneTimePassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // ─── Turunan ───
  const selfEmail = user?.email?.toLowerCase();
  const total = users.length;
  const approvedCount = users.filter((u) => u.approved).length;
  const pendingCount = total - approvedCount;
  const q = search.trim().toLowerCase();
  const visible = users
    .filter((u) => (filter === 'approved' ? u.approved : filter === 'pending' ? !u.approved : true))
    .filter((u) => !q || u.email.toLowerCase().includes(q))
    .sort((a, b) => Number(a.approved) - Number(b.approved) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  const fmtDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      : '—';

  const statusBadge = (u: UserApproval) =>
    u.approved ? <Badge tone="emerald">{L('Disetujui', 'Approved')}</Badge> : <Badge tone="amber">{L('Menunggu', 'Pending')}</Badge>;

  const rowActions = (u: UserApproval) => {
    const isSelf = u.email.toLowerCase() === selfEmail;
    const busy = busyEmail === u.email;
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={isSelf || busy}
          onClick={() => (u.approved ? setToSuspend(u) : void toggleApproval(u, true))}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            u.approved ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-emerald-500/40 bg-emerald-500 text-white hover:bg-emerald-400'
          }`}
        >
          {busy ? '…' : u.approved ? L('Tangguhkan', 'Suspend') : L('Setujui', 'Approve')}
        </button>
        <button
          type="button"
          disabled={isSelf || busy}
          onClick={() => setToDelete(u)}
          aria-label={L(`Hapus ${u.email}`, `Delete ${u.email}`)}
          title={L('Hapus pengguna', 'Delete user')}
          className="p-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const emailCell = (u: UserApproval) => {
    const isSelf = u.email.toLowerCase() === selfEmail;
    return (
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="font-semibold text-slate-200 break-all">{u.email}</span>
        {u.is_admin && <Badge tone="sky">Admin</Badge>}
        {isSelf && <Badge>{L('Anda', 'You')}</Badge>}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={ShieldCheck}
        eyebrow={L('Administrasi', 'Administration')}
        title="Admin Panel"
        description={L(
          `Setujui pengguna baru dan periksa kesehatan sistem. Mode: ${cloud ? 'Supabase (cloud)' : 'Demo / lokal'}.`,
          `Approve new users and check system health. Mode: ${cloud ? 'Supabase (cloud)' : 'Demo / local'}.`
        )}
        actions={
          <>
            <button
              type="button"
              onClick={() => void refreshAllData()}
              disabled={refreshingData}
              title={L('Kosongkan cache server dan muat ulang semua data & daftar emiten', 'Clear server caches and reload all data & the stock list')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <DatabaseZap className={`h-4 w-4 ${refreshingData ? 'animate-pulse' : ''}`} />
              {refreshingData ? L('Memperbarui…', 'Refreshing…') : L('Refresh semua data', 'Refresh all data')}
            </button>
            <Segmented
              ariaLabel={L('Bagian', 'Section')}
              value={section}
              onChange={setSection}
              className="flex-1 md:flex-none md:w-64"
              options={[
                { value: 'users', label: pendingCount > 0 ? L(`Pengguna (${pendingCount})`, `Users (${pendingCount})`) : L('Pengguna', 'Users') },
                { value: 'system', label: L('Sistem', 'System') },
              ]}
            />
            <button
              type="button"
              onClick={() => void (section === 'users' ? fetchUsers() : runSystemCheck())}
              disabled={loading || checking}
              aria-label={L('Muat ulang', 'Refresh')}
              title={L('Muat ulang', 'Refresh')}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading || checking ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </>
        }
      />

      {error && (
        <div role="alert" className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-100 flex-1 break-words">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label={L('Tutup', 'Dismiss')} className="p-1 -m-1 text-rose-300 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {oneTimePassword && (
        <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <KeyRound className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-200">{L('Password admin demo yang baru (hanya ditampilkan sekali):', 'New demo admin password (shown only once):')}</p>
            <code className="block mt-1 text-sm font-mono text-white break-all">{oneTimePassword}</code>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void copyPassword()} className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Copy className="h-3.5 w-3.5" /> {copied ? L('Tersalin', 'Copied') : L('Salin', 'Copy')}
            </button>
            <button type="button" onClick={() => setOneTimePassword(null)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold cursor-pointer">
              {L('Sudah disimpan', 'Saved it')}
            </button>
          </div>
        </div>
      )}

      {section === 'users' ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={L('Total', 'Total')} value={total} sub={L('pengguna', 'users')} />
            <Stat tone="emerald" label={L('Disetujui', 'Approved')} value={approvedCount} sub={L('punya akses', 'have access')} />
            <Stat tone={pendingCount > 0 ? 'amber' : 'slate'} label={L('Menunggu', 'Pending')} value={pendingCount} sub={L('perlu ditinjau', 'need review')} />
          </div>

          <Card>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={L('Cari email…', 'Search email…')}
                  aria-label={L('Cari email', 'Search email')}
                  className="w-full glass-input pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <Segmented
                ariaLabel={L('Filter status', 'Status filter')}
                value={filter}
                onChange={setFilter}
                className="lg:w-80"
                options={[
                  { value: 'all', label: `${L('Semua', 'All')} ${total}` },
                  { value: 'pending', label: `${L('Menunggu', 'Pending')} ${pendingCount}` },
                  { value: 'approved', label: `${L('Disetujui', 'Approved')} ${approvedCount}` },
                ]}
              />
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmBulk(true)}
                  disabled={busyEmail !== null}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4" /> {L(`Setujui semua (${pendingCount})`, `Approve all (${pendingCount})`)}
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-2 animate-pulse" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-12 rounded-xl bg-white/5" />)}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-center rounded-2xl border border-dashed border-white/10">
                <Users className="h-8 w-8 text-slate-600" />
                <p className="text-xs text-slate-400">{q || filter !== 'all' ? L('Tidak ada pengguna yang cocok.', 'No matching users.') : L('Belum ada pengguna terdaftar.', 'No registered users yet.')}</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">{L('Terdaftar (WIB)', 'Registered (WIB)')}</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">{L('Aksi', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visible.map((u) => (
                        <tr key={u.id} className={u.approved ? 'hover:bg-white/[0.03]' : 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]'}>
                          <td className="py-3 px-3">{emailCell(u)}</td>
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                          <td className="py-3 px-3">{statusBadge(u)}</td>
                          <td className="py-3 px-3">{rowActions(u)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden space-y-2.5">
                  {visible.map((u) => (
                    <li key={u.id} className={`p-3.5 rounded-2xl border ${u.approved ? 'border-white/10 bg-white/[0.02]' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-xs">{emailCell(u)}</div>
                        {statusBadge(u)}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <span className="text-[10px] text-slate-500">{fmtDate(u.created_at)}</span>
                        {rowActions(u)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!cloud && (
              <p className="text-[10px] text-slate-500 mt-4">{L('Mode demo: pengguna tersimpan di browser ini, tanggal daftar tidak dicatat.', 'Demo mode: users are stored in this browser; registration dates are not recorded.')}</p>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardTitle
              icon={<DatabaseZap className="h-5 w-5 text-emerald-400" />}
              title={L('Data pasar & daftar emiten', 'Market data & stock list')}
              subtitle={L(
                'Daftar emiten aktif diambil otomatis dari screener TradingView (cache 1 jam), sehingga IPO baru langsung ikut dipindai. Harga dari Yahoo Finance (tertunda) dengan cache 30–60 detik.',
                'The active stock list is loaded automatically from the TradingView screener (1-hour cache), so new IPOs are scanned right away. Prices come from Yahoo Finance (delayed) with 30–60 second caches.'
              )}
              right={
                <button
                  type="button"
                  onClick={() => void refreshAllData()}
                  disabled={refreshingData}
                  className="self-start shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingData ? 'animate-spin' : ''}`} /> {L('Refresh semua data', 'Refresh all data')}
                </button>
              }
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                tone={universe?.source === 'tradingview' ? 'emerald' : universe ? 'amber' : 'slate'}
                label={L('Emiten dipantau', 'Stocks tracked')}
                value={universe ? universe.count : '—'}
                sub={universe ? (universe.source === 'tradingview' ? L('daftar aktif (TradingView)', 'active list (TradingView)') : L('daftar bawaan (cadangan)', 'built-in list (fallback)')) : undefined}
              />
              <Stat tone="sky" label={L('Baru vs daftar bawaan', 'New vs built-in list')} value={universe ? universe.newSymbols.length : '—'} sub={L('kode yang belum ada di daftar bawaan', 'codes not in the built-in list')} />
              <Stat
                label={L('Di luar TradingView', 'Not on TradingView')}
                value={universe ? universe.inactiveCount : '—'}
                sub={coverage ? L(`${coverage.suspended.length} suspensi + ${coverage.noData.length} tanpa data · tidak dipindai`, `${coverage.suspended.length} suspended + ${coverage.noData.length} without data · not scanned`) : L('suspensi/delisting, tidak dipindai', 'suspended/delisted, not scanned')}
              />
              <Stat
                label={L('Daftar dimuat', 'List loaded')}
                value={<span className="text-sm">{universe ? `${new Date(universe.fetchedAt).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta' })} WIB` : '—'}</span>}
                sub={
                  lastRefresh
                    ? L(
                        `refresh ${lastRefresh.durationMs} ms · ${lastRefresh.cleared.entries} cache dikedaluwarsakan · ${lastRefresh.allInstances ? 'semua server' : 'server ini saja'}`,
                        `refresh ${lastRefresh.durationMs} ms · ${lastRefresh.cleared.entries} cache entries expired · ${lastRefresh.allInstances ? 'all servers' : 'this server only'}`
                      )
                    : undefined
                }
              />
            </div>
            {/* Cakupan emiten vs jumlah resmi BEI */}
            {coverage && (
              <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <BuildingIcon className="h-3.5 w-3.5 text-emerald-400" /> {L('Cakupan emiten BEI', 'IDX listing coverage')}
                  </span>
                  {!officialForm && (
                    <button
                      type="button"
                      onClick={() => setOfficialForm({ count: String(coverage.official.count), asOf: new Date().toISOString().slice(0, 10), source: coverage.official.origin === 'admin' ? coverage.official.source : '' })}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <PencilIcon className="h-3 w-3" /> {L('Ubah jumlah resmi', 'Edit official count')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat tone="emerald" label={L('Terpantau di web ini', 'Tracked here')} value={coverage.tracked} sub={L(`${coverage.active} aktif + ${coverage.suspended.length} suspensi`, `${coverage.active} active + ${coverage.suspended.length} suspended`)} />
                  <Stat tone="amber" label={L('Suspensi terdeteksi', 'Suspended detected')} value={coverage.suspended.length} sub={L('tidak ada di TradingView, masih ada data di Yahoo', 'not on TradingView, still on Yahoo')} />
                  <Stat label={L('Kode lama tanpa data', 'Old codes without data')} value={coverage.noData.length} sub={L('delisting / suspensi sangat lama', 'delisted / long suspended')} />
                  <Stat
                    tone="sky"
                    label={L('Tercatat di BEI (resmi)', 'Listed on IDX (official)')}
                    value={coverage.official.count}
                    sub={`${new Date(`${coverage.official.asOf}T00:00:00Z`).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · ${coverage.official.origin === 'admin' ? L('diisi admin', 'set by admin') : L('nilai bawaan', 'default')} · ${coverage.coveragePct.toFixed(1)}%`}
                  />
                </div>

                {officialForm && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-[8rem_10rem_minmax(0,1fr)_auto] gap-2 items-end">
                    <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">
                      {L('Jumlah emiten', 'Listed count')}
                      <input inputMode="numeric" value={officialForm.count} onChange={(e) => setOfficialForm({ ...officialForm, count: e.target.value.replace(/[^0-9]/g, '') })} className="px-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm text-white font-bold" />
                    </label>
                    <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">
                      {L('Per tanggal', 'As of')}
                      <input type="date" value={officialForm.asOf} onChange={(e) => setOfficialForm({ ...officialForm, asOf: e.target.value })} className="px-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm text-white" />
                    </label>
                    <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">
                      {L('Sumber', 'Source')}
                      <input value={officialForm.source} maxLength={120} placeholder={L('mis. idx.co.id / ANTARA News', 'e.g. idx.co.id / ANTARA News')} onChange={(e) => setOfficialForm({ ...officialForm, source: e.target.value })} className="px-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm text-white" />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setOfficialForm(null)} className="px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">{L('Batal', 'Cancel')}</button>
                      <button type="button" onClick={() => void saveOfficial()} disabled={savingOfficial || !officialForm.count || !officialForm.asOf} className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                        {savingOfficial ? L('Menyimpan…', 'Saving…') : L('Simpan', 'Save')}
                      </button>
                    </div>
                  </div>
                )}

                {coverage.suspended.length > 0 && (
                  <details className="mt-3 group">
                    <summary className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-white">
                      {L(`Lihat ${coverage.suspended.length} emiten suspensi / tidak bertransaksi`, `Show ${coverage.suspended.length} suspended / non-trading stocks`)}
                    </summary>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {coverage.suspended.map((s) => (
                        <span key={s.symbol} title={s.name} className="px-2 py-0.5 rounded-md border border-amber-500/25 bg-amber-500/10 text-[10px] font-bold text-amber-300">
                          {s.symbol}
                          {s.lastTrade && <span className="text-amber-200/60 font-semibold"> · {s.lastTrade}</span>}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  {L(
                    'Situs BEI (idx.co.id) memblokir akses otomatis, jadi daftar resmi tidak bisa diambil langsung. Emiten aktif diambil dari TradingView, suspensi dideteksi dari kode lama yang masih punya data harga di Yahoo (dengan tanggal transaksi terakhir). Jumlah resmi diisi admin dan ikut tampil di Beranda.',
                    "IDX's site (idx.co.id) blocks automated access, so the official list can't be fetched directly. Active stocks come from TradingView; suspensions are detected from old codes that still have Yahoo prices (with last trade date). The official count is set by admin and shown on Home."
                  )}
                </p>
              </div>
            )}

            {universe?.error && (
              <p className="text-[11px] text-amber-300 mt-3">{L(`Sumber daftar emiten gagal (${universe.error}); memakai daftar bawaan.`, `Stock list source failed (${universe.error}); using the built-in list.`)}</p>
            )}
            {universe && universe.newSymbols.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{L('Emiten baru yang kini ikut dipantau', 'Newly tracked stocks')}</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {universe.newSymbols.map((sym) => <Badge key={sym} tone="sky">{sym}</Badge>)}
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              {L(
                'Refresh membuat semua cache data (harga, scan pasar, pasar global, berita, dividen, fundamental, teknikal, daftar emiten) kedaluwarsa di SEMUA server — server lain mengetahuinya paling lambat ±10 detik lewat penanda refresh bersama — lalu halaman yang sedang terbuka di browser ini (termasuk tab lain) langsung mengambil data baru. Pengunjung lain mendapat data baru pada pembaruan berikutnya. Data lama disimpan sebagai cadangan bila sumber sedang gagal. Hasil AI tidak dibuang karena tetap valid untuk berita yang sama (hemat token). Data Yahoo gratis tetap tertunda; harga real-time penuh butuh feed data berlisensi BEI.',
                'Refresh expires every data cache (prices, market scan, global markets, news, dividends, fundamentals, technicals, stock list) on ALL servers — others learn about it within ~10 s via a shared refresh marker — then pages open in this browser (including other tabs) fetch new data immediately. Other visitors get new data on their next update. Old data is kept as a fallback if a source is failing. AI results are kept since they stay valid for the same news (saves tokens). Free Yahoo data stays delayed; true real-time prices need a licensed IDX data feed.'
              )}
            </p>
          </Card>

          <Card>
            <CardTitle
              icon={<Database className="h-5 w-5 text-emerald-400" />}
              title={L('Koneksi', 'Connection')}
              subtitle={ping ? L(`Diperiksa ${new Date(ping.at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`, `Checked ${new Date(ping.at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' })} WIB`) : undefined}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat tone={cloud ? 'emerald' : 'amber'} label={L('Mode data', 'Data mode')} value={cloud ? 'Supabase' : L('Demo / lokal', 'Demo / local')} sub={cloud ? L('Auth & database cloud', 'Cloud auth & database') : L('Data di localStorage browser', 'Data in browser localStorage')} />
              <Stat
                tone={!cloud ? 'slate' : ping?.ok ? 'emerald' : ping ? 'rose' : 'slate'}
                label={L('Status Supabase', 'Supabase status')}
                value={!cloud ? '—' : checking && !ping ? '…' : ping?.ok ? L('Terhubung', 'Connected') : ping ? L('Gagal', 'Failed') : '—'}
                sub={cloud && ping?.ms != null ? L(`waktu respons ${ping.ms} ms`, `response time ${ping.ms} ms`) : !cloud ? L('tidak dikonfigurasi', 'not configured') : undefined}
              />
              <Stat label={L('Login sebagai', 'Signed in as')} value={<span className="text-sm break-all">{user?.email ?? '—'}</span>} sub={user?.isMock ? L('akun demo', 'demo account') : undefined} />
            </div>
          </Card>

          {cloud && (
            <Card>
              <CardTitle
                icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />}
                title={L('Skema database', 'Database schema')}
                subtitle={L('Setiap baris memeriksa tabel/kolom yang dibuat migrasi. Bila "Belum ada", jalankan file migrasi tersebut di Supabase SQL Editor.', 'Each row checks the table/column a migration creates. If "Missing", run that migration file in the Supabase SQL Editor.')}
              />
              <ul className="divide-y divide-white/5">
                {SCHEMA_PROBES.map((p) => {
                  const r = probes[p.id];
                  return (
                    <li key={p.id} className="py-2.5 flex items-start gap-3">
                      {!r ? (
                        <RefreshCw className="h-4 w-4 text-slate-500 animate-spin shrink-0 mt-0.5" />
                      ) : r.status === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className={`h-4 w-4 shrink-0 mt-0.5 ${r.status === 'missing' ? 'text-amber-400' : 'text-rose-400'}`} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-bold text-white">{p.label}</span>
                          {r && r.status !== 'ok' && <Badge tone="amber">{r.status === 'missing' ? L('Belum ada', 'Missing') : L('Error', 'Error')}</Badge>}
                        </div>
                        <span className="block text-[10px] font-mono text-slate-500 break-all">{p.migration}</span>
                        {r?.detail && <span className="block text-[10px] text-slate-400 mt-0.5 break-words">{r.detail}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {Object.values(probes).some((r) => r.status !== 'ok') && (
                <div className="mt-3 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] text-[11px] text-slate-300 leading-relaxed">
                  {L(
                    'Cara tercepat: buka Supabase → SQL Editor, tempel seluruh isi file ',
                    'Quickest fix: open Supabase → SQL Editor, paste the whole file '
                  )}
                  <code className="font-mono text-amber-300">supabase/migrations/20261008000009_repair_production_schema.sql</code>
                  {L(
                    ', lalu Run. File ini aman dijalankan ulang dan mencakup 000004–000008 (termasuk 000005–000006 yang tidak bisa diperiksa dari aplikasi). Setelah itu login ulang dengan email admin.',
                    ', then Run. It is safe to re-run and covers 000004–000008 (including 000005–000006, which the app cannot check). Then sign in again with the admin email.'
                  )}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-3">
                {L('Migrasi 000005 (RLS insert) dan 000006 (perbaikan claim_first_admin) tidak bisa diperiksa dari aplikasi; keduanya sudah termasuk di file perbaikan 000009.', 'Migrations 000005 (insert RLS) and 000006 (claim_first_admin fix) cannot be checked from the app; both are included in repair file 000009.')}
              </p>
            </Card>
          )}

          <Card>
            <CardTitle
              icon={<HardDrive className="h-5 w-5 text-emerald-400" />}
              title={L('Data di browser ini', 'Data in this browser')}
              subtitle={L('Simulasi dan portofolio mode lokal yang tersimpan di localStorage perangkat ini.', 'Local-mode simulations and portfolio stored in this device’s localStorage.')}
            />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Stat label="Avg Down" value={localStats.avgDown} sub={L('rencana', 'plans')} />
              <Stat label="Compounding" value={localStats.compounding} sub={L('rencana', 'plans')} />
              <Stat label="E-IPO" value={localStats.ipo} sub={L('simulasi', 'simulations')} />
              <Stat label={L('Portofolio', 'Portfolio')} value={localStats.holdings} sub={L('saham (akun ini)', 'stocks (this account)')} />
              <Stat className="col-span-2 sm:col-span-1" label={L('Pengguna demo', 'Demo users')} value={localStats.users} sub={L('akun lokal', 'local accounts')} />
            </div>
          </Card>

          {!cloud && (
            <Card className="border-rose-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white flex items-center gap-2"><RotateCcw className="h-4 w-4 text-rose-400" />{L('Reset data demo', 'Reset demo data')}</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                    {L(
                      'Menghapus semua simulasi, portofolio lokal, dan akun demo di browser ini, lalu membuat ulang akun admin dengan password acak yang ditampilkan sekali.',
                      'Deletes all simulations, local portfolio and demo accounts in this browser, then recreates the admin account with a random password shown once.'
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => setConfirmReset(true)} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                  <RotateCcw className="h-3.5 w-3.5" /> {L('Reset', 'Reset')}
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={toSuspend !== null}
        onClose={() => setToSuspend(null)}
        onConfirm={() => toSuspend && void toggleApproval(toSuspend, false)}
        title={L('Tangguhkan akses?', 'Suspend access?')}
        message={L(`${toSuspend?.email ?? ''} tidak akan bisa memakai fitur yang membutuhkan persetujuan.`, `${toSuspend?.email ?? ''} will lose access to features that require approval.`)}
        confirmText={L('Ya, tangguhkan', 'Yes, suspend')}
        cancelText={L('Batal', 'Cancel')}
        type="warning"
      />
      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void removeUser()}
        title={L('Hapus pengguna?', 'Delete user?')}
        message={L(`Data registrasi & persetujuan ${toDelete?.email ?? ''} akan dihapus permanen.`, `Registration & approval records for ${toDelete?.email ?? ''} will be permanently deleted.`)}
        confirmText={L('Ya, hapus', 'Yes, delete')}
        cancelText={L('Batal', 'Cancel')}
        type="danger"
      />
      <ConfirmModal
        isOpen={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={() => void approveAllPending()}
        title={L(`Setujui ${pendingCount} pengguna?`, `Approve ${pendingCount} users?`)}
        message={L('Semua pengguna yang menunggu akan mendapat akses.', 'Every pending user will be granted access.')}
        confirmText={L('Ya, setujui semua', 'Yes, approve all')}
        cancelText={L('Batal', 'Cancel')}
        type="info"
      />
      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void resetLocalData()}
        title={L('Reset data demo?', 'Reset demo data?')}
        message={L('Semua data lokal di browser ini akan dihapus dan tidak bisa dikembalikan.', 'All local data in this browser will be deleted and cannot be recovered.')}
        confirmText={L('Ya, reset', 'Yes, reset')}
        cancelText={L('Batal', 'Cancel')}
        type="danger"
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className="fixed bottom-6 right-6 z-[80] px-4 py-3 rounded-xl border shadow-xl text-xs font-bold text-white bg-emerald-600/95 border-emerald-400/40 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
