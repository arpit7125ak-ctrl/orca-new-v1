/**
 * @fileoverview Exportable Maritime Safety Advisory Report Schema
 * @module db/models/report.model
 * @description
 * Section 99.10 (`reports` collection):
 * Persists pre-generated, shareable advisory reports across multiple formats
 * (markdown, text, HTML, structured JSON) and regional languages.
 *
 * Operational Mechanics:
 * - Deterministic Document Caching: Compound index on `(analysis_id, language, format)`
 *   ensures identical text is returned across multiple downloads, maintaining report integrity.
 */

const mongoose = require('mongoose');


const ReportSchema = new mongoose.Schema(
  {
    report_id: { type: String, required: true, unique: true, index: true },
    analysis_id: { type: String, required: true, index: true },

    format: { type: String, enum: ['text', 'markdown', 'html', 'json'], default: 'markdown' },

    // Mixed: for text/markdown this is a string; for json it is a structured
    // ReportContent object from the AI Service.
    content: { type: mongoose.Schema.Types.Mixed, required: true },

    language: { type: String, required: true },

    // A short version suitable for an SMS or push body.
    summary_line: { type: String, default: null },

    // Snapshot of the sources used, so the advisory remains self-contained
    // evidence even if the underlying agent_results are later pruned.
    // Section 67: "the source of every layer is shown in the evidence panel".
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },

    generated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'reports',
    strict: false,
  }
);

// Cache key: one report per analysis per language per format.
ReportSchema.index({ analysis_id: 1, language: 1, format: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema);
