/**
 * @fileoverview Agent Execution Trace & Telemetry Tracking
 * @module observability/trace
 * @description
 * Section 100 (Execution Trace):
 * Builds, mutates, and summarizes the granular lifecycle events and telemetry
 * for every agent and pipeline stage involved in an analysis request.
 *
 * Operational Responsibilities:
 * - Powers Explainable AI UI: Populates the visible reasoning panel, latency waterfall,
 *   and stage status indicators in the frontend (Section 79).
 * - Audit Trail: Logs start/completion timestamps, execution durations, retry counters,
 *   and structured error classifications (Section 106).
 * - Never-Fabricate Integrity: Unfinished stages strictly report `null` for completion
 *   and duration rather than mock zeros or artificial statuses.
 */

const { nowIso, durationMs } = require('../utils/time');


// Per-stage lifecycle status. Distinct from the ANALYSIS status in Section 9 -
// one analysis (status: running) contains many stages at different statuses.
const TRACE_STATUS = Object.freeze({
  PENDING:   'pending',    // selected, not started
  RUNNING:   'running',    // in flight
  COMPLETED: 'completed',  // finished successfully
  FAILED:    'failed',     // finished with an error
  SKIPPED:   'skipped',    // deliberately not run (reason required)
  TIMEOUT:   'timeout',    // exceeded its budget (Section 41)
});

/**
 * Create a new trace entry for a stage that is STARTING.
 *
 * @param {object} p
 * @param {string} p.stage            e.g. "planner", "weather_agent", "risk"
 * @param {boolean} [p.selected]      Section 100: selected true/false
 * @param {string} [p.selectionReason] WHY it was selected or skipped
 * @param {string} [p.summary]
 */
function startEntry({ stage, selected = true, selectionReason = null, summary = null }) {
  return {
    stage,
    selected,
    selection_reason: selectionReason,
    status: TRACE_STATUS.RUNNING,
    status_code: null,
    started_at: nowIso(),
    completed_at: null,   // honestly null until it actually completes
    duration_ms: null,    // honestly null - never 0 as a placeholder
    retry_count: 0,
    error: null,
    error_category: null,
    summary,
  };
}

/**
 * Create a trace entry for a stage that was deliberately NOT run.
 *
 * Section 107 requires skipped agents to be logged WITH REASONS - a skipped
 * agent with no reason is an unexplained gap in the evidence chain, which is
 * exactly what the explainability requirement forbids.
 */
function skippedEntry({ stage, selectionReason }) {
  return {
    stage,
    selected: false,
    selection_reason: selectionReason || 'not_required_for_this_intent',
    status: TRACE_STATUS.SKIPPED,
    status_code: null,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    retry_count: 0,
    error: null,
    error_category: null,
    summary: null,
  };
}

/**
 * Close out a RUNNING entry as completed. Mutates and returns the entry.
 */
function completeEntry(entry, { statusCode = null, summary = null } = {}) {
  entry.status = TRACE_STATUS.COMPLETED;
  entry.status_code = statusCode;
  entry.completed_at = nowIso();
  entry.duration_ms = entry.started_at ? durationMs(entry.started_at, new Date()) : null;
  if (summary) entry.summary = summary;
  return entry;
}

/**
 * Close out a RUNNING entry as failed.
 *
 * error_category is REQUIRED here - Section 107 mandates that failed agents
 * are logged with their category, because that category is what the Risk stage
 * uses to decide whether it can still produce a safe verdict (Section 50).
 */
function failEntry(entry, { error, errorCategory, statusCode = null }) {
  entry.status = TRACE_STATUS.FAILED;
  entry.status_code = statusCode;
  entry.completed_at = nowIso();
  entry.duration_ms = entry.started_at ? durationMs(entry.started_at, new Date()) : null;
  entry.error = typeof error === 'string' ? error : error?.message || 'unknown error';
  entry.error_category = errorCategory;
  return entry;
}

/** Mark a stage as timed out (Section 41: pipeline continues with what it has). */
function timeoutEntry(entry, { statusCode = null } = {}) {
  entry.status = TRACE_STATUS.TIMEOUT;
  entry.status_code = statusCode;
  entry.completed_at = nowIso();
  entry.duration_ms = entry.started_at ? durationMs(entry.started_at, new Date()) : null;
  entry.error = 'stage exceeded its time budget';
  entry.error_category = 'timeout';
  return entry;
}

/** Increment retry count (Section 100 tracks retries explicitly). */
function recordRetry(entry) {
  entry.retry_count += 1;
  return entry;
}

/**
 * Summarise a full trace for the status endpoint.
 *
 * Deliberately returns COUNTS plus the failure reasons, not the whole trace -
 * a polling Frontend needs progress, not the full audit record. The complete
 * trace stays available on the result endpoint.
 */
function summarise(trace = []) {
  const total = trace.length;
  const completed = trace.filter((e) => e.status === TRACE_STATUS.COMPLETED).length;
  const failed = trace.filter((e) => e.status === TRACE_STATUS.FAILED).length;
  const running = trace.filter((e) => e.status === TRACE_STATUS.RUNNING).length;
  const skipped = trace.filter((e) => e.status === TRACE_STATUS.SKIPPED).length;
  const timedOut = trace.filter((e) => e.status === TRACE_STATUS.TIMEOUT).length;

  // Stages that count toward "progress" exclude skipped ones - a skipped stage
  // was never going to run, so including it would inflate the percentage.
  const progressDenominator = total - skipped;

  return {
    total_stages: total,
    completed,
    failed,
    running,
    skipped,
    timed_out: timedOut,
    // null (not 0) when there is nothing to measure - never fabricate progress.
    progress_percent:
      progressDenominator > 0
        ? Math.round((completed / progressDenominator) * 100)
        : null,
    failed_stages: trace
      .filter((e) => e.status === TRACE_STATUS.FAILED || e.status === TRACE_STATUS.TIMEOUT)
      .map((e) => ({ stage: e.stage, error_category: e.error_category, error: e.error })),
    skipped_stages: trace
      .filter((e) => e.status === TRACE_STATUS.SKIPPED)
      .map((e) => ({ stage: e.stage, reason: e.selection_reason })),
  };
}

module.exports = {
  TRACE_STATUS,
  startEntry,
  skippedEntry,
  completeEntry,
  failEntry,
  timeoutEntry,
  recordRetry,
  summarise,
};
