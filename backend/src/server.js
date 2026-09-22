// src/server.js
// ---------------------------------------------------------------------------
// ENTRY POINT for the public API server.
//
//   npm start      -> node src/server.js
//   npm run dev    -> nodemon src/server.js
//
// STARTUP ORDER IS DELIBERATE:
//   1. Connect to MongoDB FIRST. Accepting traffic before the database is up
//      would return 500s that look like application bugs.
//   2. Register all models, so every index is built before the first request.
//   3. Only then bind the port.
// ---------------------------------------------------------------------------

const cron = require('node-cron');
const env = require('./config/env');
const limits = require('./config/limits');
const { connect, disconnect } = require('./db/connection');
const createApp = require('./app');
const { logger } = require('./observability/logger');
const { syncPfzFromIncois } = require('./modules/pfz/pfzSync.service');
const PfzAdvisory = require('./db/models/pfzAdvisory.model');

// Requiring the barrel registers all 12 models with Mongoose, which is what
// triggers index creation. Without this, a model only used by a rarely-hit
// route would never have its indexes built.
require('./db/models');

let server = null;
let internalServer = null;
let pfzCronTask = null;

async function start() {
  try {
    // --- 1. Database -----------------------------------------------------
    await connect();

    // --- 2. Build the app ------------------------------------------------
    const app = createApp();

    // --- 3. Listen -------------------------------------------------------
    server = app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `[server] ORCA Backend API listening on http://localhost:${env.PORT}`
      );
      logger.info(`[server] Health check:    http://localhost:${env.PORT}/health`);
      logger.info(`[server] Readiness check: http://localhost:${env.PORT}/health/ready`);
      logger.info(`[server] Config:          http://localhost:${env.PORT}/api/v1/config`);
    });

    if (env.INTERNAL_PORT && env.INTERNAL_PORT !== env.PORT) {
      const { createInternalApp } = require('./internal-server');
      const internalApp = createInternalApp();
      internalServer = internalApp.listen(env.INTERNAL_PORT, () => {
        logger.info(
          { port: env.INTERNAL_PORT },
          `[server] ORCA Backend Internal API listening on http://localhost:${env.INTERNAL_PORT}`
        );
      });
      internalServer.headersTimeout = 65000;
      internalServer.keepAliveTimeout = 60000;
    }

    // Node's default header timeout can cut off slow mobile uploads (voice
    // audio over a weak connection), so it is raised here.
    server.headersTimeout = 65000;
    server.keepAliveTimeout = 60000;

    // --- 4. Automatic PFZ Synchronization Scheduler ----------------------
    // Automatically runs at 8:00 PM IST daily without manual intervention
    pfzCronTask = cron.schedule(
      limits.PFZ_SYNC_CRON,
      async () => {
        logger.info('[server] [pfz-sync] Starting daily 8:00 PM INCOIS PFZ sync...');
        try {
          const res = await syncPfzFromIncois();
          logger.info({ res }, '[server] [pfz-sync] Daily INCOIS PFZ sync completed');
        } catch (err) {
          logger.error({ err: err.message }, '[server] [pfz-sync] Daily INCOIS PFZ sync failed');
        }
      },
      { timezone: 'Asia/Kolkata' }
    );

    logger.info(
      { cron: limits.PFZ_SYNC_CRON, timezone: 'Asia/Kolkata' },
      '[server] [pfz-sync] Automatic daily PFZ sync registered'
    );

    // Initial check: if MongoDB has no active PFZ advisories, trigger initial sync in background
    setTimeout(async () => {
      try {
        const count = await PfzAdvisory.countDocuments({ active: true });
        if (count === 0) {
          logger.info('[server] [pfz-sync] No active PFZ data in DB. Triggering initial automatic sync...');
          await syncPfzFromIncois();
        } else {
          logger.info({ active_pfz_count: count }, '[server] [pfz-sync] Active PFZ advisories present');
        }
      } catch (e) {
        logger.warn({ err: e.message }, '[server] [pfz-sync] Initial background check warning');
      }
    }, 1500);

    // Initial check: verify authoritative Indian Maritime Zones & MPAs in MongoDB
    setTimeout(async () => {
      try {
        const GisLayer = require('./db/models/gisLayer.model');
        const demoCount = await GisLayer.countDocuments({ source: 'DEMO_SEED_DATA' });
        const authCount = await GisLayer.countDocuments({ version: { $regex: 'v2' } });
        if (demoCount > 0 || authCount === 0) {
          logger.info('[server] [gis-sync] Synchronizing authoritative Indian Maritime Zones & MPAs into MongoDB...');
          const { syncAuthoritativeGisLayers } = require('../scripts/seed-all-indian-zones');
          await syncAuthoritativeGisLayers();
        } else {
          logger.info({ authoritative_zones: authCount }, '[server] [gis-sync] Authoritative maritime zones active in MongoDB');
        }
      } catch (e) {
        logger.warn({ err: e.message }, '[server] [gis-sync] Background GIS check warning');
      }
    }, 2000);

    // --- 5. Proactive Alert Surveillance Scheduler -------------------------
    if (process.env.ENABLE_EMBEDDED_WORKER !== 'false') {
      const alertScheduler = require('./modules/alerts/scheduler');
      alertScheduler.start();
      logger.info(
        { cron: limits.ALERT_SCHEDULER_CRON },
        '[server] [alerts] Proactive alert surveillance scheduler active'
      );
    }
  } catch (err) {
    logger.fatal({ err: err.message, stack: err.stack }, '[server] Failed to start');
    process.exit(1);
  }
}

/**
 * Graceful shutdown.
 *
 * WHY THIS MATTERS: without it, SIGTERM kills the process mid-request and
 * mid-write. Draining first means in-flight analyses finish being persisted
 * rather than being lost halfway through a save.
 */
async function shutdown(signal) {
  logger.info({ signal }, '[server] Shutdown signal received - draining');

  // Force-exit guard: if draining hangs (a stuck socket), do not hang forever.
  const forceExit = setTimeout(() => {
    logger.error('[server] Graceful shutdown timed out - forcing exit');
    process.exit(1);
  }, 15000);

  try {
    if (pfzCronTask) {
      pfzCronTask.stop();
    }
    try {
      const alertScheduler = require('./modules/alerts/scheduler');
      alertScheduler.stop();
    } catch (_) {}
    if (internalServer) {
      await new Promise((resolve) => internalServer.close(resolve));
      logger.info('[server] Internal HTTP server closed');
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('[server] HTTP server closed');
    }
    await disconnect();
    clearTimeout(forceExit);
    logger.info('[server] Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message }, '[server] Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C

// An unhandled rejection means a promise failed with nobody catching it. The
// process state is now unknown, so we log loudly and exit rather than limping
// on and producing wrong answers.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason: reason?.message || reason }, '[server] Unhandled promise rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, '[server] Uncaught exception');
  process.exit(1);
});

start();
