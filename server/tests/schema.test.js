/**
 * tests/schema.test.js — Prisma Schema Validation & Constraint Tests
 *
 * WHAT IS TESTED:
 *   1. Prisma client can be imported without errors (schema is valid).
 *   2. Unique constraint on ShowSeat (showId, seatId) rejects duplicates.
 *   3. Foreign key constraints reject records referencing non-existent IDs.
 *
 * IMPORTANT:
 *   These tests REQUIRE a running PostgreSQL database with migrations applied.
 *   If Postgres is unavailable, they will fail/be skipped with a clear message.
 *   They use a separate test schema (cinebook_test) to avoid polluting dev data.
 *
 * HOW TO RUN:
 *   1. Ensure Postgres is running.
 *   2. Create a test DB: createdb cinebook_test
 *   3. Set DATABASE_URL in .env to cinebook_test for test runs, OR
 *      set TEST_DATABASE_URL as a separate env var.
 *   4. Run migrations: DATABASE_URL=<test_url> npx prisma migrate deploy
 *   5. npm test
 *
 * NOTE FOR THIS PHASE:
 *   These tests are written and validated for schema correctness.
 *   Actual DB execution depends on your local Postgres setup.
 *   Results are documented in MYFINDINGS.md.
 */

'use strict';

// Use a test-specific DATABASE_URL if set, otherwise fall back to default.
// This prevents test runs from polluting the development database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');

let prisma;
let dbAvailable = false;

// ─── SETUP & TEARDOWN ─────────────────────────────────────────────────────────
beforeAll(async () => {
  try {
    prisma = new PrismaClient();
    // Quick connectivity check
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
    console.log('  ✅ DB connection established for schema tests');
  } catch (err) {
    console.warn(
      '\n  ⚠️  Database unavailable. Schema constraint tests will be SKIPPED.\n' +
        '     Start PostgreSQL and apply migrations to run these tests.\n'
    );
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

// ─── HELPER ───────────────────────────────────────────────────────────────────
/**
 * skipIfNoDb — Calls test.skip if the database is not available.
 * Used to keep test output clean when Postgres is not running locally.
 */
function itWithDb(name, fn) {
  if (!dbAvailable) {
    it.skip(`[DB REQUIRED] ${name}`, fn);
  } else {
    it(name, fn);
  }
}

// ─── PRISMA CLIENT ────────────────────────────────────────────────────────────
describe('Prisma Client', () => {
  it('should import PrismaClient without errors', () => {
    // If the Prisma schema is invalid or generate hasn't been run,
    // this import will throw. Passing means the generated client is valid.
    expect(() => require('@prisma/client')).not.toThrow();
  });
});

// ─── UNIQUE CONSTRAINT: ShowSeat ──────────────────────────────────────────────
describe('ShowSeat unique constraint (showId, seatId)', () => {
  // Clean up test data before and after
  beforeEach(async () => {
    if (!dbAvailable) return;
    // Delete in dependency order (bookings reference show_seats, etc.)
    await prisma.showSeat.deleteMany({ where: { showId: 'test-show-constraint' } });
    await prisma.show.deleteMany({ where: { id: 'test-show-constraint' } });
    await prisma.seat.deleteMany({ where: { screenId: 'test-screen-constraint' } });
    await prisma.screen.deleteMany({ where: { id: 'test-screen-constraint' } });
    await prisma.movie.deleteMany({ where: { id: 'test-movie-constraint' } });
    await prisma.theatre.deleteMany({ where: { id: 'test-theatre-constraint' } });
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await prisma.showSeat.deleteMany({ where: { showId: 'test-show-constraint' } });
    await prisma.show.deleteMany({ where: { id: 'test-show-constraint' } });
    await prisma.seat.deleteMany({ where: { screenId: 'test-screen-constraint' } });
    await prisma.screen.deleteMany({ where: { id: 'test-screen-constraint' } });
    await prisma.movie.deleteMany({ where: { id: 'test-movie-constraint' } });
    await prisma.theatre.deleteMany({ where: { id: 'test-theatre-constraint' } });
  });

  itWithDb('should reject duplicate (showId, seatId) pair in ShowSeat', async () => {
    // Create minimal required parent records
    await prisma.theatre.create({
      data: { id: 'test-theatre-constraint', name: 'Test Theatre', city: 'Test City', address: 'Test Addr' },
    });
    await prisma.screen.create({
      data: { id: 'test-screen-constraint', name: 'Screen X', totalSeats: 1, theatreId: 'test-theatre-constraint' },
    });
    await prisma.movie.create({
      data: {
        id: 'test-movie-constraint',
        title: 'Test Movie',
        durationMin: 90,
        genre: ['Drama'],
        language: 'English',
        releaseDate: new Date('2024-01-01'),
      },
    });
    const seat = await prisma.seat.create({
      data: { screenId: 'test-screen-constraint', row: 'A', number: 1 },
    });
    await prisma.show.create({
      data: {
        id: 'test-show-constraint',
        movieId: 'test-movie-constraint',
        screenId: 'test-screen-constraint',
        startsAt: new Date('2099-01-01T10:00:00Z'),
        endsAt: new Date('2099-01-01T12:00:00Z'),
        basePricePaise: 20000,
      },
    });

    // First insert should succeed
    await prisma.showSeat.create({
      data: { showId: 'test-show-constraint', seatId: seat.id, pricePaise: 20000 },
    });

    // Second insert with same (showId, seatId) must throw a unique constraint error (P2002)
    await expect(
      prisma.showSeat.create({
        data: { showId: 'test-show-constraint', seatId: seat.id, pricePaise: 20000 },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ─── FOREIGN KEY CONSTRAINT ───────────────────────────────────────────────────
describe('Foreign key constraint enforcement', () => {
  itWithDb('should reject a Show referencing a non-existent Movie', async () => {
    await expect(
      prisma.show.create({
        data: {
          movieId: 'non-existent-movie-id',
          screenId: 'non-existent-screen-id',
          startsAt: new Date('2099-01-01T10:00:00Z'),
          endsAt: new Date('2099-01-01T12:00:00Z'),
          basePricePaise: 20000,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  itWithDb('should reject a Booking referencing a non-existent User', async () => {
    await expect(
      prisma.booking.create({
        data: {
          userId: 'non-existent-user-id',
          showId: 'non-existent-show-id',
          totalAmountPaise: 20000,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
