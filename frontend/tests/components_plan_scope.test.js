import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');

test('MarineMap.jsx declares plan before referencing plan properties', () => {
  const marineMapPath = path.join(componentsDir, 'MarineMap.jsx');
  const code = fs.readFileSync(marineMapPath, 'utf8');

  // Verify plan is declared from analysis
  const hasPlanDeclaration = /const\s+plan\s*=\s*analysis\??\.plan/.test(code);
  assert.ok(
    hasPlanDeclaration,
    'MarineMap.jsx must declare `const plan = analysis?.plan || {}` at the top of its body'
  );

  // Verify declaration comes before first usage of plan.
  const declIndex = code.search(/const\s+plan\s*=/);
  const firstUsageIndex = code.search(/\bplan\./);
  assert.ok(
    declIndex !== -1 && declIndex < firstUsageIndex,
    'MarineMap.jsx must declare `plan` before accessing `plan.*`'
  );
});

test('All frontend components referencing plan.* declare or receive plan in scope', () => {
  const files = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.jsx'));

  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (/\bplan\./.test(content)) {
      const hasParam = /function\s+\w+\s*\(\s*\{[^}]*\bplan\b[^}]*\}\s*\)/.test(content);
      const hasLocalDecl = /(?:const|let|var)\s+plan\s*=/.test(content);

      assert.ok(
        hasParam || hasLocalDecl,
        `Component ${file} references plan.* but does not declare or receive 'plan' in scope!`
      );
    }
  }
});

test('MarineMap.jsx map initialization guards coordinates, includes deps, and calls invalidateSize', () => {
  const marineMapPath = path.join(componentsDir, 'MarineMap.jsx');
  const code = fs.readFileSync(marineMapPath, 'utf8');

  // Must guard finite coordinates
  assert.ok(
    /hasValidCoords/.test(code) && /Number\.isFinite\(validLat\)/.test(code),
    'MarineMap.jsx must guard coordinates with Number.isFinite'
  );

  // Map creation effect must include validLat and validLon in dependency array
  const mapEffectMatch = code.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?L\.map\([\s\S]*?\},?\s*\[([^\]]*)\]\)/);
  assert.ok(mapEffectMatch, 'MarineMap.jsx must have a map initialization useEffect');
  const deps = mapEffectMatch[1];
  assert.ok(
    deps.includes('validLat') && deps.includes('validLon'),
    `Map creation effect dependency array must include validLat and validLon, got: [${deps}]`
  );

  // Must call invalidateSize() to recover from 0-sized / tab transitions
  assert.ok(
    code.includes('invalidateSize()'),
    'MarineMap.jsx must call invalidateSize() to adjust for dynamic container dimensions'
  );
});

