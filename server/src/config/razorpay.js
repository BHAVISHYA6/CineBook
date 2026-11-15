/**
 * src/config/razorpay.js — Razorpay SDK Instance
 *
 * Configures the official Razorpay Node.js SDK using test credentials.
 * Secrets are securely kept on the backend and NEVER exposed to clients.
 */

'use strict';

const Razorpay = require('razorpay');
const { config } = require('./env');

const razorpayClient = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

module.exports = razorpayClient;
