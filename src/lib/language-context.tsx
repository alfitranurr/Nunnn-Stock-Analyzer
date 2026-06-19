'use client';

import * as React from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string) => string;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>('id');

  // Load saved language on mount
  React.useEffect(() => {
    try {
      const savedLang = localStorage.getItem('nunnn_stock_language') as Language;
      if (savedLang === 'id' || savedLang === 'en') {
        setLanguageState(savedLang);
      }
    } catch (e) {
      console.warn('Failed to load saved language:', e);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('nunnn_stock_language', lang);
    } catch (e) {
      console.warn('Failed to save language choice:', e);
    }
  };

  const t = React.useCallback((keyPath: string): string => {
    const keys = keyPath.split('.');
    let current: any = translations[language];
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to key if not found
        return keyPath;
      }
    }
    
    return typeof current === 'string' ? current : keyPath;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
