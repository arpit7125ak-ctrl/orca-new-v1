// backend/scripts/import-gis-geojson.js
// ---------------------------------------------------------------------------
// Authoritative GIS GeoJSON Ingestion Utility
// Only this tool is permitted to set `verification: "authoritative"` on GIS layers.
//
// Requirements per Specification:
// 1. Valid source URL (e.g. marineregions.org, protectedplanet.net, un.org)
// 2. Verified open/official licence (e.g. ODC-BY, CC-BY, Public Domain, Treaty)
// 3. Indian EEZ / maritime domain landmark bounding check
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const GisLayer = require('../src/db/models/gisLayer.model');

// Bounding box for Indian Maritime Region / EEZ (Rough: Lat 4°N to 26°N, Lon 65°E to 98°E)
function validateLandmarkBounds(geometry) {
  let coords = [];
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates.flat(1);
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.flat(2);
  } else if (geometry.type === 'Point') {
    coords = [geometry.coordinates];
  } else if (geometry.type === 'LineString') {
    coords = geometry.coordinates;
  }

  for (const [lon, lat] of coords) {
    if (lat < 2.0 || lat > 30.0 || lon < 60.0 || lon > 100.0) {
      return { valid: false, reason: `Coordinate [${lon}, ${lat}] is outside the broader Indian maritime domain.` };
    }
  }
  return { valid: true };
}

async function importGeoJson(filePath, metadata) {
  const { layerId, layerName, layerType, constraintType, sourceUrl, licence, version = 'v1.0-auth' } = metadata;

  if (!sourceUrl || !sourceUrl.startsWith('http')) {
    throw new Error(`Authoritative ingestion requires a valid HTTP/HTTPS sourceUrl. Got: "${sourceUrl}"`);
  }
  if (!licence) {
    throw new Error('Authoritative ingestion requires an explicit licence (e.g. CC-BY 4.0, Open Data Commons, UN Treaty).');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const geojson = JSON.parse(raw);

  let geometry;
  let properties = {};

  if (geojson.type === 'FeatureCollection') {
    if (!geojson.features || !geojson.features.length) {
      throw new Error('FeatureCollection is empty.');
    }
    geometry = geojson.features[0].geometry;
    properties = geojson.features[0].properties || {};
  } else if (geojson.type === 'Feature') {
    geometry = geojson.geometry;
    properties = geojson.properties || {};
  } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon' || geojson.type === 'LineString') {
    geometry = geojson;
  } else {
    throw new Error(`Unsupported GeoJSON geometry type: ${geojson.type}`);
  }

  const boundCheck = validateLandmarkBounds(geometry);
  if (!boundCheck.valid) {
    throw new Error(`Landmark boundary check failed: ${boundCheck.reason}`);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is missing.');
  }

  await mongoose.connect(mongoUri);

  const doc = {
    layer_id: layerId,
    layer_name: layerName,
    layer_type: layerType || 'custom',
    constraint_type: constraintType || 'advisory',
    geometry,
    properties: {
      ...properties,
      source_url: sourceUrl,
      licence,
      imported_at: new Date().toISOString(),
    },
    verification: 'authoritative', // Strict: only this script sets authoritative
    source: `${sourceUrl} (${licence})`,
    version,
    active: true,
  };

  const res = await GisLayer.findOneAndUpdate(
    { layer_id: layerId },
    doc,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Successfully ingested authoritative GIS layer: ${res.layer_id} (${res.layer_name})`);
  await mongoose.disconnect();
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.log(`
Usage:
  node import-gis-geojson.js <filePath> <layerId> <layerName> <sourceUrl> <licence> [layerType] [constraintType]

Example:
  node import-gis-geojson.js ./eez.geojson ind_eez "Indian EEZ" "https://marineregions.org" "ODC-BY" international_boundary advisory
`);
    process.exit(1);
  }

  const [filePath, layerId, layerName, sourceUrl, licence, layerType, constraintType] = args;
  importGeoJson(filePath, { layerId, layerName, sourceUrl, licence, layerType, constraintType })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Import error:', err.message);
      process.exit(1);
    });
}

module.exports = { importGeoJson, validateLandmarkBounds };
