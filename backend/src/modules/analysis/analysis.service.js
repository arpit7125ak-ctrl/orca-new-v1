/**
 * @fileoverview Analysis Service
 * Core orchestrator for the marine safety pipeline. Handles creation, network
 * dispatch to the AI Service, progress tracking, and result consolidation.
 *
 * @module analysis.service
 */

// src/modules/analysis/analysis.service.js
// ---------------------------------------------------------------------------
// Core pipeline logic. Controllers stay thin so chat and the alert worker can
// reuse this without going through HTTP.
//
// THE CENTRAL FLOW (Sections 8, 102, 103):
//   1. Validate structurally (Section 7)
//   2. Generate analysis_id at RECEIPT time
//   3. Persist as `queued` BEFORE any outbound call
//   4. POST AnalysisExecutionRequest to the AI Service
//   5. Mark `running`, return 202
//   6. AI Service calls back: /internal/v1/progress (many) then
//      /internal/v1/result (once)
//
// WHY STEP 3 PRECEDES STEP 4: if we dispatched first and crashed before
// saving, we would have work running with no record of it, and a user polling
// an ID that does not exist. Persisting first means the worst case is an
// analysis stuck in `queued` - visible and retryable.
//
// CONTRACT NOTE - how results actually arrive:
// contracts/api/InternalResultPayload.json carries ONLY the final artefact
// (exactly one of decision / route_result / trend_result / report_content /
// quick_information_result). Agent results and risk assessments do NOT come
// through it. They arrive during execution via ProgressMessage.data (small) or
// ProgressMessage.data_ref (large), which is what applyProgress persists.
// ---------------------------------------------------------------------------

const Analysis = require('../../db/models/analysis.model');
const AgentResult = require('../../db/models/agentResult.model');
const RiskResult = require('../../db/models/riskResult.model');
const Decision = require('../../db/models/decision.model');
const Route = require('../../db/models/route.model');

const { generateAnalysisId } = require('../../utils/ids');
const { buildTimeWindow, nowIso } = require('../../utils/time');
const aiServiceClient = require('../../clients/aiService.client');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { logger, forAnalysis } = require('../../observability/logger');
const trace = require('../../observability/trace');
const { buildResult } = require('./resultBuilder');
const { buildStatus } = require('./statusBuilder');

/**
 * Create and dispatch a new analysis.
 *
 * @param {object} body     request body conforming to contracts/AnalysisRequest.json
 * @param {object} [context] { conversation_id, parent_analysis_id, alert_subscription_id }
 * @param {object} [options] { utcOffsetMinutes } - transport-level hint, NOT part
 *                           of the contract; used only to attempt a truthful
 *                           TimeWindow. Omitted => time_window stays null.
 */
