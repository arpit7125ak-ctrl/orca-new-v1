/**
 * @fileoverview Pre-translated Safety Advisory & Geofence String Resolver
 * @module i18n/index
 * @description
 * Section 66.2 & 66.3 (Deterministic Multilingual Rendering):
 * Resolves static, pre-translated text templates for geofence breaches and severe weather
 * alerts across supported Indian coastal languages without invoking an LLM.
 *
 * Safety & Fallback Principles:
 * - Determinism: Safety warnings must be offline-cacheable, instant (<1s), and identical
 *   in phrasing every single time.
 * - Honest Fallback Transparency: When a specific regional translation is missing,
 *   falls back to English while explicitly returning `fellBack: true` so the UI
 *   can disclose the fallback language to the user honestly.
 */

const geofenceWarnings = require('./templates/geofenceWarnings.json');
const alertMessages = require('./templates/alertMessages.json');
const { logger } = require('../observability/logger');

const DEFAULT_LANGUAGE = 'en';

/**
 * Fill {placeholders} in a template.
 * An unprovided placeholder is left as-is rather than replaced with "undefined",
 * which makes the omission visible in testing instead of shipping broken text.
 */
function fill(template, values = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] !== undefined && values[key] !== null ? String(values[key]) : match
  );
}

/**
 * Resolve a geofence warning message.
 *
 * @param {'clear'|'approaching'|'inside'} state
 * @param {string} language      ISO 639-1
 * @param {object} values        { layer, distance, direction }
 * @returns {{ message, languageUsed, fellBack }}
 */
function geofenceMessage(state, language, values = {}) {
  const bucket = geofenceWarnings[state];
  if (!bucket) {
    logger.warn({ state }, '[i18n] Unknown geofence state requested');
    return { message: null, languageUsed: null, fellBack: false };
  }

  const hasRequested = Boolean(bucket[language]);
  const languageUsed = hasRequested ? language : DEFAULT_LANGUAGE;
  const template = bucket[languageUsed];

  return {
    message: fill(template, values),
    languageUsed,
    fellBack: !hasRequested && language !== DEFAULT_LANGUAGE,
  };
}

/**
 * Resolve a localized layer name to substitute into {layer}.
 * Falls back to a readable version of the raw layer type rather than printing
 * a snake_case identifier at a fisherman.
 */
function layerName(layerType, language) {
  const bucket = geofenceWarnings._layer_names[layerType];
  if (!bucket) return layerType.replace(/_/g, ' ');
  return bucket[language] || bucket[DEFAULT_LANGUAGE] || layerType.replace(/_/g, ' ');
}

/**
 * Resolve an alert message.
 *
 * @param {string} alertType  one of ALERT_TYPES
 * @param {string} language
 * @param {object} values     { location, level, detail }
 */
function alertMessage(alertType, language, values = {}) {
  const templateKey = {
    high_wave: 'high_waves',
    strong_wind: 'adverse_weather',
    other_hazard: 'adverse_weather',
    swell_surge: 'high_waves',
    poor_visibility: 'adverse_weather',
    thunderstorm: 'lightning',
  }[alertType] || alertType;
  const bucket = alertMessages[templateKey] || alertMessages[alertType];
  if (!bucket) {
    logger.warn({ alertType }, '[i18n] Unknown alert type requested');
    return { message: null, languageUsed: null, fellBack: false };
  }

  const hasRequested = Boolean(bucket[language]);
  const languageUsed = hasRequested ? language : DEFAULT_LANGUAGE;

  // Localise the {level} word too, otherwise a Tamil sentence ends with the
  // English word "dangerous".
  const localisedValues = { ...values };
  if (values.level && alertMessages._levels[values.level]) {
    localisedValues.level =
      alertMessages._levels[values.level][languageUsed] ||
      alertMessages._levels[values.level][DEFAULT_LANGUAGE];
  }

  return {
    message: fill(bucket[languageUsed], localisedValues),
    languageUsed,
    fellBack: !hasRequested && language !== DEFAULT_LANGUAGE,
  };
}

module.exports = { geofenceMessage, alertMessage, layerName, fill, DEFAULT_LANGUAGE };
