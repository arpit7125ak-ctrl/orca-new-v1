/**
 * @fileoverview Status Builder
 * Constructs lightweight status payloads for polling clients. Extracts current
 * state and agent execution summaries without loading full results.
 *
 * @module analysis.statusBuilder
 */

// src/modules/analysis/statusBuilder.js
// ---------------------------------------------------------------------------
// Body for GET /api/v1/analysis/:analysis_id/status.
//
// SHAPE IS LOCKED by contracts/api/AnalysisStatusResponse.json:
//   required: analysis_id, status, agent_statuses
//   optional: error, plan_summary, skipped_agents
//   additionalProperties: false
//
// That last line is why this file is much smaller than it was: progress
// percentages, stage counts and is_terminal flags are NOT in the contract and
// would be rejected. The client derives "should I keep polling?" from `status`.
//
// This is the POLLING endpoint - hit repeatedly - so a small payload is right
// anyway. The full execution_trace goes to the result endpoint (Section 100).
// ---------------------------------------------------------------------------

/**
 * @param {object} analysis Analysis document
 * @returns {object} AnalysisStatusResponse
 */
function buildStatus(analysis) {
  const response = {
    analysis_id: analysis.analysis_id,

    // Section 9 lifecycle state.
    status: analysis.status,

    // Contract-required. Map of agent name -> its current status, e.g.
    // { weather: "completed", tide: "failed" }. Always an object, never null -
    // an empty map honestly means "nothing has reported yet".
    agent_statuses: analysis.agent_statuses || {},
  };

  // ErrorInfo (contracts/shared/ErrorInfo.json) - only on failure.
  if (analysis.error_category) {
    response.error = {
      error_category: analysis.error_category,
      message: analysis.error_message || 'Analysis failed.',
    };
  }

  // Section 79 "visible reasoning": a compact view of the plan so the Frontend
  // can show what is being done without fetching the whole result.
  if (analysis.plan) {
    response.plan_summary = {
      primary_intent: analysis.primary_intent || null,
      selected_agents: analysis.selected_agents || [],
      sampling_mode: analysis.sampling?.mode || null,
      point_count: Array.isArray(analysis.points) ? analysis.points.length : null,
    };
  }

  // Section 107: skipped agents must carry reasons. A skipped agent with no
  // reason is an unexplained gap in the evidence chain.
  if (Array.isArray(analysis.skipped_agents) && analysis.skipped_agents.length) {
    response.skipped_agents = analysis.skipped_agents.map((s) => ({
      agent: s.agent,
      reason: s.reason || 'not_required_for_this_intent',
    }));
  }

  return response;
}

module.exports = { buildStatus };
