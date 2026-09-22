/**
 * tests/unit/gis-seed.test.js
 *
 * Asserts invariants for bundled GIS layers:
 * 1. Treaty polygon asserts Indian coastal ports/landmarks (Rameswaram, Pamban,
 *    Dhanushkodi, Tuticorin, Kanyakumari, Point Calimere) remain strictly OUTSIDE.
 * 2. constraint_type must be one of ['prohibited', 'conditional', 'warning_only'].
 * 3. All bundled layers have honest source strings ('ORCA approximate outline...').
 * 4. Verification flag is 'approximate' for unverified seed outlines.
 */

const { AUTHORITATIVE_ZONES } = require('../../scripts/seed-all-indian-zones');

function isPointInPolygon(lon, lat, poly) {
  let inside = false;
  const n = poly.length;
  let p1x = poly[0][0];
  let p1y = poly[0][1];
  for (let i = 1; i <= n; i++) {
    const p2 = poly[i % n];
    const p2x = p2[0];
    const p2y = p2[1];
    if (lat > Math.min(p1y, p2y)) {
      if (lat <= Math.max(p1y, p2y)) {
        if (lon <= Math.max(p1x, p2x)) {
          let xinters = lon;
          if (p1y !== p2y) {
            xinters = ((lat - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
          }
          if (p1x === p2x || lon <= xinters) {
            inside = !inside;
          }
        }
      }
    }
    p1x = p2x;
    p1y = p2y;
  }
  return inside;
}

describe('Bundled GIS Layers & Boundary Invariants', () => {
  const allowedConstraintTypes = ['prohibited', 'conditional', 'warning_only'];

  test('All bundled zones have valid constraint_type and honest source', () => {
    for (const zone of AUTHORITATIVE_ZONES) {
      expect(allowedConstraintTypes).toContain(zone.constraint_type);
      expect(zone.source).toContain('ORCA approximate outline - not survey data');
      expect(zone.verification).toBe('approximate');
    }
  });

  test('Indo-Sri Lanka boundary polygon excludes Indian coastal landmarks', () => {
    const srilanka = AUTHORITATIVE_ZONES.find((z) =>
      z.layer_name.includes('Sri Lanka')
    );
    expect(srilanka).toBeDefined();
    expect(srilanka.constraint_type).toBe('prohibited');
    expect(srilanka.verification).toBe('approximate');

    const polyCoords = srilanka.geometry_full.coordinates[0];

    const indianLandmarks = [
      { name: 'Rameswaram', lon: 79.3129, lat: 9.2876 },
      { name: 'Pamban', lon: 79.22, lat: 9.28 },
      { name: 'Dhanushkodi', lon: 79.41, lat: 9.18 },
      { name: 'Tuticorin', lon: 78.1348, lat: 8.7642 },
      { name: 'Kanyakumari', lon: 77.5385, lat: 8.0883 },
      { name: 'Point Calimere', lon: 79.86, lat: 10.29 },
    ];

    for (const landmark of indianLandmarks) {
      const inside = isPointInPolygon(landmark.lon, landmark.lat, polyCoords);
      expect(inside).toBe(false);
    }
  });
});
