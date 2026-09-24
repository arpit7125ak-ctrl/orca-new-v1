/**
 * @fileoverview Chat Routes
 * Defines API endpoints for conversational interfaces, including message
 * submission and history retrieval.
 *
 * @module chat.routes
 */

// src/modules/chat/chat.routes.js
// ---------------------------------------------------------------------------
// Section 103 - Chat:
//   POST /api/v1/chat/message
//   GET  /api/v1/chat/:conversation_id
//   GET  /api/v1/chat/:conversation_id/history
//
// /message is declared before /:conversation_id so the literal path is not
// captured as a conversation ID.
// ---------------------------------------------------------------------------

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const controller = require('./chat.controller');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// A chat message triggers a full analysis, so it carries the analysis limit.
router.post(
  '/message',
  analysisLimiter,
  validateContract('api/ChatMessageRequest.json'),
  controller.postMessage
);

router.get('/:conversation_id/history', controller.getHistory);
router.get('/:conversation_id', controller.getConversation);

module.exports = router;
