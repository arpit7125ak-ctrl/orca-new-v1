/**
 * @fileoverview Mid-Execution Progress Webhook Controller
 * @module modules/internal/progress.controller
 * @description
 * Section 103 (`POST /internal/v1/progress`):
 * Receives granular stage execution notifications (`contracts/ProgressMessage.json`)
 * broadcasted by the AI microservice during multi-agent analysis runs.
 *
 * Operational Responsibilities:
 * - Telemetry Ingestion: Appends stage entries to `execution_trace` in MongoDB.
 * - Client Polling Feed: Calculates real-time completion percentages feeding frontend
 *   progress bars (`ProgressTracker.jsx`) and Section 79 reasoning panels.
 */

const analysisService = require('../analysis/analysis.service');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');
const { forAnalysis } = require('../../observability/logger');

/**
 * Handles incoming stage progress updates from AI service.
 * @type {import('express').RequestHandler}
 */
const postProgress = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId } = req.body;

  if (!analysisId) {
    return res.status(HTTP.BAD_REQUEST).json({
      success: false,
      error: { message: 'analysis_id is required in the progress payload.' },
    });
  }

  const log = forAnalysis(analysisId, { stage: 'internal_progress' });

  const analysis = await analysisService.applyProgress(analysisId, req.body);

  log.debug(
    { agent: req.body.agent, agent_status: req.body.status },
    '[internal] Progress recorded'
  );

  return res.status(HTTP.OK).json({
    success: true,
    data: { analysis_id: analysisId, status: analysis.status },
  });
});

module.exports = { postProgress };
