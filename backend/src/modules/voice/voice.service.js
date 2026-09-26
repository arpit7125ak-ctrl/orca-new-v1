/**
 * @fileoverview Voice Service
 * @module voice.service
 * @description
 * Integrates with Bhashini for speech-to-text (ASR) and text-to-speech (TTS).
 * Manages asynchronous pre-generation, binary MP3 audio caching, and in-flight request deduplication.
 *
 * Architecture Principles (Section 102 & 103):
 * - Direct Client Isolation: Frontend NEVER calls Bhashini directly.
 * - Audio Pre-Generation: Gated on user-initiated analyses; pre-generates TTS in background upon
 *   analysis completion so playback is an instant (<20ms) database cache read.
 * - High-Efficiency Storage: Audio is stored as raw BSON BinData Buffer in MongoDB `voice_cache`
 *   with a 24-hour TTL and compound unique index `{ analysis_id: 1, language: 1 }`.
 * - Never-Fabricate Mandate: If synthesis fails or service is unconfigured, returns `{ audio: null, audio_available: false }`
 *   and logs warnings—never writes empty silent audio blobs to cache or returns fake successes.
 */

const bhashini = require('../../clients/bhashini.client');
const analysisService = require('../analysis/analysis.service');
const chatService = require('../chat/chat.service');
const VoiceCache = require('../../db/models/voiceCache.model');
const audioEncoder = require('../../utils/audioEncoder');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { logger } = require('../../observability/logger');

/**
 * In-flight promise map for deduplicating concurrent synthesis calls
 * Key: `${analysisId}:${language}` -> Promise
 */
const inFlightGenerations = new Map();

/**
 * Synthesizes audio via Bhashini, compresses to 16kHz mono MP3, and caches in MongoDB.
 * Thread-safe with in-flight deduplication.
 *
 * @param {string} analysisId
 * @param {string} language
 * @param {string} text
 * @returns {Promise<{ audio: string|null, audio_available: boolean, mime_type?: string, duration_sec?: number, text: string, language: string, reason?: string, cached?: boolean }>}
 */
async function synthesizeAndCacheAudio(analysisId, language, text) {
  const cacheKey = `${analysisId}:${language}`;
  if (inFlightGenerations.has(cacheKey)) {
    return inFlightGenerations.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const tts = await bhashini.textToSpeech(text, language);
      if (!tts.available || !tts.audio) {
        return {
          audio: null,
          audio_available: false,
          reason: tts.reason || 'tts_unavailable',
          text,
          language,
        };
      }

      const rawWavBuffer = Buffer.from(tts.audio, 'base64');
      let outputBuffer;
      let durationSec;
      let mimeType = 'audio/mp3';

      try {
        const encoded = await audioEncoder.encodeWavToMp3(rawWavBuffer, 32);
        outputBuffer = encoded.mp3Buffer;
        durationSec = encoded.durationSec;
      } catch (encErr) {
        logger.warn(
          { err: encErr.message, analysis_id: analysisId, language },
          '[voice] MP3 compression failed; falling back to raw WAV'
        );
        outputBuffer = rawWavBuffer;
        durationSec = Math.round((rawWavBuffer.length / 64000) * 1000) / 1000;
        mimeType = 'audio/wav';
      }

      // Never cache empty buffers (anti-fabrication mandate)
      if (!outputBuffer || outputBuffer.length === 0) {
        return {
          audio: null,
          audio_available: false,
          reason: 'empty_audio_buffer',
          text,
          language,
        };
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour TTL

      await VoiceCache.updateOne(
        { analysis_id: analysisId, language },
        {
          $set: {
            analysis_id: analysisId,
            language,
            text,
            mime_type: mimeType,
            audio_data: outputBuffer,
            duration_sec: durationSec,
            size_bytes: outputBuffer.length,
            expires_at: expiresAt,
          },
        },
        { upsert: true }
      );

      logger.info(
        { analysis_id: analysisId, language, size_bytes: outputBuffer.length, duration_sec: durationSec },
        '[voice] Audio synthesized, compressed to MP3, and cached in MongoDB'
      );

      return {
        audio: outputBuffer.toString('base64'),
        audio_available: true,
        mime_type: mimeType,
        duration_sec: durationSec,
        text,
        language,
        cached: false,
      };
    } finally {
      inFlightGenerations.delete(cacheKey);
    }
  })();

  inFlightGenerations.set(cacheKey, promise);
  return promise;
}

