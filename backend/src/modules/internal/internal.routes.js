/**
 * @fileoverview Internal Service-to-Service Router (AI Service Callbacks)
 * @module modules/internal/internal.routes
 * @description
 * Sections 98, 102 & 103:
 * Mounts dedicated internal webhook endpoints invoked asynchronously by the Python AI service:
 * - `POST /internal/v1/progress`: Mid-flight stage updates and percent completions.
 * - `POST /internal/v1/result`: Final completed multi-agent analysis and decision payloads.
 *
 * Security & Network Isolation:
 * - Dual Protection: Bound exclusively to `src/internal-server.js` (port 4100),
 *   completely isolated from the public internet, and guarded by `internalAuth` HMAC JWT verification.
 */

const express = require('express');

const internalAuth = require('../../middleware/internalAuth');
const validateContract = require('../../middleware/validateContract');
const { postProgress } = require('./progress.controller');
const { postResult } = require('./result.controller');

const router = express.Router();

// Applies to every route in this file.
router.use(internalAuth);

// Inbound payload shapes are locked by contract:
//   /progress -> contracts/ProgressMessage.json
//   /result   -> contracts/api/InternalResultPayload.json
router.post('/progress', validateContract('ProgressMessage.json'), postProgress);
router.post('/result', validateContract('api/InternalResultPayload.json'), postResult);

module.exports = router;
