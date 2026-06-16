'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  type = 'danger'
}: ConfirmModalProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 className="h-6 w-6 text-rose-500 animate-pulse" />;
      case 'warning':
        return <LogOut className="h-6 w-6 text-amber-500 animate-pulse" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-brand-purple" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:shadow-[0_0_16px_rgba(239,68,68,0.4)]';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_12px_rgba(217,119,6,0.2)] hover:shadow-[0_0_16px_rgba(217,119,6,0.4)]';
      default:
        return 'bg-brand-purple hover:bg-brand-purple/90 text-white shadow-[0_0_12px_rgba(0,177,91,0.2)]';
    }
  };

  const getIconBgClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-500/10 border border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/10 border border-amber-500/20';
      default:
        return 'bg-brand-purple/10 border border-brand-purple/20';
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
            className="relative border border-border-color p-6 w-full max-w-sm bg-card-bg shadow-2xl text-white z-10 rounded-2xl"
          >
            <div className="flex flex-col items-center text-center">
              {/* Icon Wrapper */}
              <div className={`p-3.5 rounded-2xl mb-4 ${getIconBgClass()}`}>
                {getIcon()}
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-white mb-2">{title}</h3>

              {/* Message */}
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {message}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-bold text-xs transition-all duration-200 cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${getButtonClass()}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
