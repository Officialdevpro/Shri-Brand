const cloudinary = require("../config/cloudinary");
const AppError = require("./AppError");

/**
 * Upload single image to Cloudinary
 * @param {Object} file - File object from multer
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<Object>} - Upload result with URL and public_id
 */
const uploadImage = async (file, folder = "shri-brand/products") => {
    try {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: folder,
            resource_type: "image",
            transformation: [
                {
                    width: 1200,
                    height: 1200,
                    crop: "limit",
                    quality: "auto:good",
                },
            ],
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
        };
    } catch (error) {
        throw new AppError(
            `Failed to upload image to cloud storage: ${error.message}`,
            500
        );
    }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file objects from multer
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<Array>} - Array of upload results
 */
const uploadMultipleImages = async (files, folder = "shri-brand/products") => {
    try {
        const uploadPromises = files.map((file) => uploadImage(file, folder));
        return await Promise.all(uploadPromises);
    } catch (error) {
        throw new AppError(
            `Failed to upload images: ${error.message}`,
            500
        );
    }
};

/**
 * Delete single image from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} - Deletion result
 */
const deleteImage = async (publicId) => {
    try {
        if (!publicId) return null;

        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        // Don't throw error, just log it (image might already be deleted)
        return null;
    }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array} publicIds - Array of Cloudinary public_ids
 * @returns {Promise<Array>} - Array of deletion results
 */
const deleteMultipleImages = async (publicIds) => {
    try {
        if (!publicIds || publicIds.length === 0) return [];

        const deletePromises = publicIds.map((id) => deleteImage(id));
        return await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error deleting images from Cloudinary:", error);
        return [];
    }
};

/**
 * Extract URLs and public IDs from uploaded files
 * @param {Object} files - Files object from multer (after Cloudinary upload)
 * @returns {Object} - Extracted image data
 */
const extractImageData = (files) => {
    const imageData = {
        mainImage: null,
        mainImageId: null,
        images: [],
        imageIds: [],
    };

    // Extract main image
    if (files.mainImage && files.mainImage[0]) {
        imageData.mainImage = files.mainImage[0].path;
        imageData.mainImageId = files.mainImage[0].filename;
    }

    // Extract gallery images
    if (files.images && files.images.length > 0) {
        imageData.images = files.images.map((file) => file.path);
        imageData.imageIds = files.images.map((file) => file.filename);
    }

    return imageData;
};

module.exports = {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    deleteMultipleImages,
    extractImageData,
};
