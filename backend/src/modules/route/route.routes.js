/**
 * @fileoverview Route Routes
 * Defines API endpoints for creating and fetching safe marine routes.
 *
 * @module route.routes
 */

// src/modules/route/route.routes.js
// Section 103: POST /api/v1/route, GET /api/v1/route/:route_id

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const controller = require('./route.controller');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// Route planning is the most expensive operation in the system (grid build +
// pathfinding), so it uses the tight analysis limiter.
router.post(
  '/',
  analysisLimiter,
  validateContract('api/RouteRequest.json'),
  controller.createRoute
);
router.get('/:route_id', controller.getRoute);

module.exports = router;
