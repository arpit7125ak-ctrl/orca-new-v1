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

const env = require('./config/env');
const { connect, disconnect } = require('./db/connection');
const createApp = require('./app');
const { logger } = require('./observability/logger');

// Requiring the barrel registers all 12 models with Mongoose, which is what
// triggers index creation. Without this, a model only used by a rarely-hit
// route would never have its indexes built.
require('./db/models');

let server = null;

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

    // Node's default header timeout can cut off slow mobile uploads (voice
    // audio over a weak connection), so it is raised here.
    server.headersTimeout = 65000;
    server.keepAliveTimeout = 60000;
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
