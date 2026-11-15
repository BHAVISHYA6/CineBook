/**
 * src/services/payment.service.js — Razorpay Payment & Webhook Service
 *
 * RESPONSIBILITY:
 *   1. Order Creation:
 *      - Creates Razorpay order for valid, unexpired PENDING bookings.
 *      - Reuses existing razorpayOrderId if one is already created (idempotent).
 *      - Records a PaymentAttempt with INITIATED status.
 *
 *   2. Payment Verification (HMAC SHA256):
 *      - Verifies `razorpay_signature` using `crypto.createHmac` with keySecret.
 *      - Ensures payment matches orderId and booking total.
 *      - Confirms booking inside an atomic PostgreSQL transaction.
 *      - Transitions ShowSeats from HELD to BOOKED.
 *      - Releases Redis locks and updates PaymentAttempt to SUCCESS.
 *
 *   3. Idempotency & Webhook Processing:
 *      - Uses `ProcessedWebhookEvent` table to prevent double-processing.
 *      - Verifies Razorpay webhook signature header (`x-razorpay-signature`).
 */

'use strict';

const crypto = require('crypto');
const prisma = require('../config/db');
const razorpay = require('../config/razorpay');
const { config } = require('../config/env');
const { releaseRedisLocks } = require('./seatLock.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * Creates or retrieves a Razorpay order for a pending reservation.
 *
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @returns {Promise<object>} Order details and public key_id
 */
async function createPaymentOrder({ bookingId, userId }) {
  if (!bookingId) {
    throw new AppError('bookingId is required', 400, 'VALIDATION_ERROR');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      show: { include: { movie: true } },
      showSeats: true,
    },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'NOT_FOUND');
  }

  // Security: Prevent paying for someone else's reservation
  if (booking.userId !== userId) {
    throw new AppError('Forbidden: You can only pay for your own reservation', 403, 'FORBIDDEN');
  }

  if (booking.status === 'CONFIRMED') {
    throw new AppError('This booking is already confirmed', 400, 'ALREADY_PAID');
  }

  if (booking.status === 'CANCELLED') {
    throw new AppError('This booking has been cancelled', 400, 'BOOKING_CANCELLED');
  }

  const now = new Date();
  if (booking.expiresAt && new Date(booking.expiresAt) <= now) {
    throw new AppError('Reservation hold has expired. Please select seats again.', 410, 'RESERVATION_EXPIRED');
  }

  // Idempotency: If Razorpay order already generated and booking is pending, reuse it
  if (booking.razorpayOrderId) {
    return {
      orderId: booking.razorpayOrderId,
      amountPaise: booking.totalAmountPaise,
      currency: 'INR',
      keyId: config.razorpay.keyId, // Only public key_id is sent to frontend
      bookingId: booking.id,
    };
  }

  // Create order with Razorpay in test mode
  // Razorpay accepts amount in paise (integer)
  let order;
  try {
    order = await razorpay.orders.create({
      amount: booking.totalAmountPaise,
      currency: 'INR',
      receipt: `rcpt_${booking.id.slice(-10)}`,
      notes: {
        bookingId: booking.id,
        userId: booking.userId,
        showId: booking.showId,
      },
    });
  } catch (err) {
    throw new AppError(`Payment provider error: ${err.message || 'Failed to create order'}`, 502, 'GATEWAY_ERROR');
  }

  // Update booking with razorpayOrderId and record PaymentAttempt inside transaction
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { razorpayOrderId: order.id },
    });

    await tx.paymentAttempt.create({
      data: {
        bookingId: booking.id,
        status: 'INITIATED',
        amountPaise: booking.totalAmountPaise,
        providerOrderId: order.id,
      },
    });
  });

  return {
    orderId: order.id,
    amountPaise: booking.totalAmountPaise,
    currency: 'INR',
    keyId: config.razorpay.keyId,
    bookingId: booking.id,
  };
}

/**
 * Verifies Razorpay HMAC SHA256 signature and confirms booking.
 *
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @returns {Promise<object>} Confirmed booking details
 */
