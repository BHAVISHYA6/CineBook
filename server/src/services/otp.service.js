/**
 * src/services/otp.service.js — OTP Generation, Hashing & Verification Service
 *
 * SECURITY & ARCHITECTURAL HIGHLIGHTS:
 *   - OTPs are cryptographically generated (6 digits).
 *   - Plaintext OTPs are NEVER stored. They are hashed using SHA-256 before storing.
 *   - Redis is used as the primary storage with strict TTL (default 5 minutes).
 *     Fallback in-memory cache is used if Redis is temporarily unreachable.
 *   - Rate limiting & Max Attempts (max 3 invalid attempts before burning the OTP).
 *   - Resend cool-down (60 seconds minimum interval between requests).
 */

'use strict';

const crypto = require('crypto');
const redisClient = require('../config/redis');

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_RESEND_COOLDOWN_SECONDS = 60; // 1 minute
const MAX_OTP_ATTEMPTS = 3;

// In-memory fallback if Redis is down
const memoryOtpStore = new Map();

/**
 * Clean up expired memory entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryOtpStore.entries()) {
    if (value.expiresAt <= now) {
      memoryOtpStore.delete(key);
    }
  }
}, 60000);

/**
 * Hash an OTP using SHA-256 with an email-specific salt
 */
function hashOtp(otp, email) {
  return crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');
}

/**
 * Generates a secure random 6-digit OTP
 */
function generateSecureOtp() {
  // crypto.randomInt is cryptographically strong
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Create and store an OTP for registration
 * @param {string} email
 * @param {object} pendingUserData - User data to be registered upon OTP verification
 * @returns {Promise<{ otp: string, expiresIn: number }>}
 */
async function createRegistrationOtp(email, pendingUserData) {
  const normalizedEmail = email.trim().toLowerCase();
  const redisKey = `otp:reg:${normalizedEmail}`;
  const cooldownKey = `otp:cooldown:${normalizedEmail}`;

  // Check resend cooldown
  let inCooldown = false;
  if (redisClient && redisClient.status === 'ready') {
    inCooldown = await redisClient.get(cooldownKey);
  } else {
    const memEntry = memoryOtpStore.get(cooldownKey);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      inCooldown = true;
    }
  }

  if (inCooldown) {
    throw new Error('Please wait 60 seconds before requesting a new OTP.');
  }

  const otp = generateSecureOtp();
  const hashedOtp = hashOtp(otp, normalizedEmail);

  const payload = {
    hashedOtp,
    attempts: 0,
    userData: pendingUserData,
    createdAt: Date.now(),
  };

  if (redisClient && redisClient.status === 'ready') {
    await redisClient.set(redisKey, JSON.stringify(payload), 'EX', OTP_TTL_SECONDS);
    await redisClient.set(cooldownKey, '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS);
  } else {
    memoryOtpStore.set(redisKey, {
      ...payload,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    });
    memoryOtpStore.set(cooldownKey, {
      expiresAt: Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    });
  }

  return {
    otp,
    expiresIn: OTP_TTL_SECONDS,
  };
}

/**
 * Verify OTP for registration
 * @param {string} email
 * @param {string} candidateOtp
 * @returns {Promise<object>} The stored pendingUserData
 */
async function verifyRegistrationOtp(email, candidateOtp) {
  const normalizedEmail = email.trim().toLowerCase();
  const redisKey = `otp:reg:${normalizedEmail}`;

  let record = null;
  const isRedis = redisClient && redisClient.status === 'ready';

  if (isRedis) {
    const raw = await redisClient.get(redisKey);
    if (raw) record = JSON.parse(raw);
  } else {
    const mem = memoryOtpStore.get(redisKey);
    if (mem && mem.expiresAt > Date.now()) {
      record = mem;
    }
  }

  if (!record) {
    throw new Error('OTP expired or not found. Please request a new one.');
  }

  // Check attempt limit
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    if (isRedis) await redisClient.del(redisKey);
    else memoryOtpStore.delete(redisKey);
    throw new Error('Maximum OTP verification attempts exceeded. Please request a new OTP.');
  }

  const candidateHash = hashOtp(candidateOtp.trim(), normalizedEmail);

  // Constant-time comparison to prevent timing attacks
  const match = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(record.hashedOtp, 'hex')
  );

  if (!match) {
    record.attempts += 1;
    const remaining = MAX_OTP_ATTEMPTS - record.attempts;

    if (isRedis) {
      const ttl = await redisClient.ttl(redisKey);
      if (ttl > 0) {
        await redisClient.set(redisKey, JSON.stringify(record), 'EX', ttl);
      }
    } else {
      memoryOtpStore.set(redisKey, record);
    }

    throw new Error(`Invalid OTP. ${remaining} attempt(s) remaining.`);
  }

  // OTP verified! Burn it immediately to prevent replay attacks
  if (isRedis) {
    await redisClient.del(redisKey);
  } else {
    memoryOtpStore.delete(redisKey);
  }

  return record.userData;
}

module.exports = {
  createRegistrationOtp,
  verifyRegistrationOtp,
};
