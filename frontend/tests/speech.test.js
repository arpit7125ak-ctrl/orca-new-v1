import test from 'node:test';
import assert from 'node:assert/strict';

import { SPEECH_LOCALES, localeFor } from '../src/utils/speech.js';

test('speech utils - 10 canonical regional languages defined', () => {
  const expectedLanguages = ['en', 'hi', 'bn', 'ta', 'te', 'or', 'mr', 'ml', 'kn', 'gu'];
  assert.equal(Object.keys(SPEECH_LOCALES).length, 10);
  for (const lang of expectedLanguages) {
    assert.ok(SPEECH_LOCALES[lang], `Language ${lang} should be defined`);
    assert.match(SPEECH_LOCALES[lang], /^[a-z]{2}-IN$/, `Locale for ${lang} should be *-IN format`);
  }
});

test('speech utils - localeFor exact mapping', () => {
  assert.equal(localeFor('hi'), 'hi-IN');
  assert.equal(localeFor('ta'), 'ta-IN');
  assert.equal(localeFor('bn'), 'bn-IN');
  assert.equal(localeFor('ml'), 'ml-IN');
  assert.equal(localeFor('gu'), 'gu-IN');
});

test('speech utils - localeFor fallback to en-IN', () => {
  assert.equal(localeFor('unknown'), 'en-IN');
  assert.equal(localeFor(null), 'en-IN');
  assert.equal(localeFor(''), 'en-IN');
});
