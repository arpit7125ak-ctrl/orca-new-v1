// src/observability/logger.js
// ---------------------------------------------------------------------------
// Section 107: Observability.
//
// Logs MUST include: analysis_id, agent/stage, status, status code, start/end
// time, duration, selected agents, skipped agents with reasons, failed agents
// with error_category, retry counts, constraint floors applied.
//
// Logs MUST NEVER include: API keys, passwords, private credentials, or full
// GPS trails beyond what geofence auditing needs.
//
// The redaction list below is the enforcement of that second rule. It is
// applied by pino at serialisation time, so a secret cannot leak even if some
// future code accidentally logs an entire request object.
// ---------------------------------------------------------------------------

const pino = require('pino');
const env = require('../config/env');
const limits = require('../config/limits');

// ---------------------------------------------------------------------------
// Redaction paths (Section 107).
// pino replaces these with "[REDACTED]" wherever they appear at these paths.
// Wildcards (*) cover both req.headers and res.headers style nesting.
// ---------------------------------------------------------------------------
const REDACT_PATHS = [
  // Auth material
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-token"]',
  'headers.authorization',
  'headers["x-internal-token"]',

  // Credentials anywhere in a logged body
  '*.password',
  '*.api_key',
  '*.apiKey',
  '*.token',
  '*.secret',
  '*.jwt',
  'password',
  'api_key',
  'apiKey',
  'token',
  'secret',

  // Project-specific secrets from env.js
  '*.INTERNAL_SECRET',
  '*.JWT_SECRET',
  '*.MONGO_URI',
  '*.BHASHINI_API_KEY',
  '*.VAPID_PRIVATE_KEY',
];

const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },

  // Human-readable timestamps in dev; epoch millis in production for
  // log-aggregation tools.
  timestamp: pino.stdTimeFunctions.isoTime,

  base: { service: 'orca-backend', env: env.NODE_ENV },

  // Pretty-print locally so the terminal is readable during the hackathon.
  // In production, raw JSON is correct - do not pretty-print there.
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

/**
 * Section 107: "Logs never include full GPS trails beyond what is needed for
 * geofence auditing."
 *
 * Truncates a position array to the configured cap and records how many were
 * dropped, so an audit can still see that data existed without us retaining
 * a complete movement history of a fisherman.
 */
function capGpsTrail(positions) {
  if (!Array.isArray(positions)) return positions;
  if (positions.length <= limits.GPS_TRAIL_MAX_POINTS) return positions;
  return {
    _truncated: true,
    _original_count: positions.length,
    _retained_count: limits.GPS_TRAIL_MAX_POINTS,
    positions: positions.slice(-limits.GPS_TRAIL_MAX_POINTS), // keep most recent
  };
}

/**
 * Create a child logger bound to one analysis.
 *
 * Every subsequent log line automatically carries analysis_id, which is what
 * makes a single request traceable end-to-end across Backend, worker and the
 * AI Service callbacks (Section 8.1).
 */
function forAnalysis(analysisId, extra = {}) {
  return logger.child({ analysis_id: analysisId, ...extra });
}

/** Child logger for a named stage/agent - satisfies the "agent/stage" field. */
function forStage(stage, extra = {}) {
  return logger.child({ stage, ...extra });
}

module.exports = { logger, forAnalysis, forStage, capGpsTrail, REDACT_PATHS };
