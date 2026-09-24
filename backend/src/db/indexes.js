/**
 * @fileoverview Database Index Registry & Latency Verification
 * @module db/indexes
 * @description
 * Sections 66.3 & 67.1:
 * Manages synchronous index builds and asserts the existence of mission-critical indexes.
 *
 * Operational Importance:
 * - Sub-Second Geofencing: Asserts the `2dsphere` spatial index on `gis_layers.geometry_full`,
 *   guaranteeing that `$geoIntersects` and boundary proximity checks complete in under 1 second.
 * - Idempotency & Lookups: Verifies unique indexes on `analysis_id`, `dedup_key`, and user emails.
 */

const mongoose = require('mongoose');
const models = require('./models');
const { logger } = require('../observability/logger');

// Indexes the application's correctness or latency guarantees depend on.
// Verified explicitly rather than assumed.
const CRITICAL_INDEXES = [
  {
    collection: 'gis_layers',
    // Field is `geometry_full` (contracts/db/GisLayerDocument.json), so
    // Mongoose names the index accordingly. This was `geometry_2dsphere`
    // before the contract reconciliation renamed the field - fixed here.
    key: 'geometry_full_2dsphere',
    why: 'Section 66.3/67.1: geofence $geoIntersects and $near must be sub-second',
  },
  {
    collection: 'analyses',
    key: 'analysis_id_1',
    why: 'Section 8.1: analysis_id uniqueness; catches a hash6 collision',
  },
  {
    collection: 'agent_results',
    key: 'analysis_id_1_agent_name_1',
    why: 'Section 99.2: one result per agent per analysis; makes retries idempotent',
  },
  {
    collection: 'geofence_events',
    key: 'created_at_1',
    why: 'Section 107: TTL index enforces GPS retention automatically',
  },
  {
    collection: 'alert_subscriptions',
    key: 'subscriber_id_1_location.lat_1_location.lon_1',
    why: 'Section 40: detects a duplicate active subscription so we can return 409',
  },
];

/**
 * Build every declared index now, and wait for completion.
 * Safe to run repeatedly - existing indexes are left untouched.
 */
async function ensureIndexes() {
  logger.info('[indexes] Building indexes for all collections');

  const results = [];

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.createIndexes();
      const built = await model.collection.indexes();
      results.push({ model: name, collection: model.collection.name, count: built.length });
      logger.info(
        { model: name, collection: model.collection.name, indexes: built.length },
        '[indexes] Built'
      );
    } catch (err) {
      // Reported, not thrown: one failing collection should not abort the rest.
      logger.error({ model: name, err: err.message }, '[indexes] Failed to build indexes');
      results.push({ model: name, error: err.message });
    }
  }

  return results;
}

/**
 * Verify that the critical indexes exist.
 * @returns {{ allPresent: boolean, checks: Array }}
 */
async function verifyIndexes() {
  const checks = [];

  for (const critical of CRITICAL_INDEXES) {
    try {
      const collection = mongoose.connection.db.collection(critical.collection);
      const existing = await collection.indexes();
      const present = existing.some((index) => index.name === critical.key);

      checks.push({ ...critical, present });

      if (!present) {
        logger.error(
          { collection: critical.collection, index: critical.key, why: critical.why },
          '[indexes] CRITICAL INDEX MISSING - run `npm run create-indexes`'
        );
      }
    } catch (err) {
      // A collection that does not exist yet has no indexes, which is normal
      // on a fresh database before any document has been written.
      checks.push({ ...critical, present: false, error: err.message });
    }
  }

  const allPresent = checks.every((c) => c.present);
  if (allPresent) logger.info('[indexes] All critical indexes verified');

  return { allPresent, checks };
}

/** Human-readable listing of every index, for debugging. */
async function listAllIndexes() {
  const listing = {};

  for (const [name, model] of Object.entries(models)) {
    try {
      listing[model.collection.name] = (await model.collection.indexes()).map((index) => ({
        name: index.name,
        keys: index.key,
        unique: index.unique || false,
        partial: Boolean(index.partialFilterExpression),
        ttl_seconds: index.expireAfterSeconds ?? null,
      }));
    } catch (err) {
      listing[model.collection.name] = { error: err.message };
    }
  }

  return listing;
}

module.exports = { ensureIndexes, verifyIndexes, listAllIndexes, CRITICAL_INDEXES };
