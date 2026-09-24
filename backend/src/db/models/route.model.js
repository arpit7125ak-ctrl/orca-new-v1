/**
 * @fileoverview Maritime Route Planning & Navigational Corridor Schema
 * @module db/models/route.model
 * @description
 * Sections 99.9, 104 & `contracts/api/RouteRequest.json`:
 * Persists evaluated marine navigational routes, waypoints, temporal risk horizons,
 * and geofence obstruction reasons.
 *
 * Operational Mechanics:
 * - Dynamic Temporal Waypoint Risk: Tracks `risk_level` and ETA at each discrete
 *   waypoint so safety is evaluated for the exact expected transit hour.
 * - Pathfinding Separation: Backend stores the navigational plan and waypoints;
 *   A* graph search pathfinding algorithm executes in the Python AI service (`pathfinder.py`).
 */

const mongoose = require('mongoose');


const WaypointSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    // Risk at this waypoint at the time the vessel is expected to reach it -
    // a route is only safe if it is safe WHEN you are there, not on average.
    // UPPERCASE per contracts/RiskAssessment.json (SAFE|CAUTION|UNSAFE|
    // DANGEROUS) - matches every other risk_level field in this system.
    risk_level: { type: String, enum: ['SAFE', 'CAUTION', 'UNSAFE', 'DANGEROUS', null], default: null },
    risk_score: { type: Number, default: null },
    eta_utc: { type: String, default: null },
    cumulative_distance_km: { type: Number, default: null },
    point_id: { type: String, default: null },
  },
  { _id: false }
);

// contracts/RouteResult.json: blocking_reasons is an array of PLAIN STRINGS
// ("free-form, e.g. 'GIS-prohibited polygon blocks all corridors'"), NOT an
// array of structured objects. The structured version below was invented -
// caught by reading the actual contract rather than the architecture doc.

const RouteSchema = new mongoose.Schema(
  {
    route_id: { type: String, required: true, unique: true, index: true },
    analysis_id: { type: String, default: null, index: true },

    // Section 7.9 + contracts/api/RouteRequest.json: origin and destination
    // are place_or_coordinate objects ({ place_name?, coordinate?: {lat,lon} }).
    //
    // THESE MUST BE Mixed, NOT a fixed { lat, lon, place_name } sub-schema.
    // An explicitly typed sub-schema field auto-applies its own defaults on
    // save regardless of what was actually sent - which is exactly what
    // happened here: storing a real { place_name, coordinate: {lat,lon} }
    // object into a { lat, lon, place_name } sub-schema left the correct
    // fields in place AND silently added stray lat:null, lon:null alongside
    // them, because those were still separately-defined schema paths. Caught
    // by live testing - the GET /route/:id response showed both shapes at
    // once.
    request: {
      origin: { type: mongoose.Schema.Types.Mixed, required: true },
      destination: { type: mongoose.Schema.Types.Mixed, required: true },
      departure_time: { type: String, default: null },
      vessel_type: { type: String, default: null },
      activity: { type: String, default: null },
      language_override: { type: String, default: null },
    },

    // Reference to the risk-cost grid the pathfinder used. Stored as a
    // reference, not inline - a full grid is large and re-derivable.
    corridor_grid_ref: { type: String, default: null },

    // Null when no safe route exists. Section 105 requires "no allowed point /
    // do-not-venture" to be representable - the route equivalent is an empty
    // path with blocking reasons, NOT a dangerous path returned anyway.
    waypoints: { type: [WaypointSchema], default: [] },

    total_distance_km: { type: Number, default: null },
    estimated_duration_hours: { type: Number, default: null },
    // Contract field names, matching RiskAssessment's own naming exactly.
    max_risk_score: { type: Number, default: null },
    max_risk_level: { type: String, enum: ['SAFE', 'CAUTION', 'UNSAFE', 'DANGEROUS', null], default: null },
    // Free-form structured entries describing risk at specific points along
    // the passage - kept as Mixed since the contract does not lock this shape
    // down beyond "array".
    time_of_passage_risk: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // contracts/RouteResult.json: plain strings, e.g. "GIS-prohibited polygon
    // blocks all corridors" - populated only when status='no_safe_route'.
    blocking_reasons: { type: [String], default: [] },

    generated_advisory: { type: String, default: null },
    language: { type: String, default: null },

    // contracts/RouteResult.json status enum exactly - note 'no_safe_route',
    // not 'partial'. A route either has a path or it explicitly does not;
    // there is no partial-route concept the way there is a partial analysis.
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'no_safe_route', 'failed'],
      default: 'queued',
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'routes',
    strict: false,
  }
);

module.exports = mongoose.model('Route', RouteSchema);
