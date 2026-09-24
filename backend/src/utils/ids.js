/**
 * @fileoverview Domain Entity ID Generators & Regex Validators
 * @module utils/ids
 * @description
 * Section 8.1 (Analysis Identifiers & Deduplication):
 * Generates and validates unique, traceable entity IDs across the ORCA ecosystem.
 *
 * Locked ID Standards:
 * - `analysis_id`: Formatted as `req_{YYYYMMDD}_{HHMM}_{hash6}` (e.g. `req_20260912_0915_f4e9d1`).
 *   Constructed from the UTC timestamp of request receipt to avoid dependency on
 *   unresolved future target time windows.
 * - Prefixed Entity IDs: Generates collision-resistant identifiers for conversations
 *   (`conv_*`), routes (`route_*`), reports (`rep_*`), and alerts (`sub_*`).
 * - Deterministic Dedup Keys: Creates SHA-256 hashes of semantic parameters to prevent
 *   duplicate alert dispatching and geofence spam (Section 66.3 & 99.7).
 */

const crypto = require('crypto');


/** Zero-pad a number to 2 digits (e.g. 9 -> "09"). */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Generate a new analysis_id.
 *
 * @param {Date} [receivedAt] Request-receipt time. Defaults to now (UTC).
 * @returns {string} e.g. "req_20260912_0915_f4e9d1"
 */
function generateAnalysisId(receivedAt = new Date()) {
  // --- date part: YYYYMMDD, UTC ---
  const yyyy = receivedAt.getUTCFullYear();
  const mm = pad2(receivedAt.getUTCMonth() + 1); // getUTCMonth() is 0-indexed
  const dd = pad2(receivedAt.getUTCDate());
  const datePart = `${yyyy}${mm}${dd}`;

  // --- time part: HHMM, UTC (minute resolution, per the locked format) ---
  const hh = pad2(receivedAt.getUTCHours());
  const mi = pad2(receivedAt.getUTCMinutes());
  const timePart = `${hh}${mi}`;

  // --- hash part: 6 hex chars of cryptographic randomness ---------------
  // The format only gives minute resolution, so many requests can share the
  // same date+time prefix. The hash is what actually guarantees uniqueness.
  // 6 hex chars = 16.7M possibilities within any given minute; combined with
  // the unique index on analysis_id in Mongo, a collision is caught rather
  // than silently overwriting.
  const hash6 = crypto.randomBytes(3).toString('hex'); // 3 bytes -> 6 hex chars

  return `req_${datePart}_${timePart}_${hash6}`;
}

// Exact-match validator for the locked format. Used by request validation on
// any endpoint that accepts an analysis_id as a path parameter, so a malformed
// ID is rejected as 400 before it ever reaches a database query.
// Pattern comes from contracts/api/AnalysisExecutionRequest.json: [a-z0-9]{6}.
// Our generator emits hex, which is a strict subset - but the validator must
// accept the full contract range, or a legitimate ID from another service
// would be rejected as malformed.
const ANALYSIS_ID_PATTERN = /^req_\d{8}_\d{4}_[a-z0-9]{6}$/;

function isValidAnalysisId(value) {
  return typeof value === 'string' && ANALYSIS_ID_PATTERN.test(value);
}

/**
 * Generic prefixed ID for entities whose format Section 8.1 does NOT lock
 * (conversations, routes, reports, subscriptions). Kept visually distinct from
 * analysis_id so the two are never confused in a log line.
 *
 * @param {string} prefix e.g. "conv", "route", "rep", "sub"
 */
function generatePrefixedId(prefix) {
  const random = crypto.randomBytes(6).toString('hex'); // 12 hex chars
  return `${prefix}_${random}`;
}

/**
 * Deterministic deduplication key.
 *
 * Section 66.3 (geofence) and Section 99.7 (alerts) both require that repeated
 * identical warnings are deduplicated. "Identical" must be reproducible across
 * processes, so the key is a hash of the semantic parts - NOT random.
 *
 * @param {...(string|number|null|undefined)} parts
 * @returns {string} 16 hex chars
 */
function generateDedupKey(...parts) {
  // null/undefined are normalised to the literal "null" so that a missing
  // field is stable rather than shifting the hash between calls.
  const normalised = parts.map((p) => (p === null || p === undefined ? 'null' : String(p)));
  return crypto.createHash('sha256').update(normalised.join('|')).digest('hex').slice(0, 16);
}

module.exports = {
  generateAnalysisId,
  isValidAnalysisId,
  ANALYSIS_ID_PATTERN,
  generatePrefixedId,
  generateDedupKey,
};
