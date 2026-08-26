import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import { ko } from './ko';

export type Lang = 'en' | 'zh' | 'ja' | 'ko';
export type TranslationKeys = typeof en;

const translations: Record<Lang, TranslationKeys> = { en, zh, ja, ko };

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function getTranslations(lang: Lang): TranslationKeys {
  if (lang === 'en') return translations.en;
  // Fall back to English for any missing keys
  return deepMerge(translations.en, translations[lang] || {}) as TranslationKeys;
}

export interface LangOption {
  code: Lang;
  label: string;
  flag: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

export { en, zh, ja, ko };
