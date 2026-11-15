/**
 * src/middleware/auth.js — JWT Authentication & Authorization Middleware
 *
 * RESPONSIBILITY:
 *   - Verifies the incoming Bearer token from the Authorization header.
 *   - Fetches the active user from the database.
 *   - Attaches the sanitized user profile to `req.user`.
 *   - Provides role-based access control helper `authorize()`.
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('./errorHandler');
const { verifyToken, toSafeUser } = require('../utils/auth.utils');

/**
 * Middleware that authenticates requests using a JWT in the Authorization header.
 * Expects header format: Authorization: Bearer <token>
 * Attaches the authenticated safe user to `req.user`.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(
        new AppError('Authentication required: Bearer token is missing', 401, 'UNAUTHORIZED')
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(
        new AppError('Authentication required: Token is missing', 401, 'UNAUTHORIZED')
      );
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenErr) {
      return next(
        new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN')
      );
    }

    if (!decoded || !decoded.id) {
      return next(
        new AppError('Malformed token payload', 401, 'INVALID_TOKEN')
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return next(
        new AppError('User account associated with this token no longer exists', 401, 'USER_NOT_FOUND')
      );
    }

    // Attach safe user profile and id to request
    req.user = toSafeUser(user);
    req.userId = user.id;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based authorization middleware factory.
 * @param  {...string} allowedRoles - Permitted roles (e.g., 'ADMIN', 'USER')
 * @returns {Function} Express middleware handler
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required before authorization check', 401, 'UNAUTHORIZED')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: You do not have permission to access this resource', 403, 'FORBIDDEN')
      );
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
