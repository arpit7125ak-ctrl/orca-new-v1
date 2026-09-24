/**
 * @fileoverview Authentication & User Profile Express Router
 * @module modules/auth/auth.routes
 * @description
 * Section 99.12 (User Profile Endpoints):
 * Exposes endpoints for user registration, identity retrieval, and profile preferences:
 * - `POST /api/v1/auth/register`: Create user via invite code.
 * - `GET /api/v1/auth/me`: Fetch authenticated user profile.
 * - `PATCH /api/v1/auth/me`: Update vessel, activity, and language preferences.
 */

const express = require('express');

const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', controller.register);
router.get('/me', controller.me);
router.patch('/me', controller.updateProfile);

module.exports = router;
