/**
 * src/controllers/show.controller.js — Shows Controller
 *
 * Implements public and admin endpoints for Shows and ShowSeats.
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const cacheService = require('../services/cache.service');

/**
 * GET /api/shows/:id
 * Retrieve show details including movie, theatre, screen, time, and pricing.
 */
async function getShowById(req, res, next) {
  try {
    const { id } = req.params;

    const cacheKey = `shows:detail:${id}`;
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        movie: true,
        screen: {
          include: {
            theatre: true,
          },
        },
      },
    });

    if (!show) {
      throw new AppError('Show not found', 404, 'NOT_FOUND');
    }

    const responseData = {
      success: true,
      data: { show },
    };

    // Cache show details with 1-minute TTL (shows have upcoming schedules)
    await cacheService.set(cacheKey, responseData, cacheService.DEFAULT_TTLS.SHORT);

    return res.status(200).json(responseData);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/shows/:id/seats
 * Retrieve seat layout and current availability using the ShowSeat inventory model.
 */
async function getShowSeats(req, res, next) {
  try {
    const { id } = req.params;

    const show = await prisma.show.findUnique({
      where: { id },
      select: {
        id: true,
        movieId: true,
        screenId: true,
        startsAt: true,
        endsAt: true,
        basePricePaise: true,
        isActive: true,
      },
    });

    if (!show) {
      throw new AppError('Show not found', 404, 'NOT_FOUND');
    }

    const showSeats = await prisma.showSeat.findMany({
      where: { showId: id },
      include: {
        seat: {
          select: {
            id: true,
            row: true,
            number: true,
            class: true,
          },
        },
      },
      orderBy: [
        { seat: { row: 'asc' } },
        { seat: { number: 'asc' } },
      ],
    });

    // Compute summary availability count
    const summary = {
      total: showSeats.length,
      available: 0,
      held: 0,
      booked: 0,
    };

    const formattedSeats = showSeats.map((ss) => {
      if (ss.status === 'AVAILABLE') summary.available++;
      else if (ss.status === 'HELD') summary.held++;
      else if (ss.status === 'BOOKED') summary.booked++;

      return {
        showSeatId: ss.id,
        seatId: ss.seat.id,
        row: ss.seat.row,
        number: ss.seat.number,
        class: ss.seat.class,
        pricePaise: ss.pricePaise,
        status: ss.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        show,
        summary,
        seats: formattedSeats,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/shows (Admin)
 * Schedule a new show on a screen.
 * Business rules:
 *   1. Movie must exist and be active.
 *   2. Screen must exist and have physical seats configured.
 *   3. StartsAt must be in the future.
 *   4. EndsAt is computed if not provided (startsAt + durationMin + 15 min buffer).
 *   5. Screen schedule must not conflict/overlap with another active show on that screen.
 *   6. ShowSeats inventory rows are populated atomically via transaction for each seat.
 */
async function createShow(req, res, next) {
  try {
    const {
      movieId,
      screenId,
      startsAt,
      endsAt,
      basePricePaise,
      surcharges, // optional: { PREMIUM: 5000, RECLINER: 10000 } in paise
    } = req.body || {};

    if (!movieId || typeof movieId !== 'string') {
      throw new AppError('movieId is required', 400, 'VALIDATION_ERROR');
    }

    if (!screenId || typeof screenId !== 'string') {
      throw new AppError('screenId is required', 400, 'VALIDATION_ERROR');
    }

    if (!startsAt) {
      throw new AppError('startsAt is required', 400, 'VALIDATION_ERROR');
    }

    const startTime = new Date(startsAt);
    if (isNaN(startTime.getTime())) {
      throw new AppError('Invalid startsAt datetime format', 400, 'VALIDATION_ERROR');
    }

    if (basePricePaise === undefined || typeof basePricePaise !== 'number' || basePricePaise <= 0) {
      throw new AppError('basePricePaise is required and must be a positive integer', 400, 'VALIDATION_ERROR');
    }

    // Check movie existence
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
    });

    if (!movie) {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }

    if (!movie.isActive) {
      throw new AppError('Cannot schedule a show for an inactive movie', 400, 'VALIDATION_ERROR');
    }

    // Check screen and physical seats
    const screen = await prisma.screen.findUnique({
      where: { id: screenId },
      include: {
        seats: true,
      },
    });

    if (!screen) {
      throw new AppError('Screen not found', 404, 'NOT_FOUND');
    }

    if (screen.seats.length === 0) {
      throw new AppError('Cannot schedule show on a screen with no seats configured', 400, 'VALIDATION_ERROR');
    }

    // Compute or validate endsAt
    let endTime;
    if (endsAt) {
      endTime = new Date(endsAt);
      if (isNaN(endTime.getTime())) {
        throw new AppError('Invalid endsAt datetime format', 400, 'VALIDATION_ERROR');
      }
      if (endTime <= startTime) {
        throw new AppError('endsAt must be after startsAt', 400, 'VALIDATION_ERROR');
      }
    } else {
      // Auto-compute: movie duration + 15 min cleaning buffer
      const durationMillis = (movie.durationMin + 15) * 60 * 1000;
      endTime = new Date(startTime.getTime() + durationMillis);
    }

    // Overlap prevention check on the same screen:
    // Existing show overlaps if: (existing.startsAt < new.endsAt) AND (existing.endsAt > new.startsAt)
    const overlappingShow = await prisma.show.findFirst({
      where: {
        screenId,
        isActive: true,
        AND: [
          { startsAt: { lt: endTime } },
          { endsAt: { gt: startTime } },
        ],
      },
    });

    if (overlappingShow) {
      throw new AppError(
        `Screen scheduling conflict: An existing show (${overlappingShow.id}) runs from ${overlappingShow.startsAt.toISOString()} to ${overlappingShow.endsAt.toISOString()}`,
        409,
        'SCHEDULE_CONFLICT'
      );
    }

    // Atomically create Show and initial ShowSeat inventory rows
    const classSurcharges = surcharges || {
      STANDARD: 0,
      PREMIUM: 5000,   // ₹50 surcharge default
      RECLINER: 10000, // ₹100 surcharge default
    };

    const newShow = await prisma.$transaction(async (tx) => {
      const showRecord = await tx.show.create({
        data: {
          movieId,
          screenId,
          startsAt: startTime,
          endsAt: endTime,
          basePricePaise: Math.floor(basePricePaise),
          isActive: true,
        },
      });

      const showSeatsData = screen.seats.map((seat) => {
        const extra = classSurcharges[seat.class] || 0;
        return {
          showId: showRecord.id,
          seatId: seat.id,
          pricePaise: Math.floor(basePricePaise) + extra,
          status: 'AVAILABLE',
        };
      });

      await tx.showSeat.createMany({
        data: showSeatsData,
      });

      return showRecord;
    });

    const fullShow = await prisma.show.findUnique({
      where: { id: newShow.id },
      include: {
        movie: {
          select: { id: true, title: true, durationMin: true },
        },
        screen: {
          select: { id: true, name: true, totalSeats: true, theatreId: true },
        },
        _count: {
          select: { showSeats: true },
        },
      },
    });

    // Invalidate any cached show details or movie show listings
    await cacheService.del(`shows:detail:${newShow.id}`);

    return res.status(201).json({
      success: true,
      message: 'Show scheduled and seat inventory generated successfully',
      data: { show: fullShow },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/shows
 * List shows with optional filters (movieId, screenId, theatreId, date)
 */
async function getShows(req, res, next) {
  try {
    const { movieId, screenId, theatreId, date, isActive } = req.query || {};

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    if (movieId) where.movieId = movieId;
    if (screenId) where.screenId = screenId;
    if (theatreId) where.screen = { theatreId };

    if (date) {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      where.startsAt = { gte: dayStart, lte: dayEnd };
    }

    const shows = await prisma.show.findMany({
      where,
      include: {
        movie: { select: { id: true, title: true, durationMin: true, posterUrl: true } },
        screen: {
          include: {
            theatre: { select: { id: true, name: true, city: true } },
          },
        },
        _count: {
          select: { showSeats: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { shows },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/shows/:id
 * Soft delete / deactivate show
 */
async function deleteShow(req, res, next) {
  try {
    const { id } = req.params;
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) throw new AppError('Show not found', 404, 'NOT_FOUND');

    await prisma.show.update({
      where: { id },
      data: { isActive: false },
    });

    await cacheService.del(`shows:detail:${id}`);

    return res.status(200).json({
      success: true,
      message: 'Show deactivated successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getShows,
  getShowById,
  getShowSeats,
  createShow,
  deleteShow,
};
