// src/utils/time.js
// ---------------------------------------------------------------------------
// Section 7.4 / 7.5 - the Backend's time responsibilities are STRUCTURAL only.
// Section 7.10: interpreting "tomorrow morning" belongs to the Planner
// (Section 14), so there is deliberately NO natural-language parsing here.
//
// CONTRACT SHAPE (contracts/shared/TimeWindow.json) - IMPORTANT:
// TimeWindow.local and .utc are ISO 8601 INTERVAL STRINGS "start/end", NOT
// nested {date, start_time, end_time} objects:
//
//   local: "2026-09-12T05:00:00+05:30/2026-09-12T11:00:00+05:30"
//   utc:   "2026-09-12T00:30:00Z/2026-09-12T05:30:00Z"
//
// It also carries `original_expression` and `matched_bucket` - both
// Planner-owned, both null when the Backend builds it.
//
// The RAW inbound range (contracts/AnalysisRequest.json `time_range`) is a
// DIFFERENT shape: { start, end }. Raw range = pre-interpretation user input.
// TimeWindow = the Planner's interpreted output. Do not confuse them.
// ---------------------------------------------------------------------------

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;         // 2026-09-12
const ISO_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // 07:30, 23:59

/**
 * Validate a bare ISO 8601 calendar date (YYYY-MM-DD).
 * Checks the shape AND that the date exists - "2026-02-30" matches the regex
 * but JS Date would silently roll it to March 2nd. We reject instead.
 */
function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

/** Validate a 24-hour clock time string (HH:MM). */
function isValidIsoTime(value) {
  return typeof value === 'string' && ISO_TIME_PATTERN.test(value);
}

/** Validate a full ISO 8601 datetime that JS can parse. */
function isValidIsoDateTime(value) {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** "HH:MM" -> minutes since midnight. */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Validate the RAW `time_range` from contracts/AnalysisRequest.json.
 *
 * The contract types start/end as plain strings with no format constraint,
 * deliberately: the user may give a full datetime OR a bare clock time, and
 * Section 7.10 leaves interpretation to the Planner. So we accept both.
 *
 * Section 7.5 overnight handling: a bare clock pair where end < start (22:00 ->
 * 04:00) is legitimate for night fishing. We FLAG it rather than reject it,
 * because resolving which calendar day the end falls on needs context the
 * Planner owns. With full datetimes there is no ambiguity, so start > end is
 * simply backwards and IS rejected.
 *
 * @returns {{ valid, reason, isOvernight, kind }}
 */
function validateTimeRange(start, end) {
  if (typeof start !== 'string' || !start.trim()) {
    return { valid: false, reason: 'time_range.start is required', isOvernight: false, kind: null };
  }
  if (typeof end !== 'string' || !end.trim()) {
    return { valid: false, reason: 'time_range.end is required', isOvernight: false, kind: null };
  }

  // Case 1: both full datetimes -> ordering is unambiguous.
  if (start.length > 5 && end.length > 5 && isValidIsoDateTime(start) && isValidIsoDateTime(end)) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    if (startMs === endMs) {
      return { valid: false, reason: 'time_range.start and end cannot be identical', isOvernight: false, kind: 'datetime' };
    }
    if (startMs > endMs) {
      return { valid: false, reason: 'time_range.start is later than time_range.end', isOvernight: false, kind: 'datetime' };
    }
    return { valid: true, reason: null, isOvernight: false, kind: 'datetime' };
  }

  // Case 2: bare HH:MM clock times -> end < start means overnight, which is legal.
  if (isValidIsoTime(start) && isValidIsoTime(end)) {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);

    if (startMinutes === endMinutes) {
      return { valid: false, reason: 'time_range.start and end cannot be identical', isOvernight: false, kind: 'clock' };
    }
    return { valid: true, reason: null, isOvernight: endMinutes < startMinutes, kind: 'clock' };
  }

  return {
    valid: false,
    reason: 'time_range.start and end must both be ISO 8601 datetimes, or both be HH:MM clock times',
    isOvernight: false,
    kind: null,
  };
}

/** Build an ISO 8601 interval string "start/end" (the TimeWindow contract shape). */
function toInterval(start, end) {
  if (!start || !end) return null;
  return `${start}/${end}`;
}

/** Split an ISO 8601 interval string back into its endpoints. */
function fromInterval(interval) {
  if (typeof interval !== 'string' || !interval.includes('/')) {
    return { start: null, end: null };
  }
  const i = interval.indexOf('/');
  return { start: interval.slice(0, i), end: interval.slice(i + 1) };
}

/** Minutes offset -> "+05:30" / "-08:00" / "Z". */
function formatOffset(minutes) {
  if (minutes === 0) return 'Z';
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** Convert a local date + HH:MM + offset into a UTC ISO string. */
function localToUtcIso(date, timeOfDay, utcOffsetMinutes) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = timeOfDay.split(':').map(Number);
  // Date.UTC treats components as UTC; subtracting the offset converts the
  // local wall-clock reading into true UTC.
  const ms = Date.UTC(y, m - 1, d, hh, mm) - utcOffsetMinutes * 60 * 1000;
  return new Date(ms).toISOString();
}

/** Add N days to a YYYY-MM-DD string. */
function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Build a TimeWindow conforming to contracts/shared/TimeWindow.json.
 *
 * NEVER-FABRICATE, and this is the crucial part:
 * The Backend can only produce a truthful TimeWindow when the user supplied an
 * explicit date AND an explicit UTC offset. Without both, resolving the window
 * is the Planner's job (Section 7.10). Guessing - e.g. assuming IST because the
 * project is Indian - would silently shift every downstream forecast lookup by
 * hours.
 *
 * So this returns NULL rather than a half-invented window. Null means
 * "not yet resolved", which is honest and is exactly what the Planner expects.
 *
 * @returns {object|null} TimeWindow, or null when it cannot be built truthfully
 */
function buildTimeWindow({ date, timeRange, utcOffsetMinutes } = {}) {
  if (!date || !timeRange || !timeRange.start || !timeRange.end) return null;
  if (typeof utcOffsetMinutes !== 'number') return null;

  // Only bare clock times are combined with a date here. Full datetimes already
  // carry their own date and offset; re-deriving them could override what the
  // user explicitly stated.
  if (!isValidIsoTime(timeRange.start) || !isValidIsoTime(timeRange.end)) return null;

  const overnight = toMinutes(timeRange.end) < toMinutes(timeRange.start);
  const endDate = overnight ? addDays(date, 1) : date;
  const offset = formatOffset(utcOffsetMinutes);

  return {
    local: toInterval(
      `${date}T${timeRange.start}:00${offset}`,
      `${endDate}T${timeRange.end}:00${offset}`
    ),
    utc: toInterval(
      localToUtcIso(date, timeRange.start, utcOffsetMinutes),
      localToUtcIso(endDate, timeRange.end, utcOffsetMinutes)
    ),
    // Planner-owned (Section 14). Null from the Backend - never guessed.
    original_expression: null,
    matched_bucket: null,
  };
}

/** Current UTC timestamp as an ISO string. */
function nowIso() {
  return new Date().toISOString();
}

/** Elapsed milliseconds, for execution_trace durations. */
function durationMs(start, end = new Date()) {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  return e.getTime() - s.getTime();
}

module.exports = {
  isValidIsoDate,
  isValidIsoTime,
  isValidIsoDateTime,
  validateTimeRange,
  buildTimeWindow,
  toInterval,
  fromInterval,
  formatOffset,
  localToUtcIso,
  addDays,
  nowIso,
  durationMs,
  toMinutes,
};
