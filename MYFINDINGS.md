# CineBook - Project Findings & System Design Log

## 1. Project Objective and Final Tech Stack

### Project Objective
**CineBook** is a production-grade, end-to-end movie ticket booking platform designed to demonstrate real-world backend engineering and system design concepts, including:
- High-concurrency seat reservation handling with race-condition prevention.
- Real-time interactive seat map synchronization across concurrent users.
- Decoupled payment processing with idempotency and webhook validation.
- Modular monolith architecture for high cohesion and low operational friction.

### Tech Stack
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js (Modular Monolith pattern)
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Cache & Concurrency**: Redis (TTL key locks & reservation coordination)
- **Payments**: Razorpay (Test Mode & Webhook Signature Verification)
- **Real-time Updates**: Socket.IO (WebSockets for live seat map updates)
- **Authentication**: JWT (JSON Web Tokens) & bcrypt (password hashing)
- **Testing & Benchmarking**: Vitest / Jest, Supertest (API testing), Autocannon (Load & concurrency testing), Postman
- **Architecture**: Modular Monolith

---

## 2. Architecture & Important Design Decisions

### High-Level Architecture Diagram
```
                          +-----------------------------+
                          |      React + Vite App       |
                          |   (Tailwind CSS, Socket.IO) |
                          +--------------+--------------+
                                         |
                              REST APIs  | Socket.IO WebSockets
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
     | (Persistent DB) |        | (Seat Lock TTL) |        |  (Test Mode)    |
     +-----------------+        +-----------------+        +-----------------+
```

### Proposed Folder Structure (Modular Monolith)
```
CineBook/
├── MYFINDINGS.md
├── README.md
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── index.js             # Express app + Socket.IO server initialization
│   │   ├── config/              # Redis, Prisma, Razorpay configs
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   └── razorpay.js
│   │   ├── middlewares/         # Auth verification, Role guards, Error handler
│   │   │   ├── auth.middleware.js
│   │   │   └── error.middleware.js
│   │   ├── modules/             # Domain Modules
│   │   │   ├── auth/            # Auth controller, service, routes
│   │   │   ├── movies/          # Movies CRUD & catalog routes
│   │   │   ├── theaters/        # Theaters & screens routes
│   │   │   ├── shows/           # Showtime management routes
│   │   │   ├── locks/           # Redis temporary seat reservation logic
│   │   │   ├── bookings/        # Booking lifecycle & DB transactions
│   │   │   ├── payments/        # Razorpay order generation & webhook handler
│   │   │   └── admin/           # Admin management & analytics
│   │   ├── sockets/             # Socket.IO event handlers (room per showId)
│   │   └── utils/               # JWT helper, custom API response error classes
│   └── tests/                   # Integration tests with Supertest & Vitest/Jest
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/                 # Axios / Fetch client API wrappers
        ├── context/             # AuthContext, SocketContext
        ├── components/          # UI components (Navbar, Modal, SeatGrid, Seat)
        ├── pages/               # Home, MovieDetails, SeatPicker, Checkout, Bookings, Admin
        └── hooks/               # Custom custom hooks (useAuth, useSocket)
```

### Key Design Decisions
1. **Modular Monolith Pattern**: Single deployable Express service partitioned cleanly into domain modules (`auth`, `movies`, `theaters`, `shows`, `bookings`, `payments`, `admin`). This enforces domain separation without microservices infrastructure overhead.
2. **Two-Phase Concurrency Control for Seat Reservations**:
   - **Phase 1 (Temporary Hold)**: Atomic Redis `SETNX` or key reservation with a 10-minute TTL (`lock:show:{showId}:seat:{seatId}`) prevents race conditions when users pick seats concurrently.
   - **Phase 2 (Permanent DB Lock)**: Upon payment verification, a PostgreSQL database transaction converts the hold into a `CONFIRMED` booking in Prisma and releases/cleans up the Redis key.
3. **Real-time WebSockets Sync**: Socket.IO rooms partitioned by `showId` broadcast real-time seat status updates (`LOCKED`, `AVAILABLE`, `BOOKED`) to all active clients viewing that showtime.
4. **Idempotent Payment & Webhook Handling**: Razorpay webhook signature is validated using HMAC SHA256. Webhook processing is idempotent to handle duplicate delivery safely.

