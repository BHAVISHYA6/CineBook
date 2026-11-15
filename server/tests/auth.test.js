/**
 * tests/auth.test.js — Integration Tests for User Authentication
 *
 * WHAT IS TESTED:
 *   1. User Registration:
 *      - Successful registration (201, safe user object, valid JWT, no plaintext password)
 *      - Rejection of duplicate email (409 Conflict)
 *      - Prevention of role tampering (cannot assign ADMIN on registration)
 *      - Validation: missing/invalid email, short password, missing name (400)
 *   2. User Login:
 *      - Successful login (200, safe user profile, valid JWT)
 *      - Rejection of incorrect password (401 Invalid Credentials)
 *      - Rejection of non-existent email (401 Invalid Credentials)
 *      - Validation: missing email or password (400)
 *   3. Authenticated Profile (GET /api/auth/me):
 *      - Successful profile retrieval with valid Bearer token (200)
 *      - Rejection when token is missing (401)
 *      - Rejection when token is invalid/tampered (401)
 *      - Rejection when token header is malformed (401)
 *      - Rejection when authenticated user has been deleted (401)
 *   4. Alias route:
 *      - /api/v1/auth/me works identically
 */

'use strict';

// ─── IN-MEMORY TEST DATABASE FOR ISOLATION ────────────────────────────────────
// An in-memory store simulating Prisma's user delegate so test suite runs
// isolated, deterministic, and fast without external Postgres dependencies.
const mockUsers = new Map();

jest.mock('../src/config/db', () => {
  return {
    user: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.email) {
          for (const u of mockUsers.values()) {
            if (u.email.toLowerCase() === where.email.toLowerCase()) {
              return { ...u };
            }
          }
          return null;
        }
        if (where.id) {
          const u = mockUsers.get(where.id);
          return u ? { ...u } : null;
        }
        return null;
      }),
      create: jest.fn(async ({ data }) => {
        const id = 'user_' + Math.random().toString(36).substring(2, 10);
        const now = new Date();
        const record = {
          id,
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone || null,
          role: data.role || 'USER',
          createdAt: now,
          updatedAt: now,
        };
        mockUsers.set(id, record);
        return { ...record };
      }),
      deleteMany: jest.fn(async () => {
        mockUsers.clear();
        return { count: 0 };
      }),
    },
    $disconnect: jest.fn(async () => {}),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { config } = require('../src/config/env');

describe('User Authentication API', () => {
  beforeEach(() => {
    mockUsers.clear();
  });

  // ─── REGISTRATION TESTS ─────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with 201 status', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'securepassword123',
          phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/registered successfully/i);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('token');

      const { user, token } = res.body.data;
      expect(user.name).toBe('Jane Doe');
      expect(user.email).toBe('jane@example.com');
      expect(user.role).toBe('USER');
      // Crucial: password hash must NEVER be exposed
      expect(user.password).toBeUndefined();

      // Verify token contains user ID and role
      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.id).toBe(user.id);
      expect(decoded.role).toBe('USER');
    });

    it('should prevent privilege escalation: client cannot assign ADMIN role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker',
          email: 'hacker@example.com',
          password: 'password123',
          role: 'ADMIN', // Tamper attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('USER');

      // Verify token role is also USER
      const decoded = jwt.verify(res.body.data.token, config.jwt.secret);
      expect(decoded.role).toBe('USER');
    });

    it('should reject registration when email is already in use (409 Conflict)', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'password123',
        });

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Duplicate',
          email: 'alice@example.com',
          password: 'anotherpassword',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noname@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── LOGIN TESTS ────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'correctpassword',
        });
    });

    it('should log in successfully with valid credentials (200 OK)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'correctpassword',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/login successful/i);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe('john@example.com');
      expect(res.body.data.user.password).toBeUndefined();

      const decoded = jwt.verify(res.body.data.token, config.jwt.secret);
      expect(decoded.id).toBe(res.body.data.user.id);
    });

    it('should reject login with incorrect password (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toMatch(/invalid email or password/i);
    });

    it('should reject login with non-existent email (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost@example.com',
          password: 'somepassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 when email or password is missing in login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── AUTHENTICATED PROFILE TESTS ────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    let validToken;
    let registeredUser;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          password: 'judgmentday',
        });
      validToken = res.body.data.token;
      registeredUser = res.body.data.user;
    });

    it('should return authenticated user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(registeredUser.id);
      expect(res.body.data.user.email).toBe('sarah@example.com');
      expect(res.body.data.user.name).toBe('Sarah Connor');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should reject request when Authorization header is missing (401)', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with malformed Authorization header (no Bearer)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Basic ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with an invalid or tampered JWT token (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject request when user no longer exists in database (401)', async () => {
      // Craft a token signed with an unknown user ID
      const ghostToken = jwt.sign(
        { id: 'non-existent-user-id', role: 'USER' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ghostToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should also work on the versioned alias /api/v1/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(registeredUser.id);
    });
  });
});
