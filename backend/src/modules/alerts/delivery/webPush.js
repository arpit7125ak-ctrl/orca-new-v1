// src/modules/alerts/delivery/webPush.js
// ---------------------------------------------------------------------------
// Web Push delivery using VAPID keys from .env.
//
// Section 102: the Backend holds the credentials; the Frontend only ever
// registers a push subscription. VAPID_PRIVATE_KEY never leaves the server and
// is in the logger redaction list.
//
// NEVER-FABRICATE NOTE: when VAPID keys are not configured, send() returns
// { delivered: false, reason: 'not_configured' }. It never reports a successful
// send that did not happen - a false "alert sent" is worse than no alert,
// because it creates false confidence that a warning was received.
// ---------------------------------------------------------------------------

const webpush = require('web-push');
const env = require('../../../config/env');
const { logger } = require('../../../observability/logger');

const isConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  logger.info('[webPush] VAPID configured - push delivery enabled');
} else {
  logger.warn(
    '[webPush] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set. ' +
    'Push alerts will be recorded but NOT delivered. Generate keys with: npx web-push generate-vapid-keys'
  );
}

/**
 * Deliver one push notification.
 * Never throws - a delivery failure must not crash the alert worker mid-run.
 *
 * @returns {{ delivered: boolean, reason?: string, error?: string, statusCode?: number }}
 */
async function send(pushSubscription, { title, body, data = {} }) {
  if (!isConfigured) {
    return { delivered: false, reason: 'not_configured' };
  }

  if (!pushSubscription || !pushSubscription.endpoint) {
    return { delivered: false, reason: 'no_push_subscription' };
  }

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title,
        body,
        data: { ...data, timestamp: new Date().toISOString() },
      })
    );
    return { delivered: true };
  } catch (err) {
    // 404/410 means the browser subscription is dead (user cleared data,
    // uninstalled the PWA). The caller should deactivate the subscription
    // rather than retrying it forever.
    const isGone = err.statusCode === 404 || err.statusCode === 410;

    logger.warn(
      { statusCode: err.statusCode, endpoint: pushSubscription.endpoint?.slice(0, 50) },
      isGone
        ? '[webPush] Push subscription is no longer valid'
        : '[webPush] Push delivery failed'
    );

    return {
      delivered: false,
      reason: isGone ? 'subscription_expired' : 'delivery_failed',
      error: err.message,
      statusCode: err.statusCode || null,
    };
  }
}

module.exports = { send, isConfigured };
