// src/modules/analysis/analysis.routes.js
// ---------------------------------------------------------------------------
// Section 103 - Analysis endpoints:
//   POST /api/v1/analysis                      create analysis
//   GET  /api/v1/analysis/:analysis_id         full result
//   GET  /api/v1/analysis/:analysis_id/status  poll status/progress
//
// Route ORDER matters in Express: /:analysis_id/status is declared BEFORE
// /:analysis_id so that "status" is not swallowed as an analysis_id.
// ---------------------------------------------------------------------------

const express = require('express');
const controller = require('./analysis.controller');
const validateContract = require('../../middleware/validateContract');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// POST /api/v1/analysis
// analysisLimiter is tighter than the general limiter: one call fans out to
// several agents and multiple LLM calls.
// validateContract runs FIRST (contract is the source of truth), then the
// module validator applies the Section 7 rules that a JSON Schema cannot
// express - e.g. "at least one of query/coords/place_name".
router.post(
  '/',
  analysisLimiter,
  validateContract('AnalysisRequest.json'),
  controller.createAnalysis
);

// Specific routes first
router.get('/latest', controller.getLatestAnalysis);
router.get('/:analysis_id/status', controller.getAnalysisStatus);

router.get('/:analysis_id', controller.getAnalysis);

module.exports = router;
