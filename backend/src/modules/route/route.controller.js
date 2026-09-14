// src/modules/route/route.controller.js
// Section 103: POST /api/v1/route, GET /api/v1/route/:route_id

const routeService = require('./route.service');
const asyncHandler = require('../../utils/asyncHandler');
const { validateRouteRequest } = require('../analysis/analysis.validator');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');

const createRoute = asyncHandler(async (req, res) => {
  // Section 7.9: both origin and destination are mandatory.
  const validation = validateRouteRequest(req.body);
  if (!validation.valid) {
    throw new AppError('Route request validation failed.', ERROR_CATEGORIES.VALIDATION_FAILURE, {
      violations: validation.errors,
    });
  }

  const { route, dispatched, dispatchError } = await routeService.createRoute(req.body);

  if (!dispatched) {
    // The route.route_id MUST be recoverable here - it is the only way to
    // check on a saved-but-not-dispatched route later. This was missing
    // entirely (found by live testing): the response had no `data` field at
    // all, unlike the equivalent case in analysis.controller.js, so a client
    // that hit this path had a saved route with no way to look it up.
    return res.status(HTTP.BAD_GATEWAY).json({
      success: false,
      error: {
        message: 'Route request was saved but could not be started - the AI Service is unavailable.',
        error_category: ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
        details: { dispatch_error: dispatchError },
        request_id: req.requestId,
      },
      data: { route_id: route.route_id, status: route.status },
      data: { route_id: route.route_id, status: route.status },
    });
  }

  // contracts/RouteResult.json is the GET shape; creation returns the handle.
  return res.status(HTTP.ACCEPTED).json({
    route_id: route.route_id,
    analysis_id: route.analysis_id,
    status: route.status,
    status_url: `/api/v1/route/${route.route_id}`,
  });
});

const getRoute = asyncHandler(async (req, res) => {
  const route = await routeService.getRoute(req.params.route_id);

  // contracts/RouteResult.json:
  //   required: route_id, status, origin, destination, vessel_type
  //   optional: analysis_id, error, waypoints, total_distance_km,
  //             estimated_duration_hours, max_risk_score, max_risk_level,
  //             time_of_passage_risk, blocking_reasons, generated_at
  // additionalProperties: false - so `path_found` and `generated_advisory`,
  // which are not in the contract, are not returned. An empty waypoints array
  // together with populated blocking_reasons IS the "no safe path" answer.
  const response = {
    route_id: route.route_id,
    status: route.status,
    origin: route.request?.origin ?? null,
    destination: route.request?.destination ?? null,
    vessel_type: route.request?.vessel_type ?? null,
  };

  if (route.analysis_id) response.analysis_id = route.analysis_id;
  if (route.error) response.error = route.error;
  if (Array.isArray(route.waypoints)) response.waypoints = route.waypoints;
  if (route.total_distance_km !== null && route.total_distance_km !== undefined) {
    response.total_distance_km = route.total_distance_km;
  }
  if (route.estimated_duration_hours !== null && route.estimated_duration_hours !== undefined) {
    response.estimated_duration_hours = route.estimated_duration_hours;
  }
  if (route.max_risk_score !== null && route.max_risk_score !== undefined) {
    response.max_risk_score = route.max_risk_score;
  }
  if (route.max_risk_level) response.max_risk_level = route.max_risk_level;
  if (route.time_of_passage_risk) response.time_of_passage_risk = route.time_of_passage_risk;
  // Populated when no safe path exists - this IS the answer, not an error.
  if (Array.isArray(route.blocking_reasons) && route.blocking_reasons.length) {
    response.blocking_reasons = route.blocking_reasons;
  }
  if (route.generated_at) response.generated_at = route.generated_at;

  return res.status(HTTP.OK).json(response);
});

module.exports = { createRoute, getRoute };
