import "@/lib/polyfills";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nunnn Stock - Kalkulator Average Down Saham Indonesia (BEI/IDX)",
  description: "Simulasikan rencana pembelian saham Average Down (pembelian bertahap) secara presisi dengan kalkulasi broker fee (pajak transaksi, levy, PPh) khusus pasar saham Indonesia (BEI/IDX).",
  keywords: "saham, average down, kalkulator saham, bursa efek indonesia, bei, idx, investasi, trading, stockbit, ajaib, ipot",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;

                // 1. Error logging overlay setup
                function showError(message, stack) {
                  try {
                    var container = document.getElementById('debug-error-overlay');
                    if (!container) {
                      container = document.createElement('div');
                      container.id = 'debug-error-overlay';
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
                    var errorEl = document.createElement('div');
                    errorEl.style.marginBottom = '10px';
                    errorEl.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
                    errorEl.style.paddingBottom = '5px';
                    errorEl.innerHTML = '<strong>Browser Error:</strong> ' + message + '<pre style="margin: 5px 0 0 0; white-space: pre-wrap; font-size: 9px; opacity: 0.85; color: #fecaca;">' + (stack || 'No stack trace available') + '</pre>';
                    container.appendChild(errorEl);
                  } catch (e) {
                    console.error('Failed to render error overlay:', e);
                  }
                }

                window.addEventListener('error', function(event) {
                  showError(event.message, event.error ? event.error.stack : '');
                });

                window.addEventListener('unhandledrejection', function(event) {
                  showError(event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled rejection', event.reason ? event.reason.stack : '');
                });

                // 2. Polyfill crypto.randomUUID
                if (!window.crypto) {
                  try {
                    Object.defineProperty(window, 'crypto', {
                      value: {},
                      writable: true,
                      configurable: true
                    });
                  } catch (e) {
                    window.crypto = {};
                  }
                }

                if (window.crypto && !window.crypto.randomUUID) {
                  var randomUUID = function() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      var r = (Math.random() * 16) | 0;
                      var v = c === 'x' ? r : (r & 0x3) | 0x8;
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
                    window.crypto.randomUUID = randomUUID;
                  }
                }

                // 3. Polyfill localStorage
                var testKey = '__test_storage__';
                var storageFunctional = false;
                try {
                  window.localStorage.setItem(testKey, 'test');
                  window.localStorage.removeItem(testKey);
                  storageFunctional = true;
                } catch (e) {
                  storageFunctional = false;
                }

                if (!storageFunctional) {
                  var mockStorage = {};
                  var localStorageMock = {
                    getItem: function(key) { return mockStorage[key] || null; },
                    setItem: function(key, val) { mockStorage[key] = String(val); },
                    removeItem: function(key) { delete mockStorage[key]; },
                    clear: function() { mockStorage = {}; },
                    key: function(index) { return Object.keys(mockStorage)[index] || null; },
                    get length() { return Object.keys(mockStorage).length; }
                  };
                  try {
                    Object.defineProperty(window, 'localStorage', {
                      value: localStorageMock,
                      writable: true,
                      configurable: true
                    });
                  } catch (e) {
                    window.localStorage = localStorageMock;
                  }
                }

                // 4. Polyfill sessionStorage
                var sessionFunctional = false;
                try {
                  window.sessionStorage.setItem(testKey, 'test');
                  window.sessionStorage.removeItem(testKey);
                  sessionFunctional = true;
                } catch (e) {
                  sessionFunctional = false;
                }

                if (!sessionFunctional) {
                  var mockSession = {};
                  var sessionStorageMock = {
                    getItem: function(key) { return mockSession[key] || null; },
                    setItem: function(key, val) { mockSession[key] = String(val); },
                    removeItem: function(key) { delete mockSession[key]; },
                    clear: function() { mockSession = {}; },
                    key: function(index) { return Object.keys(mockSession)[index] || null; },
                    get length() { return Object.keys(mockSession).length; }
                  };
                  try {
                    Object.defineProperty(window, 'sessionStorage', {
                      value: sessionStorageMock,
                      writable: true,
                      configurable: true
                    });
                  } catch (e) {
                    window.sessionStorage = sessionStorageMock;
                  }
                }
              })();
            `
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
