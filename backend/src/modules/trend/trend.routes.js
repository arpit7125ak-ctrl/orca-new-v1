/**
 * @fileoverview Trend Routes
 * Defines the Express router for trend analysis endpoints.
 * Includes rate limiting, contract validation, and controller mapping.
 * 
 * @module trend.routes
 */

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const { createTrend } = require('./trend.controller');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/', analysisLimiter, validateContract('api/TrendRequest.json'), createTrend);

module.exports = router;
