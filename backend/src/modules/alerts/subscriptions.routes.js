/**
 * @fileoverview Subscriptions Routes
 * Defines API endpoints for creating, retrieving, updating, and deleting
 * alert subscriptions and their events.
 *
 * @module alerts.subscriptions.routes
 */

// src/modules/alerts/subscriptions.routes.js
// ---------------------------------------------------------------------------
// Section 103 - Alerts:
//   POST   /api/v1/alerts/subscriptions
//   GET    /api/v1/alerts/subscriptions/:id
//   PATCH  /api/v1/alerts/subscriptions/:id
//   DELETE /api/v1/alerts/subscriptions/:id
// ---------------------------------------------------------------------------

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const controller = require('./subscriptions.controller');

const router = express.Router();

router.post(
  '/subscriptions',
  validateContract('api/AlertSubscriptionRequest.json'),
  controller.createSubscription
);
router.get('/subscriptions/:id', controller.getSubscription);
router.get('/subscriptions/:id/events', controller.getEvents);
router.patch(
  '/subscriptions/:id',
  validateContract('api/AlertSubscriptionPatchRequest.json'),
  controller.updateSubscription
);
router.delete('/subscriptions/:id', controller.deleteSubscription);

module.exports = router;
