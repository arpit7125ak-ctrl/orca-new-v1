// tests/unit/dedup.test.js
// The alert suppression logic. The quiet-hours carve-out test is the most
// important one here: suppressing a cyclone warning would be indefensible.

const { isWithinQuietHours, meetsThreshold, buildAlertDedupKey } =
  require('../../src/modules/alerts/dedup');

describe('meetsThreshold - Section 99.6', () => {
  test('a level at the threshold qualifies', () => {
    expect(meetsThreshold('unsafe', 'unsafe')).toBe(true);
  });

  test('a level above the threshold qualifies', () => {
    expect(meetsThreshold('dangerous', 'unsafe')).toBe(true);
  });

  test('a level below the threshold does not', () => {
    expect(meetsThreshold('caution', 'unsafe')).toBe(false);
  });

  test('no threshold set means notify on anything', () => {
    expect(meetsThreshold('caution', null)).toBe(true);
  });
});

describe('isWithinQuietHours - Section 99.6', () => {
  const quietHours = {
    enabled: true,
    start_local: '22:00',
    end_local: '06:00',
    utc_offset_minutes: 330, // IST
    override_for_severe: true,
  };

  test('suppresses a caution alert inside the window', () => {
    // 2026-09-12T18:00Z = 23:30 IST, inside 22:00-06:00
    expect(isWithinQuietHours(quietHours, 'caution', new Date('2026-09-12T18:00:00Z'))).toBe(true);
  });

  test('does not suppress outside the window', () => {
    // 2026-09-12T06:00Z = 11:30 IST
    expect(isWithinQuietHours(quietHours, 'caution', new Date('2026-09-12T06:00:00Z'))).toBe(false);
  });

  test('SAFETY CARVE-OUT: a DANGEROUS alert pierces quiet hours', () => {
    // A cyclone warning at 3am is exactly when someone needs to know.
    expect(isWithinQuietHours(quietHours, 'dangerous', new Date('2026-09-12T18:00:00Z'))).toBe(false);
  });

  test('respects override_for_severe=false when explicitly set', () => {
    const strict = { ...quietHours, override_for_severe: false };
    expect(isWithinQuietHours(strict, 'dangerous', new Date('2026-09-12T18:00:00Z'))).toBe(true);
  });

  test('handles a window that does NOT span midnight', () => {
    const daytime = { ...quietHours, start_local: '09:00', end_local: '17:00' };
    // 2026-09-12T06:00Z = 11:30 IST, inside 09:00-17:00
    expect(isWithinQuietHours(daytime, 'caution', new Date('2026-09-12T06:00:00Z'))).toBe(true);
  });

  test('does NOT suppress when the UTC offset is unknown', () => {
    // Without an offset we cannot tell what "local 22:00" means. Failing toward
    // DELIVERING the alert is the safe direction.
    const noOffset = { ...quietHours, utc_offset_minutes: null };
    expect(isWithinQuietHours(noOffset, 'caution', new Date('2026-09-12T18:00:00Z'))).toBe(false);
  });

  test('disabled quiet hours never suppress', () => {
    expect(isWithinQuietHours({ ...quietHours, enabled: false }, 'caution')).toBe(false);
  });
});

describe('buildAlertDedupKey', () => {
  test('is stable for identical inputs', () => {
    const args = { subscriptionId: 'sub_1', alertType: 'cyclone', level: 'dangerous' };
    expect(buildAlertDedupKey(args)).toBe(buildAlertDedupKey(args));
  });

  test('an ESCALATION produces a different key so it notifies again', () => {
    // Escalation is new information the user needs - it must not be deduped
    // away as "the same storm".
    expect(buildAlertDedupKey({ subscriptionId: 's', alertType: 'cyclone', level: 'unsafe' }))
      .not.toBe(buildAlertDedupKey({ subscriptionId: 's', alertType: 'cyclone', level: 'dangerous' }));
  });
});
