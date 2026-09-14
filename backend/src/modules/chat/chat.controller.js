// src/modules/chat/chat.controller.js
// ---------------------------------------------------------------------------
// Section 103 - Chat endpoints.
//
// CONTRACT SHAPES:
//   request  contracts/api/ChatMessageRequest.json
//            required: message | optional: conversation_id, analysis_id,
//            language_override | additionalProperties: false
//   response contracts/api/ChatMessageResponse.json
//            required: conversation_id, response_text, response_language,
//            answered_from | optional: triggered_analysis_id, dashboard_url
//
// IMPORTANT: the request contract has NO lat/lon. A chat message cannot carry a
// location directly - location comes from conversation context or from the
// Planner resolving it out of the message text. Sending lat/lon would fail
// validation.
//
// `analysis_id` on the request is for asking a follow-up ABOUT a specific
// earlier analysis, distinct from `conversation_id` which is the thread.
// ---------------------------------------------------------------------------

const asyncHandler = require('../../utils/asyncHandler');
const chatService = require('./chat.service');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const registry = require('../../config/registry');
const limits = require('../../config/limits');

/** POST /api/v1/chat/message */
const postMessage = asyncHandler(async (req, res) => {
  const {
    message,
    conversation_id: conversationId,
    analysis_id: analysisId,
    language_override: languageOverride,
  } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new AppError(
      'message is required and must be a non-empty string.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  if (message.length > limits.QUERY_MAX_LENGTH) {
    throw new AppError(
      `message must be at most ${limits.QUERY_MAX_LENGTH} characters.`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  // Section 7.8: an explicit override must be a SUPPORTED language.
  if (languageOverride && !registry.isValidLanguage(languageOverride)) {
    throw new AppError(
      `Unsupported language "${languageOverride}". Supported: ${registry.validLanguageCodes().join(', ')}.`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const result = await chatService.handleMessage({
    message: message.trim(),
    conversationId: conversationId || null,
    parentAnalysisId: analysisId || null,
    languageOverride: languageOverride || null,
    userId: req.user?.user_id || null,
  });

  // contracts/api/ChatMessageResponse.json.
  //
  // `answered_from` says where the answer came from. Here it is always
  // "new_analysis": the reply is produced asynchronously by the pipeline, so
  // response_text is an acknowledgement, and the real answer arrives once the
  // analysis completes. We do NOT fabricate an answer we do not have yet.
  return res.status(HTTP.ACCEPTED).json({
    conversation_id: result.conversation_id,
    response_text: result.acknowledgement,
    response_language: result.response_language,
    answered_from: 'new_analysis',
    triggered_analysis_id: result.analysis_id,
    dashboard_url: `/api/v1/analysis/${result.analysis_id}`,
  });
});

/**
 * GET /api/v1/chat/:conversation_id
 * contracts/api/ConversationResponse.json:
 *   required: conversation_id, messages | optional: current_context
 */
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await chatService.getConversation(req.params.conversation_id);

  return res.status(HTTP.OK).json({
    conversation_id: conversation.conversation_id,
    current_context: conversation.current_context || null,
    messages: conversation.messages || [],
  });
});

/**
 * GET /api/v1/chat/:conversation_id/history
 *
 * Not contract-governed (no History contract exists), so this keeps the
 * { success, data } envelope. Separate from the full conversation endpoint so a
 * long thread can be paged without refetching everything.
 */
const getHistory = asyncHandler(async (req, res) => {
  const conversation = await chatService.getConversation(req.params.conversation_id);

  const limit = Math.min(
    parseInt(req.query.limit || limits.DEFAULT_PAGE_SIZE, 10),
    limits.MAX_PAGE_SIZE
  );
  const offset = parseInt(req.query.offset || '0', 10);

  const total = conversation.messages.length;
  // Newest-first paging: a chat client normally wants recent turns first.
  const start = Math.max(0, total - offset - limit);
  const end = Math.max(0, total - offset);

  return res.status(HTTP.OK).json({
    success: true,
    data: {
      conversation_id: conversation.conversation_id,
      messages: conversation.messages.slice(start, end),
      pagination: { total, limit, offset, has_more: start > 0 },
    },
  });
});

module.exports = { postMessage, getConversation, getHistory };
