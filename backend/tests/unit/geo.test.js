// tests/unit/geo.test.js
// Geometry helpers underpinning geofencing (Section 66).

const { haversineKm, bearingDeg, bearingToCompass, toGeoJsonPoint, validateCoordinates } =
  require('../../src/utils/geo');

describe('haversineKm', () => {
  test('is zero for identical points', () => {
    expect(haversineKm(13.0, 80.0, 13.0, 80.0)).toBeCloseTo(0, 5);
  });

  test('one degree of latitude is about 111 km', () => {
    expect(haversineKm(13.0, 80.0, 14.0, 80.0)).toBeCloseTo(111.19, 1);
  });

  test('Chennai to Visakhapatnam is roughly 610 km', () => {
    const d = haversineKm(13.08, 80.27, 17.69, 83.28);
    expect(d).toBeGreaterThan(570);
    expect(d).toBeLessThan(640);
  });
});

describe('bearingDeg', () => {
  test('due north is 0 degrees', () => {
    expect(bearingDeg(13.0, 80.0, 14.0, 80.0)).toBeCloseTo(0, 1);
  });

  test('due east is about 90 degrees', () => {
    expect(bearingDeg(13.0, 80.0, 13.0, 81.0)).toBeCloseTo(90, 0);
  });

  test('always returns a value in [0, 360)', () => {
    const b = bearingDeg(13.0, 80.0, 12.0, 79.0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('bearingToCompass', () => {
  test.each([[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [45, 'NE']])(
    '%i degrees is %s', (deg, expected) => {
      expect(bearingToCompass(deg)).toBe(expected);
    }
  );
});

describe('toGeoJsonPoint', () => {
  test('emits [longitude, latitude] - the GeoJSON order, NOT lat/lon', () => {
    // Getting this backwards is the single most common geospatial bug and
    // would put every Indian coordinate in the wrong place.
    expect(toGeoJsonPoint(13.0, 80.5)).toEqual({ type: 'Point', coordinates: [80.5, 13.0] });
  });
});

describe('validateCoordinates - Section 7.2', () => {
  test('accepts valid coordinates', () => {
    expect(validateCoordinates(13.0, 80.5).valid).toBe(true);
  });

  test('rejects latitude beyond 90', () => {
    expect(validateCoordinates(91, 80).valid).toBe(false);
  });

  test('rejects a non-numeric latitude', () => {
    expect(validateCoordinates('13', 80).valid).toBe(false);
  });

  test('accepts the exact boundary values', () => {
    expect(validateCoordinates(90, 180).valid).toBe(true);
    expect(validateCoordinates(-90, -180).valid).toBe(true);
  });
});
