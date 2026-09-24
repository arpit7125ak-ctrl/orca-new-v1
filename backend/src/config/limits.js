/**
 * @fileoverview System Thresholds, Numerical Limits, and Operational Constants
 * @module config/limits
 * @description
 * Houses all domain-specific numerical limits, validation bounds, timeouts,
 * deduplication windows, pagination caps, and retry budgets for the ORCA backend.
 *
 * Design Guarantees:
 * - Eliminates scattered "magic numbers" across controllers, algorithms, and services.
 * - Centralizes tunability: items requiring runtime adjustment without code changes
 *   reference `process.env` defaults here, while immutable physical/mathematical
 *   bounds (e.g. latitude/longitude range) are frozen constants.
 */

const env = require('./env');

/**
 * Immutable operational limits and constants dictionary.
 * @type {Readonly<Record<string, number|string>>}
 */
module.exports = Object.freeze({
  // --- Input validation limits (Section 7) -------------------------------
  // Section 7.3: place name "must be within a configured maximum length".
  PLACE_NAME_MAX_LENGTH: 120,
  PLACE_NAME_MIN_LENGTH: 1,

  // Free-text query. Long enough for a multi-sentence question, short enough
  // that we are not shipping an essay to the LLM.
  QUERY_MAX_LENGTH: 1000,

  // Section 7.2: coordinate bounds. Hard-coded because they are physics,
  // not configuration.
  LAT_MIN: -90,
  LAT_MAX: 90,
  LON_MIN: -180,
  LON_MAX: 180,

  // --- Geofencing (Section 66) -------------------------------------------
  // Section 66.2: "approaching" = within GEOFENCE_WARNING_KM (example 5 km).
  // Read from env so it can be tuned live during the demo.
  GEOFENCE_WARNING_KM: parseFloat(process.env.GEOFENCE_WARNING_KM || '5'),

  // Section 66.3: "Repeated identical warnings are deduplicated for a
  // configurable period."
  GEOFENCE_DEDUP_WINDOW_MS: parseInt(process.env.GEOFENCE_DEDUP_WINDOW_MS || '600000', 10), // 10 min

  // Section 66.3: "Target response time is under 1 second." We cap the Mongo
  // geo query below that so we always have headroom to build the response.
  GEOFENCE_QUERY_TIMEOUT_MS: 800,

  // How far out we even bother looking for boundaries. Beyond this we return
  // `clear` without scanning every polygon in the DB.
  GEOFENCE_SEARCH_RADIUS_KM: 50,

  // --- Alerts (Section 99.6 / 99.7) --------------------------------------
  // Deduplication so a subscriber is not woken up 12 times for one storm.
  ALERT_DEDUP_WINDOW_MS: parseInt(process.env.ALERT_DEDUP_WINDOW_MS || '10800000', 10), // 3 h

  // How often the worker process wakes up to evaluate subscriptions.
  ALERT_SCHEDULER_CRON: process.env.ALERT_SCHEDULER_CRON || '*/30 * * * *', // every 30 min

  // Daily INCOIS PFZ satellite advisory synchronization cron (8:00 PM IST)
  PFZ_SYNC_CRON: process.env.PFZ_SYNC_CRON || '0 20 * * *',

  // --- AI Service call budget --------------------------------------------
  // Backend does NOT block on execution (Section 103: 202 Accepted), so this
  // timeout only covers the handoff POST itself, not the analysis.
  AI_SERVICE_HANDOFF_TIMEOUT_MS: 10000,
  AI_SERVICE_MAX_RETRIES: 2,

  // Internal token lifetime (Section 98: "signed short-lived token").
  INTERNAL_TOKEN_TTL_SECONDS: 120,

  // --- Pagination --------------------------------------------------------
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // --- Conversation history (Section 99.8) -------------------------------
  // How many prior turns we hand to the AI Service as context. Bounded so a
  // long conversation cannot blow the LLM context window.
  CHAT_CONTEXT_MAX_TURNS: 10,

  // --- Observability (Section 107) ---------------------------------------
  // Section 107: logs must never include "full GPS trails beyond what is
  // needed for geofence auditing". This caps how many positions we retain.
  GPS_TRAIL_MAX_POINTS: 50,

  // --- Rate limiting (mirrored from env for convenience) -----------------
  RATE_LIMIT_WINDOW_MS: env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: env.RATE_LIMIT_MAX_REQUESTS,
});
