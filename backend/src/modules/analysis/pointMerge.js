/**
 * @fileoverview Point Merge Utility
 * Combines disparate observations from multiple environmental agents into a
 * single, cohesive view per geographic point.
 *
 * @module analysis.pointMerge
 */

// src/modules/analysis/pointMerge.js
// ---------------------------------------------------------------------------
// Merges every agent's per-point output into ONE view per point_id.
//
// WHY THIS IS NON-TRIVIAL: seven agents each report independently for the same
// sampled points (Sections 15-17). Weather may succeed at all nine, Tide may
// fail entirely, GIS may cover only the six actually at sea. Risk and Decision
// need "everything known about P4", not seven separate lists.
//
// CONTRACT SHAPES THIS OBEYS:
//   contracts/PointObservation.json - point_id, lat, lon, point_status,
//                                     land_sea (all required), plus optional
//                                     bearing_deg / distance_km
//   contracts/AgentResult.json      - normalized / raw (NOT normalized_output)
//   contracts/Measurement.json      - measurements are a MAP keyed by canonical
//                                     parameter name, not a flat array
//   contracts/shared/DataFieldStatus.json
//                                   - available | partial | missing |
//                                     not_mapped | derived
//
// Note "missing", not "unavailable". And there is no "unit_mismatch" status -
// that was invented previously. Section 24.2 unit violations are represented as
// `missing` (the value is unusable, so it is absent) with the reason carried in
// the measurement's own fields.
//
// THE CARDINAL RULE: a point with no data for a parameter gets `null` with an
// explicit status - NEVER a zero, NEVER an interpolated neighbour value. A
// fabricated 0.0 m wave height reads as a flat calm sea, which is the most
// dangerous possible wrong answer this system could give.
// ---------------------------------------------------------------------------

// contracts/shared/DataFieldStatus.json
const USABLE_STATUSES = new Set(['available', 'derived']);

/**
 * @param {Array} points        analysis.points - PointObservation documents
 * @param {Array} agentResults  AgentResult documents for this analysis
 * @returns {Array} merged per-point view
 */
