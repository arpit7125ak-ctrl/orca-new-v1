/**
 * @fileoverview User Registration & Identity Service Layer
 * @module modules/auth/user.service
 * @description
 * Section 99.12 (User Profile Business Logic):
 * Coordinates user document creation, invite code verification, preferences validation,
 * and JWT session token generation.
 */

const jwt = require('jsonwebtoken');
const User = require('../../db/models/user.model');
const env = require('../../config/env');
const registry = require('../../config/registry');
const { resolveRole } = require('./inviteCode');
const { generatePrefixedId } = require('../../utils/ids');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');

const TOKEN_TTL = process.env.USER_TOKEN_TTL || '30d';

/**
 * Register a user.
 *
 * NOTE: there is deliberately no password here. The architecture uses invite
 * codes plus a long-lived token, which suits a demo and avoids storing
 * credentials the system has no safe place for (Section 107 forbids logging
 * them, and a hackathon codebase is not where password hashing should be
 * improvised).
 */
async function register({ displayName, inviteCode, preferredLanguage, defaultVesselType, defaultActivity, homeLocation }) {
  const { role, valid } = resolveRole(inviteCode);

  if (preferredLanguage && !registry.isValidLanguage(preferredLanguage)) {
    throw new AppError(
      `Unsupported language "${preferredLanguage}".`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }
  if (defaultVesselType && !registry.isValidVesselType(defaultVesselType)) {
    throw new AppError(
      `Unknown vessel_type "${defaultVesselType}".`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }
  if (defaultActivity && !registry.isValidActivity(defaultActivity)) {
    throw new AppError(
      `Unknown activity "${defaultActivity}".`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const user = await User.create({
    user_id: generatePrefixedId('usr'),
    role,
    // Recorded for audit - who granted this user their role.
    invite_code_used: valid ? inviteCode : null,
    display_name: displayName || null,
    preferred_language: preferredLanguage || null,
    default_vessel_type: defaultVesselType || null,
    default_activity: defaultActivity || null,
    home_location: homeLocation || {},
    last_active_at: new Date(),
  });

  return { user, token: issueUserToken(user), inviteCodeValid: valid };
}

function issueUserToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: TOKEN_TTL, algorithm: 'HS256' }
  );
}

async function getUser(userId) {
  const user = await User.findOne({ user_id: userId }).lean();
  if (!user) {
    const error = new AppError(`User ${userId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }
  return user;
}

/** Token-based "login" - exchange a valid token for the current user record. */
async function me(userId) {
  const user = await getUser(userId);
  await User.updateOne({ user_id: userId }, { last_active_at: new Date() });
  return user;
}

async function updateProfile(userId, updates) {
  const user = await User.findOne({ user_id: userId });
  if (!user) {
    const error = new AppError(`User ${userId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }

  // Role is NOT updatable here. Allowing a user to PATCH their own role would
  // make the whole invite-code mechanism pointless.
  if (updates.display_name !== undefined) user.display_name = updates.display_name;
  if (updates.preferred_language !== undefined) {
    if (updates.preferred_language && !registry.isValidLanguage(updates.preferred_language)) {
      throw new AppError('Unsupported language.', ERROR_CATEGORIES.VALIDATION_FAILURE);
    }
    user.preferred_language = updates.preferred_language;
  }
  if (updates.default_vessel_type !== undefined) user.default_vessel_type = updates.default_vessel_type;
  if (updates.default_activity !== undefined) user.default_activity = updates.default_activity;
  if (updates.home_location !== undefined) user.home_location = updates.home_location;
  if (updates.subscriber_id !== undefined) user.subscriber_id = updates.subscriber_id;

  await user.save();
  return user;
}

module.exports = { register, getUser, me, updateProfile, issueUserToken };
