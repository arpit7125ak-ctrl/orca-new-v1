// scripts/seed-ports.js
// ---------------------------------------------------------------------------
//   npm run seed:ports
//
// Seeds major Indian fishing harbours and ports as Point-geometry GIS layers.
//
// WHY PORTS ARE GIS LAYERS AND NOT THEIR OWN COLLECTION:
// Section 67 lists "Ports" as one of the reference layers, and Section 65 lists
// "Near port" as a condition ORCA must identify. Storing them in gis_layers
// means the existing 2dsphere index and the existing geofence query find them
// with no extra code path.
//
// constraint_type is warning_only: a port is not restricted water, but knowing
// the nearest harbour matters for route planning and for "where do I shelter?".
//
// Coordinates are approximate harbour positions from public references and are
// labelled as such - same never-fabricate discipline as the boundary seed.
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const GisLayer = require('../src/db/models/gisLayer.model');

const PORTS = [
  { name: 'Chennai Port',              lat: 13.1000, lon: 80.2900, state: 'Tamil Nadu',    type: 'major' },
  { name: 'Kasimedu Fishing Harbour',  lat: 13.1300, lon: 80.2950, state: 'Tamil Nadu',    type: 'fishing' },
  { name: 'Visakhapatnam Port',        lat: 17.6900, lon: 83.2800, state: 'Andhra Pradesh', type: 'major' },
  { name: 'Paradip Port',              lat: 20.2600, lon: 86.6700, state: 'Odisha',        type: 'major' },
  { name: 'Kolkata Port',              lat: 22.5400, lon: 88.3100, state: 'West Bengal',   type: 'major' },
  { name: 'Mumbai Port',               lat: 18.9400, lon: 72.8400, state: 'Maharashtra',   type: 'major' },
  { name: 'Sassoon Dock',              lat: 18.9200, lon: 72.8200, state: 'Maharashtra',   type: 'fishing' },
  { name: 'Mormugao Port',             lat: 15.4100, lon: 73.8000, state: 'Goa',           type: 'major' },
  { name: 'New Mangalore Port',        lat: 12.9200, lon: 74.8000, state: 'Karnataka',     type: 'major' },
  { name: 'Kochi Port',                lat:  9.9700, lon: 76.2600, state: 'Kerala',        type: 'major' },
  { name: 'Munambam Fishing Harbour',  lat: 10.1800, lon: 76.1700, state: 'Kerala',        type: 'fishing' },
  { name: 'Tuticorin Port',            lat:  8.7500, lon: 78.2000, state: 'Tamil Nadu',    type: 'major' },
  { name: 'Rameswaram Fishing Harbour',lat:  9.2800, lon: 79.3100, state: 'Tamil Nadu',    type: 'fishing' },
  { name: 'Veraval Fishing Harbour',   lat: 20.9000, lon: 70.3600, state: 'Gujarat',       type: 'fishing' },
  { name: 'Kandla Port',               lat: 23.0300, lon: 70.2200, state: 'Gujarat',       type: 'major' },
  { name: 'Port Blair',                lat: 11.6700, lon: 92.7400, state: 'Andaman & Nicobar', type: 'major' },
];

async function main() {
  await connect();

  console.log('\n=== Seeding ports and fishing harbours ===\n');

  let inserted = 0;
  let updated = 0;

  for (const port of PORTS) {
    const geometry = {
      type: 'Point',
      // GeoJSON order is [longitude, latitude] - the reverse of how it is
      // spoken. Getting this backwards would place every Indian port in the
      // wrong hemisphere.
      coordinates: [port.lon, port.lat],
    };

    const document = {
      layer_name: port.name,
      layer_type: 'port',
      constraint_type: 'warning_only',
      version: 'demo-1.0',
      source: 'DEMO_SEED_DATA',
      last_updated: new Date(),
      geometry_full: geometry,
      geometry_simplified: geometry,
      active: true,
      properties: {
        state: port.state,
        port_type: port.type,
        lat: port.lat,
        lon: port.lon,
        demo_only: true,
        note: 'Approximate harbour position for demonstration.',
      },
    };

    const existing = await GisLayer.findOne({ layer_name: port.name });
    if (existing) {
      await GisLayer.updateOne({ layer_name: port.name }, document);
      updated += 1;
    } else {
      await GisLayer.create(document);
      inserted += 1;
    }

    console.log(`  ${existing ? 'UPDATED ' : 'INSERTED'} ${port.name} (${port.state})`);
  }

  await GisLayer.createIndexes();

  console.log(`\n  ${inserted} inserted, ${updated} updated.\n`);
  await disconnect();
}

main().catch((err) => {
  console.error('[seed-ports] Failed:', err.message);
  process.exit(1);
});
