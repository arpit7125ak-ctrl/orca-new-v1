// src/db/models/alertEvent.model.js
// ---------------------------------------------------------------------------
// Section 99.7: `alert_events`
//   Subscription ID, triggered analysis ID, level, message, sent status,
//   deduplication key, timestamp.
//
// One document per alert we DECIDED to raise - including ones we then
// suppressed as duplicates. Storing suppressed alerts too means we can prove
// why a user did or did not receive a notification.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const AlertEventSchema = new mongoose.Schema(
  {
    subscription_id: { type: String, required: true, index: true },

    // The analysis whose result triggered this alert. Links the notification
    // back to its full evidence chain (Section 8.1). Contract calls it
    // `analysis_id`.
    analysis_id: { type: String, default: null, index: true },

    alert_type: {
      type: String, required: true,
      enum: ['cyclone','strong_wind','high_wave','swell_surge','lightning',
             'thunderstorm','poor_visibility','other_hazard','official_warning'],
    },
    // UPPERCASE per contracts/RiskAssessment.json - matches the full risk
    // scale, not just the subscription's alerting threshold.
    level: { type: String, required: true, enum: ['SAFE','CAUTION','UNSAFE','DANGEROUS'] },

    // Contract field. Lets a subscriber be told "conditions have worsened from
    // unsafe to dangerous" rather than just repeating the new level - and it is
    // why an escalation is not deduplicated away as "the same storm".
    previous_level: { type: String, enum: ['SAFE','CAUTION','UNSAFE','DANGEROUS', null], default: null },

    message_text: { type: String, default: null },
    language: { type: String, default: null },

    channel: { type: String, enum: ['web_push','sms','whatsapp','ivr', null], default: null },

    // Delivery outcome, per contracts/db/AlertEventDocument.json exactly:
    //   evaluated_no_send  - checked, decided not to send (below threshold,
    //                        quiet hours) - a DELIBERATE non-send, not a
    //                        failure. This is what lets us answer "why didn't
    //                        ORCA warn me?" instead of leaving silence.
    //   sent               - delivered
    //   suppressed_duplicate - deduplicated against a recent identical alert
    //   failed             - delivery was attempted and failed
    //
    // NOTE: there is no 'pending' in the contract enum. An alert not yet
    // delivered is recorded as 'evaluated_no_send' and updated to 'sent' or
    // 'failed' once delivery completes (see eventLogger.markDelivered).
    status: {
      type: String,
      enum: ['evaluated_no_send', 'sent', 'suppressed_duplicate', 'failed'],
      default: 'evaluated_no_send',
      index: true,
    },
    sent_at: { type: Date, default: null },
    delivery_error: { type: String, default: null },

    // Section 99.7: "deduplication key". Deterministic hash (see
    // utils/ids.generateDedupKey) of subscription + type + level so the same
    // hazard does not notify repeatedly within the dedup window.
    dedup_key: { type: String, required: true, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'alert_events',
    strict: false,
  }
);

// The dedup lookup: "did we already alert this subscription with this key
// inside the window?"
AlertEventSchema.index({ subscription_id: 1, dedup_key: 1, created_at: -1 });

module.exports = mongoose.model('AlertEvent', AlertEventSchema);
