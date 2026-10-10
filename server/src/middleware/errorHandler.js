/**
 * src/middleware/errorHandler.js — Centralized Error Handling Middleware
 *
 * WHY CENTRALIZED:
 *   Without a central error handler, each route catches its own errors
 *   differently — some send 500 with stack traces, others 400 with HTML.
 *   A single Express error middleware (4 arguments: err, req, res, next)
 *   ensures every error path returns consistent JSON and NEVER leaks
 *   internal details (stack traces, database queries) to clients.
 *
 * HOW EXPRESS ERROR MIDDLEWARE WORKS:
 *   In Express, any middleware or route can call next(err) or throw inside
 *   an async wrapper to trigger the error pipeline. Express identifies an
 *   error handler by the presence of FOUR parameters.
 *
 * AppError:
 *   A custom error class that carries an HTTP status code. Routes throw
 *   AppError when the input is invalid or a resource is not found.
 *   Generic JavaScript errors (unexpected conditions) default to 500.
 */

'use strict';

const { config } = require('../config/env');

/**
 * AppError — Custom error class for known, intentional HTTP errors.
 * Carry statusCode so the error handler can use it directly.
 *
 * Usage:
 *   throw new AppError('Movie not found', 404);
 *   throw new AppError('Email already registered', 409);
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable error message sent to the client.
   * @param {number} statusCode - HTTP status code (e.g., 400, 404, 409, 500).
   * @param {string} [code]    - Optional machine-readable error code for clients.
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'APP_ERROR';
    this.isOperational = true; // Marks errors we expect vs unexpected crashes.
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * notFoundHandler — Middleware for routes that don't match any registered handler.
 * Must be registered AFTER all routes in app.js.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

/**
 * errorHandler — Central error-handling middleware (4-argument signature required by Express).
 * Converts any error into a consistent JSON response. Never exposes stack traces in production.
 *
 * Response format:
 *   {
 *     "success": false,
 *     "error": {
 *       "code": "APP_ERROR",
 *       "message": "Human readable message"
 *     }
 *   }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error for unexpected errors.
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log unexpected (non-operational) errors for debugging.
  if (!err.isOperational) {
    console.error('💥 Unexpected error:', err);
  }

  // Prisma error handling — translate known Prisma error codes to HTTP responses.
  // P2002: Unique constraint violation (e.g., duplicate email, duplicate show seat).
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A record with this data already exists.',
        // In development, include the Prisma meta for debugging.
        ...(config.isDevelopment && { fields: err.meta?.target }),
      },
    });
  }

  // P2025: Record not found (e.g., findUniqueOrThrow failed).
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.meta?.cause || 'Requested record not found.',
      },
    });
  }

  // P2003: Foreign key constraint failed.
  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist.',
      },
    });
  }

  // Standard error response.
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'An unexpected error occurred.',
      // Only include stack trace in development — NEVER in production.
      ...(config.isDevelopment && { stack: err.stack }),
    },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
