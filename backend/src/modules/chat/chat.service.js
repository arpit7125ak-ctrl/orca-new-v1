/**
 * @fileoverview Chat Service
 * Manages conversation threads. Processes incoming messages, extracts context,
 * and delegates to the analysis service for processing.
 *
 * @module chat.service
 */

// src/modules/chat/chat.service.js
// ---------------------------------------------------------------------------
// Conversational entry point. Section 102: Frontend -> Backend -> AI Service.
//
// A chat message is not a separate pipeline - it CREATES AN ANALYSIS with
// conversation context attached. Delegating to analysis.service rather than
// duplicating the flow means one pipeline, one set of safety rules, one
// evidence chain.
//
// CONTRACT NOTE: contracts/api/ChatMessageRequest.json carries no lat/lon. So
// location comes from either (a) the conversation's stored context, or (b) the
// Planner resolving it from the message text. The Backend never invents one.
// ---------------------------------------------------------------------------

const Conversation = require('../../db/models/conversation.model');
const analysisService = require('../analysis/analysis.service');
const { buildContext, extractContextFromAnalysis } = require('./contextBuilder');
const { generatePrefixedId } = require('../../utils/ids');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const { logger } = require('../../observability/logger');

/**
 * Handle an inbound chat message.
 *
 * @param {object} params
 * @param {string} params.message
 * @param {string} [params.conversationId]  omit to start a new conversation
 * @param {string} [params.parentAnalysisId] follow-up about a specific analysis
 * @param {string} [params.languageOverride]
 * @param {string} [params.userId]
 */
