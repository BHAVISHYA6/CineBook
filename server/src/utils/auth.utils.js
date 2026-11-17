/**
 * src/utils/auth.utils.js — Password Hashing and JWT Token Utilities
 *
 * RESPONSIBILITY:
 *   Handles cryptographic password hashing/comparison via bcryptjs and
 *   generation/verification of signed JSON Web Tokens (Access & Refresh tokens).
 *   Also provides a sanitizer to strip sensitive fields (password hash)
 *   from User records before returning them to clients.
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 * @param {string} password - Raw password string to hash.
 * @returns {Promise<string>} The hashed password string.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a candidate plaintext password against an existing bcrypt hash.
 * @param {string} candidatePassword - Password input from login request.
 * @param {string} hash - Stored bcrypt hash from database.
 * @returns {Promise<boolean>} True if match, false otherwise.
 */
async function comparePassword(candidatePassword, hash) {
  return bcrypt.compare(candidatePassword, hash);
}

/**
 * Signs an access JWT with the given payload using environment secret and expiration.
 * @param {object} payload - Claims to encode (e.g. { id, role }).
 * @returns {string} Signed JWT string.
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Signs a refresh JWT with the given payload using refresh secret and expiration.
 * @param {object} payload - Claims to encode (e.g. { id, role }).
 * @returns {string} Signed refresh JWT string.
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

/**
 * Verifies an access JWT token using the configured secret.
 * Throws an error if the token has expired, is malformed, or signature mismatch.
 * @param {string} token - Bearer JWT token string.
 * @returns {object} Decoded token payload.
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/**
 * Verifies a refresh JWT token using the configured refresh secret.
 * @param {string} token - Refresh token string.
 * @returns {object} Decoded token payload.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

/**
 * Returns a safe representation of a user object by omitting sensitive fields.
 * Never leaks the password hash to the client.
 * @param {object} user - User record from Prisma.
 * @returns {object} Safe user profile without password.
 */
function toSafeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  toSafeUser,
};
