// src/modules/analysis/resultBuilder.js
// ---------------------------------------------------------------------------
// Body for GET /api/v1/analysis/:analysis_id.
//
// SHAPE IS LOCKED by contracts/api/AnalysisResultResponse.json:
//   required: analysis_id, status, plan
//   optional: error, points, quick_information_result, decision, route_result,
//             trend_result, data_quality, execution_trace, created_at,
//             completed_at
//   additionalProperties: false
//
// Everything the previous version invented (a `language` object, an `agents`
// summary array, `selected_agents` at top level, per-point merged measurements)
// is NOT in the contract and would be rejected. Agent evidence lives under
// `points`; agent selection reasoning lives inside `plan` (ExecutionPlan).
//
// EVIDENCE-FIRST PRINCIPLE still holds: every number a user sees must be
// traceable. That is carried by Measurement.source / retrieved_at / freshness
// inside each point, and by explicit `missing` / `not_mapped` statuses rather
// than omission. An omitted field looks like it was never needed; an explicit
// `missing` shows it was needed and could not be obtained.
// ---------------------------------------------------------------------------

const { mergeByPoint } = require('./pointMerge');

/**
 * @param {object} params
 * @param {object} params.analysis     Analysis document
 * @param {Array}  params.agentResults AgentResult documents
 * @param {object} [params.riskResult] RiskResult document ({ results: [...] })
 * @param {object} [params.decision]   Decision document
 * @param {object} [params.route]      Route document
 * @param {boolean} [params.includeRaw] include raw adapter payloads (debug only)
 * @returns {object} AnalysisResultResponse
 */
function buildResult({ analysis, agentResults = [], riskResult = null, decision = null, route = null, includeRaw = false }) {
  const response = {
    analysis_id: analysis.analysis_id,
    status: analysis.status,

    // Contract-required. The ExecutionPlan the Planner produced (Section 20).
    // Null when the Planner never ran - honest, and the contract permits it.
    plan: analysis.plan || null,
  };

  // --- ErrorInfo ---------------------------------------------------------
  if (analysis.error_category) {
    response.error = {
      error_category: analysis.error_category,
      message: analysis.error_message || 'Analysis failed.',
    };
  }

  // --- Points: the per-point evidence package ----------------------------
  if (Array.isArray(analysis.points) && analysis.points.length) {
    const merged = mergeByPoint(analysis.points, agentResults);

    // RiskAssessment is keyed by point_id so each point carries its own score
    // inline, rather than forcing the Frontend to join two arrays.
    const riskByPoint = new Map(
      (riskResult?.results || []).map((r) => [r.point_id, r])
    );

    response.points = merged.map((point) => {
      const risk = riskByPoint.get(point.point_id) || null;

      const entry = {
        point_id: point.point_id,
        lat: point.lat,
        lon: point.lon,
        // Section 105: a land point inside a valid grid is `not_applicable`,
        // not a failure. Keeping it visible keeps the grid honest.
        point_status: point.point_status,
        land_sea: point.land_sea,

        // Measurements keyed by canonical parameter name. Each value is a
        // Measurement (contracts/Measurement.json) carrying its own source,
        // freshness and status.
        measurements: point.measurements,
      };

      if (point.bearing_deg !== null && point.bearing_deg !== undefined) {
        entry.bearing_deg = point.bearing_deg;
      }
      if (point.distance_km !== null && point.distance_km !== undefined) {
        entry.distance_km = point.distance_km;
      }

      // RiskAssessment, stage by stage (Section 47.2 order) so the reasoning is
      // auditable rather than a single opaque number - and so it is provable
      // that the bounded LLM never single-handedly made something look safe.
      if (risk) {
        entry.risk = {
          baseline_score: risk.baseline_score,
          llm_adjustment: risk.llm_adjustment ?? null,
          adjustment_reason: risk.adjustment_reason ?? null,
          official_warnings: risk.official_warnings ?? [],
          hard_rules_applied: risk.hard_rules_applied ?? [],
          constraint_floor: risk.constraint_floor ?? null,
          final_score: risk.final_score,
          risk_level: risk.risk_level,
          risk_factors: risk.risk_factors ?? null,
          reasoning: risk.reasoning,
          key_findings: risk.key_findings ?? [],
          hourly_scores: risk.hourly_scores ?? [],
          confidence: risk.confidence,
          data_quality: risk.data_quality ?? null,
          // Section 56.5: records that the bounded LLM stage was unavailable
          // and the deterministic baseline stood alone.
          llm_interpretation_unavailable: risk.llm_interpretation_unavailable ?? false,
        };
      }

      // Which agents produced nothing for this point, and why. Section 50 needs
      // this to decide whether any point may be rated SAFE.
      if (point.agents_missing.length) {
        entry.agents_missing = point.agents_missing;
      }

      if (includeRaw && point.raw_by_agent) {
        entry.raw_by_agent = point.raw_by_agent;
      }

      return entry;
    });
  }

  // --- Exactly one intent-specific artefact (per final_stage) ------------
  if (decision) {
    response.decision = stripMongoFields(decision);
  }
  if (route) {
    response.route_result = stripMongoFields(route);
  }
  if (analysis.trend_result) {
    response.trend_result = analysis.trend_result;
  }
  if (analysis.quick_information_result) {
    response.quick_information_result = analysis.quick_information_result;
  }

  // --- DataQuality (contracts/shared/DataQuality.json) -------------------
  if (analysis.data_quality) {
    response.data_quality = analysis.data_quality;
  }

  // --- Section 100 execution trace ---------------------------------------
  // The complete record, powering the Section 79 "visible reasoning" panel.
  if (Array.isArray(analysis.execution_trace) && analysis.execution_trace.length) {
    response.execution_trace = analysis.execution_trace.map((e) => ({
      agent: e.stage,
      status: e.status,
      status_code: e.status_code,
      started_at: e.started_at,
      completed_at: e.completed_at,
      duration_ms: e.duration_ms,
      retry_count: e.retry_count,
      selection_reason: e.selection_reason,
      error: e.error_category
        ? { error_category: e.error_category, message: e.error }
        : null,
    }));
  }

  if (analysis.created_at) response.created_at = toIso(analysis.created_at);
  if (analysis.completed_at) response.completed_at = toIso(analysis.completed_at);

  return response;
}

/**
 * Remove Mongo bookkeeping before a document goes out over the API.
 * The response contracts are `additionalProperties: false`, so _id and __v
 * would cause a validation failure.
 */
function stripMongoFields(document) {
  const object = document.toObject ? document.toObject() : { ...document };
  delete object._id;
  delete object.__v;
  delete object.created_at;
  delete object.updated_at;
  return object;
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

module.exports = { buildResult, stripMongoFields };
