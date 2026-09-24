/**
 * @fileoverview Agent Execution Result Mongoose Schema
 * @module db/models/agentResult.model
 * @description
 * Implements the database document mapping for `contracts/AgentResult.json`.
 * Persists the execution outcome, raw upstream payloads, and normalized measurements
 * returned by individual specialized domain agents (weather, ocean, tide, etc.).
 *
 * Design Architecture:
 * - Dual Payload Persistence: Stores both `raw` and `normalized` outputs so telemetry
 *   can be audited or re-normalized retrospectively without re-fetching past forecast models.
 * - Dynamic Point Maps: `normalized` maps dynamic point IDs (e.g. `P0`, `P1`) to
 *   canonical parameter measurements (`Measurement.json`).
 */

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
