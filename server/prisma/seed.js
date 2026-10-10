/**
 * prisma/seed.js — CineBook Sample Data Seeder
 *
 * WHY A SEED SCRIPT:
 *   Development requires realistic data to test seat maps, booking flows,
 *   and UI rendering without having to manually insert rows. This script
 *   inserts a small but representative dataset.
 *
 * IDEMPOTENCY:
 *   The script uses upsert (or deleteMany + create) patterns so it can be
 *   safely re-run. Running it twice will not create duplicate theatres, etc.
 *   NOTE: ShowSeat rows are regenerated each run to reflect the current
 *   Seat layout — delete+recreate is acceptable in dev/seed contexts.
 *
 * HOW TO RUN:
 *   cd server
 *   node prisma/seed.js
 *   (or via: npm run db:seed)
 *
 * PREREQUISITES:
 *   - PostgreSQL running and DATABASE_URL set in server/.env
 *   - Migrations applied: npm run db:migrate
 */

'use strict';

require('dotenv').config(); // Load DATABASE_URL from server/.env

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CineBook seed...\n');

  // ─── MOVIES ───────────────────────────────────────────────────────────────
  // upsert: if a movie with this title already exists, update it; otherwise create.
  const interstellar = await prisma.movie.upsert({
    where: { id: 'movie-interstellar' },
    update: {},
    create: {
      id: 'movie-interstellar',
      title: 'Interstellar',
      description:
        "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
      durationMin: 169,
      genre: ['Sci-Fi', 'Adventure', 'Drama'],
      language: 'English',
      rating: 'UA',
      posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      releaseDate: new Date('2014-11-07'),
      isActive: true,
    },
  });

  const rrr = await prisma.movie.upsert({
    where: { id: 'movie-rrr' },
    update: {},
    create: {
      id: 'movie-rrr',
      title: 'RRR',
      description:
        'A fictional story about two legendary Indian revolutionaries and their journey away from home.',
      durationMin: 182,
      genre: ['Action', 'Drama', 'History'],
      language: 'Telugu',
      rating: 'UA',
      posterUrl: 'https://image.tmdb.org/t/p/w500/nEufeZlyAOLqO6larqbyFYzsJBn.jpg',
      releaseDate: new Date('2022-03-25'),
      isActive: true,
    },
  });

  const oppenheimer = await prisma.movie.upsert({
    where: { id: 'movie-oppenheimer' },
    update: {},
    create: {
      id: 'movie-oppenheimer',
      title: 'Oppenheimer',
      description:
        'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
      durationMin: 180,
      genre: ['Biography', 'Drama', 'History'],
      language: 'English',
      rating: 'UA',
      posterUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      releaseDate: new Date('2023-07-21'),
      isActive: true,
    },
  });

  console.log(`✅ Movies seeded: ${[interstellar, rrr, oppenheimer].map((m) => m.title).join(', ')}`);

  // ─── THEATRE & SCREENS ────────────────────────────────────────────────────
  const theatre1 = await prisma.theatre.upsert({
    where: { id: 'theatre-pvr-phoenix' },
    update: {},
    create: {
      id: 'theatre-pvr-phoenix',
      name: 'PVR Phoenix MarketCity',
      city: 'Mumbai',
      address: 'Phoenix MarketCity Mall, Kurla West, Mumbai 400070',
      isActive: true,
    },
  });

  const theatre2 = await prisma.theatre.upsert({
    where: { id: 'theatre-inox-forum' },
    update: {},
    create: {
      id: 'theatre-inox-forum',
      name: 'INOX Forum Shantiniketan',
      city: 'Bengaluru',
      address: 'Forum Shantiniketan Mall, Whitefield, Bengaluru 560048',
      isActive: true,
    },
  });

  console.log(`✅ Theatres seeded: ${[theatre1, theatre2].map((t) => t.name).join(', ')}`);

  // ─── SCREENS ──────────────────────────────────────────────────────────────
  const screenA = await prisma.screen.upsert({
    where: { id: 'screen-pvr-A' },
    update: {},
    create: {
      id: 'screen-pvr-A',
      name: 'Screen A – Dolby Atmos',
      totalSeats: 30, // 3 rows × 10 seats — small for easy dev testing
      theatreId: theatre1.id,
    },
  });

  const screenB = await prisma.screen.upsert({
    where: { id: 'screen-pvr-B' },
    update: {},
    create: {
      id: 'screen-pvr-B',
      name: 'Screen B – 4DX',
      totalSeats: 20, // 2 rows × 10 seats
      theatreId: theatre1.id,
    },
  });

  const screenC = await prisma.screen.upsert({
    where: { id: 'screen-inox-C' },
    update: {},
    create: {
      id: 'screen-inox-C',
      name: 'Screen C – Premium',
      totalSeats: 20,
      theatreId: theatre2.id,
    },
  });

  console.log(`✅ Screens seeded: ${[screenA, screenB, screenC].map((s) => s.name).join(', ')}`);

  // ─── SEATS ────────────────────────────────────────────────────────────────
  // Helper: create seats for a screen if they don't exist.
  // Layout: rows × numbers. Returns array of created/found seats.
  async function ensureSeats(screenId, rows, seatsPerRow) {
    const seats = [];
    for (const row of rows) {
      for (let num = 1; num <= seatsPerRow; num++) {
        // Determine class by row — last row is RECLINER, first two rows STANDARD, rest PREMIUM.
        const rowIndex = rows.indexOf(row);
        let seatClass = 'STANDARD';
        if (rowIndex === rows.length - 1) seatClass = 'RECLINER';
        else if (rowIndex >= Math.floor(rows.length / 2)) seatClass = 'PREMIUM';

        const seat = await prisma.seat.upsert({
          where: { screenId_row_number: { screenId, row, number: num } },
          update: {},
          create: { screenId, row, number: num, class: seatClass },
        });
        seats.push(seat);
      }
    }
    return seats;
  }

  // Screen A: 3 rows (A, B, C) × 10 seats
  const seatsA = await ensureSeats(screenA.id, ['A', 'B', 'C'], 10);
  // Screen B: 2 rows × 10 seats
  const seatsB = await ensureSeats(screenB.id, ['A', 'B'], 10);
  // Screen C: 2 rows × 10 seats
  const seatsC = await ensureSeats(screenC.id, ['A', 'B'], 10);

  console.log(`✅ Seats seeded: Screen A=${seatsA.length}, Screen B=${seatsB.length}, Screen C=${seatsC.length}`);

  // ─── SHOWS ────────────────────────────────────────────────────────────────
  // Shows start tomorrow onwards so they always appear as "upcoming" during dev.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0); // 10:00 AM

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  // Show 1: Interstellar on Screen A (Morning)
  const show1 = await prisma.show.upsert({
    where: { id: 'show-interstellar-A-1' },
    update: {},
    create: {
      id: 'show-interstellar-A-1',
      movieId: interstellar.id,
      screenId: screenA.id,
      startsAt: tomorrow,
      endsAt: addMinutes(tomorrow, interstellar.durationMin),
      basePricePaise: 25000, // ₹250.00
      isActive: true,
    },
  });

  // Show 2: RRR on Screen B (Afternoon)
  const afternoonTomorrow = new Date(tomorrow);
  afternoonTomorrow.setHours(14, 30, 0, 0);
  const show2 = await prisma.show.upsert({
    where: { id: 'show-rrr-B-1' },
    update: {},
    create: {
      id: 'show-rrr-B-1',
      movieId: rrr.id,
      screenId: screenB.id,
      startsAt: afternoonTomorrow,
      endsAt: addMinutes(afternoonTomorrow, rrr.durationMin),
      basePricePaise: 30000, // ₹300.00
      isActive: true,
    },
  });

  // Show 3: Oppenheimer on Screen C (Evening)
  const eveningTomorrow = new Date(tomorrow);
  eveningTomorrow.setHours(19, 0, 0, 0);
  const show3 = await prisma.show.upsert({
    where: { id: 'show-oppenheimer-C-1' },
    update: {},
    create: {
      id: 'show-oppenheimer-C-1',
      movieId: oppenheimer.id,
      screenId: screenC.id,
      startsAt: eveningTomorrow,
      endsAt: addMinutes(eveningTomorrow, oppenheimer.durationMin),
      basePricePaise: 35000, // ₹350.00
      isActive: true,
    },
  });

  console.log(`✅ Shows seeded: ${[show1, show2, show3].map((s) => s.id).join(', ')}`);

  // ─── SHOW SEATS (Inventory) ───────────────────────────────────────────────
  // WHY DELETE+RECREATE:
  //   ShowSeat rows are derived from (Show, Seat) pairs. If re-seeded, we
  //   want a clean inventory. In production you would NEVER delete confirmed
  //   bookings, but in dev seed data this is safe.
  //
  // Price surcharge logic:
  //   STANDARD seats = basePricePaise
  //   PREMIUM seats  = basePricePaise + 5000 (₹50 surcharge)
  //   RECLINER seats = basePricePaise + 15000 (₹150 surcharge)

  async function seedShowSeats(show, seats) {
    // Delete existing ShowSeat rows for this show to allow clean re-seed.
    await prisma.showSeat.deleteMany({ where: { showId: show.id } });

    const surchargePaise = { STANDARD: 0, PREMIUM: 5000, RECLINER: 15000 };

    const data = seats.map((seat) => ({
      showId: show.id,
      seatId: seat.id,
      status: 'AVAILABLE',
      pricePaise: show.basePricePaise + (surchargePaise[seat.class] ?? 0),
    }));

    await prisma.showSeat.createMany({ data });
    return data.length;
  }

  const ss1 = await seedShowSeats(show1, seatsA);
  const ss2 = await seedShowSeats(show2, seatsB);
  const ss3 = await seedShowSeats(show3, seatsC);

  console.log(`✅ ShowSeats seeded: Show1=${ss1}, Show2=${ss2}, Show3=${ss3} seats`);

  // ─── ADMIN USER ───────────────────────────────────────────────────────────
  // Hash generated with bcryptjs for the placeholder password "admin123".
  // DO NOT use this password in production. Change it immediately.
  const bcrypt = require('bcryptjs');
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@cinebook.dev' },
    update: {},
    create: {
      email: 'admin@cinebook.dev',
      password: adminPasswordHash,
      name: 'CineBook Admin',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user seeded: admin@cinebook.dev (password: admin123 — change in production!)');
  console.log('\n🎬 Seed complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
