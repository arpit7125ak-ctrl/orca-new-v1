/**
 * @fileoverview Bhashini National Language Translation & Speech Proxy Client
 * @module clients/bhashini.client
 * @description
 * Section 102 & 103 (Voice Pipeline):
 * Authoritative, secure gateway between the ORCA backend and the Government of
 * India's Bhashini AI language services (MeitY ULCA / Dhruva inference).
 *
 * Architectural & Safety Constraints:
 * - Direct Client Isolation: Frontend MUST NEVER communicate with Bhashini directly.
 *   API keys remain securely stored in the backend environment.
 * - Two-Phase Authentication:
 *     Phase 1 (Config Discovery): POST to BHASHINI_CONFIG_URL with userID (BHASHINI_APP_ID)
 *       and ulcaApiKey (BHASHINI_UDYAT_KEY). Cached in-memory per (task, language).
 *     Phase 2 (Inference Compute): POST to dynamic callbackUrl with inference authorization
 *       header returned from Phase 1.
 * - Never-Fabricate Mandate: If credentials are unset or upstream services fail,
 *   methods report `{ available: false, reason: ... }` rather than hallucinating
 *   transcripts or emitting silent/empty audio blobs. Fabricated transcripts in maritime
 *   navigation can lead to severe safety risks.
 */

const axios = require('axios');
const env = require('../config/env');
const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { logger } = require('../observability/logger');

const isConfigured = Boolean(
  env.BHASHINI_UDYAT_KEY &&
  env.BHASHINI_INFERENCE_KEY &&
  env.BHASHINI_APP_ID &&
  env.BHASHINI_CONFIG_URL &&
  env.BHASHINI_PIPELINE_ID
);

if (!isConfigured) {
  logger.warn(
    '[bhashini] Bhashini credentials not fully configured (requires BHASHINI_UDYAT_KEY, BHASHINI_INFERENCE_KEY, BHASHINI_APP_ID). Voice endpoints will report unavailable.'
  );
}

/** In-memory cache for Phase 1 pipeline configurations: `${taskType}:${language}` -> config */
const pipelineConfigCache = new Map();
const CONFIG_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Retrieves the Phase 1 pipeline configuration for a specific task and language.
 * Uses an in-memory cache with a 6-hour TTL, re-fetching on expiration or cache eviction.
 *
 * @param {'tts'|'asr'|'translation'} taskType
 * @param {string} language ISO 639-1 code (e.g. 'en', 'hi', 'ta')
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<{ callbackUrl: string, authHeaderName: string, authHeaderValue: string, serviceId: string, modelId: string, supportedVoices: string[] }>}
 */
async function getPipelineConfig(taskType, language, forceRefresh = false) {
  if (!isConfigured) {
    throw new Error('bhashini_not_configured');
  }

  const cacheKey = `${taskType}:${language}`;
  const now = Date.now();
  const cached = pipelineConfigCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached;
  }

  const payload = {
    pipelineTasks: [
      {
        taskType,
        config: {
          language: {
            sourceLanguage: language,
          },
        },
      },
    ],
    pipelineRequestConfig: {
      pipelineId: env.BHASHINI_PIPELINE_ID,
    },
  };

  const headers = {
    'Content-Type': 'application/json',
    userID: env.BHASHINI_APP_ID,
    ulcaApiKey: env.BHASHINI_UDYAT_KEY,
  };

  const response = await axios.post(env.BHASHINI_CONFIG_URL, payload, {
    headers,
    timeout: 30000,
  });

  const endpoint = response.data?.pipelineInferenceAPIEndPoint;
  if (!endpoint || !endpoint.callbackUrl) {
    throw new Error(`Bhashini config response missing pipelineInferenceAPIEndPoint for ${taskType}:${language}`);
  }

  const taskConfig = response.data?.pipelineResponseConfig?.[0]?.config?.[0];
  if (!taskConfig || !taskConfig.serviceId) {
    throw new Error(`Bhashini config response missing serviceId for ${taskType}:${language}`);
  }

  const entry = {
    expiresAt: now + CONFIG_CACHE_TTL_MS,
    callbackUrl: endpoint.callbackUrl,
    authHeaderName: endpoint.inferenceApiKey?.name || 'Authorization',
    authHeaderValue: endpoint.inferenceApiKey?.value || env.BHASHINI_INFERENCE_KEY,
    serviceId: taskConfig.serviceId,
    modelId: taskConfig.modelId || null,
    supportedVoices: taskConfig.supportedVoices || [],
  };

  pipelineConfigCache.set(cacheKey, entry);
  return entry;
}

/**
 * TTS: text -> speech.
 * Executes the two-phase Bhashini flow:
 * 1. Fetches/uses cached Phase 1 pipeline config for the language.
 * 2. Selects an available voice gender dynamically from supportedVoices.
 * 3. Sends inference request to dynamic callbackUrl at 16000Hz sampling rate.
 *
 * @param {string} text - Plain text advisory to synthesize.
 * @param {string} targetLanguage - ISO 639-1 language code.
 * @returns {Promise<{ available: boolean, audio: string|null, mime_type?: string, reason?: string }>}
 */
