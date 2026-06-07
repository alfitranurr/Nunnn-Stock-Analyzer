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
  Clock
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfirmModal } from '@/components/confirm-modal';

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
  const [users, setUsers] = React.useState<UserApproval[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'approved' | 'pending'>('all');
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [confirmUser, setConfirmUser] = React.useState<UserApproval | null>(null);

  const fetchUsers = async () => {
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
      setError(err.message || 'Gagal mengambil data user approvals.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleApproval = (userToUpdate: UserApproval) => {
    if (userToUpdate.email.toLowerCase() === user?.email?.toLowerCase()) {
      setError('Anda tidak dapat menangguhkan status akses admin Anda sendiri.');
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
        setSuccessMsg(`Status akses ${userToUpdate.email} berhasil diperbarui.`);
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
        setSuccessMsg(`Status akses ${userToUpdate.email} berhasil diperbarui.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengubah status persetujuan.');
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
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border-color p-5 rounded-2xl bg-card-bg relative z-10 animate-fadeIn">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-purple animate-pulse" /> Admin Panel - Persetujuan Registrasi
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola persetujuan akses pendaftaran untuk user baru (hanya akun terdaftar di bawah yang dapat masuk ke aplikasi).
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer self-end md:self-center"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
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

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-brand-purple/10 border border-brand-purple/20 text-brand-purple rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Total Terdaftar</span>
            <span className="text-xl font-bold text-white mt-0.5">{totalUsers} User</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Telah Disetujui</span>
            <span className="text-xl font-bold text-white mt-0.5">{approvedUsers} User</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Menunggu Approval</span>
            <span className={`text-xl font-bold mt-0.5 ${pendingUsers > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
              {pendingUsers} User
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-slate-900 bg-slate-950/20 rounded-xl">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Cari email user..."
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
            Semua
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
              statusFilter === 'approved' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Disetujui
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
              <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-4">Alamat Email</th>
                <th className="px-5 py-4">Tanggal Daftar</th>
                <th className="px-5 py-4">Status Akses</th>
                <th className="px-5 py-4 text-right">Tindakan Persetujuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                    <span className="inline-block animate-spin h-5 w-5 border-2 border-brand-purple border-t-transparent rounded-full mr-2.5 vertical-middle" />
                    Sedang memuat data user...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-500 italic">
                    Tidak ada pendaftar yang cocok dengan filter atau pencarian.
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
                      <td className="px-5 py-4.5 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{item.email}</span>
                          {isSelf && (
                            <span className="bg-brand-purple/20 text-brand-purple border border-brand-purple/35 text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase">
                              Admin (Anda)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4.5 text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4.5">
                        {item.approved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4.5 text-right">
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
                          {item.approved ? 'Tangguhkan Akses' : 'Setujui Akses'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmUser !== null}
        onClose={() => setConfirmUser(null)}
        onConfirm={() => {
          if (confirmUser) {
            executeToggleApproval(confirmUser, false);
          }
        }}
        title="Tangguhkan Akses Pengguna"
        message={`Apakah Anda yakin ingin menangguhkan akses untuk user "${confirmUser?.email}"? Pengguna ini tidak akan dapat login lagi ke aplikasi.`}
        confirmText="Ya, Tangguhkan"
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
}
