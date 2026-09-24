/**
 * ============================================================================
 * ORCA Speech Accessibility Utilities (src/utils/speech.js)
 * ============================================================================
 * Browser-native Web Speech API wrapper providing voice input (SpeechRecognition)
 * and advisory read-aloud (SpeechSynthesis) for Indian coastal fishermen.
 * 
 * Architectural Compliance (Architecture Spec §77):
 * - Bridges low-literacy barriers by allowing hands-free voice querying on rocking vessels.
 * - Supports 10 Canonical Indian Regional Languages (en-IN, hi-IN, bn-IN, ta-IN, te-IN,
 *   or-IN, mr-IN, ml-IN, kn-IN, gu-IN).
 * - Calibrated with a 0.95 playback rate for high intelligibility over marine ambient noise.
 */

/**
 * Mapping of ISO 639-1 language codes to canonical BCP 47 Indian speech locales.
 */
export const SPEECH_LOCALES = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  or: 'or-IN',
  mr: 'mr-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
  gu: 'gu-IN',
};

/**
 * Resolves the canonical BCP 47 speech locale for a given language code.
 * If 'auto' is supplied, inspects navigator.language and maps to the best Indian locale.
 * Defaults to 'en-IN' if unmapped.
 * 
 * @param {string} lang - Language code (e.g. 'ta', 'hi', or 'auto').
 * @returns {string} Standard BCP 47 locale string (e.g. 'ta-IN').
 */
export function localeFor(lang) {
  if (!lang || lang === 'auto') {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const nav = navigator.language.toLowerCase();
      // Check exact match (e.g. 'ta-in' or 'hi-in')
      for (const [code, locale] of Object.entries(SPEECH_LOCALES)) {
        if (nav === locale.toLowerCase() || nav.startsWith(code)) {
          return locale;
        }
      }
    }
    return 'en-IN';
  }
  return SPEECH_LOCALES[lang] || 'en-IN';
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

export function hasVoiceForLocale(locale) {
  if (!isSpeechSynthesisSupported()) return false;
  const voices = window.speechSynthesis.getVoices();
  const target = (locale || '').toLowerCase();
  return voices.some((v) => v.lang && v.lang.toLowerCase().replace('_', '-') === target);
}

/**
 * Text-to-speech output using the specific response language.
 * @param {string} text
 * @param {string} lang Language code (e.g. 'hi', 'ta') or locale (e.g. 'hi-IN')
 * @param {Function} [onVoiceMissing] Optional callback if no voice matches the locale
 */
export function speakText(text, lang = 'en', onVoiceMissing = null) {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis not supported in this browser.');
    return false;
  }

  window.speechSynthesis.cancel(); // stop any ongoing speech

  const targetLocale = localeFor(lang);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = targetLocale;
  utterance.rate = 0.95; // slightly slower for better maritime comprehension
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const matchingVoice = voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-') === targetLocale.toLowerCase());
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  } else if (voices.length > 0 && onVoiceMissing) {
    onVoiceMissing(targetLocale);
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speech-to-text recognition configured with the user's selected language.
 */
export function createSpeechRecognizer({ lang = 'auto', onResult, onError, onEnd }) {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const targetLocale = localeFor(lang);

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = targetLocale;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    onResult(transcript, event.results[0]?.isFinal);
  };

  recognition.onerror = (event) => {
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
}
