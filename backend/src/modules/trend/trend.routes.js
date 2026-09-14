// src/modules/trend/trend.routes.js
// Section 103: POST /api/v1/trend

const express = require('express');
const validateContract = require('../../middleware/validateContract');
const { createTrend } = require('./trend.controller');
const { analysisLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/', analysisLimiter, validateContract('api/TrendRequest.json'), createTrend);

module.exports = router;
