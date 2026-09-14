// src/db/models/decision.model.js
// ---------------------------------------------------------------------------
// SHAPE FROM contracts/Decision.json:
//   required: analysis_id, response_language, detailed_recommendation,
//             one_line_recommendation, recommendation_type, point_scores
//   optional: generated_at, key_findings, preferred_point,
//             preferred_point_reason, worst_point, worst_point_causes,
//             excluded_points, best_time_windows
//
// Section 68: the Decision Agent is where SAFETY and FISHING OPPORTUNITY are
// combined - they are answered separately upstream and only merged here.
//
// `excluded_points` is the field that carries Section 105's "no allowed point"
// scenario honestly: a point inside a `prohibited` zone can NEVER be
// recommended regardless of how low its risk score is, and it appears here with
// its exclusion cause rather than silently vanishing from point_scores.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

const DecisionSchema = new mongoose.Schema(
  {
    analysis_id: { type: String, required: true, unique: true, index: true },

    response_language: { type: String, default: null },
    generated_at: { type: String, default: null },

    recommendation_type: { type: String, default: null },
    one_line_recommendation: { type: String, default: null },
    detailed_recommendation: { type: String, default: null },

    // contracts/Decision.json: key_findings is a STRUCTURED OBJECT with named
    // fields (safest_allowed_point, highest_risk_point, major_hazard, etc.),
    // NOT an array of strings. Caught by live testing: the old [String] array
    // type threw a Mongoose CastError the moment a real object was saved.
    key_findings: { type: mongoose.Schema.Types.Mixed, default: null },

    // Null when NO point is allowed - we never fall back to "least bad" and
    // present it as preferred.
    preferred_point: { type: mongoose.Schema.Types.Mixed, default: null },
    preferred_point_reason: { type: String, default: null },
    worst_point: { type: mongoose.Schema.Types.Mixed, default: null },
    worst_point_causes: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Points ruled out by a hard constraint, with the cause (Section 65.1).
    excluded_points: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Section 63. An empty array is a legitimate, important answer: "there is
    // no safe window" - not a gap to hide.
    best_time_windows: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Copied from Risk rather than joined, so a stored decision remains
    // explainable even if risk_results is later recomputed.
    point_scores: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'decisions',
    strict: false,
  }
);

module.exports = mongoose.model('Decision', DecisionSchema);
