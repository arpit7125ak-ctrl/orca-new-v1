// src/modules/internal/progress.controller.js
// ---------------------------------------------------------------------------
// Section 103: POST /internal/v1/progress - AI Service progress update.
//
// Called repeatedly by the AI Service as each agent/stage starts and finishes.
// Powers the Frontend progress bar and the Section 79 "visible reasoning" panel.
//
// This endpoint is HOT - it may be hit many times per analysis - so it must be
// fast and tolerant. It returns 200 even for an unknown stage rather than
// making the AI Service handle our errors mid-pipeline.
// ---------------------------------------------------------------------------

const analysisService = require('../analysis/analysis.service');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');
const { forAnalysis } = require('../../observability/logger');

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
