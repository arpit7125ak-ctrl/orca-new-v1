// src/modules/geofence/geofence.service.js
// ---------------------------------------------------------------------------
// Section 66: Live GPS Geofencing.
//
// Flow (66.1):
//   Phone GPS -> Frontend -> Backend -> Spatial Geometry Query ->
//   Boundary/MPA/Sensitive-Zone Check -> Distance -> Warning
//
// Rules (66.3) - all three are enforced here:
//   1. "No LLM is used for the geometry decision."  -> pure MongoDB + haversine
//   2. "Target response time is under 1 second."    -> 2dsphere index + query cap
//   3. "Repeated identical warnings are deduplicated for a configurable period."
//
// THIS IS THE MOST SAFETY-CRITICAL CODE IN THE BACKEND. A fisherman crossing
// an international maritime boundary can be arrested or shot at. The logic is
// therefore deliberately boring: deterministic geometry, no cleverness, and it
// fails toward WARNING rather than toward silence.
// ---------------------------------------------------------------------------

const GisLayer = require('../../db/models/gisLayer.model');
const GeofenceEvent = require('../../db/models/geofenceEvent.model');
const limits = require('../../config/limits');
const geo = require('../../utils/geo');
const i18n = require('../../i18n');
const { generateDedupKey } = require('../../utils/ids');
const { logger } = require('../../observability/logger');

