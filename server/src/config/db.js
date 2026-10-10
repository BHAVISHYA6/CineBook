/**
 * src/config/db.js — Shared Prisma Client Instance
 *
 * WHY A SINGLETON:
 *   PrismaClient manages a connection pool to PostgreSQL. Instantiating it
 *   multiple times wastes connections and can exhaust the pool limit.
 *   By exporting a single instance, every module shares the same pool.
 *
 * WHY LOG LEVELS ARE ENVIRONMENT-BASED:
 *   In development, logging queries helps with debugging slow queries and
 *   understanding what SQL Prisma generates. In production, excessive logging
 *   increases I/O and can leak query details to logs — so only errors are logged.
 *
 * LIFECYCLE:
 *   This client is connected lazily (first query connects automatically).
 *   server.js explicitly disconnects it on shutdown via prisma.$disconnect().
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { config } = require('./env');

const prisma = new PrismaClient({
  log: config.isDevelopment
    ? ['query', 'info', 'warn', 'error'] // Verbose in dev for learning
    : ['error'],                          // Minimal in production
});

module.exports = prisma;
