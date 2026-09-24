/**
 * @fileoverview Final Operational Decision & Recommendation Mongoose Schema
 * @module db/models/decision.model
 * @description
 * Sections 68, 105 & `contracts/Decision.json`:
 * Persists the combined operational verdict synthesized by the Decision Agent.
 * Merges physical ocean/weather safety assessments with economic potential fishing zone (PFZ) insights.
 *
 * Domain Principles:
 * - Separation of Concerns: Safety risk calculations and fishing yield opportunities
 *   are computed independently upstream and only synthesized here.
 * - Point Exclusion Integrity: Coordinates falling inside prohibited geofence zones
 *   are logged under `excluded_points` with explicit violation reasons, preventing
 *   unsafe recommendation even if sea conditions are perfectly calm.
 */

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
