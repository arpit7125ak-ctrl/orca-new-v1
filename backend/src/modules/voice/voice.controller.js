/**
 * @fileoverview Voice Controller
 * Handles voice-based queries, processing audio payloads and managing
 * text-to-speech synthesis of analysis results.
 *
 * @module voice.controller
 */

// src/modules/voice/voice.controller.js
// Section 103: POST /api/v1/voice/query

const voiceService = require('./voice.service');
const asyncHandler = require('../../utils/asyncHandler');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const registry = require('../../config/registry');

// Audio payloads are large. 10 MB is roughly a minute of uncompressed speech -
// far more than any sensible query - and stops a huge upload from exhausting
// memory.
const MAX_AUDIO_BASE64_BYTES = 10 * 1024 * 1024;

const postVoiceQuery = asyncHandler(async (req, res) => {
  const {
    audio_base64: audioBase64,
    audio_mime_type: audioMimeType,
    conversation_id: conversationId,
    analysis_id: analysisId,
    language_override: languageOverride,
  } = req.body;

  // contracts/api/VoiceQueryRequest.json requires BOTH audio_base64 and
  // audio_mime_type. The mime type is not decoration: Bhashini needs to know
  // the encoding, and guessing it would silently corrupt the transcript.
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    throw new AppError(
      'audio_base64 is required and must be a base64-encoded string.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  if (!audioMimeType || typeof audioMimeType !== 'string') {
    throw new AppError(
      'audio_mime_type is required (e.g. "audio/wav", "audio/webm").',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  if (audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
    throw new AppError(
      'Audio payload is too large. Keep voice queries under roughly one minute.',
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  if (languageOverride && !registry.isValidLanguage(languageOverride)) {
    throw new AppError(
      `Unsupported language "${languageOverride}". Supported: ${registry.validLanguageCodes().join(', ')}.`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

  const result = await voiceService.handleVoiceQuery({
    audioBase64,
    audioMimeType,
    languageOverride: languageOverride || null,
    conversationId: conversationId || null,
    parentAnalysisId: analysisId || null,
  });

  // contracts/api/VoiceQueryResponse.json:
  //   required: transcript, response_text, response_language
  //   optional: detected_language, response_audio_base64,
  //             response_audio_mime_type, conversation_id,
  //             triggered_analysis_id
  //
  // response_audio_* is deliberately absent here: the analysis is asynchronous,
  // so there is no answer to synthesise yet. Returning silent or placeholder
  // audio would be fabricating a spoken verdict. The client calls
  // /api/v1/voice/speak once the analysis completes.
  const response = {
    transcript: result.transcript,
    response_text: result.acknowledgement,
    response_language: result.response_language,
    conversation_id: result.conversation_id,
    triggered_analysis_id: result.analysis_id,
  };

  if (result.detected_language) response.detected_language = result.detected_language;

  return res.status(HTTP.ACCEPTED).json(response);
});

/** POST /api/v1/voice/speak - synthesise a completed answer. */
const postSpeak = asyncHandler(async (req, res) => {
  const { analysis_id: analysisId, language_override: languageOverride, language } = req.body;

  if (!analysisId) {
    throw new AppError('analysis_id is required.', ERROR_CATEGORIES.VALIDATION_FAILURE);
  }

  const requestedLang = languageOverride || language;
  const resolvedLanguage =
    requestedLang && registry.isValidLanguage(requestedLang) ? requestedLang : 'en';
  const result = await voiceService.speakResult(analysisId, resolvedLanguage);

  // Same VoiceQueryResponse shape. When synthesis is unavailable the TEXT is
  // still returned - an honest partial success beats leaving the user with
  // nothing because audio failed.
  const response = {
    transcript: result.transcript ?? '',
    response_text: result.text,
    response_language: result.language,
    triggered_analysis_id: analysisId,
  };

  if (result.audio) {
    response.response_audio_base64 = result.audio;
    response.response_audio_mime_type = result.mime_type || 'audio/wav';
  }

  return res.status(HTTP.OK).json(response);
});

module.exports = { postVoiceQuery, postSpeak };
