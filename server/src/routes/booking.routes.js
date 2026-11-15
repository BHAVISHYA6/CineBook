/**
 * src/routes/booking.routes.js — Booking & Reservation Endpoints
 *
 * All routes require JWT authentication.
 *
 * ENDPOINTS:
 *   POST /api/bookings/reserve      - Lock seats for a show (temporary reservation)
 *   POST /api/bookings/:id/release  - Release locked seats & cancel pending reservation
 *   GET  /api/bookings/:id          - Retrieve reservation details & countdown
 */

'use strict';

const express = require('express');
const {
  reserveSeats,
  releaseReservation,
  getBookingStatus,
} = require('../controllers/booking.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all reservation routes
router.use(authenticate);

router.post('/reserve', reserveSeats);
router.post('/:id/release', releaseReservation);
router.get('/:id', getBookingStatus);

module.exports = router;
