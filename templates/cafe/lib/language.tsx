'use client';

import React, { createContext, useContext, useCallback, useEffect, useSyncExternalStore } from 'react';

type Language = 'id' | 'en';
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'id', setLanguage: () => {} });
let memoryChoice: Language | undefined;

function initialLanguage(): Language {
  if (memoryChoice) return memoryChoice;
  try {
    const saved = localStorage.getItem('tampiloka-language-choice');
    if (saved === 'id' || saved === 'en') return saved;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().split('-')[0] === 'id' ? 'id' : 'en';
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => { if (event.key === 'tampiloka-language-choice') { memoryChoice = undefined; notify(); } };
  window.addEventListener('storage', sync);
  window.addEventListener('tampiloka-language-change', notify);
  return () => { window.removeEventListener('storage', sync); window.removeEventListener('tampiloka-language-change', notify); };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<Language>(subscribe, initialLanguage, () => 'id');
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const choose = (value: Language) => {
    memoryChoice = value;
    try { localStorage.setItem('tampiloka-language-choice', value); } catch { /* Keep the choice for this session. */ }
    window.dispatchEvent(new Event('tampiloka-language-change'));
  };
  return <LanguageContext.Provider value={{ language, setLanguage: choose }}>{children}</LanguageContext.Provider>;
}

export function useCafeLanguage() {
  const context = useContext(LanguageContext);
  const t = useCallback((id: string, en: string) => context.language === 'en' ? en : id, [context.language]);
  return { ...context, t };
}

export function LanguageToggle() {
  const { language, setLanguage } = useCafeLanguage();
  return <button type="button" className="cafe-language-toggle" style={{ minHeight: 36, padding: '0 9px', border: '1px solid currentColor', borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }} aria-label={language === 'id' ? 'Ganti bahasa ke Inggris' : 'Switch language to Indonesian'} onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}>{language === 'id' ? 'ID / EN' : 'EN / ID'}</button>;
}
