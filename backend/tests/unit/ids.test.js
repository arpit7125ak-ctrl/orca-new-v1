// tests/unit/ids.test.js
// Verifies the LOCKED analysis_id format from Section 8.1. If these tests
// fail, the ID contract has been broken and every downstream system that
// parses an analysis_id is affected.

const { generateAnalysisId, isValidAnalysisId, generateDedupKey, generatePrefixedId } =
  require('../../src/utils/ids');

describe('generateAnalysisId', () => {
  test('matches the locked format req_YYYYMMDD_HHMM_hash6', () => {
    expect(generateAnalysisId()).toMatch(/^req_\d{8}_\d{4}_[0-9a-f]{6}$/);
  });

  test('embeds the REQUEST-RECEIPT time in UTC, not local time', () => {
    // Section 8.1: the embedded time is when the Backend accepted the request.
    const receivedAt = new Date('2026-09-12T09:15:00Z');
    expect(generateAnalysisId(receivedAt)).toMatch(/^req_20260912_0915_[0-9a-f]{6}$/);
  });

  test('pads single-digit months, days, hours and minutes', () => {
    const receivedAt = new Date('2026-01-05T03:07:00Z');
    expect(generateAnalysisId(receivedAt)).toMatch(/^req_20260105_0307_/);
  });

  test('produces unique IDs within the same minute', () => {
    // The format only has minute resolution, so uniqueness rests entirely on
    // the hash. This is the test that protects against silent overwrites.
    const receivedAt = new Date('2026-09-12T09:15:00Z');
    const ids = new Set(Array.from({ length: 500 }, () => generateAnalysisId(receivedAt)));
    expect(ids.size).toBe(500);
  });
});

describe('isValidAnalysisId', () => {
  test('accepts a well-formed id', () => {
    expect(isValidAnalysisId('req_20260912_0915_f4e9d1')).toBe(true);
  });

  test.each([
    ['wrong prefix',      'analysis_20260912_0915_f4e9d1'],
    ['short date',        'req_2026912_0915_f4e9d1'],
    ['uppercase hash',    'req_20260912_0915_F4E9D1'],
    ['short hash',        'req_20260912_0915_f4e9'],
    ['empty string',      ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidAnalysisId(value)).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidAnalysisId(null)).toBe(false);
    expect(isValidAnalysisId(12345)).toBe(false);
  });
});

describe('generateDedupKey', () => {
  test('is deterministic - the same inputs always give the same key', () => {
    // Section 66.3 / 99.7 depend on this: dedup must work ACROSS processes and
    // scheduler runs, so the key cannot contain randomness.
    expect(generateDedupKey('device1', 'EEZ', 'approaching'))
      .toBe(generateDedupKey('device1', 'EEZ', 'approaching'));
  });

  test('different inputs give different keys', () => {
    expect(generateDedupKey('device1', 'EEZ', 'approaching'))
      .not.toBe(generateDedupKey('device1', 'EEZ', 'inside'));
  });

  test('normalises null and undefined consistently', () => {
    expect(generateDedupKey(null, 'x')).toBe(generateDedupKey(undefined, 'x'));
  });
});

describe('generatePrefixedId', () => {
  test('applies the requested prefix', () => {
    expect(generatePrefixedId('conv')).toMatch(/^conv_[0-9a-f]{12}$/);
  });
});
