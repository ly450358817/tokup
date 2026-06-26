import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, TranslationKeys, getTranslations, LANGUAGES, LangOption } from '../i18n';

interface LanguageContextType {
  lang: Lang;
  t: TranslationKeys;
  setLang: (l: Lang) => void;
  languages: LangOption[];
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    const saved = localStorage.getItem('tokup_lang') as Lang | null;
    if (saved && ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru'].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('tokup_lang', l);
  };

  const t = getTranslations(lang);

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
