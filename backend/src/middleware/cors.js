// src/middleware/cors.js
// ---------------------------------------------------------------------------
// Section 102: the ONLY caller of the public API is the Frontend.
// Frontend -> Backend -> AI Service. Never Frontend -> AI Service directly.
//
// So CORS is an allowlist, not a wildcard. ALLOWED_ORIGINS comes from .env
// (comma-separated) and is parsed in config/env.js.
// ---------------------------------------------------------------------------

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