async function textToSpeech(text, targetLanguage) {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', audio: null };
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return { available: false, reason: 'empty_text', audio: null };
  }

  const resolvedLang = targetLanguage || 'en';

  let config;
  try {
    config = await getPipelineConfig('tts', resolvedLang);
  } catch (err) {
    logger.error(
      { err: err.message, lang: resolvedLang },
      '[bhashini] TTS Phase 1 config discovery failed'
    );
    return { available: false, reason: 'config_discovery_failed', audio: null };
  }

  // Pick voice gender dynamically from supportedVoices; fall back gracefully
  const voices = config.supportedVoices || [];
  const selectedVoice = voices.includes('female')
    ? 'female'
    : (voices.length > 0 ? voices[0] : 'female');

  const inferencePayload = {
    pipelineTasks: [
      {
        taskType: 'tts',
        config: {
          language: {
            sourceLanguage: resolvedLang,
          },
          serviceId: config.serviceId,
          gender: selectedVoice,
          samplingRate: 16000, // 16kHz audio for clarity in marine environments
        },
      },
    ],
    inputData: {
      input: [
        {
          source: text.trim(),
        },
      ],
    },
  };

  const inferenceHeaders = {
    'Content-Type': 'application/json',
    [config.authHeaderName]: config.authHeaderValue,
  };

  try {
    const response = await axios.post(config.callbackUrl, inferencePayload, {
      headers: inferenceHeaders,
      timeout: 60000,
    });

    const audioContent = response.data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
    if (!audioContent || typeof audioContent !== 'string' || !audioContent.trim()) {
      logger.warn({ lang: resolvedLang }, '[bhashini] TTS returned empty audio payload');
      return { available: false, reason: 'empty_audio_returned', audio: null };
    }

    return {
      available: true,
      audio: audioContent,
      mime_type: 'audio/wav',
    };
  } catch (err) {
    // If auth fails, invalidate cached config so subsequent calls re-discover credentials
    if (err.response?.status === 401 || err.response?.status === 403) {
      pipelineConfigCache.delete(`tts:${resolvedLang}`);
    }
    logger.error(
      { err: err.message, status: err.response?.status, lang: resolvedLang },
      '[bhashini] TTS inference failed'
    );
    return { available: false, reason: 'inference_failed', audio: null };
  }
}

/**
 * ASR: speech -> text via Bhashini Dhruva ASR Pipeline.
 *
 * @param {string} audioBase64 - Base64 encoded audio payload (MP3 or WAV).
 * @param {string} [sourceLanguage='en'] - ISO 639-1 code (e.g. 'en', 'hi', 'ta').
 * @param {string} [audioFormat='mp3'] - Container format ('mp3' or 'wav').
 * @returns {Promise<{ available: boolean, text: string|null, detected_language?: string, confidence?: number, reason?: string }>}
 */
async function speechToText(audioBase64, sourceLanguage = 'en', audioFormat = 'mp3') {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', text: null };
  }

  const resolvedLang = sourceLanguage || 'en';
  const resolvedFormat = audioFormat === 'wav' ? 'wav' : 'mp3';

  let config;
  try {
    config = await getPipelineConfig('asr', resolvedLang);
  } catch (err) {
    logger.error(
      { err: err.message, lang: resolvedLang },
      '[bhashini] Failed to acquire ASR pipeline config'
    );
    return { available: false, reason: 'config_discovery_failed', text: null };
  }

  const inferencePayload = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: {
            sourceLanguage: resolvedLang,
          },
          serviceId: config.serviceId,
          // ARCHITECTURAL WARNING: Empirical testing demonstrated that Bhashini's inference cluster
          // ignores this declared audioFormat parameter and sniffs container magic bytes directly
          // at the libsndfile/ffmpeg layer (e.g. passing MP3 bytes with audioFormat: 'wav' succeeds,
          // while passing WebM fails with HTTP 500 regardless of this tag). We retain the canonical
          // parameter ('mp3' or 'wav') for schema completeness, but do not rely on it to enforce or change behavior.
          audioFormat: resolvedFormat,
          samplingRate: 16000,
        },
      },
    ],
    inputData: {
      audio: [
        {
          audioContent: audioBase64.trim(),
        },
      ],
    },
  };

  const inferenceHeaders = {
    'Content-Type': 'application/json',
    [config.authHeaderName]: config.authHeaderValue,
  };

  try {
    const response = await axios.post(config.callbackUrl, inferencePayload, {
      headers: inferenceHeaders,
      timeout: 45000,
    });

    const output = response.data?.pipelineResponse?.[0]?.output?.[0];
    const transcript = output?.source;

    // Strict Anti-Fabrication Mandate: Never return empty or whitespace-only transcripts as successes
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      logger.warn({ lang: resolvedLang }, '[bhashini] ASR returned empty transcript');
      return { available: false, reason: 'no_speech_detected', text: null };
    }

    return {
      available: true,
      text: transcript.trim(),
      detected_language: resolvedLang,
      confidence: null, // Dhruva returns text directly; never fabricate a 1.0 confidence score
    };
  } catch (err) {
    // If auth fails, evict cached config
    if (err.response?.status === 401 || err.response?.status === 403) {
      pipelineConfigCache.delete(`asr:${resolvedLang}`);
    }
    logger.error(
      { err: err.message, status: err.response?.status, lang: resolvedLang },
      '[bhashini] ASR inference failed'
    );
    return { available: false, reason: 'inference_failed', text: null };
  }
}

/** Text translation between supported Indian languages. */
async function translate(text, sourceLanguage, targetLanguage) {
  if (!isConfigured) {
    return { available: false, reason: 'bhashini_not_configured', text: null };
  }

  return { available: false, reason: 'translate_not_implemented', text: null };
}

module.exports = {
  speechToText,
  textToSpeech,
  translate,
  getPipelineConfig,
  isConfigured,
};
