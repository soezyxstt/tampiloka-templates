'use client';

import React, { createContext, useContext, useCallback, useEffect, useSyncExternalStore } from 'react';

type Language = 'id' | 'en';
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'id', setLanguage: () => {} });
let memoryChoice: Language | undefined;

function initialLanguage(): Language {
  const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lang');
  if (requested === 'id' || requested === 'en') return requested;
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
  window.addEventListener('popstate', notify);
  window.addEventListener('tampiloka-language-change', notify);
  return () => { window.removeEventListener('storage', sync); window.removeEventListener('popstate', notify); window.removeEventListener('tampiloka-language-change', notify); };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<Language>(subscribe, initialLanguage, () => 'id');
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const choose = (value: Language) => {
    memoryChoice = value;
    try { localStorage.setItem('tampiloka-language-choice', value); } catch { /* Keep the choice for this session. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('lang', value);
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event('tampiloka-language-change'));
  };
  return <LanguageContext.Provider value={{ language, setLanguage: choose }}>{children}</LanguageContext.Provider>;
}

export function useCafeLanguage() {
  const context = useContext(LanguageContext);
  const t = useCallback((id: string, en: string) => context.language === 'en' ? en : id, [context.language]);
  return { ...context, t };
}

export function LanguageToggle({ floating = false }: { floating?: boolean }) {
  const { language, setLanguage } = useCafeLanguage();
  return <button type="button" className={floating ? 'cafe-language-toggle tl-demo-language' : 'cafe-language-toggle min-h-11 px-3 border border-current rounded-md text-xs font-semibold whitespace-nowrap'} aria-label={language === 'id' ? 'Ganti bahasa ke Inggris' : 'Switch language to Indonesian'} onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}>{language === 'id' ? 'ID / EN' : 'EN / ID'}</button>;
}

