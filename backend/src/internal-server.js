// src/internal-server.js
// ---------------------------------------------------------------------------
// ENTRY POINT for the INTERNAL server - the endpoints the AI Service calls back
// on (Section 103):
//   POST /internal/v1/progress
//   POST /internal/v1/result
//
//   npm run internal
//
// WHY A SEPARATE PROCESS AND PORT:
// Section 102 requires the internal channel to be protected. Running it on its
// own port means it can be bound to localhost or a private network and never
// exposed publicly, independently of the public API. Even if it WERE reachable,
// internalAuth still requires a signed short-lived token - defence in depth.
//
// It also isolates load: a burst of progress callbacks cannot starve the
// Frontend-facing API.
// ---------------------------------------------------------------------------

const express = require('express');
const helmet = require('helmet');

const env = require('./config/env');
const { connect, disconnect } = require('./db/connection');
const internalRoutes = require('./modules/internal/internal.routes');
const errorHandler = require('./middleware/errorHandler');
const { requestId, notFound } = require('./middleware/errorHandler');
const { logger } = require('./observability/logger');

require('./db/models'); // register models + indexes

let server = null;

function createInternalApp() {
  const app = express();

  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false }));

  // Result payloads carry every agent's output, so they are large.
  app.use(express.json({ limit: '25mb' }));

  // NO CORS here - a browser must never call these endpoints. Omitting CORS
  // entirely means the browser blocks any cross-origin attempt by default.

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'orca-backend-internal',
      uptime_seconds: Math.floor(process.uptime()),
    });
  });

  // internalAuth is applied inside internal.routes.js, covering every route.
  app.use('/internal/v1', internalRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function start() {
  try {
    await connect();
    const app = createInternalApp();

    server = app.listen(env.INTERNAL_PORT, () => {
      logger.info(
        { port: env.INTERNAL_PORT },
        `[internal-server] ORCA internal API listening on http://localhost:${env.INTERNAL_PORT}`
      );
      logger.info('[internal-server] Endpoints: POST /internal/v1/progress, POST /internal/v1/result');
    });
  } catch (err) {
    logger.fatal({ err: err.message }, '[internal-server] Failed to start');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, '[internal-server] Shutting down');
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

module.exports = { createInternalApp };
