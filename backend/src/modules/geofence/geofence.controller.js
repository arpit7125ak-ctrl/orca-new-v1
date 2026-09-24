/**
 * @fileoverview Geofence Controller
 * Handles live GPS geofence checks. Validates coordinates and structures
 * boundary alerts according to the response contract.
 *
 * @module geofence.controller
 */

// src/modules/geofence/geofence.controller.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/geofence/check - live GPS geofence check.
// Section 66.2: the Frontend sends position at a configurable interval while
// geofence mode is on, so this endpoint is called FREQUENTLY.
//
// CONTRACT SHAPES:
//   request  contracts/api/GeofenceCheckRequest.json
//            required: lat, lon | optional: device_id, vessel_type,
//            language_override | additionalProperties: false
//   response contracts/api/GeofenceCheckResponse.json
//            required: state | optional: layer_name, constraint_type,
//            distance_km, bearing_deg, warning_text, deduplicated
//            additionalProperties: false
//
// Note the response is FLAT - `layer_name` and `constraint_type` are top-level
// strings, not a nested `layer` object - and the text field is `warning_text`,
// not `message`. Fields the service computes but the contract does not list
// (elapsed_ms, bearing_compass, warning_threshold_km) are deliberately dropped
// here rather than leaked.
// ---------------------------------------------------------------------------

const asyncHandler = require('../../utils/asyncHandler');
const geofenceService = require('./geofence.service');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const { validateCoordinates } = require('../../utils/geo');
const registry = require('../../config/registry');

const checkGeofence = asyncHandler(async (req, res) => {
  const { lat, lon, device_id: deviceId, language_override: languageOverride, vessel_type: vesselType } = req.body;

  // Unlike the analysis endpoint, coordinates are REQUIRED here - a geofence
  // check with no position is meaningless.
  if (lat === undefined || lon === undefined || lat === null || lon === null) {
    throw new AppError(
      'lat and lon are required for a geofence check.',
      ERROR_CATEGORIES.INVALID_LOCATION
    );
  }

  const check = validateCoordinates(Number(lat), Number(lon));
  if (!check.valid) {
    throw new AppError(check.reason, ERROR_CATEGORIES.INVALID_LOCATION);
  }

  // An unknown language falls back to English rather than erroring: a geofence
  // warning must NEVER be blocked by a language mismatch.
  const resolvedLanguage =
    languageOverride && registry.isValidLanguage(languageOverride) ? languageOverride : 'en';

  // An unknown vessel type is ignored rather than rejected, for the same reason.
  const resolvedVesselType =
    vesselType && registry.isValidVesselType(vesselType) ? vesselType : null;

  const result = await geofenceService.checkPosition({
    lat: Number(lat),
    lon: Number(lon),
    deviceId: deviceId || null,
    language: resolvedLanguage,
    vesselType: resolvedVesselType,
  });

  // Project onto exactly the contract's properties.
  const response = { state: result.state };

  if (result.layer) {
    response.layer_name = result.layer.layer_name;
    response.constraint_type = result.layer.constraint_type;
  }
  if (result.distance_km !== null && result.distance_km !== undefined) {
    response.distance_km = result.distance_km;
  }
  if (result.bearing_deg !== null && result.bearing_deg !== undefined) {
    response.bearing_deg = result.bearing_deg;
  }
  if (result.message) {
    response.warning_text = result.message;
  }
  response.deduplicated = result.deduplicated;

  return res.status(HTTP.OK).json(response);
});

module.exports = { checkGeofence };
