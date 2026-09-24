/**
 * ============================================================================
 * ORCA Dedicated Internal Gateway Server (src/internal-server.js)
 * ============================================================================
 * Dedicated micro-server handling inter-service webhook callbacks from Python AI-Service.
 * 
 * Endpoints Hosted (Port 4100):
 * - POST /internal/v1/progress : Real-time pipeline progress updates per agent
 * - POST /internal/v1/result   : Final comprehensive analysis result delivery
 * - GET  /health               : Dedicated liveness check for inter-service health monitors
 * 
 * Security & Isolation Architecture (Architecture Spec §102, §103):
 * 1. Port Segregation: Bound separately to Port 4100 to prevent public reverse-proxy exposure.
 * 2. Zero Browser CORS: CORS is omitted entirely so browsers automatically block cross-origin requests.
 * 3. HMCA/Internal Token Auth: Requires signed short-lived Authorization tokens (INTERNAL_API_KEY).
 * 4. High-Capacity Body Parser: Configured with 25MB JSON buffer to accommodate full multi-agent
 *    vector and raster outputs without truncation.
 */

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

if (require.main === module) {
  start();
}

module.exports = { createInternalApp, start };
