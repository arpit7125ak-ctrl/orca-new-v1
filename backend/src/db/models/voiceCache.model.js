/**
 * @fileoverview Voice Cache Mongoose Model (`voice_cache` collection)
 * @module db/models/voiceCache.model
 * @description
 * Persists pre-generated and on-demand synthesized audio binary buffers (MP3)
 * for completed analyses.
 *
 * Design Guarantees:
 * - Binary Storage: Audio is stored as raw BSON BinData (`Buffer`), saving 33% overhead
 *   compared to storing base64 strings in the database.
 * - Concurrency & Idempotency: Compound unique index `{ analysis_id: 1, language: 1 }`
 *   prevents duplicate writes or racing background tasks.
 * - Time-Bounded Lifecycle: 24-hour TTL index on `expires_at` automatically cleans up
 *   stale audio without unbounded disk growth.
 */

const mongoose = require('mongoose');

const VoiceCacheSchema = new mongoose.Schema(
  {
    analysis_id: {
      type: String,
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
    },
    mime_type: {
      type: String,
      default: 'audio/mp3',
    },
    text: {
      type: String,
      default: '',
    },
    audio_data: {
      type: Buffer,
      required: true,
    },
    duration_sec: {
      type: Number,
      required: true,
    },
    size_bytes: {
      type: Number,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'voice_cache',
  }
);

// Compound unique index ensuring one authoritative audio document per (analysis_id, language)
VoiceCacheSchema.index({ analysis_id: 1, language: 1 }, { unique: true });

// TTL index to automatically purge expired audio documents
VoiceCacheSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const VoiceCache = mongoose.models.VoiceCache || mongoose.model('VoiceCache', VoiceCacheSchema);

module.exports = VoiceCache;
