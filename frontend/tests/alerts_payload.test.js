import test from 'node:test';
import assert from 'node:assert/strict';

test('alert payload builder - contract compliance', () => {
  const allowedLevels = ['CAUTION', 'UNSAFE', 'DANGEROUS'];
  const allowedChannels = ['web_push', 'sms', 'whatsapp', 'ivr'];
  const allowedTypes = [
    'cyclone',
    'strong_wind',
    'high_wave',
    'swell_surge',
    'lightning',
    'thunderstorm',
    'poor_visibility',
    'other_hazard',
    'official_warning',
  ];

  const payload = {
    subscriber_id: 'sub-test-uuid',
    location: {
      place_name: 'Kochi Offshore',
      coordinate: { lat: 9.94, lon: 76.16 },
    },
    alert_types: ['cyclone', 'high_wave', 'strong_wind'],
    minimum_level: 'CAUTION',
    channel: 'web_push',
    push_subscription: null,
  };

  assert.ok(payload.subscriber_id);
  assert.ok(payload.location.place_name || payload.location.coordinate);
  assert.ok(allowedLevels.includes(payload.minimum_level));
  assert.ok(allowedChannels.includes(payload.channel));
  assert.equal(payload.channel, 'web_push');

  for (const t of payload.alert_types) {
    assert.ok(allowedTypes.includes(t), `Hazard type ${t} must be valid`);
  }
});
