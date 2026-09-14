// scripts/validate-schemas.js
// ---------------------------------------------------------------------------
//   npm run validate-schemas
//
// Loads the contracts/ set and reports what was found. Use this to confirm the
// 44-file contract set is wired up correctly BEFORE running the server, so a
// contract problem surfaces as a clear message here rather than as a confusing
// 400 in Postman.
//
// It also checks the never-fabricate invariant that bit this project once:
// Measurement.json's `source` and `retrieved_at` MUST be nullable, otherwise a
// `not_mapped` field cannot be represented without inventing a source.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const contracts = require('../src/middleware/validateContract');

const CONTRACTS_DIR = contracts.CONTRACTS_DIR;

function collectJsonFiles(dir, collected = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsonFiles(fullPath, collected);
    else if (entry.name.endsWith('.json')) collected.push(fullPath);
  }
  return collected;
}

function main() {
  console.log(`\n=== Contract validation ===`);
  console.log(`Looking in: ${CONTRACTS_DIR}\n`);

  if (!fs.existsSync(CONTRACTS_DIR)) {
    console.log('  contracts/ directory NOT FOUND.');
    console.log('  The server will still run - module-level validators (Section 7) still apply -');
    console.log('  but JSON Schema contract enforcement is DISABLED.');
    console.log(`\n  To enable it, copy your 44-file contracts/ set to:\n    ${CONTRACTS_DIR}\n`);
    process.exit(0);
  }

  const files = collectJsonFiles(CONTRACTS_DIR);
  console.log(`  Found ${files.length} contract files.`);
  console.log(`  Loaded into Ajv: ${contracts.loadedCount()}\n`);

  // Group by top-level directory so the shape of the set is visible at a glance.
  const groups = {};
  for (const file of files) {
    const relative = path.relative(CONTRACTS_DIR, file).split(path.sep);
    const group = relative.length > 1 ? relative[0] : '(root)';
    groups[group] = (groups[group] || 0) + 1;
  }
  console.log('  By group:');
  for (const [group, count] of Object.entries(groups).sort()) {
    console.log(`    ${group.padEnd(20)} ${count}`);
  }

  // --- Never-fabricate invariant check ---------------------------------
  const measurementPath = path.join(CONTRACTS_DIR, 'shared', 'Measurement.json');
  if (fs.existsSync(measurementPath)) {
    console.log('\n  Checking never-fabricate invariants in shared/Measurement.json:');
    const schema = JSON.parse(fs.readFileSync(measurementPath, 'utf-8'));
    for (const field of ['source', 'retrieved_at', 'value']) {
      const definition = schema.properties?.[field];
      const type = definition?.type;
      const nullable = Array.isArray(type) ? type.includes('null') : type === 'null';
      console.log(
        `    ${nullable ? 'OK     ' : 'PROBLEM'} ${field} nullable: ${JSON.stringify(type)}`
      );
      if (!nullable) {
        console.log(
          `            A non-nullable ${field} makes a "not_mapped" measurement impossible`
        );
        console.log(`            to represent without fabricating a value.`);
      }
    }
  }

  console.log('\n  Done.\n');
}

main();
