'use strict';

/**
 * blogImageUpload.js
 *
 * Drop-in Express router that handles image uploads for the blog editor.
 * Uploads images to Cloudinary and returns the secure URL — so the frontend
 * never stores base64 in the database.
 *
 * Mount in app.js:
 *   const blogImageUpload = require('./routes/blogImageUpload');
 *   app.use('/api/v1/blog-images', blogImageUpload);
 *
 * Endpoints:
 *   POST /api/v1/blog-images/cover   → upload cover image
 *   POST /api/v1/blog-images/content → upload inline content image
 *
 * Both endpoints accept multipart/form-data with field name "image".
 * Both return: { status, data: { url, publicId, width, height } }
 */

const express = require('express');
const multer  = require('multer');
const cloudinary = require('../config/cloudinary');   // adjust path if needed
const AppError   = require('../utils/AppError');       // adjust path if needed

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

/** Hard limit: 1 024 KB = 1 MB */
const MAX_BYTES = 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// ─── Multer (memory storage — file goes straight from RAM to Cloudinary) ──────

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(
      new AppError(
        `Invalid file type "${file.mimetype}". Allowed: JPG, JPEG, PNG, WEBP.`,
        400
      ),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_BYTES, // multer enforces this before controller runs
    files: 1,
  },
});

// ─── Multer error handler ─────────────────────────────────────────────────────

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(
          `Image too large. Maximum allowed size is 1 MB (1 024 KB). ` +
          `Your file is ${req._fileSizeKB ? req._fileSizeKB + ' KB' : 'over the limit'}.`,
          413
        )
      );
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Only one image may be uploaded at a time.', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected field name. Use the field name "image".', 400));
    }
    return next(new AppError(err.message, 400));
  }
  next(err);
};

// ─── Helper: upload a Buffer to Cloudinary ────────────────────────────────────

/**
 * @param {Buffer} buffer       — file buffer from multer memory storage
 * @param {string} folder       — Cloudinary folder (e.g. 'shri-brand/blog/cover')
 * @param {object} [opts]       — extra Cloudinary upload options
 * @returns {Promise<{url, publicId, width, height}>}
 */
async function uploadBufferToCloudinary(buffer, folder, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Auto-compress + cap dimensions so even large originals are web-safe
        transformation: [
          {
            width: 1800,
            height: 1800,
            crop: 'limit',
            quality: 'auto:good',
            fetch_format: 'auto',
          },
        ],
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
          width:    result.width,
          height:   result.height,
        });
      }
    );
    stream.end(buffer);
  });
}

// ─── Controller factory ───────────────────────────────────────────────────────

/**
 * Returns an Express request handler that:
 *   1. Validates the uploaded file (already done by multer + fileFilter)
 *   2. Enforces the 1 MB size limit with a friendly error message
 *   3. Uploads to Cloudinary under `folder`
 *   4. Returns the Cloudinary URL
 */
function makeUploadHandler(folder) {
  return async (req, res, next) => {
    try {
      // ── Guard: file must be present ──────────────────────────────────────
      if (!req.file) {
        return next(new AppError('No image file provided. Send the image as "image" field.', 400));
      }

      // ── Guard: double-check size (multer should already block, but be safe) ─
      if (req.file.size > MAX_BYTES) {
        const kb = Math.round(req.file.size / 1024);
        return next(
          new AppError(
            `Image too large (${kb} KB). Maximum allowed size is 1 024 KB (1 MB).`,
            413
          )
        );
      }

      // ── Guard: must be a real image (MIME already validated by fileFilter) ──
      // Belt-and-suspenders: check buffer magic bytes for JPEG / PNG / WEBP
      const buf = req.file.buffer;
      const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8;
      const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      // WEBP: "RIFF" at 0 + "WEBP" at 8
      const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' &&
                     buf.slice(8, 12).toString('ascii') === 'WEBP';

      if (!isJpeg && !isPng && !isWebp) {
        return next(
          new AppError(
            'File content does not match an accepted image format (JPEG, PNG, WEBP).',
            400
          )
        );
      }

      // ── Upload to Cloudinary ─────────────────────────────────────────────
      const result = await uploadBufferToCloudinary(req.file.buffer, folder);

      // ── Success ──────────────────────────────────────────────────────────
      res.status(200).json({
        status: 'success',
        data: result,  // { url, publicId, width, height }
      });

    } catch (err) {
      // Cloudinary errors
      const message =
        (err && err.message) ? `Image upload failed: ${err.message}` : 'Image upload failed.';
      next(new AppError(message, 502));
    }
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/blog-images/cover
 * Upload the post cover image.
 * Field name: "image"
 */
router.post(
  '/cover',
  upload.single('image'),
  handleMulterError,
  makeUploadHandler('shri-brand/blog/cover')
);

/**
 * POST /api/v1/blog-images/content
 * Upload an inline content image (inserted inside the editor body).
 * Field name: "image"
 */
router.post(
  '/content',
  upload.single('image'),
  handleMulterError,
  makeUploadHandler('shri-brand/blog/content')
);

module.exports = router;