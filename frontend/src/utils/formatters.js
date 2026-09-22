/**
 * frontend/src/utils/formatters.js
 *
 * Deterministic formatters for Route and Trend outputs.
 * Strict adherence to contract shapes in RouteResult.json and TrendResult.json.
 */

/**
 * Format route duration in hours to human-readable string.
 * @param {number|null} hours
 * @returns {string}
 */
export function formatDuration(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return 'N/A';
  }
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format distance in km.
 * @param {number|null} km
 * @returns {string}
 */
export function formatDistance(km) {
  if (km === null || km === undefined || isNaN(km)) {
    return 'N/A';
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Format risk level into badge styling and display label.
 * @param {string|null} level
 * @returns {{ label: string, color: string, level: string }}
 */
export function formatRiskBadge(level) {
  const norm = String(level || '').toUpperCase();
  switch (norm) {
    case 'SAFE':
      return { label: 'Safe', color: 'emerald', level: 'SAFE' };
    case 'CAUTION':
      return { label: 'Caution', color: 'amber', level: 'CAUTION' };
    case 'UNSAFE':
      return { label: 'Unsafe', color: 'orange', level: 'UNSAFE' };
    case 'DANGEROUS':
      return { label: 'Dangerous', color: 'rose', level: 'DANGEROUS' };
    default:
      return { label: 'Undetermined', color: 'slate', level: 'UNKNOWN' };
  }
}

/**
 * Format trend direction into user-friendly metadata.
 * @param {string|null} direction
 * @returns {{ label: string, color: string, isSignificant: boolean }}
 */
export function formatTrendDirection(direction) {
  switch (direction) {
    case 'increasing':
      return { label: 'Increasing Trend', color: 'rose', isSignificant: true };
    case 'decreasing':
      return { label: 'Decreasing Trend', color: 'blue', isSignificant: true };
    case 'stable':
      return { label: 'Stable (No Trend Detectable)', color: 'emerald', isSignificant: false };
    case 'insufficient_data':
    default:
      return { label: 'Insufficient Baseline Data', color: 'slate', isSignificant: false };
  }
}

/**
 * Format trend slope / magnitude per year.
 * @param {number|null} magnitude
 * @param {string} unit
 * @returns {string}
 */
export function formatTrendMagnitude(magnitude, unit = '°C') {
  if (magnitude === null || magnitude === undefined || isNaN(magnitude)) {
    return 'None';
  }
  const prefix = magnitude > 0 ? '+' : '';
  return `${prefix}${magnitude.toFixed(2)} ${unit}/year`;
}

/**
 * Format statistical confidence percentage.
 * @param {number|null} confidence 0.0 - 1.0
 * @returns {string}
 */
export function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined || isNaN(confidence)) {
    return 'N/A';
  }
  const pct = Math.round(confidence * 100);
  if (confidence < 0.4) {
    return `${pct}% (Low - insufficient baseline)`;
  }
  if (confidence < 0.7) {
    return `${pct}% (Moderate)`;
  }
  return `${pct}% (High)`;
}
