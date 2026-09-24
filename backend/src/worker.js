/**
 * ============================================================================
 * ORCA Dedicated Background Alert & PFZ Worker (src/worker.js)
 * ============================================================================
 * Dedicated background process executing proactive alert evaluation passes
 * and external data synchronization crons.
 * 
 * Process Decoupling Architecture (Architecture Spec §12, §70):
 * 1. Deduplication Protection: If alert schedulers ran inside clustered API processes,
 *    subscribers would receive duplicate notifications for each instance. Isolating
 *    the scheduler into this dedicated worker guarantees single-execution semantics.
 * 2. Zero-Interruption Deployments: Public API gateways can be restarted or redeployed
 *    without aborting in-flight alert checks or PFZ polygon downloads.
 * 3. Scheduled Tasks:
 *    - Alert Evaluation Scheduler: Recurring polling against live sensor streams.
 *    - INCOIS PFZ Daily Sync: Pulls Potential Fishing Zone advisories daily at 20:00 IST.
 * 4. Resilient Error Handling: Catches unhandled promise rejections and continues execution
 *    so one failed notification never terminates background protection for other vessels.
 */

const cron = require('node-cron');
const { connect, disconnect } = require('./db/connection');
const scheduler = require('./modules/alerts/scheduler');
const { syncPfzFromIncois } = require('./modules/pfz/pfzSync.service');
const { logger } = require('./observability/logger');
const limits = require('./config/limits');

require('./db/models'); // register models + indexes

let pfzTask = null;

async function start() {
  try {
    await connect();

    logger.info(
      { dispatch_cron: limits.ALERT_SCHEDULER_CRON },
      '[worker] ORCA alert worker starting'
    );

    scheduler.start();

    // Daily INCOIS Potential Fishing Zone (PFZ) sync scheduled at 20:00 (8:00 PM) IST
    pfzTask = cron.schedule(
      limits.PFZ_SYNC_CRON,
      async () => {
        logger.info('[worker] [pfz-sync] Starting scheduled daily INCOIS PFZ sync...');
        try {
          const res = await syncPfzFromIncois();
          logger.info({ res }, '[worker] [pfz-sync] Daily INCOIS PFZ sync completed');
        } catch (err) {
          logger.error({ err: err.message }, '[worker] [pfz-sync] Daily INCOIS PFZ sync failed');
        }
      },
      { timezone: 'Asia/Kolkata' }
    );

    logger.info(
      { cron: limits.PFZ_SYNC_CRON, timezone: 'Asia/Kolkata' },
      '[worker] [pfz-sync] Daily INCOIS PFZ sync registered'
    );

    logger.info('[worker] Alert worker running. Press Ctrl+C to stop.');
  } catch (err) {
    logger.fatal({ err: err.message }, '[worker] Failed to start');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, '[worker] Shutting down');
  // Stop the crons FIRST so no new pass begins while tearing down the DB connection
  if (pfzTask) {
    pfzTask.stop();
  }
  scheduler.stop();
  await disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // The worker logs and KEEPS RUNNING rather than exiting. One failed
  // subscription check must not take down proactive alerting for everyone.
  logger.error({ reason: reason?.message || reason }, '[worker] Unhandled rejection - continuing');
});

start();
