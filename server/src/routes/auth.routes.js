/**
 * src/routes/auth.routes.js — Authentication Routes
 *
 * MOUNTED AT:
 *   /api/auth (and /api/v1/auth)
 *
 * ENDPOINTS:
 *   POST /register  - Register new user
 *   POST /login     - Login user and obtain JWT
 *   GET  /me        - Fetch authenticated user profile (protected)
 */

'use strict';

const express = require('express');
const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);

module.exports = router;
