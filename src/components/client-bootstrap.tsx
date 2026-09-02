'use client';

import { useEffect } from 'react';

/**
 * Client-only bootstrap:
 *  - Clears stale Supabase auth keys when an invalid/missing refresh token
 *    is reported via global error/unhandledrejection events.
 *  - Polyfills `crypto.randomUUID`, `localStorage`, `sessionStorage` for
 *    legacy/private browsers where they may be missing.
 *
 * NOTE: We intentionally do NOT override `console.error` / `console.warn`
 * globally — that previously swallowed legitimate errors and hid bugs.
 * We also no longer render a DOM error overlay in production.
 */
export function ClientBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const AUTH_ERROR_PATTERNS = [
      'invalid refresh token',
      'refresh token not found',
      'refresh_token not found',
      'authapierror',
      'failed to fetch',
    ];

    function isAuthError(text: string): boolean {
      const lower = text.toLowerCase();
      return AUTH_ERROR_PATTERNS.some((p) => lower.indexOf(p) !== -1);
    }

    function isAuthLikeReason(reason: unknown): boolean {
      if (!reason) return false;
      const r = reason as { message?: string; stack?: string; name?: string; status?: number };
      const text = `${r.message || ''} ${r.stack || ''} ${r.name || ''}`;
      if (isAuthError(text)) return true;
      return r.name === 'AuthApiError' || r.status === 400;
    }

    function clearSupabaseKeys() {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.indexOf('sb-') === 0 ||
              key.indexOf('auth-token') !== -1 ||
              key.indexOf('supabase.auth.token') !== -1)
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }

    function onError(event: ErrorEvent) {
      const msg = event.message || '';
      const stack = event.error?.stack || '';
      if (isAuthError(`${msg} ${stack}`)) {
        clearSupabaseKeys();
        try {
          event.stopImmediatePropagation();
          event.preventDefault();
        } catch {
          // ignore
        }
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isAuthLikeReason(event.reason)) {
        clearSupabaseKeys();
        try {
          event.stopImmediatePropagation();
          event.preventDefault();
        } catch {
          // ignore
        }
      }
    }

    // Polyfill crypto.randomUUID. Prefer crypto.getRandomValues for
    // cryptographically-strong randomness; fall back to Math.random only
    // when getRandomValues is unavailable (legacy browsers).
    if (!window.crypto) {
      try {
        Object.defineProperty(window, 'crypto', {
          value: {},
          writable: true,
          configurable: true,
        });
      } catch {
        (window as unknown as { crypto: unknown }).crypto = {};
      }
    }

    if (window.crypto && !window.crypto.randomUUID) {
      const randomUUID = () => {
        // Use crypto.getRandomValues for strong randomness when available.
        if (typeof window.crypto.getRandomValues === 'function') {
          const bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
          bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
          const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
          return (
            hex.slice(0, 4).join('') +
            '-' +
            hex.slice(4, 6).join('') +
            '-' +
            hex.slice(6, 8).join('') +
            '-' +
            hex.slice(8, 10).join('') +
            '-' +
            hex.slice(10, 16).join('')
          );
        }
        // Last-resort fallback for very old browsers without getRandomValues.
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      try {
        Object.defineProperty(window.crypto, 'randomUUID', {
          value: randomUUID,
          writable: true,
          configurable: true,
        });
      } catch {
        (window.crypto as unknown as { randomUUID: () => string }).randomUUID = randomUUID;
      }
    }

    // Polyfill localStorage / sessionStorage if access is blocked (private mode).
    function ensureStorage(name: 'localStorage' | 'sessionStorage') {
      const testKey = '__test_storage__';
      let functional = false;
      try {
        const store = window[name] as Storage;
        store.setItem(testKey, 'test');
        store.removeItem(testKey);
        functional = true;
      } catch {
        functional = false;
      }

      if (functional) return;

      let mock: Record<string, string> = {};
      const storeMock: Storage = {
        getItem: (key) => mock[key] || null,
        setItem: (key, val) => {
          mock[key] = String(val);
        },
        removeItem: (key) => {
          delete mock[key];
        },
        clear: () => {
          mock = {};
        },
        key: (index) => Object.keys(mock)[index] || null,
        get length() {
          return Object.keys(mock).length;
        },
      };

      try {
        Object.defineProperty(window, name, {
          value: storeMock,
          writable: true,
          configurable: true,
        });
      } catch {
        (window as unknown as Record<string, unknown>)[name] = storeMock;
      }
    }

    ensureStorage('localStorage');
    ensureStorage('sessionStorage');

    // Dev-only error overlay for quick debugging (never in production).
    if (process.env.NODE_ENV !== 'production') {
      const containerId = 'debug-error-overlay';
      const ensureContainer = () => {
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = containerId;
          container.style.position = 'fixed';
          container.style.bottom = '10px';
          container.style.left = '10px';
          container.style.right = '10px';
          container.style.backgroundColor = 'rgba(220, 38, 38, 0.95)';
          container.style.color = '#ffffff';
          container.style.padding = '15px';
          container.style.borderRadius = '8px';
          container.style.zIndex = '999999';
          container.style.fontFamily = 'monospace';
          container.style.fontSize = '11px';
          container.style.maxHeight = '220px';
          container.style.overflowY = 'auto';
          container.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
          container.style.border = '1px solid rgba(255, 255, 255, 0.3)';
          document.body.appendChild(container);
        }
        return container;
      };

      const showError = (message: string, stack?: string) => {
        try {
          const container = ensureContainer();
          const errorEl = document.createElement('div');
          errorEl.style.marginBottom = '10px';
          errorEl.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
          errorEl.style.paddingBottom = '5px';
          errorEl.innerHTML =
            '<strong>Browser Error:</strong> ' +
            message +
            '<pre style="margin: 5px 0 0 0; white-space: pre-wrap; font-size: 9px; opacity: 0.85; color: #fecaca;">' +
            (stack || 'No stack trace available') +
            '</pre>';
          container.appendChild(errorEl);
        } catch {
          // ignore
        }
      };

      const onDevError = (event: ErrorEvent) => {
        const msg = event.message || '';
        const stack = event.error?.stack || '';
        const lower = `${msg} ${stack}`.toLowerCase();
        if (
          lower.indexOf('invalid refresh token') !== -1 ||
          lower.indexOf('react error #418') !== -1 ||
          lower.indexOf('react error #423') !== -1 ||
          lower.indexOf('hydration') !== -1
        ) {
          return;
        }
        showError(msg, stack);
      };

      const onDevUnhandled = (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        if (isAuthLikeReason(reason)) return;
        const msg = reason?.message || String(reason);
        const stack = reason?.stack || '';
        if (msg.toLowerCase().indexOf('hydration') !== -1) return;
        showError(msg, stack);
      };

      window.addEventListener('error', onDevError);
      window.addEventListener('unhandledrejection', onDevUnhandled);

      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onUnhandledRejection);

      return () => {
        window.removeEventListener('error', onDevError);
        window.removeEventListener('unhandledrejection', onDevUnhandled);
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
        const container = document.getElementById(containerId);
        if (container) container.remove();
      };
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
