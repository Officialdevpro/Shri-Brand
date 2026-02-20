const Product = require("../models/product");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} folder - Cloudinary folder path.
 * @returns {Promise<object>} Cloudinary upload result.
 */
const uploadToCloudinary = (buffer, folder = "shri-brand/products") => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

/**
 * Delete an image from Cloudinary by its public ID.
 * Returns silently if publicId is falsy.
 * @param {string} publicId - Cloudinary public_id to delete.
 */
const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        // Log but don't throw — we don't want a Cloudinary hiccup to break the
        // main operation.  The image will be orphaned but the DB stays consistent.
        console.error(`Cloudinary deletion failed for "${publicId}":`, err.message);
    }
};

/**
 * Delete multiple images from Cloudinary in parallel.
 * Uses Promise.allSettled so one failure doesn't block the rest.
 * @param {string[]} publicIds - Array of Cloudinary public_ids.
 */
const deleteManyFromCloudinary = async (publicIds = []) => {
    if (!publicIds.length) return;
    const results = await Promise.allSettled(
        publicIds.map((id) => deleteFromCloudinary(id))
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length) {
        console.error(`${failures.length}/${publicIds.length} Cloudinary deletions failed.`);
    }
};

/**
 * Generate a unique SKU from the fragrance category.
 * Format: SHRI-CAT-NNN  (e.g. SHRI-FLO-427)
 * @param {string} category - fragranceCategory value.
 * @returns {string}
 */
const generateSku = (category) => {
    const code = category ? category.substring(0, 3).toUpperCase() : "GEN";
    const num = Math.floor(100 + Math.random() * 900);
    return `SHRI-${code}-${num}`;
};

/**
 * Generate a URL-friendly slug from a product name.
 * @param {string} name
 * @returns {string}
 */
const generateSlug = (name) =>
    name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-");

// ─── Controllers ────────────────────────────────────────────────────────────────

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
const getAllProducts = catchAsync(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        sort = "-createdAt",
        fragranceCategory,
        productType,
        minPrice,
        maxPrice,
        search,
        inStock,
        featured,
    } = req.query;

    // Build filter query
    const query = { isActive: true };

    if (fragranceCategory) query.fragranceCategory = fragranceCategory;
    if (productType) query.productType = productType;

    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { shortDescription: { $regex: search, $options: "i" } },
            { fullDescription: { $regex: search, $options: "i" } },
        ];
    }

    if (inStock === "true") query.stock = { $gt: 0 };
    else if (inStock === "false") query.stock = 0;

    if (featured === "true") query.isFeatured = true;

    // Execute with pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [products, total] = await Promise.all([
        Product.find(query)
            .sort(sort)
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .select("-__v"),
        Product.countDocuments(query),
    ]);

    res.status(200).json({
        success: true,
        count: products.length,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        data: products,
    });
});

