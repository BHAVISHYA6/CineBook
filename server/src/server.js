/**
 * src/server.js — HTTP Server Entry Point
 *
 * RESPONSIBILITY:
 *   - Validates environment variables (fail-fast before binding to a port).
 *   - Creates the HTTP server from the Express app.
 *   - Binds to the configured port.
 *   - Handles graceful shutdown on SIGTERM/SIGINT so in-flight requests
 *     can complete and the database connection is closed cleanly.
 *
 * WHY GRACEFUL SHUTDOWN MATTERS:
 *   When a container or process manager sends SIGTERM (e.g., during a
 *   rolling deploy or restart), abruptly killing the process can:
 *     (a) drop in-flight HTTP requests mid-response,
 *     (b) leave Prisma connection pool in an inconsistent state,
 *     (c) cause PostgreSQL to log unexpected disconnections.
 *   Graceful shutdown stops accepting new connections, waits for existing
 *   ones to finish (with a timeout), then closes DB connections cleanly.
 */

'use strict';

const http = require('http');
const { validateEnv, config } = require('./config/env');
const app = require('./app');
const prisma = require('./config/db');

// ─── STARTUP ──────────────────────────────────────────────────────────────────

/**
 * startServer — Validates config, starts the HTTP server, and logs startup info.
 */
async function startServer() {
  // Validate required env vars BEFORE binding to port.
  // If this throws, the process exits with a clear message.
  validateEnv();

  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log('');
    console.log('🎬  CineBook API Server');
    console.log(`    Environment : ${config.nodeEnv}`);
    console.log(`    Port        : ${config.port}`);
    console.log(`    Health      : http://localhost:${config.port}/health`);
    console.log(`    DB Health   : http://localhost:${config.port}/health/db`);
    console.log('');
  });

  // ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────
  /**
   * gracefulShutdown — Stops accepting requests, drains existing connections,
   * and disconnects Prisma before exiting.
   *
   * @param {string} signal - The signal received (SIGTERM or SIGINT).
   */
  async function gracefulShutdown(signal) {
    console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections. Existing connections continue until idle.
    server.close(async () => {
      console.log('   HTTP server closed.');

      try {
        // Disconnect Prisma — returns all connections to the pool and closes it.
        await prisma.$disconnect();
        console.log('   Database connection closed.');
      } catch (err) {
        console.error('   Error disconnecting database:', err.message);
      }

      console.log('   Shutdown complete. Goodbye! 👋\n');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs.
    setTimeout(() => {
      console.error('   Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10_000);
  }

  // Listen for termination signals from OS/container orchestrators.
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C in terminal

  // Log unhandled promise rejections — these are programming errors.
  // In production you might want to exit here and let the orchestrator restart.
  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Promise Rejection:', reason);
  });
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
