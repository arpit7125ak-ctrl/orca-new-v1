// src/modules/trend/trend.controller.js
// Section 103: POST /api/v1/trend
// Request shape: contracts/api/TrendRequest.json (validated in the service).

const asyncHandler = require('../../utils/asyncHandler');
const trendService = require('./trend.service');
const { ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');

const createTrend = asyncHandler(async (req, res) => {
  // All validation lives in the service so the alert worker and chat can reuse
  // it without going through HTTP.
  const { analysis, dispatched, dispatchError } = await trendService.createTrendAnalysis(req.body);

  if (!dispatched) {
    // analysis_id belongs in a top-level `data` field, not buried in
    // error.details - matching the pattern in analysis.controller.js and now
    // route.controller.js, so every "saved but not dispatched" response is
    // recoverable the same way.
    return res.status(HTTP.BAD_GATEWAY).json({
      success: false,
      error: {
        message: 'Trend request was saved but could not be started - the AI Service is unavailable.',
        error_category: ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
        details: { dispatch_error: dispatchError },
        request_id: req.requestId,
      },
      data: { analysis_id: analysis.analysis_id, status: analysis.status },
    });
  }

  return res.status(HTTP.ACCEPTED).json({
    analysis_id: analysis.analysis_id,
    status: analysis.status,
    status_url: `/api/v1/analysis/${analysis.analysis_id}/status`,
  });
});

module.exports = { createTrend };
