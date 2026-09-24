/**
 * @fileoverview Report Controller
 * Handles requests for generated reports. Supports multiple formats and languages.
 *
 * @module report.controller
 */

// src/modules/report/report.controller.js
// Section 103: GET /api/v1/report/:analysis_id

const reportService = require('./report.service');
const asyncHandler = require('../../utils/asyncHandler');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const { isValidAnalysisId } = require('../../utils/ids');
const registry = require('../../config/registry');

const VALID_FORMATS = ['text', 'markdown', 'html', 'json'];

const getReport = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId } = req.params;

  if (!isValidAnalysisId(analysisId)) {
    throw new AppError(
      'analysis_id is malformed. Expected format: req_YYYYMMDD_HHMM_xxxxxx',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const format = req.query.format || 'markdown';
  if (!VALID_FORMATS.includes(format)) {
    throw new AppError(
      `Unsupported format "${format}". Valid: ${VALID_FORMATS.join(', ')}.`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const language = req.query.language || 'en';
  if (!registry.isValidLanguage(language)) {
    throw new AppError(
      `Unsupported language "${language}". Supported: ${registry.validLanguageCodes().join(', ')}.`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const { report, cached } = await reportService.getOrCreateReport(analysisId, { language, format });

  return res.status(HTTP.OK).json({
    success: true,
    data: {
      report_id: report.report_id,
      analysis_id: report.analysis_id,
      format: report.format,
      language: report.language,
      content: report.content,
      summary_line: report.summary_line,
      sources: report.sources,
      generated_at: report.generated_at,
      // Surfaces that repeat fetches return the identical cached record.
      cached,
    },
  });
});

module.exports = { getReport };
