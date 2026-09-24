/**
 * @fileoverview Canonical Error Category Enumerations & AppError Class
 * @module errors/errorCategories
 * @description
 * Section 9 & `contracts/shared/ErrorInfo.json`:
 * Defines the standard error categories used by failed analyses, validation failures,
 * and upstream pipeline errors.
 *
 * Architecture Role:
 * - Contract Synchronization: Serves as the authoritative JavaScript representation
 *   of the schema enum specified in `contracts/shared/ErrorInfo.json`.
 * - Centralized Error Classification: `AppError` carries an `errorCategory` field,
 *   allowing the central error handler (`errorHandler.js`) to automatically derive
 *   appropriate HTTP status codes without controllers hard-coding status numbers.
 */

const ERROR_CATEGORIES = Object.freeze({
  INVALID_LOCATION:     'invalid_location',
  UNSUPPORTED_REGION:   'unsupported_region',
  UNRESOLVABLE_PLACE:   'unresolvable_place',
  UNSUPPORTED_TIME:     'unsupported_time',
  PLANNER_FAILURE:      'planner_failure',
  RISK_FAILURE:         'risk_failure',
  VALIDATION_FAILURE:   'validation_failure',
  UPSTREAM_UNAVAILABLE: 'upstream_unavailable',
  TIMEOUT:              'timeout',
  INTERNAL_ERROR:       'internal_error',
});

const ALL_ERROR_CATEGORIES = Object.freeze(Object.values(ERROR_CATEGORIES));

function isValidErrorCategory(value) {
  return ALL_ERROR_CATEGORIES.includes(value);
}

// ---------------------------------------------------------------------------
// AppError: the ONLY error type this codebase throws deliberately.
//
// Carrying error_category on the error object means the central errorHandler
// can map to an HTTP status without any route needing to know status codes.
// ---------------------------------------------------------------------------
class AppError extends Error {
  /**
   * @param {string} message        Human-readable, safe to send to the client.
   * @param {string} errorCategory  One of ERROR_CATEGORIES.
   * @param {object} [details]      Optional structured detail (e.g. Ajv errors).
   */
  constructor(message, errorCategory, details = null) {
    super(message);
    this.name = 'AppError';
    // Defensive: an unknown category becomes internal_error rather than
    // leaking an unmapped value into a response body.
    this.errorCategory = isValidErrorCategory(errorCategory)
      ? errorCategory
      : ERROR_CATEGORIES.INTERNAL_ERROR;
    this.details = details;
    // Marks this as "we meant to throw this" vs an unexpected crash.
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  ERROR_CATEGORIES,
  ALL_ERROR_CATEGORIES,
  isValidErrorCategory,
  AppError,
};
