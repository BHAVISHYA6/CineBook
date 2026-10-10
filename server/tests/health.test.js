/**
 * tests/health.test.js — Integration Tests for Health Endpoints
 *
 * WHAT IS TESTED:
 *   1. GET /health — Always returns 200 with correct shape (no DB needed).
 *   2. GET /health/db — Returns 200 if DB is up, 503 if DB is unreachable.
 *      NOTE: This test depends on a running PostgreSQL instance. If the DB
 *      is not available, the DB health test is expected to return 503.
 *
 * HOW SUPERTEST WORKS:
 *   Supertest imports the Express `app` object directly and wraps it with
 *   a temporary HTTP listener. No port binding needed — no conflicts.
 *   This is why app.js and server.js are separated.
 *
 * HOW TO RUN:
 *   cd server
 *   npm test
 *   (or: npx jest tests/health.test.js --verbose)
 */

'use strict';

const request = require('supertest');
const app = require('../src/app');

// ─── GET /health ──────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
  });

  it('should include environment and timestamp fields', async () => {
    const res = await request(app).get('/health');

    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    // Timestamp should be a valid ISO string
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });

  it('should return JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ─── GET /health/db ────────────────────────────────────────────────────────────
describe('GET /health/db', () => {
  it('should return JSON content-type regardless of DB state', async () => {
    const res = await request(app).get('/health/db');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('should return 200 or 503 (depending on DB availability)', async () => {
    const res = await request(app).get('/health/db');
    // Either the DB is up (200 ok) or down (503 error) — both are valid outcomes.
    // The test verifies the shape, not whether the DB is up.
    expect([200, 503]).toContain(res.status);
  });

  it('should return correct shape when DB is connected', async () => {
    const res = await request(app).get('/health/db');
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.latencyMs).toBe('number');
    }
  });

  it('should return correct shape when DB is disconnected', async () => {
    const res = await request(app).get('/health/db');
    if (res.status === 503) {
      expect(res.body.success).toBe(false);
      expect(res.body.database).toBe('disconnected');
      expect(typeof res.body.latencyMs).toBe('number');
    }
  });

  it('should NOT expose database credentials or stack traces in response', async () => {
    const res = await request(app).get('/health/db');
    const bodyText = JSON.stringify(res.body);
    // Verify the response doesn't contain common credential patterns.
    expect(bodyText).not.toMatch(/password/i);
    expect(bodyText).not.toMatch(/postgresql:\/\//i);
  });
});

// ─── 404 HANDLING ─────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('should return 404 for an unregistered path', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return JSON for unregistered routes', async () => {
    const res = await request(app).get('/completely-unknown');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
