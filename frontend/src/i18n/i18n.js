/**
 * frontend/src/i18n/i18n.js
 *
 * i18next initialization.
 * Languages supported: en hi bn ta te or mr ml kn gu
 *
 * When selectedLang === 'auto', i18next-browser-languagedetector reads
 * navigator.language and picks the best match from the supported set.
 * After an analysis completes with a response_language, App.jsx calls
 * i18next.changeLanguage(response_language) to sync UI chrome to the
 * language the LLM answered in.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import or_locale from './locales/or.json';
import mr from './locales/mr.json';
import ml from './locales/ml.json';
import kn from './locales/kn.json';
import gu from './locales/gu.json';

const SUPPORTED_LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'or', 'mr', 'ml', 'kn', 'gu'];

// All 10 supported Indic and English locale bundles
const resources = {
  en: { ui: en },
  hi: { ui: hi },
  bn: { ui: bn },
  ta: { ui: ta },
  te: { ui: te },
  or: { ui: or_locale },
  mr: { ui: mr },
  ml: { ui: ml },
  kn: { ui: kn },
  gu: { ui: gu },
};

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'ui',
    ns: ['ui'],
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS,
    // LanguageDetector order: localStorage first, then browser
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ORCA_UI_LANG',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18next;
export { SUPPORTED_LANGS };
