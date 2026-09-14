// src/utils/geo.js
// ---------------------------------------------------------------------------
// Pure geometry helpers. No database, no LLM, no side effects.
//
// Section 66.3 is explicit: "No LLM is used for the geometry decision."
// Everything the geofence module needs to decide clear/approaching/inside is
// computed here deterministically.
// ---------------------------------------------------------------------------

const limits = require('../config/limits');

const EARTH_RADIUS_KM = 6371.0088; // mean Earth radius (IUGG)

const toRadians = (deg) => (deg * Math.PI) / 180;
const toDegrees = (rad) => (rad * 180) / Math.PI;

/**
 * Section 7.2: structural coordinate validation.
 * Returns a reason string so the caller can produce a useful 400 rather than
 * a bare "invalid coordinates".
 *
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateCoordinates(lat, lon) {
  if (typeof lat !== 'number' || Number.isNaN(lat)) {
    return { valid: false, reason: 'latitude must be a number' };
  }
  if (typeof lon !== 'number' || Number.isNaN(lon)) {
    return { valid: false, reason: 'longitude must be a number' };
  }
  if (lat < limits.LAT_MIN || lat > limits.LAT_MAX) {
    return { valid: false, reason: `latitude must be between ${limits.LAT_MIN} and ${limits.LAT_MAX}` };
  }
  if (lon < limits.LON_MIN || lon > limits.LON_MAX) {
    return { valid: false, reason: `longitude must be between ${limits.LON_MIN} and ${limits.LON_MAX}` };
  }
  return { valid: true, reason: null };
}

/**
 * Great-circle distance between two points, in kilometres (haversine).
 *
 * Haversine assumes a sphere, so it is off by up to ~0.5% versus a true
 * ellipsoid. At geofence scale (a 5 km warning band) that is a few metres -
 * far below GPS accuracy - so the simpler formula is the right call here.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Initial bearing from point 1 to point 2, in degrees clockwise from true north.
 *
 * Section 66.2 requires the geofence response to include bearing to the
 * boundary, so the user is told WHICH WAY the hazard lies, not just how far.
 */
function bearingDeg(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLambda = toRadians(lon2 - lon1);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  // Normalise (-180, 180] into [0, 360) so it reads as a compass bearing.
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Convert a bearing in degrees to a 16-point compass label (for advisory text). */
function bearingToCompass(deg) {
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return points[Math.round(((deg % 360) / 22.5)) % 16];
}

/**
 * Build a GeoJSON Point.
 *
 * NOTE THE ORDER: GeoJSON (and therefore MongoDB 2dsphere) is
 * [longitude, latitude] - the REVERSE of how humans say it. Getting this
 * backwards is the single most common geospatial bug, so every conversion
 * goes through this helper rather than being written inline.
 */
function toGeoJsonPoint(lat, lon) {
  return { type: 'Point', coordinates: [lon, lat] };
}

/** Inverse of toGeoJsonPoint - unpack [lon, lat] back into named fields. */
function fromGeoJsonPoint(point) {
  if (!point || !Array.isArray(point.coordinates)) return null;
  const [lon, lat] = point.coordinates;
  return { lat, lon };
}

/** Kilometres -> radians, the unit MongoDB's $geoWithin/$centerSphere expects. */
function kmToRadians(km) {
  return km / EARTH_RADIUS_KM;
}

/** Kilometres -> metres, the unit MongoDB's $near/$maxDistance expects. */
function kmToMeters(km) {
  return km * 1000;
}

module.exports = {
  EARTH_RADIUS_KM,
  validateCoordinates,
  haversineKm,
  bearingDeg,
  bearingToCompass,
  toGeoJsonPoint,
  fromGeoJsonPoint,
  kmToRadians,
  kmToMeters,
  toRadians,
  toDegrees,
};
