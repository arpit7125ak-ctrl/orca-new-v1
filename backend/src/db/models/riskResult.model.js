// src/db/models/riskResult.model.js
// ---------------------------------------------------------------------------
// SHAPE FROM contracts/db/RiskResultsDocument.json:
//   required: analysis_id, results, created_at
//
// `results` is an array of contracts/RiskAssessment.json - note the field name
// is `results`, not `points`.
//
// RiskAssessment required fields: point_id, baseline_score, final_score,
// risk_level, reasoning, confidence, hourly_scores.
//
// The optional fields mirror the Section 47.2 pipeline ORDER, and that ordering
// is the whole point of storing each stage separately:
//
//   baseline_score          deterministic baseline (Section 48)
//   official_warnings       warning-derived floors (Section 49)
//   hard_rules_applied      hard-rule floors (Section 50)
//   constraint_floor        the resulting floor
//   llm_adjustment          BOUNDED LLM nudge (Section 51)
//   adjustment_reason
//   final_score / risk_level
//
// Storing them separately is what makes it PROVABLE that the bounded LLM never
// single-handedly made something look safe - it can nudge within limits but can
// never overrule a floor.
//
// Section 48.4.1 LOCKED RULE: baseline_score = max(hourly_scores[].score) over
// hours with computable data, null if none. max() (worst hour), not average -
// an average would let one calm hour mask a dangerous one.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const RiskResultSchema = new mongoose.Schema(
  {
    analysis_id: { type: String, required: true, unique: true, index: true },

    // Array of RiskAssessment objects, one per sampled point. Mixed because the
    // AI Service owns the shape (it is a locked contract, not ours to redefine)
    // and because hourly_scores/risk_factors are themselves nested structures.
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'risk_results',
    strict: false,
  }
);

module.exports = mongoose.model('RiskResult', RiskResultSchema);
