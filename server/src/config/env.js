/**
 * src/config/env.js — Environment Variable Validation
 *
 * WHY THIS EXISTS:
 *   If a required variable (like DATABASE_URL or JWT_SECRET) is missing,
 *   the server should fail fast at startup with a clear error rather than
 *   crash mid-request with a confusing "Cannot read property of undefined".
 *   This is the "fail-fast" principle — detect misconfiguration before serving traffic.
 *
 * HOW IT WORKS:
 *   We define required variables per environment and throw during module load
 *   if any are missing. Optional variables have defaults.
 */

'use strict';

require('dotenv').config(); // Load .env file into process.env

// Variables that MUST be present for the server to start.
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'];

/**
 * validateEnv — Checks all required environment variables are set.
 * Called once during server startup. Throws if any are missing.
 */
function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
        `   Copy server/.env.example to server/.env and fill in the values.`
    );
  }
}

// Exported config object — the rest of the app reads from here, not process.env directly.
// This centralises configuration access and makes testing easier (mock this module).
const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
};

module.exports = { config, validateEnv };
