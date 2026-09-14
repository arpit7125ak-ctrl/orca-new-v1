// src/modules/internal/internal.routes.js
// ---------------------------------------------------------------------------
// Section 103 - Internal endpoints HOSTED BY THE BACKEND, called by the AI
// Service:
//   POST /internal/v1/progress
//   POST /internal/v1/result
//
// SECURITY (Sections 98 + 102):
// Every route here requires a signed short-lived internal token. These are
// mounted on a SEPARATE server (src/internal-server.js) listening on a
// different port, so they are not exposed on the public API surface at all.
// Defence in depth: even if the internal port were reachable, the token check
// still applies.
// ---------------------------------------------------------------------------

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
