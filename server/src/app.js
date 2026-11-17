/**
 * src/app.js — Express Application Configuration
 *
 * RESPONSIBILITY:
 *   This file creates and configures the Express app instance — middleware,
 *   route mounting, and error handling. It does NOT start the HTTP server.
 *   That responsibility belongs to server.js.
 *
 * WHY SPLIT app.js AND server.js:
 *   Separation lets us import `app` in tests without starting a real HTTP
 *   listener. Supertest uses the app object directly and manages its own
 *   port, which avoids port conflicts during testing.
 *
 * MIDDLEWARE ORDER MATTERS:
 *   1. Security/parsing middleware first (cors, json parser)
 *   2. Request logging (morgan)
 *   3. API routes
 *   4. 404 handler (after all routes so it catches unmatched paths)
 *   5. Error handler LAST (must be the final middleware)
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { config } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const movieRoutes = require('./routes/movie.routes');
const theatreRoutes = require('./routes/theatre.routes');
const showRoutes = require('./routes/show.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow the React dev server (and production build) to call this API.
// In production, restrict this to the exact frontend domain.
app.use(
  cors({
    origin: config.clientUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Allow cookies/auth headers
  })
);

// ─── BODY PARSERS ─────────────────────────────────────────────────────────────
// Parse incoming JSON request bodies. Limit size to prevent large payload attacks.
// Capture rawBody for accurate Razorpay webhook signature verification
app.use(
  express.json({
    limit: '10kb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── REQUEST LOGGING ──────────────────────────────────────────────────────────
// morgan 'dev' format: METHOD url status response-time — readable for development.
// 'combined' (Apache log format) is better for production log aggregation.
if (!config.isTest) {
  // Suppress request logs during tests to keep test output clean.
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);

// Auth endpoints mounted at /api/auth and versioned alias /api/v1/auth
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// Movie endpoints
app.use('/api/movies', movieRoutes);
app.use('/api/v1/movies', movieRoutes);

// Theatre and screen endpoints
app.use('/api/theatres', theatreRoutes);
app.use('/api/v1/theatres', theatreRoutes);

// Show endpoints
app.use('/api/shows', showRoutes);
app.use('/api/v1/shows', showRoutes);

// Booking and seat reservation endpoints
app.use('/api/bookings', bookingRoutes);
app.use('/api/v1/bookings', bookingRoutes);

// Payment endpoints (Razorpay order, verification, webhook)
app.use('/api/payments', paymentRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Admin dashboard & management endpoints
app.use('/api/admin', adminRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── ERROR HANDLING (MUST BE LAST) ────────────────────────────────────────────
// 404 for any route that didn't match above.
app.use(notFoundHandler);
// Central error handler — converts all errors to consistent JSON responses.
app.use(errorHandler);

module.exports = app;
