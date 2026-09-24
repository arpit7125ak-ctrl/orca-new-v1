/**
 * @fileoverview Request Sanitization, NoSQL Anti-Injection & Input Normalization
 * @module middleware/sanitize
 * @description
 * Sections 7 & 10 (Defensive Data Cleansing):
 * Sanitizes all inbound HTTP request payloads before reaching database drivers or LLM agents.
 *
 * Dual-Threat Protection:
 * 1. NoSQL Injection Prevention: Recursively strips Mongo operator keys (prefixed with `$`)
 *    and nested dot paths (`.`) that could manipulate query logic.
 * 2. Prompt Injection & Control Character Scrubbing: Strips C0/C1 control characters while
 *    preserving non-Latin Indic scripts (Tamil, Bengali, Malayalam, Hindi, Gujarati, etc.).
 *    Enforces strict field-length caps defined in `config/limits.js`.
 */

const limits = require('../config/limits');


// Recursively strip keys that Mongo would interpret as operators.
function stripMongoOperators(value) {
  if (Array.isArray(value)) return value.map(stripMongoOperators);

  if (value !== null && typeof value === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(value)) {
      // $ = operator prefix. Dots enable nested-path traversal.
      if (key.startsWith('$') || key.includes('.')) continue;
      cleaned[key] = stripMongoOperators(val);
    }
    return cleaned;
  }

  return value;
}

/**
 * Clean a free-text string.
 * Deliberately NON-destructive to legitimate content: we do NOT strip
 * punctuation or non-Latin characters, because queries arrive in ten Indian
 * languages (Section 7.8) and mangling Tamil or Odia text would break the
 * core feature.
 */
function cleanText(text, maxLength) {
  if (typeof text !== 'string') return text;

  let cleaned = text
    // Remove C0/C1 control characters except tab/newline/carriage return.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Collapse runs of whitespace - a common way to pad an injection payload.
    .replace(/\s{3,}/g, ' ')
    .trim();

  if (maxLength && cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength);

  return cleaned;
}

// Fields that are free text and therefore get length-capped + cleaned.
const TEXT_FIELD_LIMITS = {
  query: limits.QUERY_MAX_LENGTH,
  message: limits.QUERY_MAX_LENGTH,
  place_name: limits.PLACE_NAME_MAX_LENGTH,
  origin_place_name: limits.PLACE_NAME_MAX_LENGTH,
  destination_place_name: limits.PLACE_NAME_MAX_LENGTH,
  display_name: limits.PLACE_NAME_MAX_LENGTH,
};

function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripMongoOperators(req.body);
    for (const [field, maxLen] of Object.entries(TEXT_FIELD_LIMITS)) {
      if (typeof req.body[field] === 'string') {
        req.body[field] = cleanText(req.body[field], maxLen);
      }
    }
  }

  // Query strings are always strings, so operators cannot be injected the same
  // way, but length-capping still applies.
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = cleanText(value, limits.QUERY_MAX_LENGTH);
      }
    }
  }

  next();
}

module.exports = sanitize;
module.exports.cleanText = cleanText;
module.exports.stripMongoOperators = stripMongoOperators;
