/**
 * @fileoverview Report Routes
 * Defines the Express router for fetching generated shareable advisories.
 *
 * @module report.routes
 */

// src/modules/report/report.routes.js
// Section 103: GET /api/v1/report/:analysis_id

const express = require('express');
const { getReport } = require('./report.controller');

const router = express.Router();

router.get('/:analysis_id', getReport);

module.exports = router;
