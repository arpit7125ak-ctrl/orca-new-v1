/**
 * @fileoverview Central Environment Configuration Loader
 * @module config/env
 * @description
 * Loads environment variables from the `.env` file via `dotenv`, validates
 * all strictly mandatory configurations at server startup, applies sensible
 * production defaults for optional items, and exports a deeply immutable
 * (frozen) configuration object for consumption across the entire backend.
 *
 * Design Guarantees:
 * - Fail-Fast Startup: Any missing critical credential or URI immediately aborts
 *   process execution with a descriptive error message before any network listener binds.
 * - Single Source of Truth: Prohibits scattered, ad-hoc `process.env.*` reads across
 *   controllers, services, or database layers.
 */

// Load local environment overrides from .env into process.env
require('dotenv').config();

/**
 * Array of mandatory environment variable keys.
 * If any of these are unset or empty strings, the backend will fail fast at startup.
 * @constant {string[]}
 */
const REQUIRED_VARS = [
  'MONGO_URI',
  'AI_SERVICE_URL',
  'INTERNAL_SECRET',
  'JWT_SECRET',
];

/**
 * Retrieves a mandatory environment variable or throws a fatal startup exception.
 *
 * @param {string} name - Name of the environment variable to look up.
 * @returns {string} The non-empty string value of the environment variable.
 * @throws {Error} If the variable is undefined or an empty string.
 */
function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
      `Copy .env.example to .env and fill in real values.`
    );
  }
  return value;
}

/**
 * Retrieves an optional environment variable with a fallback default.
 *
 * @param {string} name - Name of the environment variable to look up.
 * @param {string} fallback - Default fallback value if variable is missing or blank.
 * @returns {string} The resolved string value or the provided fallback.
 */
function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

// Fail fast, once, at startup — not partway through a request.
for (const name of REQUIRED_VARS) {
  requireEnv(name);
}

const env = Object.freeze({
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',

  // Public API server (Frontend-facing)
  PORT: parseInt(optionalEnv('PORT', '4000'), 10),

  // Internal API server (AI Service-facing only)
  INTERNAL_PORT: parseInt(optionalEnv('INTERNAL_PORT', '4100'), 10),
  INTERNAL_SECRET: requireEnv('INTERNAL_SECRET'),

  // MongoDB
  MONGO_URI: requireEnv('MONGO_URI'),

  // AI Service
  AI_SERVICE_URL: requireEnv('AI_SERVICE_URL'),

  // CORS
  ALLOWED_ORIGINS: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  // Auth (NEW/PROPOSED — see architecture doc flag on auth module)
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),

  // Web Push (alert delivery)
  VAPID_PUBLIC_KEY: optionalEnv('VAPID_PUBLIC_KEY', ''),
  VAPID_PRIVATE_KEY: optionalEnv('VAPID_PRIVATE_KEY', ''),
  VAPID_SUBJECT: optionalEnv('VAPID_SUBJECT', 'mailto:team@example.com'),

  // Bhashini (Government of India AI Language Services - ULCA / Dhruva)
  BHASHINI_CONFIG_URL: optionalEnv(
    'BHASHINI_CONFIG_URL',
    'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline'
  ),
  BHASHINI_PIPELINE_ID: optionalEnv('BHASHINI_PIPELINE_ID', '64392f96daac500b55c543cd'),
  BHASHINI_UDYAT_KEY: optionalEnv('BHASHINI_UDYAT_KEY', ''),
  BHASHINI_APP_ID: optionalEnv('BHASHINI_APP_ID', ''),
  BHASHINI_INFERENCE_KEY: optionalEnv('BHASHINI_INFERENCE_KEY', ''),

  // Logging
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),

  // External Data Feeds (Overridable via .env)
  INCOIS_WFS_URL: optionalEnv(
    'INCOIS_WFS_URL',
    'https://incois.gov.in/geoserver/PFZ_Automation/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json'
  ),
});

module.exports = env;
