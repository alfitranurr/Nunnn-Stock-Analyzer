'use client';

import * as React from 'react';
import { X, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // MOCK MODE FALLBACK
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setLoading(false);
        const mockUser = {
          id: '12345678-1234-1234-1234-1234567890ab',
          email: email,
          isMock: true
        };
        onAuthSuccess(mockUser);
        onClose();
      }, 1000);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          onAuthSuccess(data.user);
          alert('Pendaftaran berhasil! Periksa email Anda untuk konfirmasi (jika email verification aktif di Supabase).');
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          onAuthSuccess(data.user);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    if (!isSupabaseConfigured) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const mockUser = {
          id: '12345678-1234-1234-1234-1234567890ab',
          email: 'googleuser@nunnnstock.com',
          isMock: true
        };
        onAuthSuccess(mockUser);
        onClose();
      }, 800);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat otentikasi Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative glass-card border-brand-purple/20 p-6 md:p-8 w-full max-w-md bg-slate-900/90 dark:bg-black/90 shadow-2xl text-white animate-scaleIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 text-neon-gradient font-black text-2xl tracking-wider mb-1">
            <Sparkles className="h-5 w-5 text-brand-purple" />
            NUNNN STOCK
          </div>
          <p className="text-xs text-slate-400">
            {isSignUp ? 'Daftar akun baru untuk mulai mencatat' : 'Masuk ke akun untuk menyimpan riwayat rencana Anda'}
          </p>
        </div>

        {/* Supabase Not Configured Warning Banner */}
        {!isSupabaseConfigured && (
          <div className="mb-4.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Mode Simulasi (Lokal)</p>
              <p className="opacity-90 mt-0.5">
                Kunci API Supabase belum terdeteksi di `.env.local`. Akun Anda akan disimulasikan secara lokal untuk kemudahan pengetesan.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4.5 p-3 rounded-lg bg-red-500/15 border border-red-500/35 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alamat Email</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full glass-input pl-10.5 pr-4 py-2.5 text-base md:text-sm bg-black/40 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full glass-input pl-10.5 pr-4 py-2.5 text-base md:text-sm bg-black/40 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-50 text-white font-bold text-sm transition-all duration-300 shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : null}
            <span>{isSignUp ? 'Daftar Akun' : 'Masuk ke Dashboard'}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center justify-center gap-3">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase text-slate-500">Atau</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none">
            <path
              fill="#EA4335"
              d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.197 2.698 1.24 6.65l4.026 3.115z"
            />
            <path
              fill="#34A853"
              d="M16.04 15.345c-1.07.728-2.42 1.164-4.04 1.164-2.955 0-5.46-1.99-6.355-4.664L1.582 15c1.927 3.845 5.955 6.5 10.418 6.5 2.945 0 5.627-.99 7.645-2.7L16.04 15.345z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.275c0-.825-.07-1.62-.2-2.385H12v4.51h6.464c-.28 1.455-1.1 2.69-2.345 3.518l3.609 2.79c2.11-1.945 3.327-4.8 3.327-8.433z"
            />
            <path
              fill="#FBBC05"
              d="M5.645 11.845c-.236-.71-.373-1.473-.373-2.264 0-.79.137-1.554.373-2.264L1.62 4.2C.58 6.29 0 8.618 0 11c0 2.38.58 4.71 1.62 6.8l4.025-3.155z"
            />
          </svg>
          <span>Lanjutkan dengan Google</span>
        </button>

        {/* Toggle Mode */}
        <p className="text-center text-xs text-slate-400 mt-6">
          {isSignUp ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            type="button"
            className="text-brand-purple hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
          >
            {isSignUp ? 'Masuk sekarang' : 'Daftar sekarang'}
          </button>
        </p>
      </div>
    </div>
  );
}
