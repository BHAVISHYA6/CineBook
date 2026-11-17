/**
 * src/controllers/admin.controller.js — Admin Dashboard & Management Controller
 *
 * RESPONSIBILITY:
 *   - Overview statistics (movies count, theatres, shows, bookings, revenue)
 *   - Booking list with search, filter, and pagination
 *   - Image upload via Cloudinary for movie posters and backdrops
 *   - Show schedule overlap validation and conflict prevention
 *   - Advanced theatre/screen management
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { uploadImageBuffer } = require('../config/cloudinary');
const { invalidateShowCache } = require('../services/cache.service');

/**
 * GET /api/admin/overview
 * Returns system-wide statistics for the admin dashboard.
 */
async function getAdminOverview(req, res, next) {
  try {
    const [
      totalMovies,
      totalTheatres,
      totalShows,
      totalBookings,
      confirmedBookings,
      recentBookings,
    ] = await Promise.all([
      prisma.movie.count(),
      prisma.theatre.count(),
      prisma.show.count(),
      prisma.booking.count(),
      prisma.booking.findMany({
        where: { status: 'CONFIRMED' },
        select: { totalAmountPaise: true },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          show: {
            select: {
              startsAt: true,
              movie: { select: { title: true } },
              screen: { select: { name: true, theatre: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    const totalRevenuePaise = confirmedBookings.reduce(
      (sum, b) => sum + (b.totalAmountPaise || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalMovies,
          totalTheatres,
          totalShows,
          totalBookings,
          confirmedBookingsCount: confirmedBookings.length,
          totalRevenuePaise,
        },
        recentBookings,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/bookings
 * Returns all bookings with optional search, status filtering, and pagination.
 */
async function getAdminBookings(req, res, next) {
  try {
    const { status, search, page = '1', limit = '20' } = req.query || {};
    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { id: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { show: { movie: { title: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          show: {
            include: {
              movie: { select: { id: true, title: true, posterUrl: true } },
              screen: {
                select: {
                  id: true,
                  name: true,
                  theatre: { select: { id: true, name: true, city: true } },
                },
              },
            },
          },
          showSeats: {
            include: {
              seat: true,
            },
          },
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: Math.max(parseInt(page, 10) || 1, 1),
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/upload-image
 * Secure image upload endpoint (multer memoryStorage -> Cloudinary)
 */
async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No image file provided in request', 400, 'FILE_MISSING');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw new AppError(
        'Invalid file format. Allowed formats: JPEG, PNG, WEBP',
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // Limit 5MB
    if (req.file.size > 5 * 1024 * 1024) {
      throw new AppError('Image file size exceeds the 5MB limit', 400, 'FILE_TOO_LARGE');
    }

    const folder = req.body?.folder || 'cinebook/movies';
    const uploadResult = await uploadImageBuffer(req.file.buffer, folder);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to Cloudinary',
      data: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/shows
 * Creates a show with conflict detection (ensures no overlapping shows on the same screen)
 */
async function createAdminShow(req, res, next) {
  try {
    const { movieId, screenId, startsAt, basePricePaise } = req.body || {};

    if (!movieId || !screenId || !startsAt || !basePricePaise) {
      throw new AppError(
        'movieId, screenId, startsAt, and basePricePaise are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    const [movie, screen] = await Promise.all([
      prisma.movie.findUnique({ where: { id: movieId } }),
      prisma.screen.findUnique({
        where: { id: screenId },
        include: { seats: true },
      }),
    ]);

    if (!movie) throw new AppError('Movie not found', 404, 'NOT_FOUND');
    if (!screen) throw new AppError('Screen not found', 404, 'NOT_FOUND');
    if (screen.seats.length === 0) {
      throw new AppError('Screen has no physical seats configured', 400, 'NO_SEATS');
    }

    const showStart = new Date(startsAt);
    if (isNaN(showStart.getTime())) {
      throw new AppError('Invalid startsAt timestamp', 400, 'VALIDATION_ERROR');
    }

    // Compute end time: startsAt + movie.durationMin + 20 min buffer
    const durationMs = (movie.durationMin + 20) * 60 * 1000;
    const showEnd = new Date(showStart.getTime() + durationMs);

    // Conflict check: Screen cannot have overlapping shows
    const overlappingShow = await prisma.show.findFirst({
      where: {
        screenId,
        isActive: true,
        OR: [
          {
            startsAt: { lte: showEnd },
            endsAt: { gte: showStart },
          },
        ],
      },
    });

    if (overlappingShow) {
      throw new AppError(
        `Schedule conflict: Screen already has a show scheduled between ${overlappingShow.startsAt.toISOString()} and ${overlappingShow.endsAt.toISOString()}`,
        409,
        'SCHEDULE_CONFLICT'
      );
    }

    // Surcharge mapping
    const surchargeMap = { STANDARD: 0, PREMIUM: 5000, RECLINER: 15000 };

    // Transactionally create Show and its ShowSeat inventory
    const newShow = await prisma.$transaction(async (tx) => {
      const created = await tx.show.create({
        data: {
          movieId,
          screenId,
          startsAt: showStart,
          endsAt: showEnd,
          basePricePaise: parseInt(basePricePaise, 10),
          isActive: true,
        },
      });

      const showSeatsData = screen.seats.map((seat) => ({
        showId: created.id,
        seatId: seat.id,
        status: 'AVAILABLE',
        pricePaise: parseInt(basePricePaise, 10) + (surchargeMap[seat.class] || 0),
      }));

      await tx.showSeat.createMany({
        data: showSeatsData,
      });

      return created;
    });

    await invalidateShowCache(newShow.id, movieId);

    return res.status(201).json({
      success: true,
      message: 'Show created with seat inventory successfully',
      data: { show: newShow },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/shows/:id
 * Cancels or deactivates a show
 */
async function deleteAdminShow(req, res, next) {
  try {
    const { id } = req.params;
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) throw new AppError('Show not found', 404, 'NOT_FOUND');

    await prisma.show.update({
      where: { id },
      data: { isActive: false },
    });

    await invalidateShowCache(id, show.movieId);

    return res.status(200).json({
      success: true,
      message: 'Show deactivated successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminOverview,
  getAdminBookings,
  uploadImage,
  createAdminShow,
  deleteAdminShow,
};
