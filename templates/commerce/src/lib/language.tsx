import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import translations from './translations.json';
import samples from './sample-translations.json';
import errors from './error-translations.json';

type Language = 'id' | 'en';
const storageKey = 'tampiloka-language-choice';
let activeLanguage: Language = 'en';
let demoContent = false;
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: 'en', setLanguage: () => {} });

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'id' || saved === 'en') return saved;
  } catch { /* Browser storage can be unavailable. */ }
  return navigator.language.toLowerCase().split('-')[0] === 'id' ? 'id' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  activeLanguage = language;
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = (next: Language) => {
    activeLanguage = next;
    try { localStorage.setItem(storageKey, next); } catch { /* Selection still works for this session. */ }
    setLanguageState(next);
  };
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }
export function setDemoContent(demo: boolean) { demoContent = demo; }
export function sampleText(value: string): string {
  return demoContent && activeLanguage === 'en' ? (samples as Record<string, string>)[value] || value : value;
}
export function currentLocale() { return activeLanguage === 'id' ? 'id-ID' : 'en-US'; }
export function choose(indonesian: string, english: string) { return activeLanguage === 'id' ? indonesian : english; }
export function errorText(code: string, message: string) {
  if (activeLanguage === 'id') return message;
  const translated = (errors as Record<string, string>)[code];
  if (!translated) return message;
  return /^(INVALID_|GATEWAY_ERROR|COUPON_MIN_SPEND|OUT_OF_STOCK|PRICE_CHANGED)/.test(code) ? `${translated} (${message})` : translated;
}

export function t(text: string): string {
  if (activeLanguage === 'id') return text;
  const trimmed = text.trim();
  const translated = (translations as Record<string, string>)[trimmed];
  return translated ? text.replace(trimmed, translated) : text;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <button type="button" className="language-toggle" aria-label={language === 'id' ? 'Ubah bahasa ke Inggris' : 'Switch language to Indonesian'} onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}>{language === 'id' ? 'ID / EN' : 'EN / ID'}</button>;
}
