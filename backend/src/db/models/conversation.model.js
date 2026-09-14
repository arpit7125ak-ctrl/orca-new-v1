// src/db/models/conversation.model.js
// ---------------------------------------------------------------------------
// Section 99.8: `conversations`
//   conversation_id, messages, analysis references, language history.
//
// Supports the problem statement's "contextual, multi-turn conversations that
// enable users to refine queries and explore related scenarios".
//
// "language history" is a real requirement, not decoration: a user may ask in
// Tamil, follow up in English, then switch back. Section 11 detects language
// per message, so we record it per message rather than once per conversation.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');
const limits = require('../../config/limits');

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },

    // Per-message language (Section 11). detected vs override kept separate so
    // we can tell "we guessed Tamil" from "the user told us Tamil".
    detected_language: { type: String, default: null },
    override_language: { type: String, default: null },

    // If this message triggered an analysis, its ID - so any turn in the
    // conversation can be traced to its evidence.
    analysis_id: { type: String, default: null },

    // Section 90.1 follow-up suggestions offered after an assistant turn.
    suggested_followups: { type: [String], default: [] },

    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    conversation_id: { type: String, required: true, unique: true, index: true },

    // Contract field name is `subscriber_id`. Nullable - anonymous demo
    // conversations are allowed.
    subscriber_id: { type: String, default: null, index: true },

    messages: { type: [MessageSchema], default: [] },

    // Contract field name is `current_context`. Holds the last known
    // location/activity/vessel so a follow-up like "what about tomorrow?" does
    // not require the user to repeat everything.
    //
    // NOTE: analysis_ids and language_history are NOT stored - the contract has
    // no such fields, and both are derivable from `messages`. Duplicating them
    // would create two sources of truth that can drift apart.
    current_context: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'conversations',
    strict: false,
  }
);

ConversationSchema.index({ subscriber_id: 1, updated_at: -1 });

/**
 * Return the last N turns for AI Service context.
 *
 * Bounded by CHAT_CONTEXT_MAX_TURNS so a very long conversation cannot blow
 * the LLM context window - and so cost stays predictable.
 */
ConversationSchema.methods.recentMessages = function recentMessages(
  limit = limits.CHAT_CONTEXT_MAX_TURNS
) {
  return this.messages.slice(-limit);
};

module.exports = mongoose.model('Conversation', ConversationSchema);
