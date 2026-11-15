/**
 * src/routes/movie.routes.js — Movie Endpoints
 *
 * PUBLIC:
 *   GET    /api/movies          - List movies with pagination & filters
 *   GET    /api/movies/:id      - Movie details
 *   GET    /api/movies/:id/shows- Shows for movie
 *
 * ADMIN:
 *   POST   /api/movies          - Create movie
 *   PATCH  /api/movies/:id      - Update movie
 *   DELETE /api/movies/:id      - Soft deactivate movie
 */

'use strict';

const express = require('express');
const {
  getMovies,
  getMovieById,
  getMovieShows,
  createMovie,
  updateMovie,
  deleteMovie,
} = require('../controllers/movie.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getMovies);
router.get('/:id', getMovieById);
router.get('/:id/shows', getMovieShows);

// Admin-protected routes
router.post('/', authenticate, authorize('ADMIN'), createMovie);
router.patch('/:id', authenticate, authorize('ADMIN'), updateMovie);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteMovie);

module.exports = router;
