/**
 * @fileoverview Role-Based Access Control (RBAC) & Identity Middleware
 * @module middleware/roleGuard
 * @description
 * Section 99.12 (User Personas & Role Hierarchy):
 * Enforces role-based permissions over standard maritime user roles:
 * - `fisherman`, `researcher`, `coastal_authority`, `disaster_management`,
 *   `maritime_operator`, `admin`.
 *
 * Operational Mode:
 * - Open-by-Default Demo Mode: When `REQUIRE_AUTH=false` (default), unauthenticated
 *   callers proceed as guest/anonymous to enable seamless evaluation.
 * - Closed-by-Default Production Mode: When `REQUIRE_AUTH=true`, missing credentials
 *   trigger HTTP 401 Unauthorized, and insufficient privileges yield HTTP 403 Forbidden.
 */

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
