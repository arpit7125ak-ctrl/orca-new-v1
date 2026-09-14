// src/middleware/internalAuth.js
// ---------------------------------------------------------------------------
// Section 98 + Section 103: the internal channel between Backend and AI Service
// is protected by a SIGNED, SHORT-LIVED token.
//
// Section 102 explains why this matters: the Frontend must never reach the AI
// Service directly, and internal endpoints must never be callable from the
// public internet. This middleware guards /internal/v1/* on the Backend side.
//
// WHY HMAC-SIGNED JWT AND NOT A STATIC SHARED SECRET:
// A static bearer token, once leaked from a log or a proxy, is valid forever.
// A short-lived signed token (INTERNAL_TOKEN_TTL_SECONDS, default 120s) limits
// the blast radius to about two minutes. Both services sign with
// INTERNAL_SECRET, which never leaves the server environment.
// ---------------------------------------------------------------------------

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
