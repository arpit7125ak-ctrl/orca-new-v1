// scripts/seed-gis-layers.js
// ---------------------------------------------------------------------------
//   npm run seed:gis
//
// Loads GIS constraint layers into MongoDB so geofencing works out of the box.
//
// IMPORTANT HONESTY NOTE ABOUT THIS SEED DATA:
// Section 67 requires that official boundaries come from AUTHORITATIVE sources
// and that the source of every layer is shown in the evidence panel. The
// polygons below are SIMPLIFIED DEMONSTRATION GEOMETRY, not survey-accurate
// boundaries - so every seeded layer carries source: "DEMO_SEED_DATA" and a
// `demo_only: true` property.
//
// That labelling is the never-fabricate rule applied to geospatial data: the
// system is allowed to run on approximate boundaries, but it is NOT allowed to
// present them as if they were official. Replace these with real Marine
// Regions / WDPA / Bhuvan GeoJSON before any real-world use.
//
// Loading real layers instead:
//   1. Download GeoJSON from the authoritative source.
//   2. Insert with the same field shape, setting a real `source` and `version`.
//   3. Re-run `npm run create-indexes`.
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const GisLayer = require('../src/db/models/gisLayer.model');

const DEMO_LAYERS = [
  {
    layer_name: 'Indian EEZ (demo approximation)',
    layer_type: 'exclusive_economic_zone',
    constraint_type: 'warning_only',
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    source_url: null,
    last_updated: new Date(),
    // A coarse box covering part of the Bay of Bengal / Arabian Sea approach.
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [68.0, 6.0], [97.0, 6.0], [97.0, 24.0], [68.0, 24.0], [68.0, 6.0],
      ]],
    },
    properties: { demo_only: true, note: 'Coarse bounding box - NOT an official boundary.' },
  },
  {
    layer_name: 'India-Sri Lanka maritime boundary (demo approximation)',
    layer_type: 'international_maritime_boundary',
    // prohibited: Section 65.1 - a point here can NEVER be recommended. This is
    // the layer that matters most for fisherman safety; crossing it can mean
    // arrest.
    constraint_type: 'prohibited',
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    last_updated: new Date(),
    // A narrow strip in the Palk Strait region.
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [79.2, 9.0], [79.9, 9.0], [79.9, 9.9], [79.2, 9.9], [79.2, 9.0],
      ]],
    },
    properties: { demo_only: true, note: 'Illustrative only - NOT the real IMBL.' },
  },
  {
    layer_name: 'Gulf of Mannar Marine National Park (demo approximation)',
    layer_type: 'marine_protected_area',
    constraint_type: 'prohibited',
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    last_updated: new Date(),
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [78.9, 8.8], [79.3, 8.8], [79.3, 9.3], [78.9, 9.3], [78.9, 8.8],
      ]],
    },
    properties: { demo_only: true },
  },
  {
    layer_name: 'Chennai coastal ecologically sensitive zone (demo approximation)',
    layer_type: 'ecologically_sensitive_zone',
    // conditional: Section 65.1 - permitted only for certain activities.
    constraint_type: 'conditional',
    allowed_vessel_types: ['research_vessel'],
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    last_updated: new Date(),
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [80.2, 12.9], [80.5, 12.9], [80.5, 13.3], [80.2, 13.3], [80.2, 12.9],
      ]],
    },
    properties: { demo_only: true },
  },
  {
    layer_name: 'East coast seasonal fishing ban area (demo approximation)',
    layer_type: 'seasonal_fishing_ban_area',
    constraint_type: 'conditional',
    allowed_vessel_types: ['research_vessel', 'large_commercial_vessel'],
    // Section 65: seasonal ban areas. The real east-coast ban runs roughly
    // mid-April to mid-June.
    season_start: '04-15',
    season_end: '06-14',
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    last_updated: new Date(),
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [80.0, 13.5], [81.0, 13.5], [81.0, 15.0], [80.0, 15.0], [80.0, 13.5],
      ]],
    },
    properties: { demo_only: true },
  },
  {
    layer_name: 'Indian territorial waters (demo approximation)',
    layer_type: 'territorial_waters',
    constraint_type: 'warning_only',
    version: 'demo-1.0',
    source: 'DEMO_SEED_DATA',
    last_updated: new Date(),
    geometry_full: {
      type: 'Polygon',
      coordinates: [[
        [76.0, 8.0], [82.0, 8.0], [82.0, 16.0], [76.0, 16.0], [76.0, 8.0],
      ]],
    },
    properties: { demo_only: true },
  },
];

async function main() {
  await connect();

  console.log('\n=== Seeding GIS layers ===\n');
  console.log('  NOTE: this is DEMONSTRATION geometry labelled source=DEMO_SEED_DATA.');
  console.log('  Replace with authoritative Marine Regions / WDPA / Bhuvan data for real use.\n');

  let inserted = 0;
  let updated = 0;

  for (const layer of DEMO_LAYERS) {
    // geometry_simplified is set to the same geometry here because these demo
    // polygons are already trivially small. With real data, generate a properly
    // simplified version (Section 67.1) rather than duplicating - a full
    // coastline is far too heavy to ship to a phone on a boat.
    const document = { ...layer, geometry_simplified: layer.geometry_full, active: true };

    const existing = await GisLayer.findOne({ layer_name: layer.layer_name });
    if (existing) {
      await GisLayer.updateOne({ layer_name: layer.layer_name }, document);
      updated += 1;
      console.log(`  UPDATED  ${layer.layer_name} [${layer.constraint_type}]`);
    } else {
      await GisLayer.create(document);
      inserted += 1;
      console.log(`  INSERTED ${layer.layer_name} [${layer.constraint_type}]`);
    }
  }

  // The 2dsphere index is what makes the geofence sub-second (Section 66.3),
  // so build it right after seeding rather than leaving it to chance.
  await GisLayer.createIndexes();

  console.log(`\n  ${inserted} inserted, ${updated} updated.`);
  console.log('  2dsphere index built.\n');

  await disconnect();
}

main().catch((err) => {
  console.error('[seed-gis-layers] Failed:', err.message);
  process.exit(1);
});
