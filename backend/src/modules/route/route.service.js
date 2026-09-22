// src/modules/route/route.service.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/route, GET /api/v1/route/:route_id
// Section 104: route planning needs Planner + environmental/GIS data +
// risk-cost grid + Route Tool.
//
// The pathfinding itself lives in the AI Service (route/pathfinder.py). The
// Backend creates the route record, dispatches an analysis with
// intent=route_planning, and stores the result.
//
// NEVER-FABRICATE NOTE: when no safe path exists, this returns path_found=false
// WITH blocking_reasons. It never returns a dangerous path as a fallback.
// Section 65.1 makes prohibited zones absolute - they are not a cost to trade
// off against convenience.
// ---------------------------------------------------------------------------

const Route = require('../../db/models/route.model');
const analysisService = require('../analysis/analysis.service');
const { generatePrefixedId } = require('../../utils/ids');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');

async function createRoute(body) {
  const routeId = generatePrefixedId('route');

  const route = new Route({
    route_id: routeId,
    // contracts/api/RouteRequest.json shape: origin/destination are
    // place_or_coordinate objects ({ place_name, coordinate: { lat, lon } }),
    // and the time field is `departure_time`, not `departure_time_utc`.
    request: {
      origin: body.origin,
      destination: body.destination,
      vessel_type: body.vessel_type,
      activity: body.activity || null,
      departure_time: body.departure_time || null,
      language_override: body.language_override || null,
    },
    status: 'queued',
    // path_found stays NULL until the pathfinder reports. Null means "not yet
    // determined"; false would mean "determined: no path exists". Very
    // different things.
    path_found: null,
  });

  await route.save();

  // Route planning runs through the same analysis pipeline, so it inherits the
  // same risk rules, GIS constraints and evidence chain.
  // Route planning runs through the same analysis pipeline, inheriting the same
  // risk rules, GIS constraints and evidence chain. origin/destination on
  // AnalysisRequest are what signal route intent to the Planner - there is no
  // separate `route_request` field in the contract.
  const originCoord = body.origin?.coordinate || (body.origin?.lat !== undefined ? { lat: body.origin.lat, lon: body.origin.lon } : null);
  const originName = body.origin?.place_name || body.origin?.name || null;

  const { analysis, dispatched, dispatchError } = await analysisService.createAnalysis(
    {
      query: body.query || null,
      origin: body.origin,
      destination: body.destination,
      place_name: originName,
      coordinate: originCoord,
      activity: body.activity || null,
      vessel_type: body.vessel_type,
      language_override: body.language_override || null,
    },
    {}
  );

  route.analysis_id = analysis.analysis_id;
  route.status = dispatched ? 'running' : 'failed';
  await route.save();

  return { route, analysis, dispatched, dispatchError };
}

async function getRoute(routeId) {
  const route = await Route.findOne({ route_id: routeId }).lean();
  if (!route) {
    const error = new AppError(`Route ${routeId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = 404;
    throw error;
  }
  return route;
}

module.exports = { createRoute, getRoute };
