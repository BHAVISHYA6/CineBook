/**
 * src/routes/theatre.routes.js — Theatre and Screen Endpoints
 *
 * PUBLIC:
 *   GET  /api/theatres              - List theatres (optional city filter)
 *   GET  /api/theatres/:id          - Theatre details including screens
 *
 * ADMIN:
 *   POST /api/theatres              - Create theatre
 *   POST /api/theatres/:id/screens  - Create screen & seat layout
 */

'use strict';

const express = require('express');
const {
  getTheatres,
  getTheatreById,
  createTheatre,
  updateTheatre,
  deleteTheatre,
  createScreen,
} = require('../controllers/theatre.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getTheatres);
router.get('/:id', getTheatreById);

// Admin-protected routes
router.post('/', authenticate, authorize('ADMIN'), createTheatre);
router.patch('/:id', authenticate, authorize('ADMIN'), updateTheatre);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteTheatre);
router.post('/:id/screens', authenticate, authorize('ADMIN'), createScreen);

module.exports = router;