// @desc    Get single product by slug or ID
// @route   GET /api/v1/products/:identifier
// @access  Public
const getProduct = catchAsync(async (req, res, next) => {
    const { identifier } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

    const filter = isObjectId
        ? { $or: [{ _id: identifier }, { slug: identifier }], isActive: true }
        : { slug: identifier, isActive: true };

    const product = await Product.findOne(filter).select("-__v");

    if (!product) {
        return next(new AppError("Product not found", 404));
    }

    res.status(200).json({
        success: true,
        data: product,
    });
});

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private/Admin
const createProduct = catchAsync(async (req, res, next) => {
    // Validate that a main image was uploaded
    if (!req.files || !req.files.mainImage) {
        return next(new AppError("Main product image is required", 400));
    }

    // Upload main image to Cloudinary
    const mainResult = await uploadToCloudinary(req.files.mainImage[0].buffer);

    // Upload gallery images (if any)
    let galleryUrls = [];
    let galleryIds = [];

    if (req.files.images && req.files.images.length > 0) {
        const results = await Promise.all(
            req.files.images.map((file) => uploadToCloudinary(file.buffer))
        );
        galleryUrls = results.map((r) => r.secure_url);
        galleryIds = results.map((r) => r.public_id);
    }

    // Auto-generate SKU and slug if not provided
    if (!req.body.sku) req.body.sku = generateSku(req.body.fragranceCategory);
    if (!req.body.slug && req.body.name) req.body.slug = generateSlug(req.body.name);

    // Build product data
    const productData = {
        ...req.body,
        mainImage: mainResult.secure_url,
        images: galleryUrls,
        cloudinary_ids: {
            mainImage: mainResult.public_id,
            images: galleryIds,
        },
    };

    const product = await Product.create(productData);

    res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
    });
});

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
const updateProduct = catchAsync(async (req, res, next) => {
    // 1. Find the existing product
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError("Product not found", 404));
    }

    // 2. Prevent updating immutable SKU
    delete req.body.sku;

    // 3. Auto-update slug if name is changing
    if (req.body.name) {
        req.body.slug = generateSlug(req.body.name);
    }

    // 4. Handle main image replacement
    if (req.files && req.files.mainImage) {
        // Upload the new main image
        const mainResult = await uploadToCloudinary(req.files.mainImage[0].buffer);

        // Delete the old main image from Cloudinary
        if (product.cloudinary_ids && product.cloudinary_ids.mainImage) {
            await deleteFromCloudinary(product.cloudinary_ids.mainImage);
        }

        // Update fields
        req.body.mainImage = mainResult.secure_url;
        if (!req.body.cloudinary_ids) req.body.cloudinary_ids = {};
        req.body.cloudinary_ids.mainImage = mainResult.public_id;
    }

    // 5. Handle gallery images
    //    Two modes:
    //    a) Bulk "images" field (used during CREATE or full gallery replacement)
    //    b) Positional "galleryImage0-3" fields (used during UPDATE to replace specific slots)

    // Copy existing gallery arrays to mutate
    const galleryUrls = [...(product.images || [])];
    const galleryIds = [...(product.cloudinary_ids?.images || [])];
    let galleryChanged = false;

    // 5a. Handle gallery image REMOVAL (X button in the UI)
    //     Frontend sends removeGalleryImages as "0,2" to remove slots 0 and 2
    if (req.body.removeGalleryImages) {
        const indicesToRemove = String(req.body.removeGalleryImages)
            .split(',')
            .map(Number)
            .filter((n) => !isNaN(n) && n >= 0 && n < galleryUrls.length);

        for (const idx of indicesToRemove) {
            // Delete from Cloudinary
            if (galleryIds[idx]) {
                await deleteFromCloudinary(galleryIds[idx]);
            }
            // Mark for removal
            galleryUrls[idx] = null;
            galleryIds[idx] = null;
        }

        galleryChanged = indicesToRemove.length > 0;
        delete req.body.removeGalleryImages; // Don't pass to MongoDB
    }

    // 5b. Check for positional replacements (galleryImage0, galleryImage1, ...)
    for (let i = 0; i < 4; i++) {
        const fieldName = `galleryImage${i}`;
        if (req.files && req.files[fieldName] && req.files[fieldName].length > 0) {
            const result = await uploadToCloudinary(req.files[fieldName][0].buffer);

            // Delete old image at this position from Cloudinary (if it exists)
            if (galleryIds[i]) {
                await deleteFromCloudinary(galleryIds[i]);
            }

            // Replace at this position (or add if position doesn't exist yet)
            galleryUrls[i] = result.secure_url;
            galleryIds[i] = result.public_id;
            galleryChanged = true;
        }
    }

    // 5c. Bulk "images" field (for create flow, or full gallery set)
    if (req.files && req.files.images && req.files.images.length > 0 && !galleryChanged) {
        const results = await Promise.all(
            req.files.images.map((file) => uploadToCloudinary(file.buffer))
        );

        galleryUrls.length = 0;
        galleryIds.length = 0;
        results.forEach((r) => {
            galleryUrls.push(r.secure_url);
            galleryIds.push(r.public_id);
        });
        galleryChanged = true;
    }

    // 5d. Compact arrays — remove nulls left by removals
    if (galleryChanged) {
        const cleanUrls = galleryUrls.filter((v) => v !== null);
        const cleanIds = galleryIds.filter((v) => v !== null);

        req.body.images = cleanUrls;
        if (!req.body.cloudinary_ids) req.body.cloudinary_ids = {};
        req.body.cloudinary_ids.images = cleanIds;
    }

    // 6. Merge cloudinary_ids properly — preserve untouched fields
    if (req.body.cloudinary_ids) {
        req.body.cloudinary_ids = {
            mainImage: req.body.cloudinary_ids.mainImage || product.cloudinary_ids?.mainImage,
            images: req.body.cloudinary_ids.images || product.cloudinary_ids?.images || [],
        };
    }

    // 7. Manual price validation
    //    Mongoose's custom validator for originalPrice uses `this.price`, but during
    //    findByIdAndUpdate `this` is the Query object — so `this.price` is undefined
    //    and the validator always fails. We validate manually here instead.
    const finalPrice = req.body.price != null ? Number(req.body.price) : product.price;
    const finalOriginalPrice = req.body.originalPrice != null
        ? Number(req.body.originalPrice)
        : product.originalPrice;

    if (finalOriginalPrice != null && finalOriginalPrice < finalPrice) {
        return next(
            new AppError("Original price must be greater than or equal to current price", 400)
        );
    }

    // Remove originalPrice from the $set if it hasn't changed, to avoid
    // triggering the broken Mongoose update validator
    if (req.body.originalPrice != null) {
        req.body.originalPrice = Number(req.body.originalPrice);
    }
    if (req.body.price != null) {
        req.body.price = Number(req.body.price);
    }

    // 8. Apply updates
    const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { returnDocument: "after" }
    ).select("-__v");

    res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct,
    });
});

