/**
 * @fileoverview User Proactive Alert Subscription Mongoose Schema
 * @module db/models/alertSubscription.model
 * @description
 * Implements data storage conforming to `contracts/api/AlertSubscriptionRequest.json`.
 * Configures automated push/SMS/webhook alerts for maritime hazards at designated coordinates.
 *
 * Operational Rules:
 * - Nested Location Shape: Models location as `{ place_name, coordinate: { lat, lon } }` per schema contract.
 * - Uppercase Risk Scales: Enforces uppercase risk thresholds (`CAUTION`, `UNSAFE`, `DANGEROUS`).
 * - Quiet Hours Override: DANGEROUS level alerts intentionally bypass user quiet hours
 *   for life-safety preservation.
 */

const mongoose = require('mongoose');


const ALERT_TYPES = [
  'cyclone', 'strong_wind', 'high_wave', 'swell_surge', 'lightning',
  'thunderstorm', 'poor_visibility', 'other_hazard', 'official_warning',
];

const CHANNELS = ['web_push', 'sms', 'whatsapp', 'ivr'];

// Matches RiskAssessment.risk_level exactly - SAFE included even though it is
// never a sensible minimum_level, because this same list is reused for
// comparisons against a point's actual level.
const RISK_LEVELS = ['SAFE', 'CAUTION', 'UNSAFE', 'DANGEROUS'];

const AlertSubscriptionSchema = new mongoose.Schema(
  {
    subscription_id: { type: String, required: true, unique: true, index: true },
    subscriber_id: { type: String, required: true, index: true },

    // place_or_coordinate: { place_name?, coordinate?: {lat,lon} }. Stored as
    // Mixed because it is the AnalysisRequest contract's shared shape, not
    // ours to redefine.
    location: { type: mongoose.Schema.Types.Mixed, required: true },

    activity: { type: String, default: null },
    vessel_type: { type: String, default: null },
    language_override: { type: String, default: null },

    alert_types: { type: [String], enum: ALERT_TYPES, required: true },

    // Contract-required, UPPERCASE.
    minimum_level: { type: String, enum: RISK_LEVELS, required: true },

    channel: { type: String, enum: CHANNELS, required: true },

    // Just { start, end } strings per the contract - no enabled/utc_offset/
    // override_for_severe fields. The DANGEROUS-always-delivers rule is a
    // hard-coded safety behaviour, not a per-subscription setting.
    quiet_hours: {
      start: { type: String, default: null },
      end: { type: String, default: null },
    },

    active: { type: Boolean, default: true, index: true },

    push_subscription: { type: mongoose.Schema.Types.Mixed, default: null },

    last_checked_at: { type: Date, default: null },
    last_alert_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'alert_subscriptions',
    strict: false,
  }
);

AlertSubscriptionSchema.index({ active: 1, last_checked_at: 1 });

// Section 40: 409 Conflict for a duplicate subscription. Location is now
// Mixed (place_or_coordinate), so this indexes on the coordinate sub-path
// when present. Partial so inactive (soft-deleted) subscriptions never block
// a fresh one at the same place.
AlertSubscriptionSchema.index(
  { subscriber_id: 1, 'location.coordinate.lat': 1, 'location.coordinate.lon': 1 },
  { unique: true, partialFilterExpression: { active: true, subscriber_id: { $type: 'string' } } }
);

module.exports = mongoose.model('AlertSubscription', AlertSubscriptionSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
module.exports.CHANNELS = CHANNELS;
module.exports.RISK_LEVELS = RISK_LEVELS;
