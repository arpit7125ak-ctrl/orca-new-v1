// scripts/seed-pfz.js
// ---------------------------------------------------------------------------
//   npm run seed:pfz  OR  node scripts/seed-pfz.js
//
// Manual / on-demand CLI runner to sync INCOIS Potential Fishing Zone (PFZ)
// advisories into MongoDB. Uses the shared pfzSync.service.
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const { syncPfzFromIncois } = require('../src/modules/pfz/pfzSync.service');

async function main() {
  await connect();
  try {
    const result = await syncPfzFromIncois();
    console.log('[seed-pfz] Ingestion finished successfully:', result);
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-pfz] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
