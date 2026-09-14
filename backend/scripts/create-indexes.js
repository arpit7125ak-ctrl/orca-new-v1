// scripts/create-indexes.js
// ---------------------------------------------------------------------------
//   npm run create-indexes
//
// Builds every index and then verifies the critical ones. RUN THIS BEFORE THE
// DEMO. Mongoose builds indexes in the background by default, so on a fresh
// database the first geofence check can hit an unindexed collection and take
// seconds instead of milliseconds. This makes that deterministic.
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const { ensureIndexes, verifyIndexes, listAllIndexes } = require('../src/db/indexes');

async function main() {
  await connect();

  console.log('\n=== Building indexes ===\n');
  const built = await ensureIndexes();
  for (const result of built) {
    if (result.error) console.log(`  FAILED  ${result.model}: ${result.error}`);
    else console.log(`  OK      ${result.collection} (${result.count} indexes)`);
  }

  console.log('\n=== Verifying critical indexes ===\n');
  const { allPresent, checks } = await verifyIndexes();
  for (const check of checks) {
    console.log(`  ${check.present ? 'OK     ' : 'MISSING'} ${check.collection}.${check.key}`);
    if (!check.present) console.log(`          why it matters: ${check.why}`);
  }

  console.log('\n=== Full index listing ===\n');
  console.log(JSON.stringify(await listAllIndexes(), null, 2));

  await disconnect();

  // Non-zero exit so CI or a startup script can fail loudly on a missing index.
  process.exit(allPresent ? 0 : 1);
}

main().catch((err) => {
  console.error('[create-indexes] Failed:', err.message);
  process.exit(1);
});
