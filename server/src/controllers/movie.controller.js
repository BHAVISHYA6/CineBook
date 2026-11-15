/**
 * src/controllers/movie.controller.js — Movies Controller
 *
 * Implements public and admin endpoints for Movies.
 */

'use strict';

const prisma = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/movies
 * List movies with pagination and optional search/filter.
 * Query params: page, limit, search, genre, language, isActive
 */
async function getMovies(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, genre, language, isActive } = req.query;

    const where = {};

    // By default for public users, show only active movies unless explicitly requested (e.g. by admin)
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (genre && genre.trim()) {
      where.genre = { has: genre.trim() };
    }

    if (language && language.trim()) {
      where.language = { equals: language.trim(), mode: 'insensitive' };
    }

    const [total, movies] = await Promise.all([
      prisma.movie.count({ where }),
      prisma.movie.findMany({
        where,
        skip,
        take: limit,
        orderBy: { releaseDate: 'desc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        movies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/movies/:id
 * Retrieve details for a single movie.
 */
async function getMovieById(req, res, next) {
  try {
    const { id } = req.params;

    const movie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!movie) {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: { movie },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/movies/:id/shows
 * Retrieve scheduled shows for a movie, optionally filtered by city or date.
 */
async function getMovieShows(req, res, next) {
  try {
    const { id } = req.params;
    const { city, date } = req.query;

    const movie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!movie) {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }

    const showWhere = {
      movieId: id,
      isActive: true,
    };

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw new AppError('Invalid date format for filter. Expected YYYY-MM-DD.', 400, 'VALIDATION_ERROR');
      }
      const startOfDay = new Date(parsedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      showWhere.startsAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else {
      // Default: show upcoming shows from now onwards
      showWhere.startsAt = {
        gte: new Date(),
      };
    }

    if (city && city.trim()) {
      showWhere.screen = {
        theatre: {
          city: { equals: city.trim(), mode: 'insensitive' },
          isActive: true,
        },
      };
    }

    const shows = await prisma.show.findMany({
      where: showWhere,
      include: {
        screen: {
          include: {
            theatre: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: {
        movie: {
          id: movie.id,
          title: movie.title,
          durationMin: movie.durationMin,
        },
        shows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/movies (Admin)
 * Create a new movie in the catalog.
 */
async function createMovie(req, res, next) {
  try {
    const {
      title,
      description,
      durationMin,
      genre,
      language,
      rating,
      posterUrl,
      releaseDate,
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new AppError('Title is required', 400, 'VALIDATION_ERROR');
    }

    if (!durationMin || typeof durationMin !== 'number' || durationMin <= 0) {
      throw new AppError('durationMin is required and must be a positive integer', 400, 'VALIDATION_ERROR');
    }

    if (!language || typeof language !== 'string' || !language.trim()) {
      throw new AppError('Language is required', 400, 'VALIDATION_ERROR');
    }

    if (!releaseDate) {
      throw new AppError('releaseDate is required', 400, 'VALIDATION_ERROR');
    }

    const parsedReleaseDate = new Date(releaseDate);
    if (isNaN(parsedReleaseDate.getTime())) {
      throw new AppError('Invalid releaseDate format', 400, 'VALIDATION_ERROR');
    }

    let parsedGenre = [];
    if (Array.isArray(genre)) {
      parsedGenre = genre.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim());
    } else if (typeof genre === 'string' && genre.trim()) {
      parsedGenre = [genre.trim()];
    }

    const movie = await prisma.movie.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        durationMin: Math.floor(durationMin),
        genre: parsedGenre,
        language: language.trim(),
        rating: rating ? rating.trim() : null,
        posterUrl: posterUrl ? posterUrl.trim() : null,
        releaseDate: parsedReleaseDate,
        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Movie created successfully',
      data: { movie },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/movies/:id (Admin)
 * Update existing movie details.
 */
async function updateMovie(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      durationMin,
      genre,
      language,
      rating,
      posterUrl,
      releaseDate,
      isActive,
    } = req.body || {};

    const existingMovie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!existingMovie) {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }

    const updateData = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        throw new AppError('Title must be a non-empty string', 400, 'VALIDATION_ERROR');
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    if (durationMin !== undefined) {
      if (typeof durationMin !== 'number' || durationMin <= 0) {
        throw new AppError('durationMin must be a positive integer', 400, 'VALIDATION_ERROR');
      }
      updateData.durationMin = Math.floor(durationMin);
    }

    if (genre !== undefined) {
      if (Array.isArray(genre)) {
        updateData.genre = genre.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim());
      } else if (typeof genre === 'string') {
        updateData.genre = [genre.trim()];
      }
    }

    if (language !== undefined) {
      if (typeof language !== 'string' || !language.trim()) {
        throw new AppError('Language must be a non-empty string', 400, 'VALIDATION_ERROR');
      }
      updateData.language = language.trim();
    }

    if (rating !== undefined) {
      updateData.rating = rating ? rating.trim() : null;
    }

    if (posterUrl !== undefined) {
      updateData.posterUrl = posterUrl ? posterUrl.trim() : null;
    }

    if (releaseDate !== undefined) {
      const parsedDate = new Date(releaseDate);
      if (isNaN(parsedDate.getTime())) {
        throw new AppError('Invalid releaseDate format', 400, 'VALIDATION_ERROR');
      }
      updateData.releaseDate = parsedDate;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', 400, 'VALIDATION_ERROR');
      }
      updateData.isActive = isActive;
    }

    const updatedMovie = await prisma.movie.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Movie updated successfully',
      data: { movie: updatedMovie },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/movies/:id (Admin)
 * Soft deactivate movie (sets isActive = false).
 */
async function deleteMovie(req, res, next) {
  try {
    const { id } = req.params;

    const existingMovie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!existingMovie) {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }

    const movie = await prisma.movie.update({
      where: { id },
      data: { isActive: false },
    });

    return res.status(200).json({
      success: true,
      message: 'Movie deactivated successfully',
      data: { movie },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMovies,
  getMovieById,
  getMovieShows,
  createMovie,
  updateMovie,
  deleteMovie,
};
