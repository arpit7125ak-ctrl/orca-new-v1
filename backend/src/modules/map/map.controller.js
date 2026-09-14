// src/modules/map/map.controller.js
// ---------------------------------------------------------------------------
// Section 103: GET /api/v1/map/layers - reference map layers.
// Section 67.1: "The Frontend receives SIMPLIFIED layer geometry for map
// display" - full-resolution coastline polygons are far too heavy to ship to a
// phone on a boat with patchy connectivity.
// ---------------------------------------------------------------------------

const GisLayer = require('../../db/models/gisLayer.model');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');

const getLayers = asyncHandler(async (req, res) => {
  const { layer_type: layerType, constraint_type: constraintType, full } = req.query;

  const query = { active: true };
  if (layerType) query.layer_type = layerType;
  if (constraintType) query.constraint_type = constraintType;

  // Default to simplified geometry. `?full=true` is an explicit opt-in for
  // desktop/analysis use where the full resolution is actually wanted.
  const wantFull = full === 'true';

  const layers = await GisLayer.find(query)
    .select(
      // Field names come from contracts/db/GisLayerDocument.json:
      // geometry_full / geometry_simplified, not geometry / simplified_geometry.
      'layer_name layer_type constraint_type source source_url version last_updated ' +
      'allowed_vessel_types season_start season_end properties ' +
      (wantFull ? 'geometry_full' : 'geometry_simplified')
    )
    .lean();

  // contracts/api/MapLayersResponse.json: { layers: [...] }, required `layers`,
  // additionalProperties:false - so no count or geometry_resolution wrapper.
  return res.status(HTTP.OK).json({
    layers: layers.map((layer) => ({
        layer_name: layer.layer_name,
        layer_type: layer.layer_type,
        constraint_type: layer.constraint_type,
        // Section 67: the source of every layer is shown in the evidence panel.
        source: layer.source,
        source_url: layer.source_url || null,
        version: layer.version,
        last_updated: layer.last_updated,
        allowed_vessel_types: layer.allowed_vessel_types || [],
        season_start: layer.season_start || null,
        season_end: layer.season_end || null,
        // If simplified geometry was never generated, return null rather than
        // silently substituting the full geometry - the client asked for
        // simplified and deserves to know it does not exist.
        geometry: wantFull ? (layer.geometry_full || null) : (layer.geometry_simplified || null),
        properties: layer.properties || {},
    })),
  });
});

module.exports = { getLayers };
