// src/clients/aiService.client.js
// ---------------------------------------------------------------------------
// The ONLY place the Backend talks to the AI Service (Section 102).
//
// Section 103 defines the handoff precisely:
//   POST {AI_SERVICE_URL}/v1/analysis/execute
//   (contracts/api/AnalysisExecutionRequest.json - resolved over architecture
//   doc §103's /internal/v1/execute, which the contract's own description
//   notes was never actually specified there. Contracts win.)
//   body: contracts/api/AnalysisExecutionRequest.json
//   response: 202 Accepted IMMEDIATELY - the AI Service does not block
//   auth: the same internal signed short-lived token (Section 98)
//   idempotency: retrying with an analysis_id already running/completed
//                returns 200 and does NOT start a second execution
//
// The Backend therefore does NOT wait for the analysis. It hands off, marks
// the analysis `running`, and waits for the AI Service to call back on
// /internal/v1/progress and /internal/v1/result.

// ---------------------------------------------------------------------------

const axios = require('axios');
const env = require('../config/env');
const limits = require('../config/limits');
const { issueInternalToken, TOKEN_HEADER } = require('../middleware/internalAuth');
const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { logger } = require('../observability/logger');

const client = axios.create({
  baseURL: env.AI_SERVICE_URL,
  // This timeout covers the HANDOFF ONLY, not the analysis. The AI Service is
  // required to return 202 immediately, so 10s is generous.
  timeout: limits.AI_SERVICE_HANDOFF_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/** Sleep helper for retry backoff. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hand an accepted analysis to the AI Service.
 *
 * @param {object} executionRequest Conforms to AnalysisExecutionRequest.json
 * @returns {Promise<{ accepted: boolean, status: number, alreadyRunning: boolean }>}
 */
async function execute(executionRequest) {
  const analysisId = executionRequest.analysis_id;
  const log = logger.child({ analysis_id: analysisId, stage: 'ai_service_handoff' });

  let lastError = null;

  // attempt 0 is the first try; subsequent attempts are retries.
  for (let attempt = 0; attempt <= limits.AI_SERVICE_MAX_RETRIES; attempt += 1) {
    try {
      // A fresh token per attempt: tokens are short-lived (120s) and a retry
      // after backoff could otherwise carry an already-expired one.
      const token = issueInternalToken({ analysis_id: analysisId });

      const response = await client.post('/v1/analysis/execute', executionRequest, {
        headers: { [TOKEN_HEADER]: token },
        // Resolve on any status < 500 so we can inspect 4xx rather than throw.
        validateStatus: (status) => status < 500,
      });

      // Section 103: 202 = accepted and now running.
      if (response.status === 202) {
        log.info({ attempt }, '[aiService] Analysis accepted by AI Service (202)');
        return { accepted: true, status: 202, alreadyRunning: false };
      }

      // Section 103 idempotency: 200 = already running or completed. This is a
      // SUCCESS, not an error - a duplicate handoff must not be retried or
      // treated as a failure.
      if (response.status === 200) {
        log.info({ attempt }, '[aiService] Analysis already running/completed (200, idempotent)');
        return { accepted: true, status: 200, alreadyRunning: true };
      }

      // Any other 4xx means our REQUEST is wrong. Retrying an identical bad
      // request will fail identically, so fail fast instead of burning retries.
      log.error(
        { status: response.status, body: response.data },
        '[aiService] AI Service rejected the execution request'
      );
      throw new AppError(
        `AI Service rejected the analysis request (HTTP ${response.status}).`,
        ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
        { ai_service_status: response.status, ai_service_body: response.data }
      );
    } catch (err) {
      // Do not retry our own deliberate 4xx classification.
      if (err instanceof AppError) throw err;

      lastError = err;
      const isLastAttempt = attempt === limits.AI_SERVICE_MAX_RETRIES;

      log.warn(
        { attempt, err: err.message, code: err.code },
        isLastAttempt
          ? '[aiService] Handoff failed - no retries left'
          : '[aiService] Handoff failed - retrying'
      );

      if (!isLastAttempt) {
        // Exponential backoff: 500ms, 1000ms, 2000ms...
        await sleep(500 * 2 ** attempt);
      }
    }
  }

  // Every attempt failed => the AI Service is genuinely unreachable.
  // Section 40: 502 Bad Gateway via upstream_unavailable.
  throw new AppError(
    'AI Service is unavailable. The analysis was saved but could not be started.',
    ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
    { last_error: lastError?.message, code: lastError?.code }
  );
}

/**
 * Liveness check used by GET /health.
 * Never throws - health reporting must not itself fail.
 */
async function healthCheck() {
  try {
    const response = await client.get('/health', { timeout: 3000 });
    return { reachable: true, status: response.status };
  } catch (err) {
    return { reachable: false, error: err.message, code: err.code || null };
  }
}

module.exports = { execute, healthCheck, client };
