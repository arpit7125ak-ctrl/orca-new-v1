// src/db/models/agentResult.model.js
// ---------------------------------------------------------------------------
// SHAPE FROM contracts/AgentResult.json:
//   required: analysis_id, agent_name, status
//   optional: started_at, completed_at, duration_ms, retry_count, error,
//             normalized, raw
//
// Note the field names are `normalized` and `raw` - NOT normalized_output /
// raw_output - and `error` is an ErrorInfo object, not a string plus a
// separate category column.
//
// WHY BOTH normalized AND raw ARE STORED:
// Section 24.1/24.2 make the adapter the isolation layer, with canonical units
// enforced there. Keeping the raw payload alongside the normalized one means a
// unit-conversion bug found later can be fixed by re-normalising historical
// data instead of re-fetching it - often impossible for a forecast whose valid
// time has already passed.
//
// `normalized` is a MAP keyed by point_id, each value holding a map of
// canonical parameter name -> Measurement (contracts/Measurement.json). It is
// Mixed rather than a typed sub-schema precisely because those keys are
// dynamic.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const AgentResultSchema = new mongoose.Schema(
  {
    analysis_id: { type: String, required: true, index: true },
    agent_name: { type: String, required: true },

    status: {
      type: String,
      enum: ['completed', 'partial', 'failed', 'timeout', 'skipped'],
      required: true,
    },

    started_at: { type: String, default: null },
    completed_at: { type: String, default: null },
    // null, never 0, while the agent is still running.
    duration_ms: { type: Number, default: null },
    retry_count: { type: Number, default: 0 },

    // contracts/shared/ErrorInfo.json: { error_category, message, http_status?,
    // retry_count? }. Stored as the whole object so nothing is lost.
    error: { type: mongoose.Schema.Types.Mixed, default: null },

    // point_id -> { parameter -> Measurement }
    normalized: { type: mongoose.Schema.Types.Mixed, default: null },

    // Untouched upstream payload. Mixed because every provider differs.
    raw: { type: mongoose.Schema.Types.Mixed, default: null },

    // Provenance beyond what individual Measurements carry: which adapter tier
    // served this. Matters because fallback data may be lower confidence.
    adapter_used: { type: String, default: null },
    adapter_tier: { type: String, enum: ['preferred', 'fallback', 'mock', null], default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'agent_results',
    strict: false,
  }
);

// One agent reports once per analysis. This compound unique index enforces that
// and makes AI Service retries idempotent via upsert on the same key.
AgentResultSchema.index({ analysis_id: 1, agent_name: 1 }, { unique: true });

module.exports = mongoose.model('AgentResult', AgentResultSchema);
