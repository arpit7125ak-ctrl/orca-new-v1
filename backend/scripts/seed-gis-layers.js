// scripts/seed-gis-layers.js
// ---------------------------------------------------------------------------
//   npm run seed:gis
//
// Synchronizes authoritative Indian Maritime Zones, Boundaries, and Marine
// Protected Areas (MPAs) into MongoDB `gis_layers`.
// Delegated to `seed-all-indian-zones.js`.
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const { syncAuthoritativeGisLayers } = require('./seed-all-indian-zones');

async function main() {
  await connect();
  try {
    const res = await syncAuthoritativeGisLayers();
    console.log('[seed-gis] Successfully synchronized authoritative zones:', res);
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-gis] Failed:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
