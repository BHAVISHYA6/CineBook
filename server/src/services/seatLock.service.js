/**
 * src/services/seatLock.service.js — Concurrency-Safe Seat Locking Service
 *
 * ARCHITECTURE & CONCURRENCY DESIGN:
 *   1. Distributed Seat Locking via Redis:
 *      - Uses atomic Redis key: `lock:show:{showId}:seat:{seatId}`
 *      - Key value stores `{ userId, lockedAt, ttlSeconds }`
 *      - Redis SETNX with TTL (default 10 minutes = 600s) prevents two users
 *        from acquiring the lock for the same seat concurrently.
 *      - Rollback capability: If locking fails for any seat in a batch,
 *        all newly acquired locks in that batch are immediately released.
 *
 *   2. Two-Phase Locking with PostgreSQL (Database as Ultimate Source of Truth):
 *      - Redis coordinates high-speed distributed concurrency at the front line.
 *      - A PostgreSQL transaction validates that the ShowSeats are not currently
 *        BOOKED or held by another active user.
 *      - Expired DB holds (`heldUntil < now()`) are automatically treated as AVAILABLE.
 *      - Updates `ShowSeat` status to `HELD`, assigns `heldByUserId` and `heldUntil`.
 *      - Creates or updates a `PENDING` `Booking` record with total calculated price.
 *      - If DB transaction fails for any reason, Redis locks are rolled back.
 *
 *   3. Release Mechanism:
 *      - Authenticated users can release their own held seats or cancel pending bookings.
 *      - Releasing clears both the Redis locks and reverts `ShowSeat` status to `AVAILABLE`.
 */

'use strict';

const prisma = require('../config/db');
const { redis, isRedisHealthy } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');

// Default reservation hold TTL in seconds (10 minutes)
const HOLD_TTL_SECONDS = 600;

/**
 * Generate standard Redis lock key for a seat in a show
 */
function getSeatLockKey(showId, seatId) {
  return `lock:show:${showId}:seat:${seatId}`;
}

/**
 * Attempts to acquire atomic Redis locks for a list of seat IDs for a given show.
 * If any seat is already locked by someone else, releases all seats acquired in this batch.
 *
 * @param {string} showId
 * @param {string[]} seatIds
 * @param {string} userId
 * @param {number} ttlSeconds
 * @returns {Promise<{ acquired: boolean, failedSeatId?: string }>}
 */
async function acquireRedisLocks(showId, seatIds, userId, ttlSeconds = HOLD_TTL_SECONDS) {
  if (!isRedisHealthy()) {
    // If Redis is temporarily down, we proceed with DB-only pessimistic check in transaction
    return { acquired: true, redisBypassed: true };
  }

  const acquiredKeys = [];
  const payload = JSON.stringify({
    userId,
    lockedAt: new Date().toISOString(),
    ttlSeconds,
  });

  try {
    for (const seatId of seatIds) {
      const lockKey = getSeatLockKey(showId, seatId);
      // 'NX': Only set the key if it does not already exist
      // 'EX': Expire in seconds
      const result = await redis.set(lockKey, payload, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        acquiredKeys.push(lockKey);
      } else {
        // Seat is already locked in Redis! Check if it was locked by the SAME user
        const existingData = await redis.get(lockKey);
        let sameUser = false;
        if (existingData) {
          try {
            const parsed = JSON.parse(existingData);
            if (parsed.userId === userId) {
              sameUser = true;
              // Refresh TTL for current user
              await redis.expire(lockKey, ttlSeconds);
              acquiredKeys.push(lockKey);
            }
          } catch (_) {}
        }

        if (!sameUser) {
          // Locked by another user: Roll back all acquired keys in this batch
          if (acquiredKeys.length > 0) {
            await redis.del(...acquiredKeys);
          }
          return { acquired: false, failedSeatId: seatId };
        }
      }
    }

    return { acquired: true, acquiredKeys };
  } catch (err) {
    // On unexpected Redis exception, rollback acquired keys and allow DB transaction to guard
    if (acquiredKeys.length > 0) {
      try {
        await redis.del(...acquiredKeys);
      } catch (_) {}
    }
    return { acquired: true, redisBypassed: true };
  }
}