async function handleMessage({
  message,
  conversationId = null,
  parentAnalysisId = null,
  languageOverride = null,
  userId = null,
}) {
  // --- Load or create the conversation ----------------------------------
  let conversation = null;

  if (conversationId) {
    conversation = await Conversation.findOne({ conversation_id: conversationId });
    if (!conversation) {
      conversation = new Conversation({
        conversation_id: conversationId,
        subscriber_id: userId,
        messages: [],
      });
    }
  } else {
    conversation = new Conversation({
      conversation_id: generatePrefixedId('conv'),
      subscriber_id: userId,
      messages: [],
    });
  }

  // --- Record the user's turn -------------------------------------------
  // detected_language stays NULL. Language detection is Section 11, owned by
  // the Planner. Guessing here would be fabrication - and often wrong, since
  // romanized and code-mixed queries are common.
  conversation.messages.push({
    role: 'user',
    content: message,
    detected_language: null,
    override_language: languageOverride,
    analysis_id: null,
    timestamp: new Date(),
  });

  const context = buildContext(conversation, { content: message });
  const inherited = context.inherited_context || {};

  // --- Resolve location from message or fallback to coastal baseline ---
  let resolvedPlace = inherited.place_name ?? null;
  if (!resolvedPlace && message) {
    const qLower = message.toLowerCase();
    const coastalPlaces = [
      'kochi', 'chennai', 'mumbai', 'visakhapatnam', 'vizag', 'paradip',
      'kolkata', 'goa', 'mangalore', 'kozhikode', 'calicut', 'tuticorin',
      'thoothukudi', 'rameswaram', 'veraval', 'kandla', 'port blair',
      'digha', 'gopalpur', 'kasimedu', 'puducherry', 'pondicherry', 'palk bay'
    ];
    for (const p of coastalPlaces) {
      if (qLower.includes(p)) {
        resolvedPlace = p === 'palk bay' ? 'rameswaram' : p;
        break;
      }
    }
  }
  // Do NOT force Kochi if no place was specified - let the Planner prompt or detect
  // Only set place_name if explicitly matched or inherited

  // --- Detect activity and vessel neutrally or inherit ---
  let detectedActivity = inherited.activity || null;
  if (!detectedActivity && message) {
    const qLower = message.toLowerCase();
    if (/\b(surf|surfing|board)\b/.test(qLower)) detectedActivity = 'surfing';
    else if (/\b(dive|diving|scuba)\b/.test(qLower)) detectedActivity = 'diving';
    else if (/\b(touris[mt]|beach|ferry|passenger|sightseeing)\b/.test(qLower)) detectedActivity = 'tourism';
    else if (/\b(ship|shipping|cargo|tanker|transport|freight)\b/.test(qLower)) detectedActivity = 'shipping';
    else if (/\b(research|survey|marine science|sample)\b/.test(qLower)) detectedActivity = 'marine_research';
    else if (/\b(fish|fishing|catch|trawl|angler|gillnet)\b/.test(qLower)) detectedActivity = 'fishing';
    else if (/\b(boat|boating|sail|sailing)\b/.test(qLower)) detectedActivity = 'boating';
  }

  let detectedVessel = inherited.vessel_type || null;
  if (!detectedVessel && message) {
    const qLower = message.toLowerCase();
    if (/\b(ship|tanker|cargo|container|freighter)\b/.test(qLower)) detectedVessel = 'large_commercial_vessel';
    else if (/\b(research vessel|survey ship)\b/.test(qLower)) detectedVessel = 'research_vessel';
    else if (/\b(trawler|mechanized fishing)\b/.test(qLower)) detectedVessel = 'mechanized_fishing_vessel';
    else if (/\b(tourist|ferry|launch|yacht|recreational|passenger)\b/.test(qLower)) detectedVessel = 'recreational_boat';
    else if (/\b(canoe|kayak|traditional|catamaran|non-motorized)\b/.test(qLower)) detectedVessel = 'traditional_non_motorized';
    else if (/\b(country craft|fiberglass|frp)\b/.test(qLower)) detectedVessel = 'motorized_country_craft';
  }

  const analysisBody = {
    query: message,
    coordinate:
      inherited.lat !== null && inherited.lat !== undefined &&
      inherited.lon !== null && inherited.lon !== undefined
        ? { lat: inherited.lat, lon: inherited.lon }
        : null,
    place_name: resolvedPlace || null,
    activity: detectedActivity,
    vessel_type: detectedVessel,
    language_override: languageOverride,
    conversation_id: conversation.conversation_id,
    parent_analysis_id: parentAnalysisId || inherited.last_analysis_id || null,
  };

  const { analysis, dispatched, dispatchError } = await analysisService.createAnalysis(
    analysisBody,
    {
      conversation_id: conversation.conversation_id,
      parent_analysis_id: analysisBody.parent_analysis_id,
    }
  );

  // Link the analysis back to the message that caused it.
  conversation.messages[conversation.messages.length - 1].analysis_id = analysis.analysis_id;
  conversation.current_context = extractContextFromAnalysis(analysis);

  await conversation.save();

  logger.info(
    { conversation_id: conversation.conversation_id, analysis_id: analysis.analysis_id },
    '[chat] Message accepted and analysis dispatched'
  );

  // The response_language we can honestly state right now is the override, if
  // one was given. Otherwise it is unresolved until the Planner detects it, so
  // we echo the override or fall back to English for the acknowledgement only.
  const responseLanguage = languageOverride || 'en';

  return {
    conversation_id: conversation.conversation_id,
    analysis_id: analysis.analysis_id,
    status: analysis.status,
    response_language: responseLanguage,
    // An acknowledgement, NOT an answer. The real answer arrives when the
    // analysis completes. Saying anything about conditions here would be
    // fabricating a verdict before any data has been gathered.
    acknowledgement: dispatched
      ? 'Analysing your request. The full advisory will be available shortly.'
      : 'Your request was saved but could not be started - the analysis service is unavailable.',
    dispatched,
    dispatch_error: dispatchError,
  };
}

/** Fetch a conversation or throw a 404-mapped error. */
async function getConversation(conversationId) {
  const conversation = await Conversation.findOne({ conversation_id: conversationId }).lean();
  if (!conversation) {
    const error = new AppError(
      `Conversation ${conversationId} was not found.`,
      ERROR_CATEGORIES.INTERNAL_ERROR
    );
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }
  return conversation;
}

/**
 * Append an assistant reply once an analysis completes, so the thread reads as
 * a real dialogue rather than user messages with results hanging off them.
 */
async function appendAssistantMessage(conversationId, { content, language, analysisId, suggestedFollowups = [] }) {
  const conversation = await Conversation.findOne({ conversation_id: conversationId });
  if (!conversation) return null;

  conversation.messages.push({
    role: 'assistant',
    content,
    detected_language: language || null,
    analysis_id: analysisId || null,
    suggested_followups: suggestedFollowups, // Section 90.1
    timestamp: new Date(),
  });

  await conversation.save();
  return conversation;
}

module.exports = { handleMessage, getConversation, appendAssistantMessage };
