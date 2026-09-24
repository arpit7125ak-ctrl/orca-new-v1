/**
 * @fileoverview Alerts Deduplication
 * Prevents alert flooding by deduplicating notifications based on hazard level
 * and time window. Manages quiet hours evaluation.
 *
 * @module alerts.dedup
 */

// src/modules/alerts/dedup.js
// ---------------------------------------------------------------------------
// Section 99.7: alert_events carry a deduplication key.
//
// WHY DEDUPLICATION MATTERS HERE:
// The scheduler re-evaluates every subscription on a fixed interval. A cyclone
// lasts days. Without dedup, one storm would generate dozens of identical
// notifications and the user would mute ORCA entirely - which is a SAFETY
// failure, because they would then miss the alert that actually mattered.
//
// The key is deterministic (subscription + alert type + level), NOT random, so
// the same hazard produces the same key across scheduler runs and processes.
//
// DELIBERATE DESIGN CHOICE: level is part of the key. An escalation from
// `unsafe` to `dangerous` produces a DIFFERENT key and therefore DOES notify
// again - escalation is new information the user needs.
// ---------------------------------------------------------------------------

const AlertEvent = require('../../db/models/alertEvent.model');
const limits = require('../../config/limits');
const { generateDedupKey } = require('../../utils/ids');

function buildAlertDedupKey({ subscriptionId, alertType, level }) {
  return generateDedupKey(subscriptionId, alertType, level);
}

/**
 * Was an identical alert already sent inside the dedup window?
 * Only SENT alerts suppress a new one - a previously suppressed or failed
 * alert must not block a genuine delivery.
 */
async function isDuplicate({ subscriptionId, alertType, level }) {
  const dedupKey = buildAlertDedupKey({ subscriptionId, alertType, level });
  const since = new Date(Date.now() - limits.ALERT_DEDUP_WINDOW_MS);

  const recent = await AlertEvent.findOne({
    subscription_id: subscriptionId,
    dedup_key: dedupKey,
    status: 'sent',
    created_at: { $gte: since },
  }).lean();

  return { duplicate: Boolean(recent), dedupKey, previousEventId: recent?._id || null };
}

/**
 * Section 99.6 quiet hours.
 *
 * SAFETY CARVE-OUT: `override_for_severe` (default true) means a DANGEROUS
 * alert is delivered regardless of quiet hours. A cyclone warning at 3am is
 * precisely when someone needs to know - suppressing it to avoid disturbing
 * them would be indefensible.
 */
function isWithinQuietHours(quietHours, level, now = new Date()) {
  if (!quietHours) return false;
  if (quietHours.enabled === false) return false;

  const startStr = quietHours.start_local || quietHours.start;
  const endStr = quietHours.end_local || quietHours.end;
  if (!startStr || !endStr) return false;

  const normLevel = String(level || '').toUpperCase();
  const overrideSevere = quietHours.override_for_severe !== false;
  if (overrideSevere && normLevel === 'DANGEROUS') {
    return false;
  }

  const offset = quietHours.utc_offset_minutes;
  if (offset === null || offset === undefined) {
    return false;
  }

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = (utcMinutes + offset + 1440) % 1440;
  const start = toMinutes(startStr);
  const end = toMinutes(endStr);

  return start <= end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end;
}

/**
 * Does this risk level meet the subscriber's threshold (Section 99.6)?
 * Ordered so a higher threshold implies the lower ones are not notified.
 */
const LEVEL_RANK = {
  SAFE: 0, CAUTION: 1, UNSAFE: 2, DANGEROUS: 3,
  safe: 0, caution: 1, unsafe: 2, dangerous: 3,
};

function meetsThreshold(level, minimumLevel) {
  if (!minimumLevel) return true;
  const l = String(level || '').toUpperCase();
  const m = String(minimumLevel || '').toUpperCase();
  return (LEVEL_RANK[l] ?? 0) >= (LEVEL_RANK[m] ?? 0);
}

module.exports = { buildAlertDedupKey, isDuplicate, isWithinQuietHours, meetsThreshold, LEVEL_RANK };
