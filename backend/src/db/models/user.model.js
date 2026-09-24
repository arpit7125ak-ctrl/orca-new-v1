/**
 * @fileoverview User Profile, Role Assignment & Maritime Preferences Schema
 * @module db/models/user.model
 * @description
 * Section 99.12 (`users` collection):
 * Persists user identities, operational personas, preferred regional languages,
 * vessel characteristics, and home port coordinates.
 *
 * Security Architecture:
 * - Passwordless Invite Architecture: Uses verifiable role-based invite codes (`invite_code_used`)
 *   rather than storing plaintext or salted password hashes in the primary user document.
 * - Credential Privacy: Adheres to Section 107 credential isolation standards.
 */

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
