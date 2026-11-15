/**
 * src/controllers/health.controller.js — Health Check Request Handlers
 *
 * WHY HEALTH CHECKS:
 *   Health endpoints are polled by load balancers, container orchestrators
 *   (Docker, Kubernetes), and monitoring tools to determine if the service
 *   is alive and ready to accept traffic.
 *
 *   GET /health    — "Liveness" check: is the process running?
 *   GET /health/db — "Readiness" check: is the database connection healthy?
 *
 *   Separating them lets orchestrators distinguish between "restart the pod"
 *   (liveness failure) and "remove from load balancer rotation" (readiness failure).
 *
 * SECURITY:
 *   Neither endpoint exposes database credentials, connection strings,
 *   or stack traces. The DB check only returns latency and a boolean status.
 */

'use strict';

const prisma = require('../config/db');
const { config } = require('../config/env');

/**
 * getHealth — Returns basic process information.
 * Responds 200 as long as the Node.js process is running.
 *
 * @route GET /health
 */
async function getHealth(req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()), // Seconds since process start
  });
}

/**
 * getDbHealth — Verifies PostgreSQL connectivity with a lightweight query.
 * Uses Prisma's $queryRaw to run SELECT 1, which returns almost instantly
 * and exercises the actual connection without touching business tables.
 *
 * Responds 200 if connected, 503 Service Unavailable if the query fails.
 *
 * @route GET /health/db
 */
async function getDbHealth(req, res) {
  const start = Date.now();

  try {
    // $queryRaw bypasses the ORM layer — it's the fastest possible DB ping.
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error('Database health check failed:', err.message);

    // Return 503 — the server is alive but cannot serve DB-dependent requests.
    // Do NOT include err.message in production responses (may contain credentials).
    res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected',
      latencyMs,
      timestamp: new Date().toISOString(),
      ...(config.isDevelopment && { detail: err.message }),
    });
  }
}

module.exports = { getHealth, getDbHealth };
