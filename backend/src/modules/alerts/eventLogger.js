/**
 * @fileoverview Alerts Event Logger
 * Records every alert evaluation (both sent and suppressed) for audit and
 * accountability purposes.
 *
 * @module alerts.eventLogger
 */

// src/modules/alerts/eventLogger.js
// ---------------------------------------------------------------------------
// Section 99.7: every alert decision is recorded in alert_events - including
// the ones we deliberately did NOT send.
//
// WHY RECORD SUPPRESSED ALERTS:
// If a user later asks "why didn't ORCA warn me?", the answer must be in the
// database. "No record" is indistinguishable from "the system was broken". A
// suppressed_quiet_hours row is an ANSWER; silence is not.
// ---------------------------------------------------------------------------

const AlertEvent = require('../../db/models/alertEvent.model');
const { logger } = require('../../observability/logger');

async function recordAlert({
  subscriptionId,
  analysisId = null,
  alertType,
  level,
  previousLevel = null,
  messageText = null,
  language = null,
  channel = null,
  dedupKey,
  status = 'evaluated_no_send',
  deliveryError = null,
}) {
  // Field names from contracts/db/AlertEventDocument.json.
  const event = await AlertEvent.create({
    subscription_id: subscriptionId,
    analysis_id: analysisId,
    alert_type: alertType,
    level,
    message_text: messageText,
    language,
    channel,
    dedup_key: dedupKey,
    status,
    sent_at: status === 'sent' ? new Date() : null,
    previous_level: previousLevel,
    delivery_error: deliveryError,
  });

  logger.info(
    { subscription_id: subscriptionId, alert_type: alertType, level, status },
    '[alerts] Alert event recorded'
  );

  return event;
}

/** Update an event after a delivery attempt. */
async function markDelivered(eventId, { success, error = null }) {
  return AlertEvent.findByIdAndUpdate(
    eventId,
    {
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date() : null,
      delivery_error: error,
    },
    { new: true }
  );
}

module.exports = { recordAlert, markDelivered };
