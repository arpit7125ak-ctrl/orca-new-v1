// scripts/check-syntax.js
// ---------------------------------------------------------------------------
//   npm run check
//
// Parses every .js file under src/ WITHOUT executing it, so a typo is caught
// in one pass instead of one-crash-at-a-time when you hit a route in Postman.
//
// Uses `new vm.Script()` rather than require(), deliberately: require() would
// execute module-level code (opening DB connections, reading env), which is
// not what we want from a syntax check.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.resolve(__dirname, '../src');

function collectJsFiles(dir, collected = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(fullPath, collected);
    else if (entry.name.endsWith('.js')) collected.push(fullPath);
  }
  return collected;
}

const files = collectJsFiles(SRC_DIR);
let failures = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  try {
    // CommonJS files reference module/require at the top level, so wrapping
    // them the way Node does keeps the parse honest.
    new vm.Script(`(function(exports, require, module, __filename, __dirname){${source}\n})`, {
      filename: file,
    });
  } catch (err) {
    failures += 1;
    console.error(`SYNTAX ERROR  ${path.relative(SRC_DIR, file)}`);
    console.error(`              ${err.message}\n`);
  }
}

console.log(`\nChecked ${files.length} files under src/`);
console.log(failures === 0 ? 'All files parse cleanly.\n' : `${failures} file(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
