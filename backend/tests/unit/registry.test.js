// tests/unit/registry.test.js
// Sections 7.6-7.8: these lists are configuration-driven and shared with the
// AI Service, so both services must agree on their contents.

const registry = require('../../src/config/registry');

describe('activities - Section 7.6', () => {
  test('loads all seven documented activities', () => {
    expect(registry.activities).toHaveLength(7);
  });

  test('validates known and unknown values', () => {
    expect(registry.isValidActivity('fishing')).toBe(true);
    expect(registry.isValidActivity('submarine_racing')).toBe(false);
  });
});

describe('vessel types - Section 7.7', () => {
  test('loads all six documented vessel types', () => {
    expect(registry.vesselTypes).toHaveLength(6);
  });

  test('every vessel type has a conservatism_rank for the Planner default', () => {
    // Section 7.7: a missing vessel_type means the Planner applies the MOST
    // conservative profile, which requires a defined ordering.
    for (const vessel of registry.vesselTypes) {
      expect(typeof vessel.conservatism_rank).toBe('number');
    }
  });

  test('rank 1 is the most fragile craft', () => {
    const mostConservative = registry.vesselTypes.find((v) => v.conservatism_rank === 1);
    expect(mostConservative.id).toBe('traditional_non_motorized');
  });
});

describe('languages - Section 7.8', () => {
  test('loads all ten initial languages', () => {
    expect(registry.languages).toHaveLength(10);
  });

  test('uses ISO 639-1 two-letter codes', () => {
    for (const language of registry.languages) {
      expect(language.code).toMatch(/^[a-z]{2}$/);
    }
  });
});

describe('canonical units - Section 24.2', () => {
  test('wind speed is m/s per WMO, NOT knots', () => {
    // This was an explicit project decision: SI/world standard at the adapter
    // boundary, converted nowhere downstream.
    expect(registry.getCanonicalUnit('wind_speed')).toBe('m/s');
  });

  test('wave height is metres', () => {
    expect(registry.getCanonicalUnit('wave_height')).toBe('m');
  });

  test('an unknown parameter returns null - callers must not assume any unit is fine', () => {
    expect(registry.getCanonicalUnit('made_up_parameter')).toBeNull();
  });
});
