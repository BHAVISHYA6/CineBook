/**
 * src/controllers/booking.controller.js — Booking & Seat Reservation Controller
 *
 * Implements authenticated endpoints for locking seats, releasing seats,
 * and checking reservation/booking status.
 */

'use strict';

const seatLockService = require('../services/seatLock.service');

/**
 * POST /api/bookings/reserve (or /api/shows/:id/reserve)
 * Lock selected seats for a show under the authenticated user.
 */
async function reserveSeats(req, res, next) {
  try {
    const userId = req.user.id;
    const showId = req.params.showId || req.body.showId;
    const { seatIds } = req.body;

    const reservation = await seatLockService.lockSeats({
      showId,
      seatIds,
      userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Seats reserved successfully. Please complete payment before expiry.',
      data: {
        reservation,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/release
 * Release held seats and cancel pending reservation.
 */
async function releaseReservation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: bookingId } = req.params;

    const result = await seatLockService.releaseSeats({
      bookingId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Seats released and reservation cancelled successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings/:id
 * Retrieve reservation status and remaining hold time.
 */
async function getBookingStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: bookingId } = req.params;

    const result = await seatLockService.getReservationStatus(bookingId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  reserveSeats,
  releaseReservation,
  getBookingStatus,
};
