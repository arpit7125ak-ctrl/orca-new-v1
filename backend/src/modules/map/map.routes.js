// src/modules/map/map.routes.js
// Section 103: GET /api/v1/map/layers

const express = require('express');
const { getLayers } = require('./map.controller');

const router = express.Router();

router.get('/layers', getLayers);

module.exports = router;
