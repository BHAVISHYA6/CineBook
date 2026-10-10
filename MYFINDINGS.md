# CineBook - Project Findings & System Design Log

## 1. Project Objective and Final Tech Stack

### Project Objective
**CineBook** is a production-grade movie ticket booking platform designed to demonstrate real-world backend engineering, system design, concurrency handling (seat reservation/locking), real-time seat availability updates, payment integration, and modular monolith architecture principles.

### Tech Stack
- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js, Express.js (Modular Monolith pattern)
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Cache & Concurrency**: Redis (Seat locking key-value store with TTL, distributed locking / concurrency handling)
- **Payments**: Razorpay (Test Mode integration & webhook signature validation)
- **Real-time Updates**: Socket.IO (Live seat mapping & status broadcast)
- **Authentication**: JWT (JSON Web Tokens) & bcrypt (password hashing)
- **Testing & Benchmarking**: Vitest/Jest, Supertest (API testing), Autocannon (Load & concurrency testing), Postman collection
- **Architecture**: Modular Monolith (`client/` for Vite/React frontend, `server/` for Express backend structured by domain modules)

---

## 2. Architecture and Important Design Decisions

### High-Level System Architecture
```
                         +-----------------------------+
                         |      React + Vite App       |
                         |   (Tailwind CSS, Socket.io) |
                         +--------------+--------------+
                                        |
                             REST APIs  | Socket.IO
                                        v
                         +--------------+--------------+
                         |   Express API Gateway /     |
                         |     Modular Monolith        |
                         +-------+------+------+-------+
                                 |      |      |
             +-------------------+      |      +-------------------+
             v                          v                          v
    +-----------------+        +-----------------+        +-----------------+
    |   PostgreSQL    |        |      Redis      |        | Razorpay API    |
    | (Persistent Storage)     | (Seat Lock TTL) |        |  (Test Payment) |
    +-----------------+        +-----------------+        +-----------------+
```

### Key Design Decisions
1. **Modular Monolith Architecture**:
   - Organized into domain modules (`auth`, `movies`, `theaters`, `shows`, `bookings`, `payments`, `admin`).
   - Keeps code clean, decoupled, and easy to refactor into microservices if needed, without the operational complexity of distributed systems.
2. **Concurrency Control & Temporary Seat Locking**:
   - Prevent race conditions during high-demand booking windows (e.g., flash sales).
   - Redis key-value with TTL (e.g., `lock:show:{showId}:seat:{seatId}` for 10 minutes) handles temporary locks.
   - DB transaction isolation / pessimistic or optimistic locking ensures idempotent booking confirmation upon payment.
3. **Real-time Socket.IO Sync**:
   - Rooms based on `showId` stream live seat hold/release events to all connected clients selecting seats simultaneously.
4. **Decoupled Payment Workflow**:
   - Temporary reservation is created with `PENDING` state.
   - Razorpay Order generated -> Client pays -> Webhook/Verify endpoint validates payment signature -> Booking status transitions to `CONFIRMED` and Redis lock transitions to DB permanent reservation.

---

## 3. Planned Implementation Phases

- **Phase 0: Environment Setup & Project Structure Initialization**
  - Folder structure (`server/` and `client/`).
  - Base configuration files (`package.json`, `.gitignore`, `.env.example`, Prisma setup).
- **Phase 1: Database Schema & Core Backend Services**
  - Prisma schemas (User, Cinema, Theater, Screen, Movie, Show, Seat, Booking, Payment).
  - Database migrations and seed script with sample movies, theaters, screens, and shows.
  - Authentication module (JWT, bcrypt, user/admin roles).
- **Phase 2: Seat Reservation Engine & Redis Locking**
  - Redis seat locking utility with atomic operations / Lua scripts or TTL keys.
  - Show seat status calculation (Available, Locked, Booked).
  - Socket.IO gateway for real-time seat lock updates.
- **Phase 3: Booking & Razorpay Payment Integration**
  - Booking creation API & Redis TTL timer.
  - Razorpay order creation & payment verification webhook/handler.
  - Idempotent booking confirmation and seat status update to DB.
- **Phase 4: Modern Frontend Development**
  - Vite + React setup with Tailwind CSS design tokens and theme.
  - Pages: Home / Movie Catalog, Showtimes & Theater Selector, Interactive Seat Grid (real-time with Socket.IO), Booking Summary & Razorpay Checkout Modal, User Bookings & Admin Dashboard.
- **Phase 5: Automated Testing, Load Testing & Performance Benchmarks**
  - Integration tests with Supertest and Jest/Vitest.
  - Autocannon concurrency load test scripts for seat booking endpoint.
  - Performance measurements & documentation.

---

## 4. Phase Execution Log

### Phase 0: Project Setup & Repository Inspection (COMPLETED)
- **Status**: Completed
- **Implemented**: Inspected repository (was empty). Initialized `MYFINDINGS.md` and prepared implementation blueprint.
- **Files Created/Modified**:
  - `MYFINDINGS.md`: Central document tracking design, decisions, test results, and status.
- **Rationale**: Establish baseline documentation before writing code.

---

## 5. Tests Executed & Benchmark Results

*(No automated or load tests executed yet. Initial setup phase.)*

---

## 6. Bugs Encountered & Fixes Applied

*(No bugs encountered yet.)*

---

## 7. Performance Measurements

*(Performance benchmarks will be conducted during Phase 5 using Autocannon.)*

---

## 8. Known Limitations & Pending Work

- Repository code structure is pending creation (`server/` and `client/`).
- Database schema setup and Redis connection pending.

---

## 9. Next Steps and Remaining Tasks

1. Create implementation plan artifact and gain approval.
2. Initialize `server/` with Node.js Express TypeScript/ESM setup, Prisma, Redis client, Socket.IO.
3. Initialize `client/` with Vite, React, and Tailwind CSS.
4. Define Prisma Schema for Users, Movies, Theaters, Screens, Shows, Seats, Bookings, and Payments.
