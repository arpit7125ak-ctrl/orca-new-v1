// src/modules/analysis/analysis.validator.js
// ---------------------------------------------------------------------------
// Section 7: Stage 2 - Backend Validation. STRUCTURAL only.
//
// FIELD NAMES COME FROM contracts/AnalysisRequest.json, which is the locked
// source of truth. Note especially:
//   coordinate: { lat, lon }      <- nested object, NOT flat lat/lon
//   time_range: { start, end }    <- nested, NOT start_time/end_time
//   language_override             <- NOT "language"
//   origin / destination          <- { place_name, coordinate: {lat,lon} }
//
// The contract is `additionalProperties: false`, so any field not listed there
// is rejected outright. That is why there is no `overnight` or
// `utc_offset_minutes` here - neither exists in the contract.
//
// Section 7.10 - what the Backend must NOT decide:
//   - whether a place is marine or land
//   - whether a region is supported
//   - whether a coastal place should be snapped
//   - what "tomorrow morning" means
// All four belong to the Planner. Hence no geocoding, no land/sea mask and no
// natural-language date parsing in this file.
//
// Returning a LIST of problems (rather than throwing on the first) means a
// caller fixing their request in Postman sees every issue at once.
// ---------------------------------------------------------------------------

const registry = require('../../config/registry');
const limits = require('../../config/limits');
const { validateCoordinates } = require('../../utils/geo');
const { isValidIsoDate, validateTimeRange } = require('../../utils/time');
const { ERROR_CATEGORIES } = require('../../errors/errorCategories');

/**
 * Validate a coordinate object of the contract's shape: { lat, lon }.
 * The contract marks both required and `additionalProperties: false`.
 */
