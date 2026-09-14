// src/db/models/alertSubscription.model.js
// ---------------------------------------------------------------------------
// SHAPE FROM contracts/api/AlertSubscriptionRequest.json:
//   required: subscriber_id, location, alert_types, minimum_level, channel
//   optional: activity, vessel_type, language_override, quiet_hours
//
// THREE THINGS THIS GOT WRONG BEFORE, caught by live testing against the real
// contract (my earlier checker only validated top-level required/
// additionalProperties, not nested objects or enums - it missed all of this):
//
//   1. `location` is a place_or_coordinate object ({ place_name,
//      coordinate: {lat,lon} }), NOT a flat { lat, lon, place_name }.
//   2. `alert_types` enum is: cyclone, strong_wind, high_wave, swell_surge,
//      lightning, thunderstorm, poor_visibility, other_hazard,
//      official_warning - not the invented adverse_weather/high_waves/
//      geofence_proximity set.
//   3. Risk levels are UPPERCASE everywhere in this system: SAFE, CAUTION,
//      UNSAFE, DANGEROUS. minimum_level's enum is CAUTION/UNSAFE/DANGEROUS
//      (SAFE is not a sensible alert threshold - you don't get alerted when
//      everything is fine).
//
// `quiet_hours` is much simpler than assumed: just { start, end } (two plain
// strings). The contract's own description states the safety rule directly -
// "Official DANGEROUS alerts always deliver regardless of quiet hours" - so
// that override is NOT a configurable field. It is enforced in code
// (dedup.js), not stored per-subscription.
// ---------------------------------------------------------------------------

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
