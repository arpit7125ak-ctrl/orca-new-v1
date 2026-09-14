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
  // contracts' quiet_hours is just { start, end } - no `enabled` flag.
  // Absence of start/end IS "not configured", so both being set is what
  // "enabled" means here.
  if (!quietHours || !quietHours.start || !quietHours.end) return false;

  // Section 70.3 (contract description, not a configurable field): "Official
  // DANGEROUS alerts always deliver regardless of quiet hours." This is a
  // hard safety rule enforced in code, not a per-subscription setting - the
  // contract's quiet_hours object has no override flag at all.
  if (level === 'DANGEROUS') return false;

  // The contract's quiet_hours is just { start, end } as plain "HH:MM"
  // strings with no UTC offset field. Without a stated offset we treat them
  // as the subscriber's own local wall-clock time using server-local time -
  // simpler than before, and matches what the contract actually offers.
  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const localMinutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);

  // Quiet hours usually span midnight (e.g. 22:00 -> 06:00), so the window
  // wraps and a simple start<=x<=end comparison would be wrong.
  return start <= end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end;
}

/**
 * Does this risk level meet the subscriber's threshold (Section 99.6)?
 * Ordered so a higher threshold implies the lower ones are not notified.
 */
// UPPERCASE per contracts/RiskAssessment.json risk_level and
// contracts/api/AlertSubscriptionRequest.json minimum_level. This was
// lowercase before - caught by live testing against the real contract, which
// rejects lowercase values outright (Ajv enum match is case-sensitive).
const LEVEL_RANK = { SAFE: 0, CAUTION: 1, UNSAFE: 2, DANGEROUS: 3 };

function meetsThreshold(level, minimumLevel) {
  // Contract field is `minimum_level` (contracts/api/AlertSubscriptionRequest).
  if (!minimumLevel) return true;  // no threshold set = notify on anything
  return (LEVEL_RANK[level] || 0) >= (LEVEL_RANK[minimumLevel] || 0);
}

module.exports = { buildAlertDedupKey, isDuplicate, isWithinQuietHours, meetsThreshold, LEVEL_RANK };
