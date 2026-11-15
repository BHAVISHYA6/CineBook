/**
 * src/services/cache.service.js — Reusable Redis Cache Service
 *
 * RESPONSIBILITY:
 *   Provides cache-aside helpers (get, set, del, deleteByPattern, wrap).
 *   All methods fail-safe: if Redis is unavailable or throws, operations
 *   catch the error and return null/fallback cleanly so PostgreSQL serves the request.
 */

'use strict';

const { redis, isRedisHealthy } = require('../config/redis');

// Default sensible TTLs in seconds
const DEFAULT_TTLS = {
  SHORT: 60,         // 1 minute (e.g. show details with dynamic schedules)
  MEDIUM: 300,       // 5 minutes (e.g. movies list, theatres list)
  LONG: 3600,        // 1 hour (e.g. static movie details, theatre screen metadata)
};

/**
 * Retrieve cached JSON value by key
 * @param {string} key
 * @returns {Promise<any|null>} Parsed object or null on miss/error
 */
async function get(key) {
  if (!isRedisHealthy()) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.warn(`[Cache GET Error] Key: ${key} - ${err.message}`);
    return null;
  }
}

/**
 * Set JSON value with TTL in seconds
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttlSeconds = DEFAULT_TTLS.MEDIUM) {
  if (!isRedisHealthy()) return false;
  try {
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    console.warn(`[Cache SET Error] Key: ${key} - ${err.message}`);
    return false;
  }
}

/**
 * Delete a specific cache key
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function del(key) {
  if (!isRedisHealthy()) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.warn(`[Cache DEL Error] Key: ${key} - ${err.message}`);
    return false;
  }
}

/**
 * Delete all keys matching a wildcard pattern (e.g., "movies:*")
 * Uses SCAN rather than KEYS to avoid blocking Redis event loop
 * @param {string} pattern
 * @returns {Promise<number>} Number of keys deleted
 */
async function deleteByPattern(pattern) {
  if (!isRedisHealthy()) return 0;
  try {
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');
    return totalDeleted;
  } catch (err) {
    console.warn(`[Cache PATTERN DEL Error] Pattern: ${pattern} - ${err.message}`);
    return 0;
  }
}

/**
 * Cache-Aside wrapper: Try cache first; on miss, execute fallbackFn and cache the result
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {Function} fallbackFn
 * @returns {Promise<any>}
 */
async function remember(key, ttlSeconds, fallbackFn) {
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fallbackFn();
  if (fresh !== null && fresh !== undefined) {
    await set(key, fresh, ttlSeconds);
  }
  return fresh;
}

module.exports = {
  get,
  set,
  del,
  deleteByPattern,
  remember,
  DEFAULT_TTLS,
};
