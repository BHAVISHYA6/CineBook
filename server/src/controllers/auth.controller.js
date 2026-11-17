/**
 * src/controllers/auth.controller.js — Authentication Controllers (Enhanced for Phase 8)
 *
 * RESPONSIBILITY:
 *   - User Registration with Email OTP Verification flow (Initiate & Verify)
 *   - Direct registration fallback / Resend OTP
 *   - Login with Access Token + Refresh Token generation
 *   - Refresh token rotation / Access token issuance
 *   - Logout with Refresh Token invalidation
 *   - Current user profile retrieval
 */

'use strict';

const prisma = require('../config/db');
const redisClient = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  toSafeUser,
} = require('../utils/auth.utils');
const { createRegistrationOtp, verifyRegistrationOtp } = require('../services/otp.service');

// Basic email format validator regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory fallback for refresh token blacklist/store
const memoryRefreshStore = new Set();

/**
 * Validates registration input
 */
function validateRegisterInput({ name, email, password, phone }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Name is required and must be non-empty', 400, 'VALIDATION_ERROR');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('A valid email address is required', 400, 'VALIDATION_ERROR');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new AppError('Password is required and must be at least 6 characters long', 400, 'VALIDATION_ERROR');
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    throw new AppError('Phone must be a valid string if provided', 400, 'VALIDATION_ERROR');
  }
}

/**
 * Validates login input
 */
function validateLoginInput({ email, password }) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
  }

  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required', 400, 'VALIDATION_ERROR');
  }
}

/**
 * Store active refresh token in Redis / memory
 */
async function storeRefreshToken(userId, refreshToken) {
  const isRedis = redisClient && redisClient.status === 'ready';
  const key = `refresh:${userId}:${refreshToken}`;
  if (isRedis) {
    // 7 days TTL (604800s)
    await redisClient.set(key, '1', 'EX', 7 * 24 * 60 * 60);
  } else {
    memoryRefreshStore.add(key);
  }
}

/**
 * Invalidate refresh token
 */
async function invalidateRefreshToken(userId, refreshToken) {
  const isRedis = redisClient && redisClient.status === 'ready';
  const key = `refresh:${userId}:${refreshToken}`;
  if (isRedis) {
    await redisClient.del(key);
  } else {
    memoryRefreshStore.delete(key);
  }
}

/**
 * Check if refresh token is valid and active
 */
async function isRefreshTokenActive(userId, refreshToken) {
  const isRedis = redisClient && redisClient.status === 'ready';
  const key = `refresh:${userId}:${refreshToken}`;
  if (isRedis) {
    const exists = await redisClient.get(key);
    return !!exists;
  }
  return memoryRefreshStore.has(key);
}

/**
 * POST /api/auth/register-otp
 * Step 1: Initiates registration by creating and sending an OTP to user's email.
 */
async function initiateRegistration(req, res, next) {
  try {
    const { name, email, password, phone } = req.body || {};
    validateRegisterInput({ name, email, password, phone });

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'CONFLICT');
    }

    const hashedPassword = await hashPassword(password);

    const pendingData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : null,
      role: 'USER',
    };

    const { otp, expiresIn } = await createRegistrationOtp(normalizedEmail, pendingData);

    // In a real email environment: sendEmailWithOtp(normalizedEmail, otp);
    // For local development and assessment, log and return preview
    console.log(`[AUTH OTP] 📧 Verification code for ${normalizedEmail}: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to email address successfully',
      data: {
        email: normalizedEmail,
        expiresIn,
        otpPreview: process.env.NODE_ENV !== 'production' ? otp : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/verify-otp
 * Step 2: Verifies OTP and registers the user in PostgreSQL.
 */
async function verifyRegistration(req, res, next) {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      throw new AppError('Email and 6-digit OTP are required', 400, 'VALIDATION_ERROR');
    }

    const userData = await verifyRegistrationOtp(email, otp);

    // Create user in PostgreSQL
    const newUser = await prisma.user.create({
      data: userData,
    });

    const safeUser = toSafeUser(newUser);
    const token = generateToken({ id: safeUser.id, role: safeUser.role });
    const refreshToken = generateRefreshToken({ id: safeUser.id, role: safeUser.role });

    await storeRefreshToken(safeUser.id, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'Account verified and registered successfully',
      data: {
        user: safeUser,
        token,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register
 * Direct registration endpoint (backward compatible)
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body || {};
    validateRegisterInput({ name, email, password, phone });

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'CONFLICT');
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null,
        role: 'USER',
      },
    });

    const safeUser = toSafeUser(newUser);
    const token = generateToken({ id: safeUser.id, role: safeUser.role });
    const refreshToken = generateRefreshToken({ id: safeUser.id, role: safeUser.role });

    await storeRefreshToken(safeUser.id, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: safeUser,
        token,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues Access + Refresh Tokens.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    validateLoginInput({ email, password });

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const safeUser = toSafeUser(user);
    const token = generateToken({ id: safeUser.id, role: safeUser.role });
    const refreshToken = generateRefreshToken({ id: safeUser.id, role: safeUser.role });

    await storeRefreshToken(safeUser.id, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: safeUser,
        token,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Exchanges a valid refresh token for a fresh access token (and rotates refresh token).
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: tokenInput } = req.body || {};
    if (!tokenInput) {
      throw new AppError('Refresh token is required', 400, 'VALIDATION_ERROR');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(tokenInput);
    } catch (tokenErr) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const isActive = await isRefreshTokenActive(decoded.id, tokenInput);
    if (!isActive) {
      throw new AppError('Refresh token has been revoked or expired', 401, 'REVOKED_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new AppError('User account associated with this token no longer exists', 401, 'USER_NOT_FOUND');
    }

    // Invalidate old token and issue new pair (rotation)
    await invalidateRefreshToken(user.id, tokenInput);

    const safeUser = toSafeUser(user);
    const newAccessToken = generateToken({ id: safeUser.id, role: safeUser.role });
    const newRefreshToken = generateRefreshToken({ id: safeUser.id, role: safeUser.role });

    await storeRefreshToken(user.id, newRefreshToken);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: safeUser,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Invalidates user session and blacklists/removes the refresh token.
 */
async function logout(req, res, next) {
  try {
    const { refreshToken: tokenInput } = req.body || {};
    if (tokenInput && req.userId) {
      await invalidateRefreshToken(req.userId, tokenInput);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile.
 */
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        user: toSafeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiateRegistration,
  verifyRegistration,
  register,
  login,
  refreshToken,
  logout,
  getMe,
};
