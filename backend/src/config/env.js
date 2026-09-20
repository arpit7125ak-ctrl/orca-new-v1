// src/config/env.js
// Loads .env, fails fast if anything required is missing, and hands the rest
// of the app a single frozen config object instead of scattering
// `process.env.X` reads everywhere.

require('dotenv').config();

const REQUIRED_VARS = [
  'MONGO_URI',
  'AI_SERVICE_URL',
  'INTERNAL_SECRET',
  'JWT_SECRET',
];

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

  // Bhashini (voice proxy)
  BHASHINI_API_URL: optionalEnv('BHASHINI_API_URL', ''),
  BHASHINI_API_KEY: optionalEnv('BHASHINI_API_KEY', ''),

  // Logging
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),

  // External Data Feeds (Overridable via .env)
  INCOIS_WFS_URL: optionalEnv(
    'INCOIS_WFS_URL',
    'https://incois.gov.in/geoserver/PFZ_Automation/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json'
  ),
});

module.exports = env;
