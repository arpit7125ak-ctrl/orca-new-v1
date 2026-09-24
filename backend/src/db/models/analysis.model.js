/**
 * @fileoverview Central Analysis Job Mongoose Schema (`analyses` collection)
 * @module db/models/analysis.model
 * @description
 * Sections 8.1, 9, 99 & `contracts/db/AnalysesDocument.json`:
 * Acts as the primary operational spine of the ORCA system. Every user query,
 * automated subscription check, or route evaluation persists an authoritative record here.
 *
 * Architecture Principles:
 * - Central Spine: All secondary collections (`agent_results`, `risk_results`, `decisions`)
 *   reference this document via the indexed `analysis_id`.
 * - Contract Conformity: Maps directly to `AnalysesDocument.json`, storing raw user request,
 *   planner execution plan, point measurements, execution trace, and status transitions.
 * - Anti-Fabrication: Omits arbitrary default values so unmeasured fields stay honestly null.
 */

const mongoose = require('mongoose');
const { ALL_ERROR_CATEGORIES } = require('../../errors/errorCategories');


// Section 9: the five analysis lifecycle states.
const ANALYSIS_STATUSES = ['queued', 'running', 'completed', 'partial', 'failed'];

// contracts/api/InternalResultPayload.json
const FINAL_STAGES = ['decision', 'route', 'trend', 'report', 'quick_information'];

// ---------------------------------------------------------------------------
// Execution trace entry (Section 100). Stage-level, distinct from the analysis
// lifecycle - one running analysis contains many stages at different statuses.
// ---------------------------------------------------------------------------
const TraceEntrySchema = new mongoose.Schema(
  {
    // Named `stage` internally; serialised as `agent` on the way out, matching
    // contracts/ProgressMessage.json.
    stage: { type: String, required: true },
    selected: { type: Boolean, default: true },
    selection_reason: { type: String, default: null },
    status: { type: String, default: null },
    status_code: { type: Number, default: null },
    started_at: { type: String, default: null },
    // An unfinished stage keeps completed_at and duration_ms null - never a
    // tidy 0, which would read as "finished instantly".
    completed_at: { type: String, default: null },
    duration_ms: { type: Number, default: null },
    retry_count: { type: Number, default: 0 },
    error: { type: String, default: null },
    error_category: { type: String, enum: [...ALL_ERROR_CATEGORIES, null], default: null },
    summary: { type: String, default: null },
  },
  { _id: false }
);

const AnalysisSchema = new mongoose.Schema(
  {
    // Section 8.1 locked format: req_{YYYYMMDD}_{HHMM}_{hash6}.
    // `unique` creates the index that catches a hash6 collision rather than
    // silently overwriting a prior analysis.
    analysis_id: { type: String, required: true, unique: true, index: true },

    // Section 8.1 linkage fields.
    conversation_id: { type: String, default: null, index: true },
    parent_analysis_id: { type: String, default: null, index: true },
    alert_subscription_id: { type: String, default: null, index: true },

    // The inbound AnalysisRequest, stored verbatim so we can always show what
    // was actually asked. Mixed because it is the contract's shape, not ours.
    request: { type: mongoose.Schema.Types.Mixed, required: true },

    // contracts/ExecutionPlan.json. Named `plan` per AnalysesDocument.
    plan: { type: mongoose.Schema.Types.Mixed, default: null },

    // --- Denormalised from the plan, for cheap querying --------------------
    // These duplicate fields inside `plan` on purpose: the status endpoint and
    // the alert worker read them constantly and should not have to walk a
    // Mixed sub-document to do it.
    detected_language: { type: String, default: null },
    override_language: { type: String, default: null },
    response_language: { type: String, default: null },
    primary_intent: { type: String, default: null },
    secondary_intents: { type: [String], default: [] },
    activity: { type: String, default: null },
    vessel_type: { type: String, default: null },
    // Section 7.7: records that the Planner substituted a conservative default
    // because none was supplied - the assumption must be stated, not hidden.
    vessel_type_assumed: { type: Boolean, default: false },

    // contracts/shared/Location.json - { original, validated }. Null until the
    // Planner resolves it; `validated` is Planner-owned (Section 7.10).
    location: { type: mongoose.Schema.Types.Mixed, default: null },

    // contracts/shared/TimeWindow.json - local/utc are ISO 8601 INTERVAL
    // STRINGS ("start/end"), not nested date/time objects. Null when the
    // Backend could not build one truthfully (see utils/time.js).
    time_window: { type: mongoose.Schema.Types.Mixed, default: null },

    sampling: { type: mongoose.Schema.Types.Mixed, default: null },

    // contracts/PointObservation.json documents.
    points: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Section 9 lifecycle.
    status: { type: String, enum: ANALYSIS_STATUSES, default: 'queued', index: true },

    // Stored flat for indexing; serialised as a nested ErrorInfo object
    // ({ error_category, message }) in responses.
    error_category: { type: String, enum: [...ALL_ERROR_CATEGORIES, null], default: null },
    error_message: { type: String, default: null },

    selected_agents: { type: [String], default: [] },
    // Section 107: skipped agents carry REASONS. A bare name is an unexplained
    // gap in the evidence chain.
    skipped_agents: {
      type: [{ _id: false, agent: String, reason: String }],
      default: [],
    },
    // Map of agent name -> status, e.g. { weather: "completed" }.
    agent_statuses: { type: mongoose.Schema.Types.Mixed, default: {} },

    // ProgressMessage.data_ref pointers, by agent - where the AI Service stored
    // a payload too large to send inline.
    data_refs: { type: mongoose.Schema.Types.Mixed, default: {} },

    // contracts/shared/DataQuality.json
    data_quality: { type: mongoose.Schema.Types.Mixed, default: null },

    // Section 100
    execution_trace: { type: [TraceEntrySchema], default: [] },

    // --- Final artefact (contracts/api/InternalResultPayload.json) ---------
    // Exactly one of these is populated, matching final_stage. Decision and
    // Route live in their own collections; the rest are stored inline because
    // Section 99 defines no collection for them.
    final_stage: { type: String, enum: [...FINAL_STAGES, null], default: null },
    trend_result: { type: mongoose.Schema.Types.Mixed, default: null },
    report_content: { type: mongoose.Schema.Types.Mixed, default: null },
    quick_information_result: { type: mongoose.Schema.Types.Mixed, default: null },

    // Set by the alert scheduler once it has decided whether to raise an alert,
    // so an analysis is never evaluated twice.
    alert_evaluated: { type: Boolean, default: false, index: true },

    completed_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'analyses',
    // Section 99: flexible structures for agent-specific and future fields.
    // Lets the AI Service add fields we have not modelled without them being
    // silently dropped.
    strict: false,
  }
);

// --- Indexes ---------------------------------------------------------------
// The alert worker and any dashboard both ask "what is running / what completed
// recently".
AnalysisSchema.index({ status: 1, created_at: -1 });
// Conversation history retrieval.
AnalysisSchema.index({ conversation_id: 1, created_at: -1 });
// The scheduler's phase-2 query: subscription-triggered, finished, unevaluated.
AnalysisSchema.index({ alert_subscription_id: 1, alert_evaluated: 1, completed_at: -1 });

module.exports = mongoose.model('Analysis', AnalysisSchema);
module.exports.ANALYSIS_STATUSES = ANALYSIS_STATUSES;
module.exports.FINAL_STAGES = FINAL_STAGES;
