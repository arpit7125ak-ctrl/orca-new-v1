// src/modules/geofence/geofence.routes.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/geofence/check
//
// Uses geofenceLimiter (NOT the general limiter): Section 66.2 expects
// frequent polling and this is a safety feature. Throttling a boundary warning
// could put someone in prohibited waters, so the limit here is the loosest.
//
// contracts/api/GeofenceCheckRequest.json is enforced here, but the controller
// ALSO validates inline. That redundancy is deliberate: if the contracts/
// directory is ever missing the middleware degrades to a no-op, and a safety
// endpoint must not silently lose its input checks.
// ---------------------------------------------------------------------------

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const { checkGeofence } = require('./geofence.controller');
const { geofenceLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post(
  '/check',
  geofenceLimiter,
  validateContract('api/GeofenceCheckRequest.json'),
  checkGeofence
);

module.exports = router;
