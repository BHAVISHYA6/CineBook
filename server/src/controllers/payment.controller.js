/**
 * src/controllers/payment.controller.js — Payment & Webhook Controllers
 */

'use strict';

const paymentService = require('../services/payment.service');

/**
 * POST /api/payments/create-order
 * Create or reuse a Razorpay order for an authenticated pending reservation.
 */
async function createOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const { bookingId } = req.body;

    const orderDetails = await paymentService.createPaymentOrder({
      bookingId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: orderDetails,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/verify
 * Verify payment signature and permanently confirm booking.
 */
async function verify(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    const result = await paymentService.verifyPayment({
      bookingId,
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/webhook
 * Handle asynchronous notifications from Razorpay with signature check & deduplication.
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    // rawBody attached by raw express body parser or stringified payload
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await paymentService.processWebhook(rawBody, signature);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  verify,
  handleWebhook,
};
