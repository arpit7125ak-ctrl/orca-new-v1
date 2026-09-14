// src/middleware/roleGuard.js
// ---------------------------------------------------------------------------
// Role-based access control over the roles enumerated in Section 99.12:
//   fisherman | researcher | coastal_authority | disaster_management |
//   maritime_operator | admin
//
// STATUS: PROPOSED. Section 103 defines no auth endpoints, so the surrounding
// auth module is flagged PROPOSED. This middleware is written so that when auth
// is turned on it is a one-line change per route, and is a no-op until then.
//
// OPEN-BY-DEFAULT DESIGN DECISION:
// If no JWT is present, requests are allowed through as anonymous. That is
// correct for a hackathon demo where a judge must be able to try the API
// without signing up. Set REQUIRE_AUTH=true in .env to flip to closed-by-default.
// ---------------------------------------------------------------------------

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { HTTP } = require('../errors/httpStatus');

const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

/**
 * Attach req.user if a valid Bearer token is present. Never rejects on its own -
 * it only populates identity. Enforcement is roleGuard's job.
 */
function attachUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    // An invalid token is treated as anonymous rather than an error, so a stale
    // token in a browser does not hard-block public endpoints.
    req.user = null;
  }
  return next();
}

/**
 * Require the caller to hold one of the given roles.
 * @param {...string} allowedRoles
 */
function roleGuard(...allowedRoles) {
  return function guard(req, res, next) {
    if (!req.user) {
      if (!REQUIRE_AUTH) return next(); // demo mode: anonymous allowed
      const error = new AppError('Authentication required.', ERROR_CATEGORIES.VALIDATION_FAILURE);
      error.httpStatusOverride = HTTP.UNAUTHORIZED;
      return next(error);
    }

    // admin always passes - avoids having to list it on every route.
    if (req.user.role === 'admin') return next();

    if (!allowedRoles.includes(req.user.role)) {
      const error = new AppError(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}.`,
        ERROR_CATEGORIES.VALIDATION_FAILURE
      );
      error.httpStatusOverride = HTTP.FORBIDDEN; // 403: authenticated but not permitted
      return next(error);
    }

    return next();
  };
}

module.exports = roleGuard;
module.exports.attachUser = attachUser;
module.exports.REQUIRE_AUTH = REQUIRE_AUTH;
