/**
 * src/controllers/auth.controller.js — Authentication Controllers
 *
 * RESPONSIBILITY:
 *   Handles registration, login, and profile retrieval endpoints.
 *   Enforces validation, sanitizes user roles to prevent privilege escalation,
 *   hashes passwords using bcrypt, generates JWTs, and returns consistent JSON.
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const {
  hashPassword,
  comparePassword,
  generateToken,
  toSafeUser,
} = require('../utils/auth.utils');

// Basic email format validator regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates registration request body.
 * @param {object} body - Request body containing name, email, password, phone.
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
 * Validates login request body.
 * @param {object} body - Request body containing email and password.
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
 * POST /api/auth/register
 * Registers a new user. Clients cannot assign themselves the ADMIN role.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body || {};

    validateRegisterInput({ name, email, password, phone });

    const normalizedEmail = email.trim().toLowerCase();

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'CONFLICT');
    }

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(password);

    // Explicitly enforce role 'USER' — ignore any client-provided role
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

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns a JWT.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    validateLoginInput({ email, password });

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Use generic message to avoid email enumeration
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const safeUser = toSafeUser(user);
    const token = generateToken({ id: safeUser.id, role: safeUser.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: safeUser,
        token,
      },
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
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
};
