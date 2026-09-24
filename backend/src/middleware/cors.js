/**
 * @fileoverview Cross-Origin Resource Sharing (CORS) Security Middleware
 * @module middleware/cors
 * @description
 * Section 102 (Perimeter & Communication Topology):
 * Regulates browser origin access to the public API server.
 *
 * Operational Policy:
 * - Restrictive Whitelist: Origins must match `ALLOWED_ORIGINS` configured in `.env`.
 * - Non-Browser Clients: Requests without an `Origin` header (CLI tools, server-to-server,
 *   automated smoke tests) are permitted, with authentication enforced downstream by JWT guards.
 * - Header Exposition: Exposes `X-Request-Id` to allow frontend telemetry and support correlation.
 */

const cors = require('cors');
const env = require('../config/env');
const { logger } = require('../observability/logger');

const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header are non-browser clients: curl, Postman,
    // server-to-server, health checks. CORS is a BROWSER protection, so there
    // is nothing to protect here - allowing them is what makes Postman testing
    // work. Real authorisation is handled by auth middleware, not CORS.
    if (!origin) return callback(null, true);

    if (env.ALLOWED_ORIGINS.includes('*') || env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Log rather than silently reject - a blocked origin during the demo is
    // otherwise a very confusing "it just doesn't work" in the browser console.
    logger.warn({ origin, allowed: env.ALLOWED_ORIGINS }, '[cors] Blocked disallowed origin');
    return callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
  },

  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  // Lets the Frontend read our request-id header for support/debugging.
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400, // cache preflight for 24h
};

module.exports = cors(corsOptions);
module.exports.corsOptions = corsOptions;
