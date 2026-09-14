// src/db/models/geofenceEvent.model.js
// ---------------------------------------------------------------------------
// SHAPE FROM contracts/db/GeofenceEventDocument.json:
//   required: lat, lon, state, created_at
//   optional: device_id, layer_name, constraint_type, distance_km,
//             bearing_deg, deduplicated
//
// Section 66.3: geofence events are stored for audit.
// Section 107: full GPS trails must NOT be retained beyond audit needs - see
// the TTL index at the bottom, which makes MongoDB enforce retention rather
// than relying on someone remembering to run a cleanup job.
//
// layer_name and constraint_type are nullable by design: a `clear` event
// genuinely has no layer, so writing one would be fabrication.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const GEOFENCE_STATES = ['clear', 'approaching', 'inside'];

const GeofenceEventSchema = new mongoose.Schema(
  {
    // Nullable by contract. Anonymous one-off checks have no device_id; when it
    // IS present it is a component of the deduplication key (Section 66.3).
    device_id: { type: String, default: null, index: true },

    lat: { type: Number, required: true },
    lon: { type: Number, required: true },

    state: { type: String, enum: GEOFENCE_STATES, required: true },

    layer_name: { type: String, default: null },
    constraint_type: { type: String, default: null },

    distance_km: { type: Number, default: null },
    bearing_deg: { type: Number, default: null },

    // Section 66.3: repeated identical warnings are deduplicated. We still
    // STORE the duplicate (audit completeness) but flag it so it is not
    // re-delivered to the user.
    deduplicated: { type: Boolean, default: false },

    // Internal bookkeeping, not in the contract - the deterministic hash used
    // to detect a repeat, and the text actually shown.
    dedup_key: { type: String, default: null, index: true },
    warning_text: { type: String, default: null },
    language: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'geofence_events',
    strict: false,
  }
);

// Dedup lookup: "has this device already been warned about this layer recently?"
GeofenceEventSchema.index({ device_id: 1, dedup_key: 1, created_at: -1 });

// RETENTION (Section 107). GPS positions are sensitive - a complete movement
// history of a named fisherman is exactly what we must not accumulate. This TTL
// index makes MongoDB delete events automatically after the retention window.
const RETENTION_DAYS = parseInt(process.env.GEOFENCE_RETENTION_DAYS || '30', 10);
GeofenceEventSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }
);

module.exports = mongoose.model('GeofenceEvent', GeofenceEventSchema);
module.exports.GEOFENCE_STATES = GEOFENCE_STATES;
