// src/errors/httpStatus.js
// ---------------------------------------------------------------------------
// Section 40: Status Code Design. This maps our internal error_category enum
// onto the HTTP status codes the spec prescribes, so no controller ever
// hard-codes a status number.
// ---------------------------------------------------------------------------

const { ERROR_CATEGORIES } = require('./errorCategories');

// Named constants so code reads as intent, not numbers.
const HTTP = Object.freeze({
  OK: 200,                    // Success
  CREATED: 201,               // Resource created synchronously (e.g. subscription)
  ACCEPTED: 202,              // Analysis accepted for async execution
  PARTIAL_CONTENT: 206,       // Partial result available
  BAD_REQUEST: 400,           // Malformed input
  UNAUTHORIZED: 401,          // Auth missing/invalid
  FORBIDDEN: 403,             // Not permitted
  NOT_FOUND: 404,             // Resource does not exist
  CONFLICT: 409,              // Conflicting state (e.g. duplicate subscription)
  UNPROCESSABLE_ENTITY: 422,  // Structurally valid, semantically invalid
  TOO_MANY_REQUESTS: 429,     // Rate limited
  INTERNAL_SERVER_ERROR: 500, // Unexpected internal failure
  BAD_GATEWAY: 502,           // Upstream AI/data service failure
  SERVICE_UNAVAILABLE: 503,   // Required service unavailable
  GATEWAY_TIMEOUT: 504,       // Upstream did not respond in time
});

// ---------------------------------------------------------------------------
// The mapping itself.
//
// NOTE on 422 vs 400 - Section 40 is explicit about the difference:
//   400 = MALFORMED input (wrong shape, wrong type, missing field)
//   422 = structurally valid but SEMANTICALLY invalid, and it names exactly
//         these examples: unsupported marine location, unresolvable place,
//         time window beyond forecast horizon.
//
// That is why unsupported_region / unresolvable_place / unsupported_time map
// to 422 while validation_failure maps to 400.
//
// invalid_location maps to 400, not 422, because Section 7.2 treats it as a
// RANGE check: a latitude of 200 is nonsense, not "valid but unsupported".
// ---------------------------------------------------------------------------
const CATEGORY_TO_STATUS = Object.freeze({
  // Structural / caller's fault - malformed
  [ERROR_CATEGORIES.VALIDATION_FAILURE]:   HTTP.BAD_REQUEST,
  [ERROR_CATEGORIES.INVALID_LOCATION]:     HTTP.BAD_REQUEST,

  // Semantically invalid - the three examples Section 40 names explicitly
  [ERROR_CATEGORIES.UNSUPPORTED_REGION]:   HTTP.UNPROCESSABLE_ENTITY,
  [ERROR_CATEGORIES.UNRESOLVABLE_PLACE]:   HTTP.UNPROCESSABLE_ENTITY,
  [ERROR_CATEGORIES.UNSUPPORTED_TIME]:     HTTP.UNPROCESSABLE_ENTITY,

  // Upstream (AI Service / data providers) problems
  [ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE]: HTTP.BAD_GATEWAY,
  [ERROR_CATEGORIES.TIMEOUT]:              HTTP.GATEWAY_TIMEOUT,

  // Our own pipeline failed
  [ERROR_CATEGORIES.PLANNER_FAILURE]:      HTTP.INTERNAL_SERVER_ERROR,
  [ERROR_CATEGORIES.RISK_FAILURE]:         HTTP.INTERNAL_SERVER_ERROR,
  [ERROR_CATEGORIES.INTERNAL_ERROR]:       HTTP.INTERNAL_SERVER_ERROR,
});

/**
 * Map an error_category to its HTTP status.
 * Unknown categories deliberately fall back to 500 rather than guessing.
 */
function statusForCategory(errorCategory) {
  return CATEGORY_TO_STATUS[errorCategory] || HTTP.INTERNAL_SERVER_ERROR;
}

/**
 * Section 9 + Section 40: map an analysis lifecycle state to the status code
 * used when RETURNING that analysis.
 *
 *   completed      -> 200
 *   partial        -> 206 Partial Content
 *   queued/running -> 200 (the poll itself succeeded; body carries progress)
 *   failed         -> resolved from the stored error_category instead
 */
function statusForAnalysisState(state, errorCategory) {
  switch (state) {
    case 'completed': return HTTP.OK;
    case 'partial':   return HTTP.PARTIAL_CONTENT;
    case 'queued':
    case 'running':   return HTTP.OK;
    case 'failed':    return statusForCategory(errorCategory);
    default:          return HTTP.OK;
  }
}

module.exports = { HTTP, CATEGORY_TO_STATUS, statusForCategory, statusForAnalysisState };
