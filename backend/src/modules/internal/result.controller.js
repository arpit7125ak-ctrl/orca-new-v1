/**
 * @fileoverview Terminal Analysis Result Webhook Controller
 * @module modules/internal/result.controller
 * @description
 * Sections 101 & 103 (`POST /internal/v1/result`):
 * Ingests completed analysis packages (`contracts/api/InternalResultPayload.json`)
 * transmitted by the Python AI service upon pipeline completion.
 *
 * Operational Responsibilities:
 * - Evidence Chain Storage: Atomically saves decision documents, agent raw/normalized
 *   results, point measurements, and risk assessments into MongoDB.
 * - State Transition: Moves job state from `running` to `completed`, `partial`, or `failed`.
 * - Idempotency: Duplicate result deliveries are safely absorbed without state corruption.
 */

const analysisService = require('../analysis/analysis.service');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');
const { forAnalysis } = require('../../observability/logger');

/**
 * Ingests terminal analysis outcomes from AI microservice.
 * @type {import('express').RequestHandler}
 */
const postResult = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId } = req.body;

  if (!analysisId) {
    return res.status(HTTP.BAD_REQUEST).json({
      success: false,
      error: { message: 'analysis_id is required in the result payload.' },
    });
  }

  const log = forAnalysis(analysisId, { stage: 'internal_result' });

  const analysis = await analysisService.applyResult(analysisId, req.body);

  // The payload is validated against InternalResultPayload.json by middleware
  // before reaching here, so by this point the shape is known-good.
  log.info(
    { status: analysis.status, final_stage: req.body.final_stage },
    '[internal] Final result persisted'
  );

  return res.status(HTTP.OK).json({
    success: true,
    data: {
      analysis_id: analysisId,
      status: analysis.status,
      completed_at: analysis.completed_at,
    },
  });
});

module.exports = { postResult };