/**
 * Releases Redis locks for specified seats if owned by the user.
 *
 * @param {string} showId
 * @param {string[]} seatIds
 * @param {string} userId
 */
async function releaseRedisLocks(showId, seatIds, userId) {
  if (!isRedisHealthy() || !seatIds || seatIds.length === 0) return;

  try {
    for (const seatId of seatIds) {
      const lockKey = getSeatLockKey(showId, seatId);
      const existing = await redis.get(lockKey);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed.userId === userId) {
            await redis.del(lockKey);
          }
        } catch (_) {
          await redis.del(lockKey);
        }
      }
    }
  } catch (err) {
    console.warn(`[Redis Release Warning] ${err.message}`);
  }
}

/**
 * Reserves/locks selected seats for a show in a concurrency-safe manner.
 *
 * @param {object} params
 * @param {string} params.showId
 * @param {string[]} params.seatIds
 * @param {string} params.userId
 * @returns {Promise<object>} The pending Booking details
 */
async function lockSeats({ showId, seatIds, userId }) {
  if (!showId || typeof showId !== 'string') {
    throw new AppError('showId is required', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError('seatIds must be a non-empty array of seat identifiers', 400, 'VALIDATION_ERROR');
  }

  // Deduplicate requested seat IDs
  const uniqueSeatIds = [...new Set(seatIds)];

  if (uniqueSeatIds.length > 10) {
    throw new AppError('Cannot reserve more than 10 seats in a single request', 400, 'VALIDATION_ERROR');
  }

  // Verify Show exists and is upcoming
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { movie: true },
  });

  if (!show || !show.isActive) {
    throw new AppError('Show not found or is no longer active', 404, 'NOT_FOUND');
  }

  if (new Date() >= new Date(show.startsAt)) {
    throw new AppError('Cannot reserve seats for a show that has already started', 400, 'VALIDATION_ERROR');
  }

  // STEP 1: Fast Distributed Lock Acquisition via Redis
  const redisLock = await acquireRedisLocks(showId, uniqueSeatIds, userId, HOLD_TTL_SECONDS);
  if (!redisLock.acquired) {
    throw new AppError(
      `Seat ${redisLock.failedSeatId} is currently held by another user. Please select different seats.`,
      409,
      'SEAT_ALREADY_RESERVED'
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_SECONDS * 1000);

  // STEP 2: Database Transaction (Persistent Source of Truth)
  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Fetch requested show seats
      const showSeats = await tx.showSeat.findMany({
        where: {
          showId,
          seatId: { in: uniqueSeatIds },
        },
        include: {
          seat: true,
        },
      });

      if (showSeats.length !== uniqueSeatIds.length) {
        throw new AppError('One or more selected seats do not exist for this show', 404, 'NOT_FOUND');
      }

      // Check each seat's real-time DB status
      for (const ss of showSeats) {
        if (ss.status === 'BOOKED') {
          throw new AppError(`Seat Row ${ss.seat.row} #${ss.seat.number} is already permanently booked`, 409, 'SEAT_ALREADY_BOOKED');
        }

        // If currently HELD, check if hold is still active and owned by someone else
        if (ss.status === 'HELD' && ss.heldUntil && new Date(ss.heldUntil) > now) {
          if (ss.heldByUserId !== userId) {
            throw new AppError(`Seat Row ${ss.seat.row} #${ss.seat.number} is currently reserved by another customer`, 409, 'SEAT_ALREADY_RESERVED');
          }
        }
      }

      // Calculate total amount in paise
      const totalAmountPaise = showSeats.reduce((acc, curr) => acc + curr.pricePaise, 0);

      // Create a PENDING Booking row
      const newBooking = await tx.booking.create({
        data: {
          userId,
          showId,
          status: 'PENDING',
          totalAmountPaise,
          expiresAt,
        },
      });

      // Update ShowSeats to HELD status linked to this booking
      await tx.showSeat.updateMany({
        where: {
          showId,
          seatId: { in: uniqueSeatIds },
        },
        data: {
          status: 'HELD',
          heldByUserId: userId,
          heldUntil: expiresAt,
          bookingId: newBooking.id,
        },
      });

      return {
        ...newBooking,
        seats: showSeats.map((s) => ({
          showSeatId: s.id,
          seatId: s.seatId,
          row: s.seat.row,
          number: s.seat.number,
          class: s.seat.class,
          pricePaise: s.pricePaise,
        })),
      };
    });

    return booking;
  } catch (dbError) {
    // If DB transaction fails, ensure Redis locks are promptly released
    await releaseRedisLocks(showId, uniqueSeatIds, userId);
    throw dbError;
  }
}

