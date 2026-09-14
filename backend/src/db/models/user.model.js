// src/db/models/user.model.js
// ---------------------------------------------------------------------------
// Section 99.12: `users` - the other spec gap that was closed. Exact fields:
//   user_id, role, invite_code_used, display_name, preferred_language,
//   default_vessel_type, default_activity, home_location, subscriber_id,
//   created_at, last_active_at
//
// NOTE: Section 103 defines NO auth endpoints. The modules/auth/* routes built
// on top of this model are therefore marked PROPOSED - they are a reasonable
// implementation of a collection the doc specifies, but the endpoints
// themselves are not in the spec.
//
// SECURITY NOTE: there is no password field here. The architecture uses invite
// codes, and Section 107 forbids logging credentials. If password auth is added
// later, the hash must live in a separate collection or at minimum be `select:
// false` so it is never returned by a default query.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const ROLES = [
  'fisherman',
  'researcher',
  'coastal_authority',
  'disaster_management',
  'maritime_operator',
  'admin',
];

// Same shape as the analysis location sub-document (Section 99.1) so a user's
// home location can be dropped straight into an analysis request.
const HomeLocationSchema = new mongoose.Schema(
  {
    original: {
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      place_name: { type: String, default: null },
    },
    validated: {
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      resolved_name: { type: String, default: null },
    },
    snapped: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ROLES, required: true, index: true },

    // Which invite code was redeemed. Kept for audit - who let this user in.
    invite_code_used: { type: String, default: null },

    display_name: { type: String, default: null },
    preferred_language: { type: String, default: null },

    default_vessel_type: { type: String, default: null },
    default_activity: { type: String, default: null },

    home_location: { type: HomeLocationSchema, default: () => ({}) },

    // Nullable by spec - links to alert_subscriptions (Section 99.6) when the
    // user has subscribed to alerts.
    subscriber_id: { type: String, default: null, index: true },

    last_active_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users',
    strict: false,
  }
);

module.exports = mongoose.model('User', UserSchema);
module.exports.ROLES = ROLES;
