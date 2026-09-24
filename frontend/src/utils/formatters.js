/**
 * ============================================================================
 * ORCA Deterministic Output Formatters (src/utils/formatters.js)
 * ============================================================================
 * Provides strictly typed, null-safe string & visual badge formatters for
 * maritime telemetry, Route results, and Trend statistics.
 * 
 * Contract Alignment:
 * - RouteResult.json: route_id, total_distance_km, estimated_duration_hours, waypoint risks.
 * - TrendResult.json: trend_direction, slope_per_year, statistical confidence.
 * - Never throws on null/undefined/NaN; produces truthful fallback strings ('N/A', 'None').
 */

/**
 * Converts decimal hours into human-readable duration strings (e.g. '45m', '2h 15m').
 * 
 * @param {number|null|undefined} hours - Duration in fractional hours.
 * @returns {string} Formatted duration or 'N/A' if null/invalid.
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
 * Formats nautical or terrestrial distance in kilometers to 1 decimal place.
 * 
 * @param {number|null|undefined} km - Distance in kilometers.
 * @returns {string} Formatted string with 'km' suffix or 'N/A' if null/invalid.
 */
export function formatDistance(km) {
  if (km === null || km === undefined || isNaN(km)) {
    return 'N/A';
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Maps a maritime safety risk level (SAFE, CAUTION, UNSAFE, DANGEROUS)
 * into a Tailwind color palette and user-facing display label.
 * 
 * @param {string|null|undefined} level - Risk level enum string.
 * @returns {{ label: string, color: string, level: string }} Badge rendering descriptor.
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
