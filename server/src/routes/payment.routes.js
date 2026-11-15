/**
 * src/routes/payment.routes.js — Razorpay Payment Endpoints
 *
 * ENDPOINTS:
 *   POST /api/payments/create-order  - Create Razorpay order (Authenticated)
 *   POST /api/payments/verify        - Verify signature & confirm booking (Authenticated)
 *   POST /api/payments/webhook       - Async provider notifications (Webhook signature verification)
 */

'use strict';

const express = require('express');
const {
  createOrder,
  verify,
  handleWebhook,
} = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public webhook route (verified via x-razorpay-signature header)
router.post('/webhook', handleWebhook);

// Authenticated user payment routes
router.post('/create-order', authenticate, createOrder);
router.post('/verify', authenticate, verify);

module.exports = router;