### Required Environment Variables

#### Server (`server/.env.example`)
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cinebook_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_jwt_secret_key_here"
JWT_EXPIRES_IN="7d"
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"
CLIENT_URL="http://localhost:5173"
```

#### Client (`client/.env.example`)
```env
VITE_API_BASE_URL="http://localhost:5000/api/v1"
VITE_SOCKET_URL="http://localhost:5000"
VITE_RAZORPAY_KEY_ID="rzp_test_your_key_id"
```

---

## 3. Planned Implementation Phases

- **Phase 0: Environment Inspection & Blueprint Design (COMPLETED)**
  - Repository inspection and verification.
  - Creation and maintenance of `MYFINDINGS.md`.
  - Architecture blueprinting and environment setup definition.

- **Phase 1: Backend Foundation, Prisma Schema & Auth Module**
  - Express server boilerplate setup (`server/`).
  - Prisma schema definition (User, Cinema, Theater, Screen, Movie, Show, Seat, Booking, Payment).
  - DB migrations and seeding script with realistic movie & theater data.
  - Authentication & Authorization module (JWT, bcrypt, User/Admin RBAC).

- **Phase 2: Redis Seat Locking Engine & Socket.IO Real-time Sync**
  - Redis reservation manager with atomic key creation and TTL expiry events.
  - Endpoint to hold and release seats temporarily.
  - Socket.IO server setup with room-based broadcast for live seat grid UI updates.

- **Phase 3: Booking Engine & Razorpay Payment Integration**
  - Booking service with ACID Prisma transactions.
  - Razorpay order creation integration and payment verification handler.
  - Secure Razorpay webhook listener with signature verification.

- **Phase 4: Modern React Frontend (Vite + Tailwind CSS)**
  - Client application initialization (`client/`).
  - Dark-mode luxury cinema UI theme and typography system.
  - Interactive live seat map with dynamic color-coding and real-time Socket updates.
  - Razorpay payment modal integration and user booking history view.
  - Admin dashboard for movie, showtime, and theater management.

- **Phase 5: Automated Testing, Concurrency Benchmarking & Documentation**
  - Integration tests with Supertest and Jest/Vitest for Auth, Seat Locking, and Booking endpoints.
  - Autocannon load testing script to test concurrent seat reservations under high traffic.
  - Documentation of performance throughput and latencies.

---

## 4. Phase Execution Log

### Phase 0: Project Setup & Repository Inspection
- **Status**: Completed
- **Implemented**: 
  - Inspected workspace repository. Verified structure contains `MYFINDINGS.md` and initial git repository configuration.
  - Documented full tech stack, modular monolith architecture, folder layout, design decisions, environment variables, and implementation roadmap.
- **Files Created/Modified**:
  - `MYFINDINGS.md`: Maintained system design log and findings document.
- **Rationale**: Establish single source of truth for architectural requirements and progress tracking before feature coding.

---

## 5. Tests Executed & Benchmark Results

*(No automated or load tests executed yet. Initial blueprint and setup phase.)*

---

## 6. Bugs Encountered & Fixes Applied

*(No runtime bugs encountered yet.)*

---

## 7. Performance Measurements

*(Performance measurements with Autocannon will be executed during Phase 5 under multi-user concurrent seat reservation workloads.)*

---

## 8. Known Limitations & Pending Work

- `server/` directory setup pending (Node.js, Express, Prisma, Redis, Socket.IO).
- `client/` directory setup pending (React, Vite, Tailwind CSS).
- Prisma database schema creation and seed script pending.

---

## 9. Next Steps and Remaining Tasks

1. Create `server/` directory and initialize `package.json` with dependencies (`express`, `@prisma/client`, `ioredis`, `socket.io`, `jsonwebtoken`, `bcryptjs`, `razorpay`, `cors`, `dotenv`).
2. Create `prisma/schema.prisma` modeling entities and relations.
3. Setup PostgreSQL database connection and run initial migration.
4. Build `auth` domain module and JWT middleware.
