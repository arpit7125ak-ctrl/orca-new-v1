// tests/unit/validator.test.js
// Section 7 structural validation, including the things the Backend must NOT
// do (Section 7.10).

const { validateAnalysisRequest, validateRouteRequest } =
  require('../../src/modules/analysis/analysis.validator');

describe('validateAnalysisRequest - Section 7.1 minimum input', () => {
  test('rejects an empty request', () => {
    const result = validateAnalysisRequest({});
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/at least one of/i);
  });

  test('accepts a query alone', () => {
    expect(validateAnalysisRequest({ query: 'Is it safe to go out tomorrow?' }).valid).toBe(true);
  });

  test('accepts coordinates alone', () => {
    expect(validateAnalysisRequest({ coordinate: { lat: 13.0, lon: 80.5 } }).valid).toBe(true);
  });

  test('accepts a place name alone', () => {
    expect(validateAnalysisRequest({ place_name: 'Chennai' }).valid).toBe(true);
  });
});

describe('validateAnalysisRequest - Section 7.2 coordinates', () => {
  test('rejects an out-of-range latitude with error_category invalid_location', () => {
    const result = validateAnalysisRequest({ coordinate: { lat: 200, lon: 80 } });
    expect(result.valid).toBe(false);
    expect(result.errorCategory).toBe('invalid_location');
  });

  test('rejects an out-of-range longitude', () => {
    expect(validateAnalysisRequest({ coordinate: { lat: 13, lon: 500 } }).valid).toBe(false);
  });

  test('rejects a lone latitude - a half coordinate is meaningless', () => {
    const result = validateAnalysisRequest({ coordinate: { lat: 13.0 }, query: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errorCategory).toBe('invalid_location');
  });

  test('rejects flat lat/lon with a message pointing at the right shape', () => {
    // The contract nests them under `coordinate`; flat fields would otherwise
    // fail with an opaque additionalProperties error.
    const result = validateAnalysisRequest({ lat: 13.0, lon: 80.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /coordinate/.test(e.message))).toBe(true);
  });
});

describe('validateAnalysisRequest - Sections 7.6 / 7.7 / 7.8 config-driven values', () => {
  test('rejects an unknown activity and lists the valid ones', () => {
    const result = validateAnalysisRequest({ query: 'x', activity: 'submarine_racing' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/fishing/); // lists valid values
  });

  test('accepts a known activity', () => {
    expect(validateAnalysisRequest({ query: 'x', activity: 'fishing' }).valid).toBe(true);
  });

  test('Section 7.7: a MISSING vessel_type is NOT an error', () => {
    // The Planner substitutes the most conservative profile and states the
    // assumption - the Backend must not reject the request.
    expect(validateAnalysisRequest({ query: 'x', activity: 'fishing' }).valid).toBe(true);
  });

  test('rejects an unknown vessel_type', () => {
    expect(validateAnalysisRequest({ query: 'x', vessel_type: 'submarine' }).valid).toBe(false);
  });

  test('rejects an unsupported language override', () => {
    expect(validateAnalysisRequest({ query: 'x', language_override: 'fr' }).valid).toBe(false);
  });

  test('accepts every supported Indian language', () => {
    for (const code of ['en', 'hi', 'bn', 'ta', 'te', 'or', 'mr', 'ml', 'kn', 'gu']) {
      expect(validateAnalysisRequest({ query: 'x', language_override: code }).valid).toBe(true);
    }
  });
});

describe('validateAnalysisRequest - Sections 7.4 / 7.5 date and time', () => {
  test('rejects a malformed date', () => {
    expect(validateAnalysisRequest({ query: 'x', date: '12-09-2026' }).valid).toBe(false);
  });

  test('rejects a date that does not exist', () => {
    expect(validateAnalysisRequest({ query: 'x', date: '2026-02-30' }).valid).toBe(false);
  });

  test('accepts a valid ISO date', () => {
    expect(validateAnalysisRequest({ query: 'x', date: '2026-09-14' }).valid).toBe(true);
  });

  test('Section 7.5: an overnight clock range is ACCEPTED and flagged', () => {
    // There is no `overnight` field in the contract. A bare clock range where
    // end < start is legal for night fishing; resolving which calendar day the
    // end falls on is the Planner's job (Section 7.10), so we flag rather than
    // reject.
    const result = validateAnalysisRequest({
      query: 'x',
      time_range: { start: '22:00', end: '04:00' },
    });
    expect(result.valid).toBe(true);
    expect(result.isOvernight).toBe(true);
  });

  test('rejects a backwards range when both sides are full datetimes', () => {
    // With explicit dates attached there is no overnight ambiguity.
    const result = validateAnalysisRequest({
      query: 'x',
      time_range: { start: '2026-09-14T10:00:00Z', end: '2026-09-14T06:00:00Z' },
    });
    expect(result.valid).toBe(false);
  });

  test('rejects flat start_time/end_time with a shape hint', () => {
    const result = validateAnalysisRequest({ query: 'x', start_time: '06:00', end_time: '10:00' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /time_range/.test(e.message))).toBe(true);
  });
});

describe('validateAnalysisRequest - Section 7.10 what the Backend does NOT validate', () => {
  test('does not reject a land coordinate - land/sea is the Planner job', () => {
    // New Delhi: firmly inland. The Backend must still accept it; the Planner
    // decides whether to snap offshore or reject.
    expect(validateAnalysisRequest({ coordinate: { lat: 28.6139, lon: 77.2090 } }).valid).toBe(true);
  });

  test('does not reject a far-future date - forecast horizon is the Planner job', () => {
    expect(validateAnalysisRequest({ query: 'x', date: '2030-01-01' }).valid).toBe(true);
  });

  test('does not attempt to parse "tomorrow morning" out of the query', () => {
    expect(validateAnalysisRequest({ query: 'Is it safe tomorrow morning?' }).valid).toBe(true);
  });
});

describe('validateRouteRequest - Section 7.9', () => {
  const VESSEL = 'mechanized_fishing_vessel';

  test('requires both origin and destination', () => {
    expect(
      validateRouteRequest({
        origin: { coordinate: { lat: 13, lon: 80 } },
        vessel_type: VESSEL,
      }).valid
    ).toBe(false);
  });

  test('accepts coordinates at both ends', () => {
    expect(
      validateRouteRequest({
        origin: { coordinate: { lat: 13.0, lon: 80.3 } },
        destination: { coordinate: { lat: 13.5, lon: 81.0 } },
        vessel_type: VESSEL,
      }).valid
    ).toBe(true);
  });

  test('accepts place names at both ends', () => {
    expect(
      validateRouteRequest({
        origin: { place_name: 'Chennai' },
        destination: { place_name: 'Puducherry' },
        vessel_type: VESSEL,
      }).valid
    ).toBe(true);
  });

  test('rejects an endpoint with neither coordinate nor place_name', () => {
    expect(
      validateRouteRequest({
        origin: {},
        destination: { coordinate: { lat: 13, lon: 80 } },
        vessel_type: VESSEL,
      }).valid
    ).toBe(false);
  });

  test('vessel_type is REQUIRED for routes, unlike a point analysis', () => {
    // contracts/api/RouteRequest.json makes it required: a route is sustained
    // exposure, so the conservative-default fallback is not acceptable here.
    expect(
      validateRouteRequest({
        origin: { place_name: 'Chennai' },
        destination: { place_name: 'Puducherry' },
      }).valid
    ).toBe(false);
  });
});
