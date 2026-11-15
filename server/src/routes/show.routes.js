/**
 * src/routes/show.routes.js — Show and ShowSeat Endpoints
 *
 * PUBLIC:
 *   GET  /api/shows/:id        - Show details (movie, screen, theatre, timing)
 *   GET  /api/shows/:id/seats  - Show seat layout & availability
 *
 * ADMIN:
 *   POST /api/shows            - Schedule show and initialize ShowSeat inventory
 */

'use strict';

const express = require('express');
const {
  getShowById,
  getShowSeats,
  createShow,
} = require('../controllers/show.controller');
const { reserveSeats } = require('../controllers/booking.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/:id', getShowById);
router.get('/:id/seats', getShowSeats);

// Authenticated user reservation endpoint
router.post('/:showId/reserve', authenticate, reserveSeats);

// Admin-protected routes
router.post('/', authenticate, authorize('ADMIN'), createShow);

module.exports = router;
