'use client';

import * as React from 'react';
import { 
  ShieldCheck, 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Trash2,
  Database,
  Calculator,
  Percent,
  Coins,
  Briefcase,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfirmModal } from '@/components/confirm-modal';
import { useLanguage } from '@/lib/language-context';

interface AdminPanelTabProps {
  user: any;
}

interface UserApproval {
  id: string;
  email: string;
  approved: boolean;
  created_at?: string;
  isLocal?: boolean;
}

export function AdminPanelTab({ user }: AdminPanelTabProps) {
  const { language, t } = useLanguage();
  const [users, setUsers] = React.useState<UserApproval[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'approved' | 'pending'>('all');
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [confirmUser, setConfirmUser] = React.useState<UserApproval | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<UserApproval | null>(null);
  const [activeTab, setActiveTab] = React.useState<'approvals' | 'database'>('approvals');
  const [localStats, setLocalStats] = React.useState({
    avgDownPlans: 0,
    compoundingPlans: 0,
    ipoPlans: 0,
    holdings: 0,
    simulatedUsers: 0
  });
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const fetchLocalStats = React.useCallback(() => {
    try {
      const avgDownStr = localStorage.getItem('nunnn_stock_saved_plans');
      const compoundingStr = localStorage.getItem('nunnn_stock_compounding_plans');
      const ipoStr = localStorage.getItem('nunnn_stock_ipo_plans');
      const usersStr = localStorage.getItem('nunnn_stock_simulated_users');
      
      let holdingsCount = 0;
      if (user?.id) {
        const holdingsStr = localStorage.getItem(`nunnn_stock_portfolio_holdings_${user.id}`);
        if (holdingsStr) holdingsCount = JSON.parse(holdingsStr).length;
      }

      setLocalStats({
        avgDownPlans: avgDownStr ? JSON.parse(avgDownStr).length : 0,
        compoundingPlans: compoundingStr ? JSON.parse(compoundingStr).length : 0,
        ipoPlans: ipoStr ? JSON.parse(ipoStr).length : 0,
        simulatedUsers: usersStr ? JSON.parse(usersStr).length : 0,
        holdings: holdingsCount
      });
    } catch (e) {
      console.error('Failed to parse local stats:', e);
    }
  }, [user]);

  const executeResetSimData = () => {
    try {
      localStorage.removeItem('nunnn_stock_saved_plans');
      localStorage.removeItem('nunnn_stock_compounding_plans');
      localStorage.removeItem('nunnn_stock_ipo_plans');
      if (user?.id) {
        localStorage.removeItem(`nunnn_stock_portfolio_holdings_${user.id}`);
        localStorage.removeItem(`nunnn_stock_portfolio_cash_${user.id}`);
      }
      
      const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@nunnnstock.com').toLowerCase();
      localStorage.setItem('nunnn_stock_simulated_users', JSON.stringify([
        { email: adminEmail, password: 'adminpassword', approved: true }
      ]));

      setSuccessMsg(language === 'id' ? 'Data simulasi lokal berhasil dibersihkan.' : 'Local simulated data cleared successfully.');
      fetchLocalStats();
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(language === 'id' ? 'Gagal membersihkan data simulasi.' : 'Failed to clear simulated data.');
    } finally {
      setShowResetConfirm(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'database') {
      const timer = setTimeout(() => {
        fetchLocalStats();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchLocalStats]);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        const storedUsers = localStorage.getItem('nunnn_stock_simulated_users');
        const parsedUsers = storedUsers ? JSON.parse(storedUsers) : [];
        
        const mapped: UserApproval[] = parsedUsers.map((u: any, idx: number) => ({
          id: `local-id-${idx}`,
          email: u.email,
          approved: u.approved,
          created_at: new Date().toISOString(),
          isLocal: true
        }));
        setUsers(mapped);
      } else {
        const { data, error: dbError } = await supabase
          .from('user_approvals')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;
        setUsers(data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'id' ? 'Gagal mengambil data user approvals.' : 'Failed to retrieve user approval data.'));
    } finally {
      setLoading(false);
    }
  }, [language]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Automatically clear notifications after 4 seconds
  React.useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleToggleApproval = (userToUpdate: UserApproval) => {
    if (userToUpdate.email.toLowerCase() === user?.email?.toLowerCase()) {
      setError(language === 'id' ? 'Anda tidak dapat menangguhkan status akses admin Anda sendiri.' : 'You cannot suspend your own admin access status.');
      return;
    }

    if (userToUpdate.approved) {
      setConfirmUser(userToUpdate);
    } else {
      executeToggleApproval(userToUpdate, true);
    }
  };

  const executeToggleApproval = async (userToUpdate: UserApproval, newStatus: boolean) => {
    setError(null);
    setSuccessMsg(null);
    setConfirmUser(null);

    try {
      if (!isSupabaseConfigured) {
        const storedUsers = localStorage.getItem('nunnn_stock_simulated_users');
        let simUsers = storedUsers ? JSON.parse(storedUsers) : [];
        
        simUsers = simUsers.map((u: any) => {
          if (u.email.toLowerCase() === userToUpdate.email.toLowerCase()) {
            return { ...u, approved: newStatus };
          }
          return u;
        });

        localStorage.setItem('nunnn_stock_simulated_users', JSON.stringify(simUsers));
        setUsers(prev => prev.map(u => 
          u.email.toLowerCase() === userToUpdate.email.toLowerCase() 
            ? { ...u, approved: newStatus } 
            : u
        ));
        setSuccessMsg(
          newStatus 
            ? t('admin.toastApproved').replace('{email}', userToUpdate.email)
            : t('admin.toastRevoked').replace('{email}', userToUpdate.email)
        );
      } else {
        const { error: dbError } = await supabase
          .from('user_approvals')
          .update({ approved: newStatus })
          .eq('email', userToUpdate.email);

        if (dbError) throw dbError;
        
        setUsers(prev => prev.map(u => 
          u.email.toLowerCase() === userToUpdate.email.toLowerCase() 
            ? { ...u, approved: newStatus } 
            : u
        ));
        setSuccessMsg(
          newStatus 
            ? t('admin.toastApproved').replace('{email}', userToUpdate.email)
            : t('admin.toastRevoked').replace('{email}', userToUpdate.email)
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'id' ? 'Gagal mengubah status persetujuan.' : 'Failed to change approval status.'));
    }
  };

  const executeDeleteUser = async (userToDelete: UserApproval) => {
    setError(null);
    setSuccessMsg(null);
    setDeleteUser(null);

    try {
      if (!isSupabaseConfigured) {
        const storedUsers = localStorage.getItem('nunnn_stock_simulated_users');
        let simUsers = storedUsers ? JSON.parse(storedUsers) : [];
        
        simUsers = simUsers.filter((u: any) => u.email.toLowerCase() !== userToDelete.email.toLowerCase());

        localStorage.setItem('nunnn_stock_simulated_users', JSON.stringify(simUsers));
        setUsers(prev => prev.filter(u => u.email.toLowerCase() !== userToDelete.email.toLowerCase()));
        setSuccessMsg(
          language === 'id'
            ? `User ${userToDelete.email} berhasil dihapus.`
            : `User ${userToDelete.email} has been deleted successfully.`
        );
      } else {
        const { error: dbError } = await supabase
          .from('user_approvals')
          .delete()
          .eq('email', userToDelete.email);

        if (dbError) throw dbError;
        
        setUsers(prev => prev.filter(u => u.email.toLowerCase() !== userToDelete.email.toLowerCase()));
        setSuccessMsg(
          language === 'id'
            ? `User ${userToDelete.email} berhasil dihapus.`
            : `User ${userToDelete.email} has been deleted successfully.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'id' ? 'Gagal menghapus user.' : 'Failed to delete user.'));
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (statusFilter === 'approved') return matchesSearch && u.approved;
    if (statusFilter === 'pending') return matchesSearch && !u.approved;
    return matchesSearch;
  });

  const totalUsers = users.length;
  const approvedUsers = users.filter(u => u.approved).length;
  const pendingUsers = users.filter(u => !u.approved).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card-bg via-[#161b22] to-[#0d1117] p-6 md:p-8 shadow-2xl w-full">
        <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 w-full">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>{language === 'id' ? 'Panel Manajemen Sistem & Admin' : 'Administrator Management Panel'}</span>
            </div>
            
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
              {t('admin.title')}
              <Sparkles className="h-6 w-6 text-emerald-400 shrink-0" />
            </h1>
            
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed w-full">
              {t('admin.desc')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
            {/* Section Switcher Tabs */}
            <div className="flex bg-white/5 p-1 border border-white/10 rounded-xl text-xs font-bold w-full md:w-auto">
              <button
                onClick={() => setActiveTab('approvals')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'approvals' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('admin.tabApprovals')}
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'database' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('admin.tabDatabase')}
              </button>
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title={language === 'id' ? 'Refresh Data' : 'Refresh Data'}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Warning/Success alerts */}
      {error && (
        <div className="border border-red-500/20 bg-red-500/10 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="border border-emerald-500/20 bg-emerald-500/10 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200">{successMsg}</div>
        </div>
      )}

      {activeTab === 'approvals' ? (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  {language === 'id' ? 'Total Terdaftar' : 'Total Registered'}
                </span>
                <span className="font-bold text-white mt-0.5 text-base">{totalUsers} {language === 'id' ? 'User' : 'Users'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  {t('admin.statusApproved')}
                </span>
                <span className="font-bold text-white mt-0.5 text-base">{approvedUsers} {language === 'id' ? 'User' : 'Users'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  {language === 'id' ? 'Menunggu Approval' : 'Awaiting Approval'}
                </span>
                <span className={`font-bold mt-0.5 text-base ${pendingUsers > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                  {pendingUsers} {language === 'id' ? 'User' : 'Users'}
                </span>
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-slate-900 bg-slate-950/20 rounded-xl">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/60 transition-all duration-200"
              />
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            </div>

            <div className="flex bg-slate-900 p-0.5 border border-slate-800 rounded-lg text-[10px] font-bold w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
                  statusFilter === 'all' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'id' ? 'Semua' : 'All'}
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
                  statusFilter === 'approved' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('admin.statusApproved')}
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
                  statusFilter === 'pending' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* User Table List */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-2xl overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
                    <th className="px-5 py-4">{t('admin.thEmail')}</th>
                    <th className="px-5 py-4">{language === 'id' ? 'Tanggal Daftar' : 'Registration Date'}</th>
                    <th className="px-5 py-4">{t('admin.thStatus')}</th>
                    <th className="px-5 py-4 text-right">{t('admin.thAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                        <span className="inline-block animate-spin h-5 w-5 border-2 border-brand-purple border-t-transparent rounded-full mr-2.5 vertical-middle" />
                        {language === 'id' ? 'Sedang memuat data user...' : 'Loading user data...'}
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500 italic">
                        {t('admin.emptyUsers')}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => {
                      const isSelf = item.email.toLowerCase() === user?.email?.toLowerCase();
                      return (
                        <tr 
                          key={item.id} 
                          className="hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="px-5 py-4.5 font-medium text-slate-200 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{item.email}</span>
                              {isSelf && (
                                <span className="bg-brand-purple/20 text-brand-purple border border-brand-purple/35 text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase">
                                  Admin ({language === 'id' ? 'Anda' : 'You'})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4.5 text-slate-400 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              {item.created_at ? new Date(item.created_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4.5 whitespace-nowrap">
                            {item.approved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {language === 'id' ? 'Disetujui' : 'Approved'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                {language === 'id' ? 'Menunggu Approval' : 'Pending Approval'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => handleToggleApproval(item)}
                                disabled={isSelf}
                                className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase select-none transition-all duration-300 border cursor-pointer ${
                                  isSelf
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                                    : item.approved
                                      ? 'bg-transparent border-rose-500/30 text-rose-400 hover:text-white hover:bg-rose-600 hover:border-rose-500 hover:shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:scale-[1.02]'
                                }`}
                              >
                                {item.approved ? (language === 'id' ? 'Tangguhkan' : 'Suspend') : (language === 'id' ? 'Setujui' : 'Approve')}
                              </button>
                              
                              <button
                                onClick={() => setDeleteUser(item)}
                                disabled={isSelf}
                                className={`p-1.5 rounded-xl transition-all duration-300 border cursor-pointer ${
                                  isSelf
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                                    : 'bg-transparent border-rose-500/20 text-rose-500 hover:text-white hover:bg-rose-600 hover:border-rose-500'
                                }`}
                                title={language === 'id' ? 'Hapus Pengguna' : 'Delete User'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Database & Integration Status Panel */
        <div className="space-y-6">
          {/* Section 1: Integration Status */}
          <div className="glass-card p-6 space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Database className="h-4.5 w-4.5 text-brand-purple" />
                {t('admin.dbStatusTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('admin.dbStatusDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supabase Status */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">{t('admin.dbSupabaseConfig')}</span>
                  <span className="text-[10px] text-slate-500">PostgreSQL Cloud Database Integration</span>
                </div>
                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                  isSupabaseConfigured 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {isSupabaseConfigured ? t('admin.dbSupabaseConnected') : t('admin.dbSupabaseOffline')}
                </span>
              </div>

              {/* Auth status */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">{language === 'id' ? 'Status Autentikasi' : 'Authentication Status'}</span>
                  <span className="text-[10px] text-slate-500">JSON Web Token & Simulation Handlers</span>
                </div>
                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                  !isSupabaseConfigured 
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {!isSupabaseConfigured ? t('admin.dbSimulatedActive') : (language === 'id' ? 'Supabase Auth Aktif' : 'Supabase Auth Active')}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Local Simulation Statistics */}
          <div className="glass-card p-6 space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Database className="h-4.5 w-4.5 text-brand-purple" />
                {t('admin.dbLocalStatsTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('admin.dbLocalStatsDesc')}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Stat 1: Avg Down */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 hover:border-brand-purple/20 transition-all rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-lg shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">
                    {t('admin.dbStatAvgDown')}
                  </span>
                  <span className="font-extrabold text-white text-sm mt-0.5 block">{localStats.avgDownPlans}</span>
                </div>
              </div>

              {/* Stat 2: Compounding */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 hover:border-brand-purple/20 transition-all rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-lg shrink-0">
                  <Percent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">
                    {t('admin.dbStatCompounding')}
                  </span>
                  <span className="font-extrabold text-white text-sm mt-0.5 block">{localStats.compoundingPlans}</span>
                </div>
              </div>

              {/* Stat 3: E-IPO */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 hover:border-brand-purple/20 transition-all rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-lg shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">
                    {t('admin.dbStatIpo')}
                  </span>
                  <span className="font-extrabold text-white text-sm mt-0.5 block">{localStats.ipoPlans}</span>
                </div>
              </div>

              {/* Stat 4: Holdings */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 hover:border-brand-purple/20 transition-all rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-lg shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">
                    {t('admin.dbStatHoldings')}
                  </span>
                  <span className="font-extrabold text-white text-sm mt-0.5 block">{localStats.holdings}</span>
                </div>
              </div>

              {/* Stat 5: Users */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 hover:border-brand-purple/20 transition-all rounded-xl flex items-center gap-3 col-span-2 md:col-span-1">
                <div className="p-2.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-lg shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">
                    {t('admin.dbStatUsers')}
                  </span>
                  <span className="font-extrabold text-white text-sm mt-0.5 block">{localStats.simulatedUsers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Maintenance Tools */}
          <div className="glass-card p-6 space-y-5 border-l-2 border-l-rose-500/80 animate-fadeIn">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                {t('admin.dbMaintenanceTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('admin.dbMaintenanceDesc')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/[0.02] border border-rose-500/10">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-200 block">{language === 'id' ? 'Set Ulang Memori Simulasi Lokal' : 'Reset Local Simulation Memory'}</span>
                <span className="text-[10px] text-slate-500 block leading-relaxed max-w-xl">
                  {language === 'id' 
                    ? 'Hapus semua data simulasi yang tersimpan di localStorage browser ini untuk memulai pengujian dari awal.'
                    : 'Remove all simulated datasets currently stored in this browser\'s localStorage to start testing fresh.'}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border border-rose-500/20 rounded-xl text-white font-extrabold text-xs shadow-md select-none transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('admin.btnResetSim')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Suspend Modal */}
      <ConfirmModal
        isOpen={confirmUser !== null}
        onClose={() => setConfirmUser(null)}
        onConfirm={() => {
          if (confirmUser) {
            executeToggleApproval(confirmUser, false);
          }
        }}
        title={language === 'id' ? 'Tangguhkan Akses Pengguna' : 'Suspend User Access'}
        message={
          language === 'id'
            ? `Apakah Anda yakin ingin menangguhkan akses untuk user "${confirmUser?.email}"? Pengguna ini tidak akan dapat login lagi ke aplikasi.`
            : `Are you sure you want to suspend access for user "${confirmUser?.email}"? This user will no longer be able to log in to the application.`
        }
        confirmText={language === 'id' ? 'Ya, Tangguhkan' : 'Yes, Suspend'}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => {
          if (deleteUser) {
            executeDeleteUser(deleteUser);
          }
        }}
        title={language === 'id' ? 'Hapus Pengguna' : 'Delete User'}
        message={
          language === 'id'
            ? `Apakah Anda yakin ingin menghapus user "${deleteUser?.email}"? Seluruh data registrasi dan persetujuan pengguna ini akan dihapus secara permanen.`
            : `Are you sure you want to delete user "${deleteUser?.email}"? All registration and approval records for this user will be permanently deleted.`
        }
        confirmText={language === 'id' ? 'Ya, Hapus' : 'Yes, Delete'}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Reset Simulated Data Confirm Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeResetSimData}
        title={t('admin.modalResetTitle')}
        message={t('admin.modalResetMessage')}
        confirmText={language === 'id' ? 'Ya, Reset' : 'Yes, Reset'}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </div>
  );
}
