// src/errors/errorCategories.js
// ---------------------------------------------------------------------------
// Section 9: every `failed` analysis stores an `error_category`. This file is
// the authoritative JS mirror of that enum. It MUST stay in sync with
// contracts/shared/ErrorInfo.json - the contract is the source of truth, this
// is the convenience constant used by code.
// ---------------------------------------------------------------------------

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