async function verifyPayment({
  bookingId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError('Missing required payment verification parameters', 400, 'VALIDATION_ERROR');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { showSeats: true },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'NOT_FOUND');
  }

  if (booking.userId !== userId) {
    throw new AppError('Forbidden: Reservation ownership mismatch', 403, 'FORBIDDEN');
  }

  // Idempotency: If already confirmed, return success immediately
  if (booking.status === 'CONFIRMED') {
    return {
      success: true,
      message: 'Payment already verified and booking confirmed',
      booking,
    };
  }

  // Verify HMAC SHA256 signature: generatedSignature = HMAC_SHA256(order_id + "|" + payment_id, secret)
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');

  const isSignatureValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(razorpaySignature)
  );

  if (!isSignatureValid) {
    // Record failed attempt
    await prisma.paymentAttempt.create({
      data: {
        bookingId: booking.id,
        status: 'FAILED',
        amountPaise: booking.totalAmountPaise,
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        providerSignature: razorpaySignature,
        errorCode: 'SIGNATURE_VERIFICATION_FAILED',
      },
    });

    throw new AppError('Invalid payment signature verification failed', 400, 'PAYMENT_VERIFICATION_FAILED');
  }

  // Atomic PostgreSQL Transaction: Permanently book seats and confirm booking
  const confirmedBooking = await prisma.$transaction(async (tx) => {
    // 1. Update Booking status to CONFIRMED
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
      },
    });

    // 2. Permanently transition all show seats to BOOKED
    await tx.showSeat.updateMany({
      where: {
        bookingId: booking.id,
      },
      data: {
        status: 'BOOKED',
        heldUntil: null, // Clear temporary hold timestamp
      },
    });

    // 3. Record successful PaymentAttempt
    await tx.paymentAttempt.create({
      data: {
        bookingId: booking.id,
        status: 'SUCCESS',
        amountPaise: booking.totalAmountPaise,
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        providerSignature: razorpaySignature,
      },
    });

    return updated;
  });

  // 4. Release Redis temporary hold locks (seats are permanently allocated in DB)
  const seatIds = booking.showSeats.map((ss) => ss.seatId);
  await releaseRedisLocks(booking.showId, seatIds, userId);

  return {
    success: true,
    message: 'Payment verified and seats booked permanently',
    booking: confirmedBooking,
  };
}

/**
 * Handles incoming Razorpay Webhook events with signature verification and deduplication.
 *
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader
 * @returns {Promise<object>}
 */
async function processWebhook(rawBody, signatureHeader) {
  if (!signatureHeader) {
    throw new AppError('Missing webhook signature header', 400, 'INVALID_WEBHOOK');
  }

  // 1. Verify Webhook Signature
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signatureHeader)
  );

  if (!isValid) {
    throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
  }

  const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  const eventId = event.event_id || event.id || `evt_${Date.now()}`;
  const eventType = event.event;

  // 2. Idempotency Check: Prevent processing identical webhook event multiple times
  const existingEvent = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent) {
    return { status: 'already_processed', eventId };
  }

  // 3. Handle Supported Events (e.g. payment.captured, payment.failed)
  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = event.payload.payment ? event.payload.payment.entity : null;
    const orderId = paymentEntity ? paymentEntity.order_id : event.payload.order?.entity?.id;

    if (orderId) {
      const booking = await prisma.booking.findFirst({
        where: { razorpayOrderId: orderId },
        include: { showSeats: true },
      });

      if (booking && booking.status !== 'CONFIRMED') {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'CONFIRMED' },
          });

          await tx.showSeat.updateMany({
            where: { bookingId: booking.id },
            data: { status: 'BOOKED', heldUntil: null },
          });

          await tx.paymentAttempt.create({
            data: {
              bookingId: booking.id,
              status: 'SUCCESS',
              amountPaise: paymentEntity ? paymentEntity.amount : booking.totalAmountPaise,
              providerOrderId: orderId,
              providerPaymentId: paymentEntity ? paymentEntity.id : null,
            },
          });
        });

        // Release temporary locks
        const seatIds = booking.showSeats.map((s) => s.seatId);
        await releaseRedisLocks(booking.showId, seatIds, booking.userId);
      }
    }
  }

  // 4. Record event as processed
  await prisma.processedWebhookEvent.create({
    data: {
      eventId,
      eventType,
    },
  });

  return { status: 'processed', eventId };
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  processWebhook,
};
