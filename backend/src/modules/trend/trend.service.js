/**
 * @fileoverview Trend Analysis Service
 * Handles historical and trend analysis requests, validating periods and parameters.
 * Maps requests to the core analysis pipeline.
 *
 * @module trend.service
 */

// src/modules/trend/trend.service.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/trend - historical/trend analysis.
// Answers "Why has fish productivity declined in a particular coastal region?"
//
// CONTRACT: contracts/api/TrendRequest.json
//   required: parameter
//   optional: query, coordinate, place_name, baseline_period,
//             analysis_period, language_override
//   additionalProperties: false
//
// Note `parameter` is REQUIRED and the periods are `baseline_period` /
// `analysis_period` objects - NOT from_date/to_date. A trend is always a trend
// IN something, which is why the parameter is mandatory: "why has productivity
// declined" has to resolve to a measurable series (chlorophyll, SST, ...).
//
// Trend requests run through the SAME analysis pipeline; the difference is
// intent and that the window points BACKWARD. Section 7.4 notes past dates are
// routed to historical/trend rather than rejected.
// ---------------------------------------------------------------------------

const analysisService = require('../analysis/analysis.service');
const { isValidIsoDate } = require('../../utils/time');
const registry = require('../../config/registry');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');

/**
 * Validate a period object { start, end } of ISO dates.
 * Structural only - whether the period is COVERED by available historical data
 * is semantic and belongs to the Planner (Section 7.10).
 */
function validatePeriod(period, fieldName, errors) {
  if (period === undefined || period === null) return;

  if (typeof period !== 'object' || Array.isArray(period)) {
    errors.push({ field: fieldName, message: `${fieldName} must be an object { start, end }.` });
    return;
  }

  if (!isValidIsoDate(period.start) || !isValidIsoDate(period.end)) {
    errors.push({
      field: fieldName,
      message: `${fieldName}.start and ${fieldName}.end must be ISO 8601 dates (YYYY-MM-DD).`,
    });
    return;
  }

  if (new Date(period.start) > new Date(period.end)) {
    errors.push({ field: fieldName, message: `${fieldName}.start must not be later than ${fieldName}.end.` });
  }
}

async function createTrendAnalysis(body) {
  const errors = [];

  // `parameter` is contract-required.
  if (!body.parameter || typeof body.parameter !== 'string') {
    errors.push({
      field: 'parameter',
      message: 'parameter is required - a trend must be a trend in a specific measurable quantity.',
    });
  } else if (!registry.getCanonicalUnit(body.parameter)) {
    // Not fatal: the canonical-units list covers the parameters we score on,
    // but the AI Service may hold historical series we do not. Warn-shaped
    // rather than reject-shaped would be wrong here though, because a typo'd
    // parameter silently returning nothing is worse than a clear error.
    errors.push({
      field: 'parameter',
      message:
        `Unknown parameter "${body.parameter}". ` +
        `Known parameters: ${Object.keys(registry.canonicalUnits).join(', ')}.`,
    });
  }

  validatePeriod(body.baseline_period, 'baseline_period', errors);
  validatePeriod(body.analysis_period, 'analysis_period', errors);

  const hasCoordinate = body.coordinate !== undefined && body.coordinate !== null;
  const hasPlaceName = typeof body.place_name === 'string' && body.place_name.trim().length > 0;

  if (!hasCoordinate && !hasPlaceName) {
    errors.push({
      field: '(root)',
      message: 'Either coordinate { lat, lon } or place_name is required - a trend needs a place.',
    });
  }

  if (body.language_override && !registry.isValidLanguage(body.language_override)) {
    errors.push({
      field: 'language_override',
      message: `Unsupported language "${body.language_override}".`,
    });
  }

  if (errors.length) {
    throw new AppError('Trend request validation failed.', ERROR_CATEGORIES.VALIDATION_FAILURE, {
      violations: errors,
    });
  }

  // Map onto contracts/AnalysisRequest.json. The periods and parameter are not
  // AnalysisRequest fields, so they travel in the query text for the Planner to
  // pick up - AnalysisRequest is additionalProperties:false and cannot carry
  // them structurally.
  const query =
    body.query ||
    `Analyse the historical trend in ${body.parameter}` +
    (body.analysis_period ? ` from ${body.analysis_period.start} to ${body.analysis_period.end}` : '') +
    (body.baseline_period
      ? `, compared against the baseline ${body.baseline_period.start} to ${body.baseline_period.end}`
      : '') +
    '.';

  return analysisService.createAnalysis(
    {
      query,
      coordinate: body.coordinate ?? null,
      place_name: body.place_name ?? null,
      language_override: body.language_override || null,
    },
    {}
  );
}

module.exports = { createTrendAnalysis, validatePeriod };