function mergeByPoint(points = [], agentResults = []) {
  // Index by point_id first so the merge is O(points), not O(points x agents).
  const byPoint = new Map();

  for (const point of points) {
    byPoint.set(point.point_id, {
      point_id: point.point_id,
      lat: point.lat,
      lon: point.lon,
      // Required by contracts/PointObservation.json. Null is preserved rather
      // than defaulted - if the Planner did not classify it, we do not invent it.
      point_status: point.point_status ?? null,
      land_sea: point.land_sea ?? null,
      bearing_deg: point.bearing_deg ?? null,
      distance_km: point.distance_km ?? null,
      // Measurement MAP keyed by canonical parameter name (contract shape).
      measurements: {},
      agents_reporting: [],
      agents_missing: [],
      raw_by_agent: {},
    });
  }

  for (const result of agentResults) {
    const agentName = result.agent_name;

    // A failed/skipped agent still matters: every point must record that this
    // agent produced nothing, and WHY. Silence is not the same as "fine"
    // (Section 41, Section 50).
    if (['failed', 'skipped', 'timeout', 'partial'].includes(result.status) && !result.normalized) {
      for (const merged of byPoint.values()) {
        merged.agents_missing.push({
          agent: agentName,
          status: result.status,
          error_category: result.error?.error_category || null,
          message: result.error?.message || null,
        });
      }
      continue;
    }

    // contracts/AgentResult.json: `normalized.by_point` or flat, keyed by point_id.
    const normalized = result.normalized?.by_point || result.normalized || {};
    const seenPointIds = new Set();

    for (const [pointId, observation] of Object.entries(normalized)) {
      const merged = byPoint.get(pointId);
      // An observation for an unknown point_id means the AI Service sampled
      // differently from what we stored. Skip rather than inventing a point -
      // it surfaces below as a missing agent, which is visible.
      if (!merged) continue;

      seenPointIds.add(pointId);
      merged.agents_reporting.push(agentName);

      // Measurements arrive as a map: { wind_speed_ms: Measurement, ... }
      const measurements = observation.measurements || observation;

      for (const [parameter, measurement] of Object.entries(measurements)) {
        if (!measurement || typeof measurement !== 'object') continue;

        // Parameter collision across agents (e.g. two both report SST).
        // Keep the usable one rather than letting arrival order decide.
        const existing = merged.measurements[parameter];
        if (
          existing &&
          USABLE_STATUSES.has(existing.status) &&
          !USABLE_STATUSES.has(measurement.status)
        ) {
          continue;
        }

        merged.measurements[parameter] = {
          parameter: measurement.parameter ?? parameter,
          value: measurement.value ?? null,       // null stays null
          unit: measurement.unit ?? null,
          source: measurement.source ?? null,     // nullable by contract
          product_id: measurement.product_id ?? null,
          retrieved_at: measurement.retrieved_at ?? null,
          valid_time: measurement.valid_time ?? null,
          observation_type: measurement.observation_type ?? null,
          status: measurement.status ?? 'missing',
          // Freshness is an OBJECT { state, age_hours, max_age_hours }, not a
          // number of minutes.
          freshness: measurement.freshness ?? { state: 'unknown' },
          confidence: measurement.confidence ?? null,
          official_source: measurement.official_source ?? null,
          reported_by: agentName,
        };
      }
    }

    // Points this succeeding agent did not cover (e.g. GIS skipping land
    // points). Recorded so the gap is explicit rather than silent.
    for (const merged of byPoint.values()) {
      if (!seenPointIds.has(merged.point_id)) {
        merged.agents_missing.push({
          agent: agentName,
          status: 'no_data_for_point',
          error_category: null,
          message: null,
        });
      }
    }

    if (result.raw) {
      for (const merged of byPoint.values()) {
        merged.raw_by_agent[agentName] = result.raw;
      }
    }
  }

  return [...byPoint.values()];
}

/**
 * Per-point completeness summary.
 *
 * Feeds DataQuality and lets the Risk stage know how much evidence it actually
 * has (Section 50: a mandatory safety agent missing means NO point may be
 * rated SAFE).
 *
 * @param {Array} mergedPoints        output of mergeByPoint
 * @param {Array} expectedParameters  parameters the plan expected to collect
 */
function summariseCompleteness(mergedPoints = [], expectedParameters = []) {
  return mergedPoints.map((point) => {
    const measurements = Object.values(point.measurements);

    const usable = measurements.filter((m) => USABLE_STATUSES.has(m.status));
    const missing = measurements.filter((m) => m.status === 'missing');
    const notMapped = measurements.filter((m) => m.status === 'not_mapped');
    const partial = measurements.filter((m) => m.status === 'partial');

    const missingExpected = expectedParameters.filter(
      (parameter) =>
        !point.measurements[parameter] ||
        !USABLE_STATUSES.has(point.measurements[parameter].status)
    );

    return {
      point_id: point.point_id,
      point_status: point.point_status,
      parameters_available: usable.length,
      parameters_expected: expectedParameters.length,
      // null (not 0) when nothing was expected - a percentage of nothing is
      // undefined, and 0% would falsely read as total failure.
      completeness_percent:
        expectedParameters.length > 0
          ? Math.round((usable.length / expectedParameters.length) * 100)
          : null,
      missing_parameters: missingExpected,
      // `not_mapped` is distinct from `missing`: the adapter has no mapping for
      // this field yet, versus the source was asked and returned nothing. Kept
      // separate so an adapter gap is visible as a gap.
      not_mapped_parameters: notMapped.map((m) => m.parameter),
      partial_parameters: partial.map((m) => m.parameter),
      missing_measurement_count: missing.length,
      agents_reporting: [...new Set(point.agents_reporting)],
      agents_missing: point.agents_missing,
    };
  });
}

module.exports = { mergeByPoint, summariseCompleteness, USABLE_STATUSES };
