// src/modules/auth/inviteCode.js
// ---------------------------------------------------------------------------
// STATUS: PROPOSED
// Section 103 defines NO auth endpoints. Section 99.12 DOES define a `users`
// collection with `role` and `invite_code_used`, which strongly implies
// invite-based registration - so this module implements that implication
// without inventing endpoints the doc never specified.
//
// Invite codes map to roles. This keeps privileged roles (coastal_authority,
// disaster_management, admin) from being self-assigned by anyone who registers.
//
// Codes come from .env (INVITE_CODES), never hard-coded, so they can be rotated
// without a code change and never appear in the repository.
//   INVITE_CODES=FISH2026:fisherman,RESEARCH2026:researcher,ADMIN2026:admin
// ---------------------------------------------------------------------------

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
