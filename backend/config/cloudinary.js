const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: "./config.env" });

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate configuration
if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
) {
    console.warn(
        "⚠️  WARNING: Cloudinary credentials not found in config.env. Image upload will not work."
    );
}

module.exports = cloudinary;
