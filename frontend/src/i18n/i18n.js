/**
 * ============================================================================
 * ORCA Multilingual Internationalization Engine (src/i18n/i18n.js)
 * ============================================================================
 * Configures i18next and react-i18next for complete coastal multilingual support.
 * 
 * Target User Base:
 * Indian artisanal fishermen, coastal vessel operators, and regional maritime authorities.
 * 
 * Supported Languages (10 total):
 * - en: English (default fallback)
 * - hi: Hindi (हिन्दी)
 * - bn: Bengali (বাংলা)
 * - ta: Tamil (தமிழ்)
 * - te: Telugu (తెలుగు)
 * - or: Odia (ଓଡ଼ିଆ)
 * - mr: Marathi (मराठी)
 * - ml: Malayalam (മലയാളം)
 * - kn: Kannada (ಕನ್ನಡ)
 * - gu: Gujarati (ગુજરાતી)
 * 
 * Detection & Sync Strategy:
 * 1. Checks localStorage ('ORCA_UI_LANG') for user's explicit preference.
 * 2. Falls back to navigator.language auto-detection.
 * 3. Syncs UI chrome dynamically when AI-Service returns an advisory in a detected language.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import JSON translation bundles for all 10 supported languages
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

/** Complete list of supported ISO 639-1 language codes */
const SUPPORTED_LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'or', 'mr', 'ml', 'kn', 'gu'];

/**
 * Translation resource map.
 * Each language provides the 'ui' namespace containing strings for all
 * navigation items, metrics, error banners, and form controls.
 */
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
