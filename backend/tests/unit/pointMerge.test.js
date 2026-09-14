// tests/unit/pointMerge.test.js
// These tests exist to defend the NEVER-FABRICATE rule at the merge layer -
// the place where a missing measurement could most easily become a silent 0.

const { mergeByPoint, summariseCompleteness } = require('../../src/modules/analysis/pointMerge');

// contracts/PointObservation.json requires point_id, lat, lon, point_status,
// land_sea.
const POINTS = [
  { point_id: 'P1', lat: 13.0, lon: 80.5, point_status: 'analysed', land_sea: 'sea' },
  { point_id: 'P2', lat: 13.1, lon: 80.6, point_status: 'analysed', land_sea: 'sea' },
];

// contracts/Measurement.json: freshness is an OBJECT, and status comes from
// DataFieldStatus (available|partial|missing|not_mapped|derived).
const fresh = { state: 'fresh', age_hours: 0.5, max_age_hours: 6 };

describe('mergeByPoint', () => {
  test('merges measurements from several agents into one view per point', () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'weather',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            wind_speed_ms: { value: 8.2, unit: 'm/s', status: 'available', source: 'IMD', freshness: fresh },
          } },
        },
      },
      {
        agent_name: 'ocean',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            wave_height_m: { value: 1.4, unit: 'm', status: 'available', source: 'INCOIS', freshness: fresh },
          } },
        },
      },
    ]);

    const p1 = merged.find((p) => p.point_id === 'P1');
    expect(p1.measurements.wind_speed_ms.value).toBe(8.2);
    expect(p1.measurements.wave_height_m.value).toBe(1.4);
    expect(p1.agents_reporting).toEqual(expect.arrayContaining(['weather', 'ocean']));
  });

  test('NEVER-FABRICATE: a missing value stays null and is never coerced to 0', () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'tide',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            // DataFieldStatus 'missing' - the source was asked and returned
            // nothing. Distinct from 'not_mapped' (no adapter mapping exists).
            tide_height_m: {
              value: null, unit: 'm', status: 'missing', source: null,
              retrieved_at: null, freshness: { state: 'unknown' },
            },
          } },
        },
      },
    ]);

    const p1 = merged.find((p) => p.point_id === 'P1');
    expect(p1.measurements.tide_height_m.value).toBeNull();
    expect(p1.measurements.tide_height_m.value).not.toBe(0);
    // source and retrieved_at are nullable by contract - data that was never
    // retrieved genuinely has neither.
    expect(p1.measurements.tide_height_m.source).toBeNull();
    expect(p1.measurements.tide_height_m.retrieved_at).toBeNull();
  });

  test('records a FAILED agent against every point rather than staying silent', () => {
    // Section 41: a failed agent must be visible, because the Risk stage needs
    // to know what it does NOT have (Section 50).
    const merged = mergeByPoint(POINTS, [
      // contracts/AgentResult.json: `error` is an ErrorInfo object.
      {
        agent_name: 'tide',
        status: 'failed',
        error: { error_category: 'timeout', message: 'upstream timeout' },
      },
    ]);

    for (const point of merged) {
      const missing = point.agents_missing.find((a) => a.agent === 'tide');
      expect(missing).toBeDefined();
      expect(missing.error_category).toBe('timeout');
    }
  });

  test('records points an otherwise-successful agent did not cover', () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'gis',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            water_depth_m: { value: 40, unit: 'm', status: 'available', source: 'GEBCO', freshness: fresh },
          } },
        },
      },
    ]);

    const p2 = merged.find((p) => p.point_id === 'P2');
    expect(p2.agents_missing.some((a) => a.agent === 'gis' && a.status === 'no_data_for_point')).toBe(true);
  });

  test('prefers a real value over an unavailable one when two agents collide', () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'ocean',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            sst_c: { value: 28.4, status: 'available', source: 'INCOIS', freshness: fresh },
          } },
        },
      },
      {
        agent_name: 'ecosystem',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            sst_c: { value: null, status: 'missing', source: null, freshness: { state: 'unknown' } },
          } },
        },
      },
    ]);

    const p1 = merged.find((p) => p.point_id === 'P1');
    expect(p1.measurements.sst_c.value).toBe(28.4);
  });
});

describe('summariseCompleteness', () => {
  test('reports completeness_percent as null (not 0) when nothing was expected', () => {
    const merged = mergeByPoint(POINTS, []);
    const summary = summariseCompleteness(merged, []);
    // A percentage of nothing is undefined. 0% would falsely read as total failure.
    expect(summary[0].completeness_percent).toBeNull();
  });

  test('lists missing parameters explicitly', () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'weather',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            wind_speed_ms: { value: 5, status: 'available', source: 'IMD', freshness: fresh },
          } },
        },
      },
    ]);

    const summary = summariseCompleteness(merged, ['wind_speed_ms', 'wave_height_m']);
    const p1 = summary.find((p) => p.point_id === 'P1');
    expect(p1.missing_parameters).toContain('wave_height_m');
    expect(p1.completeness_percent).toBe(50);
  });

  test('counts not_mapped separately from missing - an adapter gap is visible', () => {
    // 'not_mapped' = the adapter has no mapping for this field yet.
    // 'missing'    = the source was queried and returned nothing.
    // Collapsing the two would hide adapter gaps behind ordinary data outages.
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'tide',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            tidal_current_ms: {
              value: null, unit: null, status: 'not_mapped',
              source: null, freshness: { state: 'unknown' },
            },
          } },
        },
      },
    ]);

    const summary = summariseCompleteness(merged, ['tidal_current_ms']);
    expect(summary[0].not_mapped_parameters).toContain('tidal_current_ms');
    expect(summary[0].parameters_available).toBe(0);
  });

  test("'derived' counts as usable - it is computed, not absent", () => {
    const merged = mergeByPoint(POINTS, [
      {
        agent_name: 'ocean',
        status: 'completed',
        normalized: {
          P1: { measurements: {
            swell_height_m: { value: 1.1, unit: 'm', status: 'derived', source: 'INCOIS', freshness: fresh },
          } },
        },
      },
    ]);

    const summary = summariseCompleteness(merged, ['swell_height_m']);
    expect(summary[0].parameters_available).toBe(1);
    expect(summary[0].completeness_percent).toBe(100);
  });
});
