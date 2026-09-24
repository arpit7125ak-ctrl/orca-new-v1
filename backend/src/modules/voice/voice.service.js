/**
 * @fileoverview Voice Service
 * Integrates with Bhashini for speech-to-text (ASR) and text-to-speech (TTS).
 * Routes transcripts through the standard chat/analysis pipeline.
 *
 * @module voice.service
 */

// src/modules/voice/voice.service.js
// ---------------------------------------------------------------------------
// Section 103: POST /api/v1/voice/query - audio in, audio + text out
// (proxies Bhashini).
//
// Section 102 is the reason this module exists at all: the Frontend must NEVER
// call Bhashini directly, because that would put the API key in the browser.
// Everything routes Frontend -> Backend -> Bhashini.
//
// PIPELINE:
//   1. ASR: audio -> text (Bhashini)
//   2. Analysis: text -> full ORCA pipeline (asynchronous, like any query)
//   3. TTS happens LATER, when the result is fetched - not here.
//
// WHY TTS IS NOT DONE IN STEP 3 HERE:
// The analysis is asynchronous (Section 103: 202 Accepted). There is no answer
// yet to synthesise. Blocking this request until the whole multi-agent pipeline
// finished would hold an audio upload open for tens of seconds. Instead we
// return the transcript plus an analysis_id, and the client requests TTS once
// the result is ready.
// ---------------------------------------------------------------------------

const bhashini = require('../../clients/bhashini.client');
const analysisService = require('../analysis/analysis.service');
const chatService = require('../chat/chat.service');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { logger } = require('../../observability/logger');

/**
 * Handle a voice query.
 *
 * @param {object} params
 * @param {string} params.audioBase64
 * @param {string} [params.language]        caller's declared language
 * @param {string} [params.conversationId]  continue an existing conversation
 * @param {object} [params.locationHint]    { lat, lon }
 */
async function handleVoiceQuery({ audioBase64, audioMimeType, languageOverride = null, conversationId = null, parentAnalysisId = null }) {
  // --- Step 1: ASR -------------------------------------------------------
  // Language is passed through as a HINT only. If none was given we do not
  // default to Hindi - that would bias recognition for a Tamil or Odia speaker.
  // Bhashini's own detection is authoritative.
  const asr = await bhashini.speechToText(audioBase64, languageOverride, audioMimeType);

  // NEVER-FABRICATE: if Bhashini is not configured we say so plainly. We do
  // NOT invent a transcript - a wrong transcript would feed a wrong question
  // into a SAFETY decision, which is far worse than an honest failure.
  if (!asr.available) {
    throw new AppError(
      'Voice input is not available - the speech service is not configured.',
      ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
      { reason: asr.reason }
    );
  }

  if (!asr.text || !asr.text.trim()) {
    throw new AppError(
      'No speech could be recognised in the supplied audio.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const transcript = asr.text.trim();

  // Bhashini's detected language is preferred over the caller's declared one -
  // it heard the actual audio.
  const resolvedLanguage = asr.detected_language || languageOverride || null;

  logger.info(
    { transcript_length: transcript.length, language: resolvedLanguage },
    '[voice] Speech recognised'
  );

  // --- Step 2: run it through the normal pipeline -----------------------
  // Voice is just another input channel. It shares the chat path so a spoken
  // follow-up inherits context exactly like a typed one.
  const chatResult = await chatService.handleMessage({
    message: transcript,
    conversationId,
    parentAnalysisId,
    // Only pass an override if the caller actually stated one. Bhashini's
    // detected language is a detection, not a user instruction, so it must not
    // masquerade as an explicit override.
    languageOverride,
  });

  return {
    transcript,
    detected_language: asr.detected_language || null,
    asr_confidence: asr.confidence ?? null, // null, never a fabricated 1.0
    conversation_id: chatResult.conversation_id,
    analysis_id: chatResult.analysis_id,
    status: chatResult.status,
    response_language: resolvedLanguage || 'en',
    acknowledgement: chatResult.acknowledgement,
  };
}

/**
 * Synthesise the answer for a completed analysis.
 * Separate endpoint precisely because the answer does not exist at upload time.
 */
async function speakResult(analysisId, language = 'en') {
  const { analysis, body } = await analysisService.getFullResult(analysisId);

  if (!['completed', 'partial'].includes(analysis.status)) {
    throw new AppError(
      `Analysis ${analysisId} is not finished (status: ${analysis.status}).`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  // Speak the one-line recommendation - a spoken advisory must be short enough
  // to absorb on a moving boat.
  // Speak the one-line recommendation - a spoken advisory must be short enough
  // to absorb on a moving boat. Falls back through the other final artefacts.
  const text =
    body.decision?.one_line_recommendation ||
    body.quick_information_result?.answer_text ||
    body.trend_result?.explanation ||
    null;

  if (!text) {
    throw new AppError(
      'This analysis has no spoken summary available.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const tts = await bhashini.textToSpeech(text, language);

  if (!tts.available) {
    // Honest partial success: the TEXT is still returned so the user is not
    // left with nothing just because audio synthesis is unavailable.
    return { audio: null, audio_available: false, reason: tts.reason, text, language };
  }

  return {
    audio: tts.audio,
    audio_available: true,
    mime_type: tts.mime_type || tts.format || 'audio/wav',
    text,
    language,
  };
}

module.exports = { handleVoiceQuery, speakResult };
