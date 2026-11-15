/**
 * src/controllers/theatre.controller.js — Theatres and Screens Controller
 *
 * Implements public and admin endpoints for Theatres and Screens.
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/theatres
 * List theatres with optional city filter.
 * Query params: city, isActive
 */
async function getTheatres(req, res, next) {
  try {
    const { city, isActive } = req.query;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    if (city && city.trim()) {
      where.city = { equals: city.trim(), mode: 'insensitive' };
    }

    const theatres = await prisma.theatre.findMany({
      where,
      include: {
        screens: {
          select: {
            id: true,
            name: true,
            totalSeats: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { theatres },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/theatres/:id
 * Retrieve details for a single theatre including its screens.
 */
async function getTheatreById(req, res, next) {
  try {
    const { id } = req.params;

    const theatre = await prisma.theatre.findUnique({
      where: { id },
      include: {
        screens: {
          include: {
            _count: {
              select: { seats: true },
            },
          },
        },
      },
    });

    if (!theatre) {
      throw new AppError('Theatre not found', 404, 'NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: { theatre },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/theatres (Admin)
 * Create a new physical theatre.
 */
async function createTheatre(req, res, next) {
  try {
    const { name, city, address } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Name is required', 400, 'VALIDATION_ERROR');
    }

    if (!city || typeof city !== 'string' || !city.trim()) {
      throw new AppError('City is required', 400, 'VALIDATION_ERROR');
    }

    if (!address || typeof address !== 'string' || !address.trim()) {
      throw new AppError('Address is required', 400, 'VALIDATION_ERROR');
    }

    const theatre = await prisma.theatre.create({
      data: {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Theatre created successfully',
      data: { theatre },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/theatres/:id/screens (Admin)
 * Create an auditorium screen within a theatre and configure its physical seat layout.
 * Accepts:
 *   name: string
 *   seatLayout: { rows: [{ row: 'A', count: 10, class: 'STANDARD' }, ...] }
 * OR
 *   totalSeats: number (defaults layout to rows of 10)
 */
async function createScreen(req, res, next) {
  try {
    const { id: theatreId } = req.params;
    const { name, seatLayout, totalSeats } = req.body || {};

    const theatre = await prisma.theatre.findUnique({
      where: { id: theatreId },
    });

    if (!theatre) {
      throw new AppError('Theatre not found', 404, 'NOT_FOUND');
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Screen name is required', 400, 'VALIDATION_ERROR');
    }

    // Build seats array based on seatLayout or totalSeats
    const seatsToCreate = [];
    const validClasses = ['STANDARD', 'PREMIUM', 'RECLINER'];

    if (seatLayout && Array.isArray(seatLayout.rows) && seatLayout.rows.length > 0) {
      const seenPositions = new Set();
      for (const rowDef of seatLayout.rows) {
        const rowLabel = (rowDef.row || '').toUpperCase().trim();
        const count = parseInt(rowDef.count, 10);
        const seatClass = (rowDef.class || 'STANDARD').toUpperCase().trim();

        if (!rowLabel) {
          throw new AppError('Each row configuration must have a valid row identifier (e.g. "A")', 400, 'VALIDATION_ERROR');
        }

        if (isNaN(count) || count <= 0) {
          throw new AppError(`Row ${rowLabel} must have a positive seat count`, 400, 'VALIDATION_ERROR');
        }

        if (!validClasses.includes(seatClass)) {
          throw new AppError(`Invalid seat class "${seatClass}". Allowed: ${validClasses.join(', ')}`, 400, 'VALIDATION_ERROR');
        }

        for (let num = 1; num <= count; num++) {
          const key = `${rowLabel}-${num}`;
          if (seenPositions.has(key)) {
            throw new AppError(`Duplicate seat position specified: Row ${rowLabel} Seat ${num}`, 400, 'VALIDATION_ERROR');
          }
          seenPositions.add(key);

          seatsToCreate.push({
            row: rowLabel,
            number: num,
            class: seatClass,
          });
        }
      }
    } else if (totalSeats && typeof totalSeats === 'number' && totalSeats > 0) {
      // Auto-generate rows of 10 seats
      const numSeats = Math.floor(totalSeats);
      const seatsPerRow = 10;
      for (let i = 0; i < numSeats; i++) {
        const rowIndex = Math.floor(i / seatsPerRow);
        const seatNum = (i % seatsPerRow) + 1;
        const rowLabel = String.fromCharCode(65 + (rowIndex % 26)); // A, B, C...
        seatsToCreate.push({
          row: rowLabel,
          number: seatNum,
          class: 'STANDARD',
        });
      }
    } else {
      throw new AppError('Either seatLayout (rows array) or totalSeats (positive integer) must be provided', 400, 'VALIDATION_ERROR');
    }

    // Execute Screen and Seat creation within a Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      const screen = await tx.screen.create({
        data: {
          name: name.trim(),
          theatreId,
          totalSeats: seatsToCreate.length,
        },
      });

      // Prepare seats with screenId
      const seatDataWithScreen = seatsToCreate.map((seat) => ({
        ...seat,
        screenId: screen.id,
      }));

      await tx.seat.createMany({
        data: seatDataWithScreen,
      });

      const fullScreen = await tx.screen.findUnique({
        where: { id: screen.id },
        include: {
          seats: {
            orderBy: [{ row: 'asc' }, { number: 'asc' }],
          },
        },
      });

      return fullScreen;
    });

    return res.status(201).json({
      success: true,
      message: 'Screen and seat layout created successfully',
      data: { screen: result },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTheatres,
  getTheatreById,
  createTheatre,
  createScreen,
};
