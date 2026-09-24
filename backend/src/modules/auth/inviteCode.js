/**
 * @fileoverview Role-Based Invite Code Parser & Validator
 * @module modules/auth/inviteCode
 * @description
 * Section 99.12 (Invite-Based Maritime Registration):
 * Manages role provisioning via invite codes configured in `INVITE_CODES`.
 *
 * Operational Mechanics:
 * - Environment Sourced: Codes format as `CODE:role,CODE2:role2` (e.g. `FISH2026:fisherman`).
 * - Privilege Escalation Prevention: Prohibits unverified users from arbitrarily claiming
 *   elevated roles (`coastal_authority`, `disaster_management`, `admin`).
 */

const { ROLES } = require('../../db/models/user.model');
const { logger } = require('../../observability/logger');


function parseInviteCodes() {
  const raw = process.env.INVITE_CODES || '';
  const map = new Map();

  for (const pair of raw.split(',')) {
    const [code, role] = pair.split(':').map((s) => (s || '').trim());
    if (!code || !role) continue;

    if (!ROLES.includes(role)) {
      logger.warn({ code, role }, '[inviteCode] Ignoring invite code with an unknown role');
      continue;
    }
    map.set(code, role);
  }

  return map;
}

const INVITE_CODES = parseInviteCodes();

if (INVITE_CODES.size === 0) {
  logger.warn(
    '[inviteCode] No INVITE_CODES configured. Registration will default every user to the ' +
    '`fisherman` role - the least privileged option.'
  );
}

/**
 * Resolve an invite code to a role.
 * An unknown/absent code yields `fisherman`, the LEAST privileged role. Failing
 * toward least privilege is the correct direction: a mistake here should never
 * hand someone admin.
 */
function resolveRole(inviteCode) {
  if (!inviteCode) return { role: 'fisherman', valid: false };

  const role = INVITE_CODES.get(inviteCode);
  if (!role) return { role: 'fisherman', valid: false };

  return { role, valid: true };
}

module.exports = { resolveRole, INVITE_CODES };