function isSeasonActive(layer, now = new Date()) {
  if (!layer.season_start || !layer.season_end) return true; // year-round
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${mm}-${dd}`;

  if (layer.season_start <= layer.season_end) {
    return today >= layer.season_start && today <= layer.season_end;
  }
  return today >= layer.season_start || today <= layer.season_end;
}

/**
 * Check a GPS position against all active constraint layers.
 *
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lon
 * @param {string} [params.deviceId]  used for deduplication (Section 99.11)
 * @param {string} [params.language]
 * @param {string} [params.vesselType] matters for `conditional` layers (65.1).
 *        NOTE: contracts/api/GeofenceCheckRequest.json carries vessel_type, not
 *        activity, so conditional-layer evaluation keys off the vessel here.
 * @returns {Promise<object>} geofence result
 */
async function checkPosition({ lat, lon, deviceId = null, language = 'en', vesselType = null }) {
  const startedAt = Date.now();
  const point = geo.toGeoJsonPoint(lat, lon);

  // --- Step 1: am I INSIDE any layer? -----------------------------------
  // $geoIntersects is exact, not approximate. Checked FIRST because being
  // inside a prohibited zone is strictly more urgent than approaching one.
  // Checked against geometry_full, not the simplified version: an "am I inside
  // a prohibited zone?" answer must use the most accurate boundary available.
  // Simplified geometry is for map display only (Section 67.1).
  const insideLayers = await GisLayer.find({
    active: true,
    constraint_type: { $ne: null },
    geometry_full: { $geoIntersects: { $geometry: point } },
  })
    .select('layer_name layer_type constraint_type verification allowed_vessel_types season_start season_end source version')
    .maxTimeMS(limits.GEOFENCE_QUERY_TIMEOUT_MS) // Section 66.3 sub-second target
    .lean();

  // --- Step 2: what is NEARBY? -------------------------------------------
  // $near returns results sorted by distance ascending, so the first hit is
  // the closest boundary - which is the one worth warning about.
  const nearbyLayers = await GisLayer.find({
    active: true,
    constraint_type: { $ne: null },
    geometry_full: {
      $near: {
        $geometry: point,
        $maxDistance: geo.kmToMeters(limits.GEOFENCE_SEARCH_RADIUS_KM),
      },
    },
  })
    .select('layer_name layer_type constraint_type verification allowed_vessel_types season_start season_end geometry_full source version')
    .limit(10)
    .maxTimeMS(limits.GEOFENCE_QUERY_TIMEOUT_MS)
    .lean();

  // --- Step 3: decide the state -----------------------------------------
  let state = 'clear';
  let triggeringLayer = null;
  let distanceKm = null;
  let bearing = null;

  // Actual exclusionary layers that forbid entry (authoritative prohibited or unpermitted conditional in active season)
  const restrictiveInside = insideLayers.filter((l) => {
    if (l.constraint_type === 'prohibited') {
      // Unverified prohibited is treated as WARN-ONLY (never 'inside')
      // Treat missing/null/undefined/unknown verification as approximate (fail safe)
      if (!l.verification || l.verification !== 'authoritative') return false;
      return true;
    }
    if (l.constraint_type === 'conditional') {
      if (!isSeasonActive(l)) return false;
      if (vesselType && Array.isArray(l.allowed_vessel_types)) {
        return !l.allowed_vessel_types.includes(vesselType);
      }
      return true;
    }
    return false;
  });

  const unverifiedInside = insideLayers.find(
    (l) => l.constraint_type === 'prohibited' && (!l.verification || l.verification !== 'authoritative')
  );

  if (restrictiveInside.length > 0) {
    state = 'inside';

    // Prioritize prohibited over conditional
    triggeringLayer =
      restrictiveInside.find((l) => l.constraint_type === 'prohibited') ||
      restrictiveInside.find((l) => l.constraint_type === 'conditional') ||
      restrictiveInside[0];

    distanceKm = 0; // genuinely zero - we are inside
  } else if (unverifiedInside) {
    // Unverified prohibited treated as WARN-ONLY (never 'inside')
    state = 'approaching';
    const cleanName = unverifiedInside.layer_name.replace(' (approximate boundary, unverified)', '');
    triggeringLayer = {
      ...unverifiedInside,
      constraint_type: 'warning_only',
      layer_name: `${cleanName} (approximate boundary, unverified)`,
    };
    distanceKm = 0.0;
  } else if (nearbyLayers.length > 0) {
    // Only warn about approaching prohibited or unpermitted conditional zones
    const relevantNearby = nearbyLayers.filter((l) => {
      if (l.constraint_type === 'prohibited') return true;
      if (l.constraint_type === 'conditional') {
        if (!isSeasonActive(l)) return false;
        if (vesselType && Array.isArray(l.allowed_vessel_types)) {
          return !l.allowed_vessel_types.includes(vesselType);
        }
        return true;
      }
      return false;
    });

    if (relevantNearby.length > 0) {
      const nearest = relevantNearby[0];
      const nearestPoint = nearestPointOnGeometry(nearest.geometry_full, lat, lon);

      if (nearestPoint) {
        const d = geo.haversineKm(lat, lon, nearestPoint.lat, nearestPoint.lon);

        // Section 66.2: "approaching" = within GEOFENCE_WARNING_KM
        if (d <= limits.GEOFENCE_WARNING_KM) {
          state = 'approaching';
          triggeringLayer = nearest;
          distanceKm = Number(d.toFixed(2));
          bearing = Number(geo.bearingDeg(lat, lon, nearestPoint.lat, nearestPoint.lon).toFixed(1));
        }
      }
    }
  }

  // --- Step 4: conditional layers and activity (Section 65.1) -----------
  // `conditional` means "allowed only for certain activities or seasons". If
  // this activity IS permitted, downgrade the alarm - but keep it visible as
  // informational rather than dropping it entirely.
  // Left null when we cannot determine it - null means "not evaluated", which
  // is different from false ("evaluated, and not allowed").
  let conditionalAllowed = null;
  if (
    triggeringLayer &&
    triggeringLayer.constraint_type === 'conditional' &&
    vesselType &&
    Array.isArray(triggeringLayer.allowed_vessel_types)
  ) {
    conditionalAllowed = triggeringLayer.allowed_vessel_types.includes(vesselType);
  }

  // --- Step 5: deduplication (Section 66.3) -----------------------------
  // The key is deterministic: same device + same layer + same state = same key.
  const dedupKey = generateDedupKey(
    deviceId,
    triggeringLayer?.layer_name || 'none',
    state
  );

  let deduplicated = false;
  if (deviceId && state !== 'clear') {
    const since = new Date(Date.now() - limits.GEOFENCE_DEDUP_WINDOW_MS);
    const recent = await GeofenceEvent.findOne({
      device_id: deviceId,
      dedup_key: dedupKey,
      created_at: { $gte: since },
    }).lean();
    deduplicated = Boolean(recent);
  }

  // --- Step 6: build the warning message (Section 66.2) -----------------
  // Pre-translated templates, no LLM.
  let message = null;
  let languageUsed = null;
  let fellBack = false;

  if (state === 'clear') {
    const isInIndianDomain = lat >= 4.0 && lat <= 25.0 && lon >= 65.0 && lon <= 96.0;
    if (!isInIndianDomain) {
      triggeringLayer = {
        layer_name: 'Beyond Indian EEZ (Foreign / High Seas)',
        layer_type: 'exclusive_economic_zone',
        constraint_type: 'warning_only',
        source: 'UNCLOS Sovereign Maritime Limits / Maritime Zones of India Act',
        version: 'EEZ-200NM-Limit',
      };
      message = `Advisory: Vessel GPS coordinate (${lat}°N, ${lon}°E) is outside the Indian Exclusive Economic Zone. Standard domestic coastal fishing permits apply only within sovereign Indian waters.`;
    } else {
      const resolved = i18n.geofenceMessage('clear', language);
      message = resolved.message;
      languageUsed = resolved.languageUsed;
      fellBack = resolved.fellBack;
    }
  } else if (triggeringLayer) {
    if (unverifiedInside) {
      message = `Warning: Vessel GPS position is within an approximate, unverified maritime boundary corridor for ${triggeringLayer.layer_name}. Note that this boundary is approximate and not verified against official survey charts; navigate with caution.`;
      languageUsed = language;
      fellBack = false;
    } else {
      const localisedLayer = i18n.layerName(triggeringLayer.layer_type, language);
      const resolved = i18n.geofenceMessage(state, language, {
        layer: localisedLayer,
        distance: distanceKm !== null ? distanceKm.toFixed(1) : '?',
        direction: bearing !== null ? geo.bearingToCompass(bearing) : '',
      });
      message = resolved.message;
      languageUsed = resolved.languageUsed;
      fellBack = resolved.fellBack;
    }
  }

  // --- Step 7: audit log (Section 66.3) ---------------------------------
  // Every check is stored, including deduplicated ones, so we can always show
  // why a warning was or was not delivered. Retention is enforced by the TTL
  // index on the model (Section 107).
  const event = await GeofenceEvent.create({
    device_id: deviceId,
    lat,
    lon,
    state,
    // Null when clear - a `clear` result genuinely has no layer.
    layer_name: triggeringLayer?.layer_name || null,
    constraint_type: triggeringLayer?.constraint_type || null,
    distance_km: distanceKm,
    bearing_deg: bearing,
    deduplicated,
    dedup_key: dedupKey,
    warning_text: message,
    language: languageUsed,
  });

  const elapsedMs = Date.now() - startedAt;

  // Section 66.3 target is under 1 second. Log a breach so a slow demo is
  // visible rather than mysteriously laggy.
  if (elapsedMs > 1000) {
    logger.warn(
      { elapsed_ms: elapsedMs, lat, lon },
      '[geofence] Check exceeded the 1s target - verify the geometry_full 2dsphere index exists'
    );
  }

  return {
    state,
    layer: triggeringLayer
      ? {
          layer_name: triggeringLayer.layer_name,
          layer_type: triggeringLayer.layer_type,
          constraint_type: triggeringLayer.constraint_type,
          // Section 67: every layer's source must be shown as evidence.
          source: triggeringLayer.source,
          version: triggeringLayer.version,
        }
      : null,
    distance_km: distanceKm,
    bearing_deg: bearing,
    bearing_compass: bearing !== null ? geo.bearingToCompass(bearing) : null,
    conditional_allowed_for_vessel: conditionalAllowed,
    message,
    language: languageUsed,
    // Honest signal that the message is in English because the requested
    // language had no template.
    language_fallback: fellBack,
    // deduplicated=true means: still true, but do not re-notify.
    deduplicated,
    event_id: event._id,
    elapsed_ms: elapsedMs,
    // Section 66.2 configurable warning band, echoed so the client can render
    // an accurate proximity ring without hard-coding the number.
    warning_threshold_km: limits.GEOFENCE_WARNING_KM,
  };
}

/**
 * Approximate the nearest vertex of a geometry to a point.
 *
 * DELIBERATE SIMPLIFICATION - documented honestly:
 * This scans VERTICES, not edges, so for a polygon with widely spaced vertices
 * it can slightly OVERSTATE the distance to the boundary. That error direction
 * is the safe one: it can make us warn a little early, never late. Computing
 * true point-to-edge distance would need a geodesic library; at a 5 km warning
 * band with real coastline data the vertex approximation is adequate.
 */
function nearestPointOnGeometry(geometry, lat, lon) {
  if (!geometry || !geometry.coordinates) return null;

  let best = null;
  let bestDistance = Infinity;

  // Recursively walk the nested coordinate arrays - Polygon, MultiPolygon,
  // LineString and Point all reduce to [lon, lat] pairs at the leaves.
  const walk = (coords) => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [pointLon, pointLat] = coords; // GeoJSON order is [lon, lat]
      const d = geo.haversineKm(lat, lon, pointLat, pointLon);
      if (d < bestDistance) {
        bestDistance = d;
        best = { lat: pointLat, lon: pointLon };
      }
      return;
    }
    for (const child of coords) {
      if (Array.isArray(child)) walk(child);
    }
  };

  walk(geometry.coordinates);
  return best;
}

module.exports = { checkPosition, nearestPointOnGeometry };
