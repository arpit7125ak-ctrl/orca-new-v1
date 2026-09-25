/**
 * ============================================================================
 * ORCA Public Express Application Factory (src/app.js)
 * ============================================================================
 * Constructs and configures the public-facing Express HTTP application.
 * 
 * Architectural Isolation (Architecture Spec §2.1.4, §102):
 * - Serves frontend requests on Port 4000.
 * - Internal AI-Service callbacks (/api/v1/internal/*) are NOT mounted here;
 *   they are isolated on Port 4100 in src/internal-server.js.
 * 
 * Strict Middleware Pipeline Order:
 * 1. requestId: Generates X-Request-ID for distributed tracing across logs.
 * 2. helmet: Hardens HTTP security headers (HSTS, frameguard, XSS filter).
 * 3. cors: Enforces strict origin whitelist.
 * 4. compression: Gzip/Deflate compression for low-bandwidth marine mobile connections.
 * 5. body-parsers: express.json() with strict 10MB upload ceiling.
 * 6. sanitize: Recursively strips NoSQL injection keys ($gt, $ne, etc.) from req.body.
 * 7. attachUser: Decodes session tokens / role credentials.
 * 8. generalLimiter: IP-based sliding window rate limiter.
 * 9. Route Modules: Mounts all 10 domain controllers under /api/v1/*.
 * 10. notFound & errorHandler: Standardized JSON error response formatting.
 */

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const registry = require('./config/registry');
const corsMiddleware = require('./middleware/cors');
const sanitize = require('./middleware/sanitize');
const { generalLimiter } = require('./middleware/rateLimit');
const { attachUser } = require('./middleware/roleGuard');
const errorHandler = require('./middleware/errorHandler');
const { requestId, notFound } = require('./middleware/errorHandler');
const { logger } = require('./observability/logger');
const contracts = require('./middleware/validateContract');
const aiServiceClient = require('./clients/aiService.client');
const bhashini = require('./clients/bhashini.client');
const mongoose = require('mongoose');

// Route modules (Section 103)
const analysisRoutes = require('./modules/analysis/analysis.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const mapRoutes = require('./modules/map/map.routes');
const geofenceRoutes = require('./modules/geofence/geofence.routes');
const routeRoutes = require('./modules/route/route.routes');
const reportRoutes = require('./modules/report/report.routes');
const trendRoutes = require('./modules/trend/trend.routes');
const alertRoutes = require('./modules/alerts/subscriptions.routes');
const voiceRoutes = require('./modules/voice/voice.routes');
const authRoutes = require('./modules/auth/auth.routes'); // PROPOSED

function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx, Render, Railway) this makes req.ip the real
  // client IP rather than the proxy's, which matters for rate limiting.
  app.set('trust proxy', 1);

  // --- 1. Request ID -----------------------------------------------------
  app.use(requestId);

  // --- 2. Security headers ----------------------------------------------
  // contentSecurityPolicy is disabled because this process serves JSON only,
  // never HTML - a CSP here would protect nothing and complicates the demo.
  app.use(helmet({ contentSecurityPolicy: false }));

  // --- 3. CORS (Section 102) --------------------------------------------
  app.use(corsMiddleware);

  // gzip - map layer GeoJSON is large and compresses extremely well.
  app.use(compression());

  // --- 4. Body parsing ---------------------------------------------------
  // 12mb because voice queries carry base64 audio (the voice controller caps
  // audio at 10mb; the extra headroom covers JSON overhead).
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // --- 5. Sanitisation ---------------------------------------------------
  app.use(sanitize);

  // --- 6. Identity (optional - see roleGuard.js) -------------------------
  app.use(attachUser);

  // --- Health endpoints (BEFORE the rate limiter) ------------------------
  // Deliberately not rate limited: a monitoring probe must never be throttled,
  // and a 429 on /health would look like an outage.

  /**
   * GET /health - liveness. Answers "is this process up?"
   * Always 200 if the process can respond at all.
   */
  const healthHandler = async (req, res) => {

    // Optional probe of external AI service; must never throw unhandled rejection
    try {
      const aiHealthUrl = "https://orca-ai-service-b0fx.onrender.com/health";
      const resai = await fetch(aiHealthUrl, { signal: AbortSignal.timeout(3000) });
      const aiData = await resai.json();
      console.log('AI Health Data:', aiData);
    } catch (e) {
      // Gracefully ignore external connection drops / timeouts
    }

    res.status(200).json({
      status: 'ok',
      service: 'orca-backend',
      env: env.NODE_ENV,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  /**
   * GET /health/ready - readiness. Answers "can this process do useful work?"
   *
   * Returns 503 when MongoDB is down, because without the database every
   * endpoint would fail anyway. The AI Service being unreachable is reported
   * but does NOT fail readiness - the Backend can still serve stored results,
   * map layers and geofence checks without it.
   */
  app.get('/health/ready', async (req, res) => {
    // mongoose.connection.readyState: 1 = connected
    const mongoConnected = mongoose.connection.readyState === 1;
    const aiService = await aiServiceClient.healthCheck();

    const ready = mongoConnected;

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks: {
        mongodb: { connected: mongoConnected, state: mongoose.connection.readyState },
        // Reported honestly, but not a readiness blocker - see note above.
        ai_service: aiService,
        bhashini: { configured: bhashini.isConfigured },
        contracts: { loaded: contracts.isLoaded(), count: contracts.loadedCount() },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/config - the configuration-driven lists from Sections 7.6-7.8.
   * Lets the Frontend build its dropdowns from the SAME source the Backend
   * validates against, so the two can never drift out of sync.
   */
  app.get('/api/v1/config', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        activities: registry.activities,
        vessel_types: registry.vesselTypes,
        languages: registry.languages,
        canonical_units: registry.canonicalUnits,
        web_push: {
          enabled: Boolean(env.VAPID_PUBLIC_KEY),
          vapid_public_key: env.VAPID_PUBLIC_KEY || null,
        },
      },
    });
  });

  // --- 7. Rate limiting --------------------------------------------------
  // Route-specific limiters (analysis, geofence) are applied inside their own
  // route files and override this general one.
  app.use('/api/', generalLimiter);

  // --- 8. Routes (Section 103) -------------------------------------------
  app.use('/api/v1/analysis', analysisRoutes);
  app.use('/api/v1/chat', chatRoutes);
  app.use('/api/v1/map', mapRoutes);
  app.use('/api/v1/geofence', geofenceRoutes);
  app.use('/api/v1/route', routeRoutes);
  app.use('/api/v1/report', reportRoutes);
  app.use('/api/v1/trend', trendRoutes);
  app.use('/api/v1/alerts', alertRoutes);
  app.use('/api/v1/voice', voiceRoutes);
  app.use('/api/v1/auth', authRoutes); // PROPOSED

  // Internal routes (Protected by internalAuth token verification)
  const internalRoutes = require('./modules/internal/internal.routes');
  app.use('/internal/v1', internalRoutes);

  // --- 9 & 10: 404 then the central error handler ------------------------
  app.use(notFound);
  app.use(errorHandler);

  logger.info('[app] Express application configured');

  return app;
}

module.exports = createApp;
