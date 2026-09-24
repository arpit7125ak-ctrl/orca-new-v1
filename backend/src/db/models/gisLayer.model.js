/**
 * @fileoverview Maritime GIS Spatial Layers & Constraint Zones Schema
 * @module db/models/gisLayer.model
 * @description
 * Sections 65.1, 67.1 & `contracts/db/GisLayerDocument.json`:
 * Stores maritime boundaries, marine protected areas (MPAs), international maritime
 * boundary lines (IMBL), and naval exercise zones.
 *
 * Performance & Dual-Geometry Strategy:
 * - Dual Geometry Storage: Stores `geometry_full` (full resolution with `2dsphere` index)
 *   for sub-second backend spatial operations, and `geometry_simplified` (Douglas-Peucker
 *   reduced vertices) for low-bandwidth mobile rendering.
 * - Constraint Enforcements: Tags layers as `prohibited`, `conditional`, or `warning_only`.
 */

const mongoose = require('mongoose');


// Section 65.1 constraint types:
//   prohibited   - a point/route can NEVER be recommended here
//   conditional  - allowed only for certain vessels or seasons
//   warning_only - allowed, but the user is warned (e.g. near a boundary)
const CONSTRAINT_TYPES = ['prohibited', 'conditional', 'warning_only'];

const GisLayerSchema = new mongoose.Schema(
  {
    layer_name: { type: String, required: true, index: true },

    // Section 67: EEZ, territorial waters, contiguous zone, MPA, ecologically
    // sensitive, restricted, ports, coastline, bathymetry.
    layer_type: { type: String, default: null, index: true },

    constraint_type: { type: String, enum: CONSTRAINT_TYPES, required: true },

    // Section 67.1: every layer has a version, source and last-updated date.
    version: { type: String, required: true },
    source: { type: String, required: true },
    source_url: { type: String, default: null },
    last_updated: { type: Date, required: true },

    // Section 65.1: for `conditional` layers, which vessels may enter.
    // Empty means "see config/gis_constraints.yaml".
    allowed_vessel_types: { type: [String], default: [] },

    // Seasonal applicability (Section 65: seasonal fishing ban areas).
    // Null dates = always in force.
    season_start: { type: String, default: null }, // "MM-DD"
    season_end: { type: String, default: null },   // "MM-DD"

    // Full-resolution geometry, used for exact $geoIntersects checks.
    // Mixed because it may be Polygon, MultiPolygon, LineString (coastline) or
    // Point (ports) - all valid GeoJSON.
    geometry_full: { type: mongoose.Schema.Types.Mixed, default: null },

    // Contract-required: what the Frontend actually receives (Section 67.1).
    geometry_simplified: { type: mongoose.Schema.Types.Mixed, required: true },

    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'gis_layers',
    strict: false,
  }
);

// THE critical indexes (Section 67.1). Without these, $geoIntersects and $near
// do a full collection scan and Section 66.3's sub-second target is impossible.
//
// BOTH geometries are indexed: the geofence checks against geometry_full for
// accuracy, while map queries and coarse proximity can use the simplified one.
GisLayerSchema.index({ geometry_full: '2dsphere' });
GisLayerSchema.index({ geometry_simplified: '2dsphere' });

// Common query shape: "give me the active prohibited layers".
GisLayerSchema.index({ active: 1, constraint_type: 1 });

module.exports = mongoose.model('GisLayer', GisLayerSchema);
module.exports.CONSTRAINT_TYPES = CONSTRAINT_TYPES;
