/**
 * src/routes/admin.routes.js — Admin Endpoints
 *
 * MOUNTED AT:
 *   /api/admin (and /api/v1/admin)
 *
 * All routes require authenticate + authorize('ADMIN')
 */

'use strict';

const express = require('express');
const multer = require('multer');
const {
  getAdminOverview,
  getAdminBookings,
  uploadImage,
  createAdminShow,
  deleteAdminShow,
} = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Memory storage for multer so we can stream to Cloudinary directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// Protect all admin routes
router.use(authenticate, authorize('ADMIN'));

router.get('/overview', getAdminOverview);
router.get('/bookings', getAdminBookings);
router.post('/upload-image', upload.single('image'), uploadImage);
router.post('/shows', createAdminShow);
router.delete('/shows/:id', deleteAdminShow);

module.exports = router;
