/**
 * @fileoverview Express Rate Limiting Policies for Public Endpoints
 * @module middleware/rateLimit
 * @description
 * Section 40 (HTTP 429 Rate Limiting):
 * Distributes inbound traffic across 3 differentiated rate limiter policies
 * aligned with resource cost and maritime safety criticality:
 *
 * Policies:
 * - `generalLimiter`: Standard read endpoints (cached routes, static catalog).
 * - `analysisLimiter`: High-compute analysis triggers (spawns multi-agent AI execution).
 * - `geofenceLimiter`: GPS telemetry monitoring. Highly permissive because throttling
 *   live boundary warnings would pose immediate navigational hazards to fishermen.
 */

const rateLimit = require('express-rate-limit');
const limits = require('../config/limits');
const { HTTP } = require('../errors/httpStatus');
const { ERROR_CATEGORIES } = require('../errors/errorCategories');

// Shared 429 body. Matches the standard error envelope used by errorHandler so
// the Frontend has exactly one error shape to parse.
function rateLimitHandler(req, res) {
  res.status(HTTP.TOO_MANY_REQUESTS).json({
    success: false,
    error: {
      message: 'Too many requests. Please slow down and try again shortly.',
      error_category: ERROR_CATEGORIES.INTERNAL_ERROR,
      retry_after_seconds: Math.ceil(limits.RATE_LIMIT_WINDOW_MS / 1000),
    },
  });
}

const commonOptions = {
  standardHeaders: true, // RateLimit-* headers so clients can self-throttle
  legacyHeaders: false,
  handler: rateLimitHandler,
};

const generalLimiter = rateLimit({
  ...commonOptions,
  windowMs: limits.RATE_LIMIT_WINDOW_MS,
  max: limits.RATE_LIMIT_MAX_REQUESTS,
});

// Analysis is expensive: one request fans out to multiple agents and LLM calls.
const analysisLimiter = rateLimit({
  ...commonOptions,
  windowMs: limits.RATE_LIMIT_WINDOW_MS,
  max: Math.max(5, Math.floor(limits.RATE_LIMIT_MAX_REQUESTS / 5)),
  message: 'Too many analysis requests.',
});

// Geofence: cheap (pure geometry, no LLM - Section 66.3) and safety-critical.
const geofenceLimiter = rateLimit({
  ...commonOptions,
  windowMs: limits.RATE_LIMIT_WINDOW_MS,
  max: limits.RATE_LIMIT_MAX_REQUESTS * 3,
});

module.exports = { generalLimiter, analysisLimiter, geofenceLimiter };
