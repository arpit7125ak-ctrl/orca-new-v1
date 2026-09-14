// tests/unit/i18n.test.js
// Section 66.2: pre-translated templates, and honest reporting of fallback.

const i18n = require('../../src/i18n');

describe('geofenceMessage', () => {
  test('fills placeholders in English', () => {
    const { message, fellBack } = i18n.geofenceMessage('approaching', 'en', {
      layer: 'the international maritime boundary',
      distance: '3.2',
      direction: 'SE',
    });
    expect(message).toContain('3.2');
    expect(message).toContain('SE');
    expect(fellBack).toBe(false);
  });

  test('returns a native-script message for Tamil', () => {
    const { message, languageUsed, fellBack } = i18n.geofenceMessage('inside', 'ta', { layer: 'X' });
    expect(languageUsed).toBe('ta');
    expect(fellBack).toBe(false);
    expect(message).toMatch(/[\u0B80-\u0BFF]/); // Tamil unicode range
  });

  test('falls back to English AND reports it honestly', () => {
    // The caller can then show "displayed in English" rather than implying the
    // requested language was supported.
    const { languageUsed, fellBack } = i18n.geofenceMessage('clear', 'fr');
    expect(languageUsed).toBe('en');
    expect(fellBack).toBe(true);
  });

  test('every supported language has all three states', () => {
    for (const code of ['en', 'hi', 'bn', 'ta', 'te', 'or', 'mr', 'ml', 'kn', 'gu']) {
      for (const state of ['clear', 'approaching', 'inside']) {
        expect(i18n.geofenceMessage(state, code, { layer: 'X', distance: '1', direction: 'N' }).fellBack)
          .toBe(false);
      }
    }
  });
});

describe('alertMessage', () => {
  test('localises the {level} word, not just the sentence', () => {
    // Otherwise a Hindi sentence would end with the English word "dangerous".
    const { message } = i18n.alertMessage('cyclone', 'hi', {
      location: 'Chennai', level: 'dangerous', detail: '',
    });
    expect(message).toMatch(/[\u0900-\u097F]/); // Devanagari
  });

  test('covers every alert type in every language', () => {
    const types = ['adverse_weather', 'high_waves', 'lightning', 'cyclone', 'official_warning', 'geofence_proximity'];
    for (const type of types) {
      for (const code of ['en', 'hi', 'ta', 'bn', 'te', 'or', 'mr', 'ml', 'kn', 'gu']) {
        expect(i18n.alertMessage(type, code, { location: 'X', level: 'unsafe', detail: '' }).fellBack)
          .toBe(false);
      }
    }
  });
});

describe('layerName', () => {
  test('returns a localised layer name', () => {
    expect(i18n.layerName('marine_protected_area', 'ta')).toMatch(/[\u0B80-\u0BFF]/);
  });

  test('degrades to readable text for an unknown layer type rather than snake_case', () => {
    expect(i18n.layerName('some_new_layer', 'en')).toBe('some new layer');
  });
});
