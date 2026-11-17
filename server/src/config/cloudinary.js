/**
 * src/config/cloudinary.js — Cloudinary Configuration & Uploader
 *
 * RESPONSIBILITY:
 *   Initializes Cloudinary v2 SDK using environment variables and provides
 *   helper functions to upload image buffers from memory storage.
 */

'use strict';

const cloudinary = require('cloudinary').v2;
const { config } = require('./env');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

/**
 * Upload an image buffer (from multer memoryStorage) to Cloudinary.
 * If Cloudinary is not configured or in demo mode, returns a mock URL or uploads.
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<{ url: string, publicId: string, format: string, bytes: number }>}
 */
function uploadImageBuffer(buffer, folder = 'cinebook/movies') {
  return new Promise((resolve, reject) => {
    // If credentials are demo or missing, provide safe mock fallback for dev testing
    if (
      !config.cloudinary.cloudName ||
      config.cloudinary.cloudName === 'demo' ||
      !config.cloudinary.apiKey ||
      config.cloudinary.apiKey === 'demo_key'
    ) {
      const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return resolve({
        url: `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80#${mockId}`,
        publicId: mockId,
        format: 'jpg',
        bytes: buffer ? buffer.length : 1024,
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

module.exports = {
  cloudinary,
  uploadImageBuffer,
};
