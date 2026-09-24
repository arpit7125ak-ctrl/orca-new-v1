/**
 * @fileoverview Internal Service-to-Service HMAC JWT Authentication Guard
 * @module middleware/internalAuth
 * @description
 * Sections 98, 102 & 103 (Internal Security Perimeter):
 * Protects communication channels between the Node.js backend and the Python AI service
 * using short-lived (120s TTL) HMAC-SHA256 signed JWT tokens.
 *
 * Security Principles:
 * - Isolation: Internal endpoints (`/internal/v1/*`) are never accessible from the public internet.
 * - Anti-Replay: Uses short-lived tokens rather than static API keys to strictly limit
 *   the blast radius of any transient token interception.
 * - Bidirectional Verification: Verifies expected `issuer` and `audience` claims between
 *   `orca-backend` and `orca-ai-service`.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const limits = require('../config/limits');
const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { HTTP } = require('../errors/httpStatus');
const { logger } = require('../observability/logger');

const TOKEN_HEADER = 'x-internal-token';
const ISSUER_BACKEND = 'orca-backend';
const ISSUER_AI_SERVICE = 'orca-ai-service';

/**
 * Mint a token for OUTBOUND calls (Backend -> AI Service POST /v1/analysis/execute).
 * @param {object} [payload] e.g. { analysis_id }
 */
function issueInternalToken(payload = {}) {
  return jwt.sign(
    { ...payload, iss: ISSUER_BACKEND, aud: ISSUER_AI_SERVICE },
    env.INTERNAL_SECRET,
    { expiresIn: limits.INTERNAL_TOKEN_TTL_SECONDS, algorithm: 'HS256' }
  );
}

/**
 * Express middleware guarding INBOUND internal calls
 * (AI Service -> Backend /internal/v1/progress and /internal/v1/result).
 */
function internalAuth(req, res, next) {
  const rawHeader = req.headers[TOKEN_HEADER] || req.headers.authorization;

  if (!rawHeader) {
    logger.warn(
      { path: req.path, ip: req.ip },
      '[internalAuth] Rejected internal call with no token'
    );
    // 401, not the validation_failure default of 400 - a missing token and an
    // invalid/expired one (handled below) are the same underlying problem,
    // "you are not authenticated", and must report the same status. Caught by
    // live testing: this branch was returning 400 while the catch block below
    // correctly returned 401 for the same category of failure.
    const error = new AppError(
      'Internal authentication token is required for this endpoint.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
    error.httpStatusOverride = HTTP.UNAUTHORIZED;
    return next(error);
  }

  // Accept both "Bearer <token>" and a bare token.
  const token = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7) : rawHeader;

  try {
    const decoded = jwt.verify(token, env.INTERNAL_SECRET, {
      algorithms: ['HS256'], // pin the algorithm - prevents alg=none attacks
      // Inbound calls come FROM the AI Service TO the Backend, so the expected
      // issuer/audience are the reverse of issueInternalToken().
      issuer: ISSUER_AI_SERVICE,
      audience: ISSUER_BACKEND,
    });

    req.internalCaller = decoded;
    return next();
  } catch (err) {
    // Distinguish expiry from forgery: expiry is usually clock skew or a slow
    // retry (recoverable); a bad signature is a real security event.
    const isExpired = err.name === 'TokenExpiredError';

    logger.warn(
      { path: req.path, ip: req.ip, reason: err.name },
      isExpired
        ? '[internalAuth] Internal token expired'
        : '[internalAuth] Internal token verification FAILED'
    );

    const error = new AppError(
      isExpired
        ? 'Internal token has expired. Re-issue and retry.'
        : 'Internal token is invalid.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
    // 401 rather than the default 400 for this category - the caller is
    // unauthenticated, not malformed.
    error.httpStatusOverride = HTTP.UNAUTHORIZED;
    return next(error);
  }
}

module.exports = internalAuth;
module.exports.issueInternalToken = issueInternalToken;
module.exports.TOKEN_HEADER = TOKEN_HEADER;
module.exports.ISSUER_BACKEND = ISSUER_BACKEND;
module.exports.ISSUER_AI_SERVICE = ISSUER_AI_SERVICE;
