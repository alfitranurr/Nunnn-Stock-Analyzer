'use client';

if (typeof window !== 'undefined') {
  // 1. Polyfill crypto.randomUUID for non-secure contexts (HTTP / IP addresses)
  if (!window.crypto) {
    try {
      Object.defineProperty(window, 'crypto', {
        value: {},
        writable: true,
        configurable: true
      });
    } catch (e) {
      console.error('[Polyfill] Failed to create window.crypto object:', e);
    }
  }

  if (window.crypto && !window.crypto.randomUUID) {
    console.warn('[Polyfill] crypto.randomUUID is not supported in this context. Applying custom fallback.');
    const randomUUID = () => {
      // Fallback RFC4122 v4 compliant UUID generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    try {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: randomUUID,
        writable: true,
        configurable: true
      });
    } catch (e) {
      try {
        (window.crypto as any).randomUUID = randomUUID;
      } catch (innerErr) {
        console.error('[Polyfill] Failed to write fallback to crypto.randomUUID:', innerErr);
      }
    }
  }

  // 2. Polyfill localStorage for incognito/private mode restrictions
  const testKey = '__test_storage_polyfill__';
  let isLocalStorageFunctional = false;
  try {
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    isLocalStorageFunctional = true;
  } catch (e) {
    isLocalStorageFunctional = false;
  }

  if (!isLocalStorageFunctional) {
    console.warn('[Polyfill] localStorage is restricted (e.g. Incognito mode). Applying in-memory fallback.');
    const mockStorage = new Map<string, string>();
    const storageMock = {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => { mockStorage.set(key, value); },
      removeItem: (key: string) => { mockStorage.delete(key); },
      clear: () => { mockStorage.clear(); },
      key: (index: number) => Array.from(mockStorage.keys())[index] || null,
      get length() { return mockStorage.size; }
    };

    try {
      Object.defineProperty(window, 'localStorage', {
        value: storageMock,
        writable: true,
        configurable: true
      });
    } catch (e) {
      console.error('[Polyfill] Failed to redefine window.localStorage:', e);
    }
  }

  // 3. Polyfill sessionStorage for incognito/private mode restrictions
  let isSessionStorageFunctional = false;
  try {
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
    isSessionStorageFunctional = true;
  } catch (e) {
    isSessionStorageFunctional = false;
  }

  if (!isSessionStorageFunctional) {
    console.warn('[Polyfill] sessionStorage is restricted. Applying in-memory fallback.');
    const mockStorage = new Map<string, string>();
    const storageMock = {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => { mockStorage.set(key, value); },
      removeItem: (key: string) => { mockStorage.delete(key); },
      clear: () => { mockStorage.clear(); },
      key: (index: number) => Array.from(mockStorage.keys())[index] || null,
      get length() { return mockStorage.size; }
    };

    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: storageMock,
        writable: true,
        configurable: true
      });
    } catch (e) {
      console.error('[Polyfill] Failed to redefine window.sessionStorage:', e);
    }
  }

  // 4. Debug Error Overlay: Display JavaScript errors on device screen
  const showError = (message: string, stack?: string) => {
    try {
      let container = document.getElementById('debug-error-overlay');
      if (!container) {
        container = document.createElement('div');
        container.id = 'debug-error-overlay';
        container.style.position = 'fixed';
        container.style.bottom = '10px';
        container.style.left = '10px';
        container.style.right = '10px';
        container.style.backgroundColor = 'rgba(220, 38, 38, 0.95)';
        container.style.color = '#white';
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
      const errorEl = document.createElement('div');
      errorEl.style.marginBottom = '10px';
      errorEl.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
      errorEl.style.paddingBottom = '5px';
      errorEl.innerHTML = `<strong>Error:</strong> ${message}<pre style="margin: 5px 0 0 0; white-space: pre-wrap; font-size: 9px; opacity: 0.85; color: #fecaca;">${stack || 'No stack trace available'}</pre>`;
      container.appendChild(errorEl);
    } catch (e) {
      console.error('Failed to render error overlay:', e);
    }
  };

  window.addEventListener('error', (event) => {
    showError(event.message, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    showError(event.reason?.message || String(event.reason), event.reason?.stack);
  });

  console.log('[Debug] Error Logger Overlay initialized.');
}
