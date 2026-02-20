const multer = require("multer");
const AppError = require("../utils/AppError");

// Memory storage — files uploaded to Cloudinary in the controller
const storage = multer.memoryStorage();

// File filter to validate file types
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new AppError(
                "Invalid file type. Only JPG, JPEG, PNG, and WebP images are allowed.",
                400
            ),
            false
        );
    }
};

// Configure multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,  // 5MB per file
        files: 6,                    // 1 main + 4 gallery (create) or individual slots (update)
    },
});

// Accept all image fields:
//   - "mainImage"       → main product image
//   - "images"          → bulk gallery upload (used during CREATE)
//   - "galleryImage0-3" → individual slot replacement (used during UPDATE)
const uploadProductImages = upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "images", maxCount: 4 },
    { name: "galleryImage0", maxCount: 1 },
    { name: "galleryImage1", maxCount: 1 },
    { name: "galleryImage2", maxCount: 1 },
    { name: "galleryImage3", maxCount: 1 },
]);

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return next(
                new AppError("File size too large. Maximum file size is 5MB.", 413)
            );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return next(
                new AppError("Too many files. Maximum 5 images allowed (1 main + 4 gallery).", 400)
            );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
                new AppError(
                    "Unexpected field. Use 'mainImage', 'images', or 'galleryImage0-3'.",
                    400
                )
            );
        }
        return next(new AppError(err.message, 400));
    }

    next(err);
};

module.exports = {
    uploadProductImages,
    handleMulterError,
};
