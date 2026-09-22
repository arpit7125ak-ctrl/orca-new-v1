/**
 * tests/unit/geofence_invariants.test.js
 *
 * Verifies R1 Geofence Invariants:
 * 1. Unverified prohibited layer -> state "approaching", constraint_type "warning_only",
 *    layer_name suffixed "(approximate boundary, unverified)", message says approximate,
 *    never "inside prohibited waters" or "leave immediately".
 * 2. Authoritative prohibited layer -> state "inside", constraint_type "prohibited".
 * 3. Missing/null verification field -> treated as unverified/approximate (fail safe).
 */

const { checkPosition } = require('../../src/modules/geofence/geofence.service');
const GisLayer = require('../../src/db/models/gisLayer.model');
const GeofenceEvent = require('../../src/db/models/geofenceEvent.model');

jest.mock('../../src/db/models/gisLayer.model');
jest.mock('../../src/db/models/geofenceEvent.model');

describe('R1 Geofence Invariant Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    GeofenceEvent.create.mockResolvedValue({ _id: 'mock_event_id' });
    GeofenceEvent.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  });

  test('unverified prohibited layer yields state approaching, warning_only, and approximate message', async () => {
    // Point inside an unverified prohibited boundary
    GisLayer.find.mockImplementation((filter) => {
      if (filter.geometry_full?.$geoIntersects) {
        return {
          select: jest.fn().mockReturnThis(),
          maxTimeMS: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              layer_name: 'India - Sri Lanka International Maritime Boundary & Sri Lankan Waters',
              layer_type: 'international_maritime_boundary',
              constraint_type: 'prohibited',
              verification: 'approximate', // Unverified!
              source: 'ORCA approximate outline',
            },
          ]),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
    });

    const res = await checkPosition({ lat: 9.10, lon: 79.55, language: 'en' });

    // Assertions
    expect(res.state).toBe('approaching');
    expect(res.state).not.toBe('inside');
    expect(res.layer.constraint_type).toBe('warning_only');
    expect(res.layer.layer_name).toContain('(approximate boundary, unverified)');
    const warningText = res.message || res.warning_text;
    expect(warningText.toLowerCase()).toContain('approximate');
    expect(warningText.toLowerCase()).not.toContain('leave this area immediately');
    expect(warningText.toLowerCase()).not.toContain('inside prohibited waters');
  });

  test('authoritative prohibited layer yields state inside and leave immediately directive', async () => {
    GisLayer.find.mockImplementation((filter) => {
      if (filter.geometry_full?.$geoIntersects) {
        return {
          select: jest.fn().mockReturnThis(),
          maxTimeMS: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              layer_name: 'Surveyed Naval Prohibited Zone',
              layer_type: 'international_maritime_boundary',
              constraint_type: 'prohibited',
              verification: 'authoritative', // Authoritative!
              source: 'Survey of India official chart',
            },
          ]),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
    });

    const res = await checkPosition({ lat: 9.10, lon: 79.55, language: 'en' });

    // Assertions
    expect(res.state).toBe('inside');
    expect(res.layer.constraint_type).toBe('prohibited');
    const warningText = res.message || res.warning_text;
    expect(warningText).toContain('Leave this area immediately');
  });

  test('missing or null verification field is treated as approximate (fail safe)', async () => {
    GisLayer.find.mockImplementation((filter) => {
      if (filter.geometry_full?.$geoIntersects) {
        return {
          select: jest.fn().mockReturnThis(),
          maxTimeMS: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              layer_name: 'Legacy Unverified Zone',
              layer_type: 'marine_protected_area',
              constraint_type: 'prohibited',
              verification: null, // Missing / null verification!
              source: 'Unknown community report',
            },
          ]),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
    });

    const res = await checkPosition({ lat: 9.10, lon: 79.55, language: 'en' });

    // Assertions: Fail safe -> treated as unverified
    expect(res.state).toBe('approaching');
    expect(res.state).not.toBe('inside');
    expect(res.layer.constraint_type).toBe('warning_only');
    expect(res.layer.layer_name).toContain('(approximate boundary, unverified)');
    const warningText = res.message || res.warning_text;
    expect(warningText.toLowerCase()).toContain('approximate');
    expect(warningText.toLowerCase()).not.toContain('leave this area immediately');
  });
});
