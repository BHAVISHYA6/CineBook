/**
 * src/routes/auth.routes.js — Authentication Routes (Enhanced for Phase 8)
 *
 * ENDPOINTS:
 *   POST /register-otp  - Initiate OTP registration (generates & logs/emails OTP)
 *   POST /verify-otp    - Verify OTP and complete registration
 *   POST /register      - Direct registration
 *   POST /login         - Authenticate and receive Access + Refresh tokens
 *   POST /refresh       - Refresh access token using valid refresh token
 *   POST /logout        - Invalidate refresh token and logout
 *   GET  /me            - Fetch authenticated user profile
 */

'use strict';

const express = require('express');
const {
  initiateRegistration,
  verifyRegistration,
  register,
  login,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register-otp', initiateRegistration);
router.post('/verify-otp', verifyRegistration);
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
