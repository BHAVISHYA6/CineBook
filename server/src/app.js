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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── REQUEST LOGGING ──────────────────────────────────────────────────────────
// morgan 'dev' format: METHOD url status response-time — readable for development.
// 'combined' (Apache log format) is better for production log aggregation.
if (!config.isTest) {
  // Suppress request logs during tests to keep test output clean.
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
// API versioning via /api/v1 prefix. Allows breaking changes in a future v2.
app.use('/health', healthRoutes);

// Placeholder: future route modules will be mounted here in later phases.
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/movies', movieRoutes);
// app.use('/api/v1/shows', showRoutes);
// app.use('/api/v1/bookings', bookingRoutes);

// ─── ERROR HANDLING (MUST BE LAST) ────────────────────────────────────────────
// 404 for any route that didn't match above.
app.use(notFoundHandler);
// Central error handler — converts all errors to consistent JSON responses.
app.use(errorHandler);

module.exports = app;
