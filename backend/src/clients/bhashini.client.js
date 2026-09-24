/**
 * @fileoverview Bhashini National Language Translation & Speech Proxy Client
 * @module clients/bhashini.client
 * @description
 * Section 102 & 103 (Voice Pipeline):
 * Acts as the authoritative, secure gateway between the ORCA backend and the
 * Government of India's Bhashini AI language services (ASR, TTS, Machine Translation).
 *
 * Architectural & Safety Constraints:
 * - Direct Client Isolation: Frontend MUST NEVER communicate with Bhashini directly.
 *   API keys remain securely stored in the backend environment.
 * - Never-Fabricate Mandate: If `BHASHINI_API_KEY` is omitted, methods report
 *   `{ available: false }` rather than hallucinating/mocking speech transcripts.
 *   Fabricated transcripts in maritime navigation can lead to severe safety risks.
 */


const axios = require('axios');
const env = require('../config/env');
const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { logger } = require('../observability/logger');

const isConfigured = Boolean(env.BHASHINI_API_URL && env.BHASHINI_API_KEY);

const client = isConfigured
  ? axios.create({
      baseURL: env.BHASHINI_API_URL,
      timeout: 30000, // audio payloads are large; ASR/TTS is slow
      headers: {
        'Content-Type': 'application/json',
        Authorization: env.BHASHINI_API_KEY,
      },
    })
  : null;

if (!isConfigured) {
  logger.warn(
    '[bhashini] BHASHINI_API_URL / BHASHINI_API_KEY not set. Voice endpoints will report unavailable.'
  );
}

/**
 * ASR: speech -> text.
 * @param {string} audioBase64
 * @param {string} sourceLanguage ISO 639-1, e.g. "ta"
 */
async function speechToText(audioBase64, sourceLanguage, audioMimeType = null) {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', text: null };
  }

  try {
    const response = await client.post('/asr', {
      audio: audioBase64,
      // Null is sent through rather than defaulted - Bhashini can auto-detect,
      // and guessing a language would bias recognition against the speaker.
      source_language: sourceLanguage || null,
      audio_mime_type: audioMimeType,
    });
    return {
      available: true,
      text: response.data?.text ?? null,          // null, never "" - absent is absent
      detected_language: response.data?.language ?? null,
      confidence: response.data?.confidence ?? null,
    };
  } catch (err) {
    logger.error({ err: err.message }, '[bhashini] ASR request failed');
    throw new AppError(
      'Speech recognition service is unavailable.',
      ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
      { provider: 'bhashini', operation: 'asr' }
    );
  }
}

/**
 * TTS: text -> speech.
 * @returns {{ available: boolean, audio: string|null }} base64 audio
 */
async function textToSpeech(text, targetLanguage) {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', audio: null };
  }

  try {
    const response = await client.post('/tts', { text, target_language: targetLanguage });
    return {
      available: true,
      audio: response.data?.audio ?? null,
      mime_type: response.data?.mime_type ?? response.data?.format ?? null,
    };
  } catch (err) {
    logger.error({ err: err.message }, '[bhashini] TTS request failed');
    throw new AppError(
      'Speech synthesis service is unavailable.',
      ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
      { provider: 'bhashini', operation: 'tts' }
    );
  }
}

/** Text translation between supported Indian languages. */
async function translate(text, sourceLanguage, targetLanguage) {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', text: null };
  }

  try {
    const response = await client.post('/translate', {
      text,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
    return { available: true, text: response.data?.text ?? null };
  } catch (err) {
    logger.error({ err: err.message }, '[bhashini] Translation request failed');
    throw new AppError(
      'Translation service is unavailable.',
      ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE,
      { provider: 'bhashini', operation: 'translate' }
    );
  }
}

module.exports = { speechToText, textToSpeech, translate, isConfigured };
