/**
 * @fileoverview Voice Routes
 * Defines endpoints for voice interactions (querying via audio and speaking results).
 * Includes contract validation and rate limiting.
 *
 * @module voice.routes
 */

// src/modules/voice/voice.routes.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/voice/query - audio in, audio + text out.
// POST /api/v1/voice/speak is the companion endpoint that synthesises the
// answer once the analysis has completed (see voice.service.js for why the
// two are separate).
// ---------------------------------------------------------------------------

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const controller = require('./voice.controller');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// Voice query triggers a full analysis plus an ASR call, so it uses the tight
// limiter.
router.post(
  '/query',
  analysisLimiter,
  validateContract('api/VoiceQueryRequest.json'),
  controller.postVoiceQuery
);
router.post('/speak', controller.postSpeak);

module.exports = router;