async function createAnalysis(body, context = {}, options = {}) {
  // --- Step 2: ID at REQUEST-RECEIPT time (Section 8.1) ------------------
  const receivedAt = new Date();
  const analysisId = generateAnalysisId(receivedAt);
  const log = forAnalysis(analysisId);

  const originalCoordinate = body.coordinate || null;

  // contracts/shared/Location.json requires original.lat and original.lon, so a
  // place-name-only request cannot produce a valid Location yet. We leave
  // location null until the Planner resolves it rather than writing a
  // half-object that violates the contract.
  const location = originalCoordinate
    ? {
      original: {
        name: body.place_name || null,
        lat: Number(originalCoordinate.lat),
        lon: Number(originalCoordinate.lon),
      },
      // `validated` is Planner-owned (Section 7.10). Null, never guessed.
      validated: null,
    }
    : null;

  // Null unless we have BOTH an explicit date and an explicit offset - see
  // utils/time.buildTimeWindow for why guessing a timezone is forbidden.
  const timeWindow = buildTimeWindow({
    date: body.date,
    timeRange: body.time_range,
    utcOffsetMinutes: options.utcOffsetMinutes,
  });

  // --- Step 3: persist as `queued` BEFORE any network call ---------------
  const analysis = new Analysis({
    analysis_id: analysisId,

    conversation_id: context.conversation_id || body.conversation_id || null,
    parent_analysis_id: context.parent_analysis_id || body.parent_analysis_id || null,
    alert_subscription_id: context.alert_subscription_id || null,

    // Stored verbatim so we can always show exactly what was asked.
    request: body,

    // Only the OVERRIDE is known here. detected_language stays null until the
    // Planner reports it (Section 11) - we do not guess, because romanized and
    // code-mixed queries are common and guessing would often be wrong.
    override_language: body.language_override || null,
    detected_language: null,
    response_language: null,

    location,
    time_window: timeWindow,

    activity: body.activity || null,
    vessel_type: body.vessel_type || null,
    // Section 7.7: flags that the Planner must substitute a conservative
    // default AND state the assumption.
    vessel_type_assumed: !body.vessel_type,

    status: 'queued',

    execution_trace: [
      trace.completeEntry(
        trace.startEntry({
          stage: 'backend_validation',
          selected: true,
          selectionReason: 'every request is structurally validated (Section 7)',
        }),
        { statusCode: 202, summary: 'Request accepted and persisted' }
      ),
    ],
  });

  await analysis.save();
  log.info({ activity: body.activity, has_query: Boolean(body.query) }, '[analysis] Created and queued');

  // --- Step 4: hand off --------------------------------------------------
  // Shape is contracts/api/AnalysisExecutionRequest.json exactly. It is
  // `additionalProperties: false`, so nothing extra may be added - note there
  // is no `received_at` and no nested `context` object.
  const executionRequest = {
    analysis_id: analysisId,
    conversation_id: analysis.conversation_id,
    parent_analysis_id: analysis.parent_analysis_id,
    alert_subscription_id: analysis.alert_subscription_id,
    request: buildContractRequest(body),
  };

  const dispatchEntry = trace.startEntry({
    stage: 'ai_service_handoff',
    selected: true,
    selectionReason: 'hand off to the AI Service for execution',
  });

  try {
    const dispatch = await aiServiceClient.execute(executionRequest);

    trace.completeEntry(dispatchEntry, {
      statusCode: dispatch.status,
      summary: dispatch.alreadyRunning
        ? 'AI Service reported this analysis already running (idempotent)'
        : 'AI Service accepted the analysis',
    });

    analysis.status = 'running';
    analysis.execution_trace.push(dispatchEntry);
    await analysis.save();

    return { analysis, dispatched: true, dispatchError: null };
  } catch (err) {
    // The AI Service is unreachable. The record SURVIVES in `failed` with an
    // honest error_category - we do not delete it, because a user polling that
    // ID deserves to be told what happened.
    trace.failEntry(dispatchEntry, {
      error: err,
      errorCategory: err.errorCategory || ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
    });

    analysis.status = 'failed';
    analysis.error_category = err.errorCategory || ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE;
    analysis.error_message = err.message;
    analysis.execution_trace.push(dispatchEntry);
    analysis.completed_at = new Date();
    await analysis.save();

    log.error({ err: err.message }, '[analysis] AI Service dispatch failed');
    return { analysis, dispatched: false, dispatchError: err.message };
  }
}

/**
 * Project an inbound body onto exactly the properties
 * contracts/AnalysisRequest.json permits.
 *
 * Necessary because the contract is `additionalProperties: false`: any stray
 * field (an internal hint, a transport-level extra) would make the AI Service
 * reject the whole request. Undefined keys are stripped so we send absent
 * rather than explicit-null where the caller said nothing.
 */
function buildContractRequest(body) {
  const allowed = {
    query: body.query ?? null,
    coordinate: body.coordinate ?? null,
    place_name: body.place_name ?? null,
    date: body.date ?? null,
    time_range: body.time_range ?? null,
    activity: body.activity ?? null,
    vessel_type: body.vessel_type ?? null,
    origin: body.origin ?? null,
    destination: body.destination ?? null,
    language_override: body.language_override ?? null,
    conversation_id: body.conversation_id ?? null,
    parent_analysis_id: body.parent_analysis_id ?? null,
  };

  for (const key of Object.keys(allowed)) {
    if (allowed[key] === undefined) delete allowed[key];
  }
  return allowed;
}

