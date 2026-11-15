/**
 * src/config/redis.js — Redis Client Singleton & Lifecycle Management
 *
 * RESPONSIBILITY:
 *   Initializes and exports a resilient Redis client via ioredis.
 *   Configured to handle connection failures gracefully without crashing
 *   the application, supporting cache degradation to PostgreSQL.
 */

'use strict';

const Redis = require('ioredis');
const { config } = require('./env');

let redisClient = null;
let isConnected = false;

try {
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1, // Fail fast on cache read/write when Redis is unreachable
    enableReadyCheck: true,
    lazyConnect: true, // Connect explicitly or on first command
    enableOfflineQueue: false, // Don't hold open handles if disconnected
    retryStrategy(times) {
      // Reconnect with exponential backoff up to 2 seconds
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      if (targetErrors.some((code) => err.message.includes(code))) {
        return true;
      }
      return false;
    },
  });

  redisClient.on('connect', () => {
    isConnected = true;
    if (config.isDevelopment) {
      console.log('✅ Connected to Redis cache service');
    }
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    if (config.isDevelopment) {
      console.warn('⚠️  Redis connection error (fallback to DB active):', err.message);
    }
  });

  redisClient.on('close', () => {
    isConnected = false;
  });

  // Attempt initial non-blocking connection
  redisClient.connect().catch((err) => {
    isConnected = false;
    if (config.isDevelopment) {
      console.warn('⚠️  Redis not reachable at startup. API will operate in direct-database mode.');
    }
  });
} catch (error) {
  isConnected = false;
  console.warn('⚠️  Failed to initialize Redis client:', error.message);
}

/**
 * Check if Redis is currently connected and operational
 */
function isRedisHealthy() {
  return isConnected && redisClient && redisClient.status === 'ready';
}

module.exports = {
  redis: redisClient,
  isRedisHealthy,
};
