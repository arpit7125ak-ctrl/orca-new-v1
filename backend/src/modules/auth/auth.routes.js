// src/modules/auth/auth.routes.js
// ---------------------------------------------------------------------------
// STATUS: PROPOSED.
// Section 103 lists no auth endpoints, but Section 99.12 defines a `users`
// collection with roles and invite codes. These routes are a minimal, honest
// implementation of that collection - flagged so nobody mistakes them for
// specified behaviour.
//
// These are OPTIONAL: with REQUIRE_AUTH unset, every other endpoint works
// anonymously, which is what makes the API demo-able without registration.
// ---------------------------------------------------------------------------

const express = require('express');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', controller.register);
router.get('/me', controller.me);
router.patch('/me', controller.updateProfile);

module.exports = router;
