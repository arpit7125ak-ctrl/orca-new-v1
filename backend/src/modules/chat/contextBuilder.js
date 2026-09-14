// src/modules/chat/contextBuilder.js
// ---------------------------------------------------------------------------
// Builds the conversation context handed to the AI Service.
//
// The problem statement requires "contextual, multi-turn conversations that
// enable users to refine queries and explore related scenarios". That means a
// follow-up like "what about tomorrow?" must inherit the location, activity
// and vessel from the previous turn - WITHOUT the user repeating them.
//
// BOUNDED ON PURPOSE: only the last N turns are included
// (limits.CHAT_CONTEXT_MAX_TURNS). An unbounded history would eventually blow
// the LLM context window mid-demo and makes cost unpredictable.
// ---------------------------------------------------------------------------

const limits = require('../../config/limits');

/**
 * @param {object} conversation Conversation document (may be null for turn 1)
 * @param {object} newMessage   { content, language }
 */
function buildContext(conversation, newMessage) {
  if (!conversation) {
    // First turn: no history, no inherited context. Explicitly empty rather
    // than fabricated defaults.
    return {
      conversation_id: null,
      history: [],
      inherited_context: null,
      language_history: [],
    };
  }

  const recent = conversation.messages.slice(-limits.CHAT_CONTEXT_MAX_TURNS);

  return {
    conversation_id: conversation.conversation_id,

    history: recent.map((message) => ({
      role: message.role,
      content: message.content,
      language: message.detected_language || message.override_language || null,
      analysis_id: message.analysis_id || null,
      timestamp: message.timestamp,
    })),

    // Last known location/activity/vessel so a follow-up does not need them
    // restated. The AI Service decides whether inheriting is appropriate - we
    // only SUPPLY it, we do not assume it applies.
    inherited_context: conversation.current_context || null,

    // Section 99.8: language history. A user may switch languages mid-thread,
    // and the assistant should notice rather than locking to the first one.
    language_history: conversation.language_history || [],

    // Everything this conversation has produced so far, for follow-ups like
    // "compare that with the earlier one".
    prior_analysis_ids: conversation.analysis_ids || [],
  };
}

/**
 * Extract reusable context from a completed analysis, to carry into the next turn.
 * Returns only fields that were actually RESOLVED - never the raw request,
 * because an unresolved place name would be a misleading inheritance.
 */
function extractContextFromAnalysis(analysis) {
  if (!analysis) return null;

  const validated = analysis.location?.validated || {};

  return {
    lat: validated.lat ?? analysis.location?.original?.lat ?? null,
    lon: validated.lon ?? analysis.location?.original?.lon ?? null,
    place_name: validated.resolved_name ?? analysis.location?.original?.place_name ?? null,
    activity: analysis.activity || null,
    vessel_type: analysis.vessel_type || null,
    date: analysis.time_window?.local?.date || null,
    last_analysis_id: analysis.analysis_id,
    last_intent: analysis.primary_intent || null,
  };
}

module.exports = { buildContext, extractContextFromAnalysis };
