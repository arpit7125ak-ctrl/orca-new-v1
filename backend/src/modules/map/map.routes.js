/**
 * @fileoverview Map GIS Layers Express Router
 * @module modules/map/map.routes
 * @description
 * Section 103:
 * Mounts public endpoints for maritime GIS boundary layers (`GET /api/v1/map/layers`).
 */

const express = require('express');
const { getLayers } = require('./map.controller');

const router = express.Router();

router.get('/layers', getLayers);

module.exports = router;
