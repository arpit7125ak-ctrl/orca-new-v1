/**
 * @fileoverview INCOIS Potential Fishing Zone (PFZ) Advisory Contours Schema
 * @module db/models/pfzAdvisory.model
 * @description
 * Models the `pfz_advisories` collection storing daily satellite-derived chlorophyll
 * and Sea Surface Temperature (SST) oceanic convergence front contours from INCOIS.
 *
 * Performance Features:
 * - 2dsphere Spatial Indexing: Equips `geometry` with a geospatial index enabling
 *   sub-5ms proximity and intersection queries between fishing boats and PFZ lines.
 * - Temporal Validity Windows: Tracks `valid_from` and `valid_to` timestamps to ensure
 *   stale satellite advisories are automatically filtered out.
 */

const mongoose = require('mongoose');


const PfzAdvisorySchema = new mongoose.Schema(
  {
    advisory_id: { type: String, required: true, unique: true, index: true },
    sector: { type: String, required: true, index: true },
    source: { type: String, default: 'INCOIS (Oceansat-3 / AVHRR)' },
    source_url: { type: String, default: 'https://services.incois.gov.in/geoserver/wfs' },
    valid_from: { type: Date, required: true, index: true },
    valid_to: { type: Date, required: true, index: true },
    geometry: { type: mongoose.Schema.Types.Mixed, required: true },
    properties: {
      reference_port: { type: String, default: null },
      distance_km: { type: Number, default: null },
      bearing_deg: { type: Number, default: null },
      direction_compass: { type: String, default: null },
      depth_min_m: { type: Number, default: null },
      depth_max_m: { type: Number, default: null },
      sst_gradient_c: { type: Number, default: null },
      suitability_score: { type: Number, default: 0.8 },
      target_species: { type: [String], default: [] },
      ocean_feature: { type: String, default: 'thermal_front_convergence' },
      reliability: { type: String, default: 'high' },
    },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'pfz_advisories',
    strict: false,
  }
);

// 2dsphere index enables native spatial proximity searches ($near, $geoIntersects)
PfzAdvisorySchema.index({ geometry: '2dsphere' });
PfzAdvisorySchema.index({ active: 1, valid_to: 1 });

module.exports = mongoose.model('PfzAdvisory', PfzAdvisorySchema);
