/**
 * @fileoverview User Registration & Session Management Controller
 * @module modules/auth/auth.controller
 * @description
 * Section 99.12 (User Profile & Authentication Handlers):
 * Handles onboarding, profile updates, and JWT session generation.
 *
 * Privacy Rules:
 * - Data Sanitization: Strips audit credentials (`invite_code_used`) from outgoing JSON responses.
 */

const userService = require('./user.service');
const asyncHandler = require('../../utils/asyncHandler');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');

/**
 * Normalizes user document into a safe, client-facing presentation object.
 * @param {object} user - Mongoose User document or plain object.
 * @returns {object} Safe user profile sans internal credentials.
 */
function present(user) {
  const object = user.toObject ? user.toObject() : user;
  return {
    user_id: object.user_id,
    role: object.role,
    display_name: object.display_name,
    preferred_language: object.preferred_language,
    default_vessel_type: object.default_vessel_type,
    default_activity: object.default_activity,
    home_location: object.home_location,
    subscriber_id: object.subscriber_id,
    created_at: object.created_at,
    last_active_at: object.last_active_at,
  };
}

const register = asyncHandler(async (req, res) => {
  const { user, token, inviteCodeValid } = await userService.register({
    displayName: req.body.display_name,
    inviteCode: req.body.invite_code,
    preferredLanguage: req.body.preferred_language,
    defaultVesselType: req.body.default_vessel_type,
    defaultActivity: req.body.default_activity,
    homeLocation: req.body.home_location,
  });

  return res.status(HTTP.CREATED).json({
    success: true,
    data: {
      user: present(user),
      token,
      // Told plainly rather than silently downgrading the user's role.
      invite_code_valid: inviteCodeValid,
      ...(inviteCodeValid
        ? {}
        : { note: 'No valid invite code supplied - registered with the default `fisherman` role.' }),
    },
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    const error = new AppError('Authentication required.', ERROR_CATEGORIES.VALIDATION_FAILURE);
    error.httpStatusOverride = HTTP.UNAUTHORIZED;
    throw error;
  }
  const user = await userService.me(req.user.user_id);
  return res.status(HTTP.OK).json({ success: true, data: present(user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    const error = new AppError('Authentication required.', ERROR_CATEGORIES.VALIDATION_FAILURE);
    error.httpStatusOverride = HTTP.UNAUTHORIZED;
    throw error;
  }
  const user = await userService.updateProfile(req.user.user_id, req.body);
  return res.status(HTTP.OK).json({ success: true, data: present(user) });
});

module.exports = { register, me, updateProfile };
