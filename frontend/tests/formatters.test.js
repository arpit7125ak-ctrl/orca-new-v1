import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDuration,
  formatDistance,
  formatRiskBadge,
  formatTrendDirection,
  formatTrendMagnitude,
  formatConfidence,
} from '../src/utils/formatters.js';

test('formatDuration - formats standard hours and minutes', () => {
  assert.equal(formatDuration(24.7), '24h 42m');
  assert.equal(formatDuration(2.0), '2h');
  assert.equal(formatDuration(0.5), '30m');
  assert.equal(formatDuration(null), 'N/A');
  assert.equal(formatDuration(undefined), 'N/A');
});

test('formatDistance - formats kilometers', () => {
  assert.equal(formatDistance(365.61), '365.6 km');
  assert.equal(formatDistance(12.0), '12.0 km');
  assert.equal(formatDistance(null), 'N/A');
});

test('formatRiskBadge - maps levels to display colors', () => {
  assert.equal(formatRiskBadge('SAFE').color, 'emerald');
  assert.equal(formatRiskBadge('CAUTION').color, 'amber');
  assert.equal(formatRiskBadge('UNSAFE').color, 'orange');
  assert.equal(formatRiskBadge('DANGEROUS').color, 'rose');
  assert.equal(formatRiskBadge(null).level, 'UNKNOWN');
});

test('formatTrendDirection - labels directions correctly', () => {
  const inc = formatTrendDirection('increasing');
  assert.equal(inc.label, 'Increasing Trend');
  assert.equal(inc.isSignificant, true);

  const dec = formatTrendDirection('decreasing');
  assert.equal(dec.label, 'Decreasing Trend');
  assert.equal(dec.isSignificant, true);

  const st = formatTrendDirection('stable');
  assert.equal(st.label, 'Stable (No Trend Detectable)');
  assert.equal(st.isSignificant, false);

  const ins = formatTrendDirection('insufficient_data');
  assert.equal(ins.label, 'Insufficient Baseline Data');
  assert.equal(ins.isSignificant, false);
});

test('formatTrendMagnitude - formats slopes and units', () => {
  assert.equal(formatTrendMagnitude(0.18, '°C'), '+0.18 °C/year');
  assert.equal(formatTrendMagnitude(-0.25, '°C'), '-0.25 °C/year');
  assert.equal(formatTrendMagnitude(null), 'None');
});

test('formatConfidence - formats statistical confidence', () => {
  assert.equal(formatConfidence(0.85), '85% (High)');
  assert.equal(formatConfidence(0.55), '55% (Moderate)');
  assert.equal(formatConfidence(0.30), '30% (Low - insufficient baseline)');
  assert.equal(formatConfidence(null), 'N/A');
});