/** Fetch one analysis or throw a 404-mapped AppError. */
async function getAnalysisOrThrow(analysisId) {
  const analysis = await Analysis.findOne({ analysis_id: analysisId }).lean();
  if (!analysis) {
    const error = new AppError(`Analysis ${analysisId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = 404;
    throw error;
  }
  return analysis;
}

/** Full result - joins analyses, agent_results, risk_results, decisions, routes. */
async function getFullResult(analysisId, { includeRaw = false } = {}) {
  const analysis = await getAnalysisOrThrow(analysisId);

  const [agentResults, riskResult, decision, route] = await Promise.all([
    AgentResult.find({ analysis_id: analysisId }).lean(),
    RiskResult.findOne({ analysis_id: analysisId }).lean(),
    Decision.findOne({ analysis_id: analysisId }).lean(),
    Route.findOne({ analysis_id: analysisId }).lean(),
  ]);

  return {
    analysis,
    body: buildResult({ analysis, agentResults, riskResult, decision, route, includeRaw }),
  };
}

/** Lightweight polling status. */
async function getStatus(analysisId) {
  const analysis = await getAnalysisOrThrow(analysisId);
  return { analysis, body: buildStatus(analysis) };
}

/**
 * Apply a progress update - contracts/ProgressMessage.json.
 *
 * Contract shape (all `additionalProperties: false`):
 *   required: analysis_id, agent, status, status_code, timestamp
 *   optional: selection_reason, data_ref, data, error, metadata
 *
 * Note `agent`, not `stage`, and `error` is an ErrorInfo OBJECT
 * ({ error_category, message, http_status?, retry_count? }), not a bare string.
 *
 * IDEMPOTENCY: a stage already in the trace is UPDATED, not appended. The AI
 * Service may legitimately retry, and duplicate entries would corrupt the
 * progress percentage.
 */
async function applyProgress(analysisId, message) {
  const analysis = await Analysis.findOne({ analysis_id: analysisId });
  if (!analysis) {
    const error = new AppError(`Analysis ${analysisId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = 404;
    throw error;
  }

  // A terminal analysis must not be reopened by a late progress message.
  if (['completed', 'partial', 'failed'].includes(analysis.status)) {
    logger.warn(
      { analysis_id: analysisId, status: analysis.status },
      '[analysis] Ignoring progress for an already-terminal analysis'
    );
    return analysis;
  }

  if (analysis.status === 'queued') analysis.status = 'running';

  const agent = message.agent;
  const errorInfo = message.error || null;

  // --- Update the execution trace (Section 100) --------------------------
  const existingIndex = analysis.execution_trace.findIndex((e) => e.stage === agent);
  const previous = existingIndex >= 0 ? analysis.execution_trace[existingIndex] : null;

  const isTerminalStage = ['completed', 'partial', 'failed', 'skipped'].includes(message.status);

  // Per-agent timing: data agents (weather, ocean, etc.) report started_at and
  // duration_ms inside message.metadata (compliant with ProgressMessage.json) or
  // message.data. Use them so we capture the true perf_counter elapsed time.
  const msgStartedAt = message.metadata?.started_at || message.data?.started_at || message.started_at || null;
  const msgCompletedAt = message.metadata?.completed_at || message.data?.completed_at || message.completed_at || null;
  const rawDuration = message.metadata?.duration_ms ?? message.data?.duration_ms ?? message.duration_ms;
  const msgDurationMs = (typeof rawDuration === 'number' && !isNaN(rawDuration))
    ? rawDuration
    : null;

  const entry = {
    stage: agent,
    selected: message.status !== 'skipped',
    selection_reason: message.selection_reason || previous?.selection_reason || null,
    status: message.status,
    status_code: message.status_code ?? null,
    // If the agent sent its own started_at, use it. Otherwise preserve the
    // existing started_at (set on the "running" message) or fall back to now.
    started_at: msgStartedAt || previous?.started_at || message.timestamp || nowIso(),
    completed_at: isTerminalStage
      ? (msgCompletedAt || message.timestamp || nowIso())
      : null,
    duration_ms: null,
    retry_count: errorInfo?.retry_count ?? previous?.retry_count ?? 0,
    error: errorInfo?.message || null,
    error_category: errorInfo?.error_category || null,
    summary: null,
  };

  // Use the agent-reported duration when available (most accurate - measured
  // with perf_counter inside the agent). Fall back to timestamp arithmetic.
  if (isTerminalStage) {
    if (msgDurationMs !== null) {
      entry.duration_ms = msgDurationMs;
    } else if (entry.started_at && entry.completed_at) {
      entry.duration_ms = new Date(entry.completed_at).getTime() - new Date(entry.started_at).getTime();
    }
  }

  if (existingIndex >= 0) analysis.execution_trace[existingIndex] = entry;
  else analysis.execution_trace.push(entry);

  // --- Per-agent status map (Section 99.1 agent_statuses) ----------------
  analysis.agent_statuses = { ...(analysis.agent_statuses || {}), [agent]: message.status };

  // Section 107: selected/skipped agents with reasons.
  if (message.status === 'skipped') {
    const already = (analysis.skipped_agents || []).some((s) => s.agent === agent);
    if (!already) {
      analysis.skipped_agents.push({
        agent,
        reason: message.selection_reason || 'not_required_for_this_intent',
      });
    }
  } else if (!analysis.selected_agents.includes(agent)) {
    analysis.selected_agents.push(agent);
  }

  // --- Inline data (ProgressMessage.data) --------------------------------
  // This is how agent results, the execution plan and risk assessments reach
  // the Backend - NOT via the final result callback.
  if (message.data && typeof message.data === 'object') {
    await absorbProgressData(analysis, agent, message.data);
  }

  // data_ref points at storage the AI Service already wrote. Recorded so the
  // evidence is traceable even though the payload did not travel inline.
  if (message.data_ref) {
    analysis.data_refs = { ...(analysis.data_refs || {}), [agent]: message.data_ref };
  }

  await analysis.save();
  return analysis;
}

/**
 * Persist structured payloads arriving inline on a ProgressMessage.
 *
 * ProgressMessage.data is deliberately untyped in the contract
 * (`type: ["object","null"]`), so we dispatch on well-known keys and ignore
 * anything unrecognised rather than guessing at its meaning.
 */
async function absorbProgressData(analysis, agent, data) {
  // ExecutionPlan from the Planner (contracts/ExecutionPlan.json)
  if (agent === 'planner' || data.primary_intent || data.stages) {
    analysis.plan = data;
    analysis.markModified('plan'); // belt-and-suspenders: Mixed fields on strict:false docs are not always auto-detected as dirty by plain assignment

    if (data.primary_intent) analysis.primary_intent = data.primary_intent;
    if (Array.isArray(data.secondary_intents)) analysis.secondary_intents = data.secondary_intents;
    if (data.response_language) analysis.response_language = data.response_language;
    if (data.language_detection?.detected) analysis.detected_language = data.language_detection.detected;
    if (data.location) analysis.location = data.location;
    if (data.time_window) analysis.time_window = data.time_window;
    if (data.sampling) analysis.sampling = data.sampling;
    if (data.vessel_type) analysis.vessel_type = data.vessel_type;
    if (data.vessel_assumed !== undefined) analysis.vessel_type_assumed = data.vessel_assumed;
    if (Array.isArray(data.selected_agents)) {
      // AgentSelection is { agent, reason, mandatory_by_policy } - flatten to
      // names for the summary list, keeping the reasons in plan.
      analysis.selected_agents = data.selected_agents.map((s) =>
        typeof s === 'string' ? s : s.agent
      );
    }
    if (Array.isArray(data.skipped_agents)) {
      analysis.skipped_agents = data.skipped_agents.map((s) =>
        typeof s === 'string' ? { agent: s, reason: null } : { agent: s.agent, reason: s.reason }
      );
    }
  }

  // AgentResult (contracts/AgentResult.json): normalized + raw
  if (data.agent_name && (data.normalized !== undefined || data.raw !== undefined)) {
    await AgentResult.findOneAndUpdate(
      { analysis_id: analysis.analysis_id, agent_name: data.agent_name },
      { ...data, analysis_id: analysis.analysis_id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // RiskAssessment array (contracts/db/RiskResultsDocument.json: { results })
  if (Array.isArray(data.results) && data.results.some((r) => r.point_id && r.final_score !== undefined)) {
    await RiskResult.findOneAndUpdate(
      { analysis_id: analysis.analysis_id },
      { analysis_id: analysis.analysis_id, results: data.results },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // Sampled points (contracts/PointObservation.json)
  if (Array.isArray(data.points) && data.points.length) {
    analysis.points = data.points;
  }

  // DataQuality (contracts/shared/DataQuality.json)
  if (data.data_quality) analysis.data_quality = data.data_quality;
}

/**
 * Apply the FINAL result - contracts/api/InternalResultPayload.json.
 *
 * Contract shape (`additionalProperties: false`):
 *   required: analysis_id, final_stage, status
 *   optional: error, and EXACTLY ONE of decision / route_result /
 *             trend_result / report_content / quick_information_result,
 *             matching final_stage.
 *
 * Note what is NOT here: agent_results, risk_result, execution_trace. Those
 * arrive during execution via ProgressMessage - see applyProgress.
 */
async function applyResult(analysisId, payload) {
  const analysis = await Analysis.findOne({ analysis_id: analysisId });
  if (!analysis) {
    const error = new AppError(`Analysis ${analysisId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = 404;
    throw error;
  }

  const log = forAnalysis(analysisId);

  // Idempotency: Section 103 requires retries to be safe.
  if (['completed', 'partial', 'failed'].includes(analysis.status)) {
    log.info({ status: analysis.status }, '[analysis] Result already recorded - ignoring duplicate');
    return analysis;
  }

  const finalStage = payload.final_stage;

  // --- Persist the intent-specific artefact ------------------------------
  switch (finalStage) {
    case 'decision':
      if (payload.decision) {
        await Decision.findOneAndUpdate(
          { analysis_id: analysisId },
          { ...payload.decision, analysis_id: analysisId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      break;

    case 'route':
      if (payload.route_result) {
        const existingRoute = await Route.findOne({
          $or: [{ analysis_id: analysisId }, { route_id: payload.route_result.route_id }],
        });
        const preservedRouteId = existingRoute ? existingRoute.route_id : payload.route_result.route_id;
        await Route.findOneAndUpdate(
          { $or: [{ analysis_id: analysisId }, { route_id: preservedRouteId }] },
          { ...payload.route_result, route_id: preservedRouteId, analysis_id: analysisId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      break;

    case 'trend':
      // TrendResult has no dedicated collection in Section 99; it is stored on
      // the analysis as the final artefact.
      analysis.trend_result = payload.trend_result || null;
      break;

    case 'report':
      analysis.report_content = payload.report_content || null;
      break;

    case 'quick_information':
      analysis.quick_information_result = payload.quick_information_result || null;
      break;

    default:
      log.warn({ final_stage: finalStage }, '[analysis] Unknown final_stage - artefact not persisted');
  }

  analysis.final_stage = finalStage;

  // Section 9 lifecycle. The AI Service decides completed vs partial vs failed,
  // because only it knows whether a mandatory safety agent failed (Section 104).
  analysis.status = payload.status;

  if (payload.error) {
    analysis.error_category = payload.error.error_category || null;
    analysis.error_message = payload.error.message || null;
  }

  analysis.completed_at = new Date();

  await analysis.save();
  log.info({ status: analysis.status, final_stage: finalStage }, '[analysis] Final result recorded');

  // --- Asynchronous Audio Pre-Generation (Section 102/103) -----------------
  // Gated: Pre-generate ONLY for user-initiated analyses, completely skipping
  // scheduled background checks (which carry alert_subscription_id).
  // Non-blocking: executed via setImmediate, never delaying the analysis response.
  if (!analysis.alert_subscription_id && ['completed', 'partial'].includes(analysis.status)) {
    setImmediate(() => {
      try {
        const voiceService = require('../voice/voice.service');
        const targetLang = analysis.response_language || analysis.detected_language || 'en';
        voiceService.preGenerateAudio(analysisId, targetLang).catch((voiceErr) => {
          logger.warn(
            { analysis_id: analysisId, err: voiceErr.message },
            '[analysis] Background audio pre-generation failed'
          );
        });
      } catch (err) {
        logger.warn(
          { analysis_id: analysisId, err: err.message },
          '[analysis] Failed to trigger background audio pre-generation'
        );
      }
    });
  }

  // If this analysis was triggered from chat, persist the assistant's reply into the conversation thread
  if (analysis.conversation_id) {
    try {
      const chatService = require('../chat/chat.service');
      const content =
        payload.decision?.advisory_text ||
        payload.decision?.explanation ||
        payload.report_content ||
        payload.error?.message ||
        'Sea condition safety analysis complete.';
      await chatService.appendAssistantMessage(analysis.conversation_id, {
        content,
        language: analysis.response_language || analysis.detected_language || 'en',
        analysisId: analysis.analysis_id,
        suggestedFollowups: payload.decision?.recommended_actions || [],
      });
      log.info({ conversation_id: analysis.conversation_id }, '[analysis] Persisted assistant reply to conversation');
    } catch (chatErr) {
      log.warn({ err: chatErr.message }, '[analysis] Failed to append assistant message to conversation');
    }
  }

  return analysis;
}

module.exports = {
  createAnalysis,
  getAnalysisOrThrow,
  getFullResult,
  getStatus,
  applyProgress,
  applyResult,
  buildContractRequest,
};
