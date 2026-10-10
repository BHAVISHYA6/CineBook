/**
 * src/routes/health.routes.js — Health Check Route Definitions
 *
 * WHY SEPARATE ROUTES FROM CONTROLLERS:
 *   Routes define the URL structure and HTTP method mapping.
 *   Controllers contain the request/response handling logic.
 *   Keeping them separate makes it trivial to add middleware to specific
 *   routes (e.g., rate limiting the DB check) without cluttering controllers.
 */

'use strict';

const { Router } = require('express');
const { getHealth, getDbHealth } = require('../controllers/health.controller');

const router = Router();

// GET /health — Basic liveness check (no DB required)
router.get('/', getHealth);

// GET /health/db — Database readiness check
router.get('/db', getDbHealth);

module.exports = router;