/**
 * Releases seats held by a user for a specific booking or show.
 *
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @returns {Promise<object>}
 */
async function releaseSeats({ bookingId, userId }) {
  if (!bookingId) {
    throw new AppError('bookingId is required', 400, 'VALIDATION_ERROR');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { showSeats: true },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'NOT_FOUND');
  }

  if (booking.userId !== userId) {
    throw new AppError('You do not have permission to release this booking', 403, 'FORBIDDEN');
  }

  if (booking.status === 'CONFIRMED') {
    throw new AppError('Cannot release a confirmed booking', 400, 'INVALID_STATE');
  }

  const seatIds = booking.showSeats.map((ss) => ss.seatId);

  // Database Transaction to update booking and seats
  await prisma.$transaction(async (tx) => {
    await tx.showSeat.updateMany({
      where: {
        bookingId: booking.id,
      },
      data: {
        status: 'AVAILABLE',
        heldByUserId: null,
        heldUntil: null,
        bookingId: null,
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
      },
    });
  });

  // Release Redis locks
  await releaseRedisLocks(booking.showId, seatIds, userId);

  return {
    bookingId: booking.id,
    releasedSeatsCount: seatIds.length,
    status: 'CANCELLED',
  };
}

/**
 * Retrieves the current reservation / booking status for a user.
 *
 * @param {string} bookingId
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getReservationStatus(bookingId, userId) {
  if (!bookingId) {
    throw new AppError('bookingId is required', 400, 'VALIDATION_ERROR');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      show: {
        include: {
          movie: { select: { title: true, durationMin: true } },
          screen: {
            select: { name: true, theatre: { select: { name: true, city: true } } },
          },
        },
      },
      showSeats: {
        include: {
          seat: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'NOT_FOUND');
  }

  if (booking.userId !== userId) {
    throw new AppError('Forbidden: Not your reservation', 403, 'FORBIDDEN');
  }

  const now = new Date();
  const isExpired = booking.status === 'PENDING' && booking.expiresAt && new Date(booking.expiresAt) <= now;

  return {
    bookingId: booking.id,
    status: isExpired ? 'EXPIRED' : booking.status,
    totalAmountPaise: booking.totalAmountPaise,
    expiresAt: booking.expiresAt,
    remainingSeconds: booking.expiresAt ? Math.max(0, Math.floor((new Date(booking.expiresAt) - now) / 1000)) : 0,
    show: {
      id: booking.show.id,
      movieTitle: booking.show.movie.title,
      theatreName: booking.show.screen.theatre.name,
      screenName: booking.show.screen.name,
      city: booking.show.screen.theatre.city,
      startsAt: booking.show.startsAt,
    },
    seats: booking.showSeats.map((ss) => ({
      showSeatId: ss.id,
      seatId: ss.seatId,
      row: ss.seat.row,
      number: ss.seat.number,
      class: ss.seat.class,
      pricePaise: ss.pricePaise,
      status: isExpired ? 'AVAILABLE' : ss.status,
    })),
  };
}

module.exports = {
  lockSeats,
  releaseSeats,
  getReservationStatus,
  HOLD_TTL_SECONDS,
};