// @desc    Delete product (soft delete) + remove Cloudinary images
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
const deleteProduct = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError("Product not found", 404));
    }

    // Collect all Cloudinary public IDs to delete
    const idsToDelete = [];

    if (product.cloudinary_ids) {
        if (product.cloudinary_ids.mainImage) {
            idsToDelete.push(product.cloudinary_ids.mainImage);
        }
        if (product.cloudinary_ids.images && product.cloudinary_ids.images.length > 0) {
            idsToDelete.push(...product.cloudinary_ids.images);
        }
    }

    // Delete all images from Cloudinary
    await deleteManyFromCloudinary(idsToDelete);

    // Soft delete: set isActive to false
    product.isActive = false;
    await product.save();

    res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: null,
    });
});

// @desc    Get featured products
// @route   GET /api/v1/products/featured
// @access  Public
const getFeaturedProducts = catchAsync(async (req, res, next) => {
    const products = await Product.find({
        isFeatured: true,
        isActive: true,
        stock: { $gt: 0 },
    })
        .sort("-createdAt")
        .limit(8)
        .select("-__v");

    res.status(200).json({
        success: true,
        count: products.length,
        data: products,
    });
});

// @desc    Get products by fragrance category
// @route   GET /api/v1/products/category/:category
// @access  Public
const getProductsByCategory = catchAsync(async (req, res, next) => {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const validCategories = ["floral", "woody", "resin", "heritage", "mixed"];
    if (!validCategories.includes(category)) {
        return next(
            new AppError(
                `Invalid category. Valid categories are: ${validCategories.join(", ")}`,
                400
            )
        );
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const filter = { fragranceCategory: category, isActive: true };

    const [products, total] = await Promise.all([
        Product.find(filter)
            .sort("-createdAt")
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .select("-__v"),
        Product.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        category,
        count: products.length,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        data: products,
    });
});

// @desc    Update product stock (for order processing)
// @route   PATCH /api/v1/products/:id/stock
// @access  Private/Admin
const updateStock = catchAsync(async (req, res, next) => {
    const { quantity, operation = "decrease" } = req.body;

    if (!quantity || quantity <= 0) {
        return next(new AppError("Quantity must be a positive number", 400));
    }

    if (!["increase", "decrease"].includes(operation)) {
        return next(new AppError("Operation must be 'increase' or 'decrease'", 400));
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError("Product not found", 404));
    }

    if (operation === "decrease") {
        if (product.stock < quantity) {
            return next(
                new AppError(`Insufficient stock. Available: ${product.stock}`, 400)
            );
        }
        product.stock -= quantity;
        product.totalSold += quantity;
    } else {
        product.stock += quantity;
    }

    await product.save();

    res.status(200).json({
        success: true,
        message: "Stock updated successfully",
        data: {
            stock: product.stock,
            totalSold: product.totalSold,
            isLowStock: product.isLowStock,
            isInStock: product.isInStock,
        },
    });
});

module.exports = {
    getAllProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getFeaturedProducts,
    getProductsByCategory,
    updateStock,
};