/**
 * Asynchronously pre-generates audio in the background for a completed user analysis.
 * Non-blocking, safe against failures.
 *
 * @param {string} analysisId
 * @param {string} [language='en']
 */
async function preGenerateAudio(analysisId, language = 'en') {
  if (!bhashini.isConfigured) return;

  const resolvedLang = language || 'en';

  try {
    // Check if already cached
    const existing = await VoiceCache.findOne({ analysis_id: analysisId, language: resolvedLang }).lean();
    if (existing) return;

    const { analysis, body } = await analysisService.getFullResult(analysisId);
    if (!['completed', 'partial'].includes(analysis.status)) return;

    const text =
      body.decision?.one_line_recommendation ||
      body.quick_information_result?.answer_text ||
      body.trend_result?.explanation ||
      null;

    if (!text || !text.trim()) return;

    await synthesizeAndCacheAudio(analysisId, resolvedLang, text.trim());
  } catch (err) {
    logger.warn(
      { analysis_id: analysisId, err: err.message },
      '[voice] Background audio pre-generation failed'
    );
  }
}

/**
 * Handle a voice query (ASR).
 */
async function handleVoiceQuery({ audioBase64, audioMimeType, languageOverride = null, conversationId = null, parentAnalysisId = null }) {
  const asr = await bhashini.speechToText(audioBase64, languageOverride, audioMimeType);

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
  const resolvedLanguage = asr.detected_language || languageOverride || null;

  logger.info(
    { transcript_length: transcript.length, language: resolvedLanguage },
    '[voice] Speech recognised'
  );

  const chatResult = await chatService.handleMessage({
    message: transcript,
    conversationId,
    parentAnalysisId,
    languageOverride,
  });

  return {
    transcript,
    detected_language: asr.detected_language || null,
    asr_confidence: asr.confidence ?? null,
    conversation_id: chatResult.conversation_id,
    analysis_id: chatResult.analysis_id,
    status: chatResult.status,
    response_language: resolvedLanguage || 'en',
    acknowledgement: chatResult.acknowledgement,
  };
}

/**
 * Synthesise or retrieve the answer for a completed analysis.
 * Uses cache-first architecture: returns cached MP3 immediately (<20ms) if available,
 * or synthesizes on-demand with concurrency deduplication.
 */
async function speakResult(analysisId, language = 'en') {
  const resolvedLang = language || 'en';

  // 1. Cache-first lookup
  const cached = await VoiceCache.findOne({ analysis_id: analysisId, language: resolvedLang }).lean();
  if (cached && cached.audio_data) {
    const audioBuffer = Buffer.isBuffer(cached.audio_data)
      ? cached.audio_data
      : cached.audio_data.buffer
      ? Buffer.from(cached.audio_data.buffer)
      : Buffer.from(cached.audio_data);

    if (audioBuffer && audioBuffer.length > 0) {
      let text = cached.text;
      if (!text) {
        try {
          const { body } = await analysisService.getFullResult(analysisId);
          text =
            body.decision?.one_line_recommendation ||
            body.quick_information_result?.answer_text ||
            body.trend_result?.explanation ||
            '';
        } catch (_) {
          text = '';
        }
      }

      return {
        audio: audioBuffer.toString('base64'),
        audio_available: true,
        mime_type: cached.mime_type || 'audio/mp3',
        duration_sec: cached.duration_sec,
        text,
        language: resolvedLang,
        cached: true,
      };
    }
  }

  // 2. Cache miss or in-flight: get full result and trigger synthesis
  const { analysis, body } = await analysisService.getFullResult(analysisId);

  if (!['completed', 'partial'].includes(analysis.status)) {
    throw new AppError(
      `Analysis ${analysisId} is not finished (status: ${analysis.status}).`,
      ERROR_CATEGORIES.VALIDATION_FAILURE
    );
  }

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

  return await synthesizeAndCacheAudio(analysisId, resolvedLang, text.trim());
}

module.exports = {
  handleVoiceQuery,
  speakResult,
  preGenerateAudio,
};
