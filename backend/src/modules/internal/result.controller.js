// src/modules/internal/result.controller.js
// ---------------------------------------------------------------------------
// Section 103: POST /internal/v1/result - AI Service final result.
// Section 101: the Backend persists the final response plus ALL supporting
// evidence (agent results, risk results, sampled points, GIS/PFZ/Ecosystem
// info, official warnings applied, errors, data quality, execution trace).
//
// IDEMPOTENT BY DESIGN: analysis.service.applyResult() ignores a second result
// for an already-terminal analysis, so an AI Service retry cannot corrupt a
// stored result.
// ---------------------------------------------------------------------------

const analysisService = require('../analysis/analysis.service');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');
const { forAnalysis } = require('../../observability/logger');

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