function checkCoordinateObject(coordinate, fieldPath, errors) {
  if (typeof coordinate !== 'object' || Array.isArray(coordinate)) {
    errors.push({ field: fieldPath, message: `${fieldPath} must be an object of the form { lat, lon }.` });
    return ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  const { lat, lon } = coordinate;

  if (lat === undefined || lat === null || lon === undefined || lon === null) {
    // The contract requires BOTH. A lone latitude is meaningless, and silently
    // ignoring it could analyse a completely different place.
    errors.push({ field: fieldPath, message: `${fieldPath} requires both lat and lon.` });
    return ERROR_CATEGORIES.INVALID_LOCATION;
  }

  const check = validateCoordinates(Number(lat), Number(lon));
  if (!check.valid) {
    errors.push({ field: `${fieldPath}.lat/lon`, message: check.reason });
    return ERROR_CATEGORIES.INVALID_LOCATION;
  }

  return null;
}

/**
 * Validate an inbound analysis request against contracts/AnalysisRequest.json.
 *
 * @returns {{ valid, errors, errorCategory, isOvernight }}
 */
function validateAnalysisRequest(body = {}) {
  const errors = [];

  // Tracks the MOST SPECIFIC category found, so the HTTP status is accurate.
  // A bad coordinate should surface as invalid_location (400), not a generic
  // validation_failure - the category is what the Frontend branches on.
  let errorCategory = null;
  let isOvernight = false;

  // --- 7.1 Minimum input -------------------------------------------------
  // The contract expresses this as `anyOf` over query / coordinate / place_name.
  const hasQuery = typeof body.query === 'string' && body.query.trim().length > 0;
  const hasCoordinate = body.coordinate !== undefined && body.coordinate !== null;
  const hasPlaceName = typeof body.place_name === 'string' && body.place_name.trim().length > 0;

  if (!hasQuery && !hasCoordinate && !hasPlaceName) {
    errors.push({
      field: '(root)',
      message: 'At least one of query, coordinate { lat, lon }, or place_name is required.',
    });
    errorCategory = ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  // --- 7.2 Coordinate ----------------------------------------------------
  if (hasCoordinate) {
    const category = checkCoordinateObject(body.coordinate, 'coordinate', errors);
    if (category) errorCategory = category;
  }

  // Catch the common mistake of sending flat lat/lon. Without this the request
  // fails the contract with an opaque "additionalProperties" error.
  if (body.lat !== undefined || body.lon !== undefined) {
    errors.push({
      field: 'lat/lon',
      message: 'Coordinates go in a nested object: "coordinate": { "lat": ..., "lon": ... }.',
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  // --- 7.3 Place name -----------------------------------------------------
  if (body.place_name !== undefined && body.place_name !== null) {
    if (typeof body.place_name !== 'string') {
      errors.push({ field: 'place_name', message: 'place_name must be a string.' });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    } else {
      const trimmed = body.place_name.trim();
      if (trimmed.length < limits.PLACE_NAME_MIN_LENGTH) {
        errors.push({ field: 'place_name', message: 'place_name must not be empty.' });
        errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
      } else if (trimmed.length > limits.PLACE_NAME_MAX_LENGTH) {
        // The contract defers max length to config, which is exactly this.
        errors.push({
          field: 'place_name',
          message: `place_name must be at most ${limits.PLACE_NAME_MAX_LENGTH} characters.`,
        });
        errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
      }
    }
  }

  // --- Query length -------------------------------------------------------
  if (hasQuery && body.query.length > limits.QUERY_MAX_LENGTH) {
    errors.push({
      field: 'query',
      message: `query must be at most ${limits.QUERY_MAX_LENGTH} characters.`,
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  // --- 7.4 Date -----------------------------------------------------------
  // Only an EXPLICIT date is validated. "tomorrow" inside query text is the
  // Planner's job (Section 14), so we never parse body.query.
  if (body.date !== undefined && body.date !== null) {
    if (!isValidIsoDate(body.date)) {
      errors.push({
        field: 'date',
        message: 'date must be a valid ISO 8601 calendar date (YYYY-MM-DD).',
      });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    }
    // NOTE: the forecast horizon is NOT checked here. Whether a date is covered
    // by available data is SEMANTIC (Section 40 maps it to 422) and belongs to
    // the Planner, which knows the data catalogue.
  }

  // --- 7.5 Time range -----------------------------------------------------
  if (body.time_range !== undefined && body.time_range !== null) {
    if (typeof body.time_range !== 'object' || Array.isArray(body.time_range)) {
      errors.push({ field: 'time_range', message: 'time_range must be an object { start, end }.' });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    } else {
      const rangeCheck = validateTimeRange(body.time_range.start, body.time_range.end);
      if (!rangeCheck.valid) {
        errors.push({ field: 'time_range', message: rangeCheck.reason });
        errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
      } else {
        // Section 7.5: an overnight clock range is legal. Surfaced so the
        // service can pass it to the Planner rather than silently losing it.
        isOvernight = rangeCheck.isOvernight;
      }
    }
  }

  // Catch flat start_time/end_time, the other common shape mistake.
  if (body.start_time !== undefined || body.end_time !== undefined) {
    errors.push({
      field: 'start_time/end_time',
      message: 'Times go in a nested object: "time_range": { "start": "...", "end": "..." }.',
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  // --- 7.6 Activity -------------------------------------------------------
  // The contract deliberately does NOT enum these - activities are
  // config-extensible, validated against shared-config/activities.json.
  if (body.activity !== undefined && body.activity !== null) {
    if (!registry.isValidActivity(body.activity)) {
      errors.push({
        field: 'activity',
        message:
          `Unknown activity "${body.activity}". ` +
          `Valid values: ${registry.validActivityIds().join(', ')}.`,
      });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    }
  }

  // --- 7.7 Vessel type ----------------------------------------------------
  // Note what is NOT here: a MISSING vessel_type is not an error. Section 7.7
  // says the Planner substitutes the most conservative profile and states the
  // assumption. We only reject an UNKNOWN value.
  if (body.vessel_type !== undefined && body.vessel_type !== null) {
    if (!registry.isValidVesselType(body.vessel_type)) {
      errors.push({
        field: 'vessel_type',
        message:
          `Unknown vessel_type "${body.vessel_type}". ` +
          `Valid values: ${registry.validVesselTypeIds().join(', ')}.`,
      });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    }
  }

  // --- 7.8 Language override ---------------------------------------------
  // Contract field is `language_override`, not `language`.
  if (body.language_override !== undefined && body.language_override !== null) {
    if (!registry.isValidLanguage(body.language_override)) {
      errors.push({
        field: 'language_override',
        message:
          `Unsupported language "${body.language_override}". ` +
          `Supported: ${registry.validLanguageCodes().join(', ')}.`,
      });
      errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
    }
  }

  if (body.language !== undefined) {
    errors.push({
      field: 'language',
      message: 'Use "language_override" (contracts/AnalysisRequest.json), not "language".',
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  // --- 7.9 Origin and destination ----------------------------------------
  // Present on AnalysisRequest for route-shaped analyses. The contract requires
  // them TOGETHER - both present or both absent.
  const hasOrigin = body.origin !== undefined && body.origin !== null;
  const hasDestination = body.destination !== undefined && body.destination !== null;

  if (hasOrigin !== hasDestination) {
    errors.push({
      field: 'origin/destination',
      message: 'origin and destination must be supplied together (Section 7.9).',
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  for (const endpoint of ['origin', 'destination']) {
    if (body[endpoint] === undefined || body[endpoint] === null) continue;
    const category = checkPlaceOrCoordinate(body[endpoint], endpoint, errors);
    if (category) errorCategory = errorCategory || category;
  }

  return { valid: errors.length === 0, errors, errorCategory, isOvernight };
}

/**
 * Validate the contract's `place_or_coordinate` shape:
 *   { place_name?: string|null, coordinate?: { lat, lon }|null }
 * At least one of the two must be usable, or the endpoint identifies nothing.
 */
function checkPlaceOrCoordinate(value, fieldPath, errors) {
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      field: fieldPath,
      message: `${fieldPath} must be an object with place_name and/or coordinate { lat, lon }.`,
    });
    return ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  const hasPlace = typeof value.place_name === 'string' && value.place_name.trim().length > 0;
  const hasCoordinate = value.coordinate !== undefined && value.coordinate !== null;

  if (!hasPlace && !hasCoordinate) {
    errors.push({
      field: fieldPath,
      message: `${fieldPath} must include either a place_name or a coordinate { lat, lon }.`,
    });
    return ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  if (hasCoordinate) {
    return checkCoordinateObject(value.coordinate, `${fieldPath}.coordinate`, errors);
  }

  if (hasPlace && value.place_name.length > limits.PLACE_NAME_MAX_LENGTH) {
    errors.push({
      field: `${fieldPath}.place_name`,
      message: `place_name must be at most ${limits.PLACE_NAME_MAX_LENGTH} characters.`,
    });
    return ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  return null;
}

/**
 * Section 7.9 + contracts/api/RouteRequest.json.
 * Note the contract makes vessel_type REQUIRED for routes - safe environmental
 * limits differ by vessel, and a route is a sustained exposure, so the
 * conservative-default fallback used elsewhere is not acceptable here.
 */
function validateRouteRequest(body = {}) {
  const errors = [];
  let errorCategory = null;

  for (const endpoint of ['origin', 'destination']) {
    if (body[endpoint] === undefined || body[endpoint] === null) {
      errors.push({ field: endpoint, message: `${endpoint} is required.` });
      errorCategory = ERROR_CATEGORIES.VALIDATION_FAILURE;
      continue;
    }
    const category = checkPlaceOrCoordinate(body[endpoint], endpoint, errors);
    if (category) errorCategory = errorCategory || category;
  }

  if (!body.vessel_type) {
    errors.push({
      field: 'vessel_type',
      message: 'vessel_type is required for a route request (contracts/api/RouteRequest.json).',
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  } else if (!registry.isValidVesselType(body.vessel_type)) {
    errors.push({
      field: 'vessel_type',
      message: `Unknown vessel_type "${body.vessel_type}". Valid: ${registry.validVesselTypeIds().join(', ')}.`,
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  if (body.activity && !registry.isValidActivity(body.activity)) {
    errors.push({ field: 'activity', message: `Unknown activity "${body.activity}".` });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  if (body.language_override && !registry.isValidLanguage(body.language_override)) {
    errors.push({
      field: 'language_override',
      message: `Unsupported language "${body.language_override}".`,
    });
    errorCategory = errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE;
  }

  return { valid: errors.length === 0, errors, errorCategory };
}

module.exports = { validateAnalysisRequest, validateRouteRequest, checkPlaceOrCoordinate };
