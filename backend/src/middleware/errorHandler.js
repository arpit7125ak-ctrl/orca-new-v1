// src/middleware/errorHandler.js
// ---------------------------------------------------------------------------
// The single place an error becomes an HTTP response.
//
// Express identifies error middleware by ARITY - it must take exactly four
// arguments (err, req, res, next). Removing the unused `next` parameter would
// silently turn this into ordinary middleware and every error would hang.
// That is why `next` is present but unused.
//
// Every error response uses one envelope so the Frontend parses one shape:
//   { success: false, error: { message, error_category, details?, request_id } }
// ---------------------------------------------------------------------------

const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { HTTP, statusForCategory } = require('../errors/httpStatus');
const { logger } = require('../observability/logger');
const env = require('../config/env');
const { generatePrefixedId } = require('../utils/ids');

/**
 * Attach a request ID to every request for cross-service tracing.
 * Honours an inbound X-Request-Id so a Frontend-generated ID survives the hop.
 */
function requestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || generatePrefixedId('rq');
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/** 404 handler. Mounted AFTER all routes, BEFORE errorHandler. */
function notFound(req, res, next) {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    ERROR_CATEGORIES.INTERNAL_ERROR
  );
  error.httpStatusOverride = HTTP.NOT_FOUND;
  next(error);
}

// Translate well-known third-party errors into our own categories, so a
// Mongoose or Ajv failure does not surface as an opaque 500.
function classifyError(err) {
  // Mongoose: bad ObjectId / cast failure => malformed input
  if (err.name === 'CastError') {
    return { category: ERROR_CATEGORIES.VALIDATION_FAILURE, status: HTTP.BAD_REQUEST };
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    return { category: ERROR_CATEGORIES.VALIDATION_FAILURE, status: HTTP.BAD_REQUEST };
  }

  // MongoDB duplicate key => 409 Conflict (Section 40: "duplicate subscription")
  if (err.code === 11000) {
    return { category: ERROR_CATEGORIES.VALIDATION_FAILURE, status: HTTP.CONFLICT };
  }

  // express.json() malformed-body error
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return { category: ERROR_CATEGORIES.VALIDATION_FAILURE, status: HTTP.BAD_REQUEST };
  }

  // CORS rejection from middleware/cors.js
  if (err.message && err.message.includes('not allowed by CORS')) {
    return { category: ERROR_CATEGORIES.VALIDATION_FAILURE, status: HTTP.FORBIDDEN };
  }

  // Outbound call failures (axios) => the AI Service or a data source is down
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return { category: ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE, status: HTTP.BAD_GATEWAY };
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    return { category: ERROR_CATEGORIES.TIMEOUT, status: HTTP.GATEWAY_TIMEOUT };
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let errorCategory;
  let statusCode;
  let message;
  let details = null;

  if (err instanceof AppError) {
    errorCategory = err.errorCategory;
    // httpStatusOverride lets a specific case (401/403/404/409) win over the
    // category's default mapping without polluting the category enum.
    statusCode = err.httpStatusOverride || statusForCategory(err.errorCategory);
    message = err.message;
    details = err.details;
  } else {
    const classified = classifyError(err);
    if (classified) {
      errorCategory = classified.category;
      statusCode = classified.status;
      message = err.message;
      // Surface Mongoose field-level errors - genuinely useful in Postman.
      if (err.name === 'ValidationError' && err.errors) {
        details = Object.entries(err.errors).map(([field, e]) => ({
          field,
          message: e.message,
        }));
      }
    } else {
      // Truly unexpected. Section 40: 500.
      errorCategory = ERROR_CATEGORIES.INTERNAL_ERROR;
      statusCode = HTTP.INTERNAL_SERVER_ERROR;
      // NEVER leak an internal error message to the client in production - it
      // can expose file paths, driver internals or query structure.
      message = env.isProduction
        ? 'An unexpected internal error occurred.'
        : err.message;
    }
  }

  // 5xx is our fault and gets a stack trace; 4xx is the caller's and is logged
  // at warn without the noise.
  const logPayload = {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status_code: statusCode,
    error_category: errorCategory,
    err: err.message,
  };

  if (statusCode >= 500) {
    logger.error({ ...logPayload, stack: err.stack }, '[error] Request failed');
  } else {
    logger.warn(logPayload, '[error] Request rejected');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      error_category: errorCategory,
      ...(details ? { details } : {}),
      request_id: req.requestId,
      // Stack only outside production, and only for genuine 500s.
      ...(!env.isProduction && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
module.exports.requestId = requestId;
module.exports.notFound = notFound;
