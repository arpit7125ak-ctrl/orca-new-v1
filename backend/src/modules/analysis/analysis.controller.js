// src/modules/analysis/analysis.controller.js
// ---------------------------------------------------------------------------
// HTTP layer for analysis. Thin by design: parse, call the service, pick a
// status code, respond. Logic lives in analysis.service.js so chat and the
// alert worker can reuse it without HTTP.
//
// RESPONSE SHAPES ARE LOCKED:
//   POST   -> contracts/api/AnalysisCreatedResponse.json
//             { analysis_id, status, status_url }  additionalProperties: false
//   GET    -> contracts/api/AnalysisResultResponse.json
//   GET /status -> contracts/api/AnalysisStatusResponse.json
//
// These are returned at the TOP LEVEL, not wrapped in { success, data }. The
// contracts describe the response body itself, so a wrapper would violate them.
// Error responses keep the { success:false, error } envelope from errorHandler,
// which is separate and not contract-governed.
// ---------------------------------------------------------------------------

const asyncHandler = require('../../utils/asyncHandler');
const analysisService = require('./analysis.service');
const { validateAnalysisRequest } = require('./analysis.validator');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP, statusForAnalysisState } = require('../../errors/httpStatus');
const { isValidAnalysisId } = require('../../utils/ids');

/**
 * POST /api/v1/analysis
 * Section 40: 202 Accepted - accepted for ASYNCHRONOUS execution.
 */
const createAnalysis = asyncHandler(async (req, res) => {
  const validation = validateAnalysisRequest(req.body);
  if (!validation.valid) {
    throw new AppError(
      'Request validation failed.',
      validation.errorCategory || ERROR_CATEGORIES.VALIDATION_FAILURE,
      { violations: validation.errors }
    );
  }

  // utc_offset_minutes is NOT part of contracts/AnalysisRequest.json, so it is
  // read from a header instead of the body. Without it the Backend cannot build
  // a truthful TimeWindow and leaves it null for the Planner (never guesses).
  const offsetHeader = req.headers['x-utc-offset-minutes'];
  const utcOffsetMinutes =
    offsetHeader !== undefined && offsetHeader !== '' && !Number.isNaN(Number(offsetHeader))
      ? Number(offsetHeader)
      : undefined;

  const { analysis, dispatched, dispatchError } = await analysisService.createAnalysis(
    req.body,
    {},
    { utcOffsetMinutes }
  );

  // Dispatch failed => the AI Service is down. The analysis is stored as
  // `failed`; we report 502 rather than pretending it was accepted. The
  // analysis_id is still returned so the client can inspect or retry it.
  if (!dispatched) {
    return res.status(HTTP.BAD_GATEWAY).json({
      success: false,
      error: {
        message: 'Analysis was saved but could not be started - the AI Service is unavailable.',
        error_category: analysis.error_category,
        details: { dispatch_error: dispatchError, analysis_id: analysis.analysis_id },
        request_id: req.requestId,
      },
    });
  }

  // contracts/api/AnalysisCreatedResponse.json - exactly these three fields.
  // IMPORTANT: `status` has a SINGLE-VALUE enum: ["queued"]. It must NEVER
  // reflect the post-dispatch state (e.g. "running"), even though the
  // analysis document itself may already say `running` by the time we
  // respond. This endpoint answers "was the request accepted?", not "what is
  // the current state?" - that second question is what /status is for.
  return res.status(HTTP.ACCEPTED).json({
    analysis_id: analysis.analysis_id,
    status: 'queued',
    status_url: `/api/v1/analysis/${analysis.analysis_id}/status`,
  });
});

/**
 * GET /api/v1/analysis/:analysis_id
 * Section 40: 200 when completed, 206 Partial Content when partial.
 */
const getAnalysis = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId } = req.params;

  // Validate the ID shape BEFORE hitting the database - a malformed ID is a
  // 400, not a 404, and this avoids a pointless query.
  if (!isValidAnalysisId(analysisId)) {
    throw new AppError(
      'analysis_id is malformed. Expected format: req_YYYYMMDD_HHMM_xxxxxx',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const includeRaw = req.query.include_raw === 'true';
  const { analysis, body } = await analysisService.getFullResult(analysisId, { includeRaw });

  // 206 is what tells the Frontend to show "some data unavailable" rather than
  // presenting a partial answer as complete.
  const status = statusForAnalysisState(analysis.status, analysis.error_category);

  return res.status(status).json(body);
});

/**
 * GET /api/v1/analysis/:analysis_id/status
 * Always 200 while in flight - the POLL succeeded even if the analysis has not
 * finished. The body carries the real state.
 */
const getAnalysisStatus = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId } = req.params;

  if (!isValidAnalysisId(analysisId)) {
    throw new AppError(
      'analysis_id is malformed. Expected format: req_YYYYMMDD_HHMM_xxxxxx',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const { body } = await analysisService.getStatus(analysisId);
  return res.status(HTTP.OK).json(body);
});

module.exports = { createAnalysis, getAnalysis, getAnalysisStatus };
