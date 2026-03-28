const Category = require("../models/categoryModel");
const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
const getAllCategories = catchAsync(async (req, res, next) => {
    const filter = {};
    if (req.query.active === "true") filter.isActive = true;

    const categories = await Category.find(filter).sort("order name").lean();

    res.status(200).json({
        success: true,
        count: categories.length,
        data: categories,
    });
});

// @desc    Create a category
// @route   POST /api/v1/categories
// @access  Private/Admin
const createCategory = catchAsync(async (req, res, next) => {
    const { name, label, isActive, order } = req.body;

    if (!name || !label) {
        return next(new AppError("Name and label are required", 400));
    }

    const category = await Category.create({ name, label, isActive, order });

    res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
    });
});

// @desc    Update a category
// @route   PATCH /api/v1/categories/:id
// @access  Private/Admin
const updateCategory = catchAsync(async (req, res, next) => {
    const category = await Category.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
    );

    if (!category) {
        return next(new AppError("Category not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: category,
    });
});

// @desc    Delete a category (only if no products use it)
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
const deleteCategory = catchAsync(async (req, res, next) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return next(new AppError("Category not found", 404));
    }

    // Check if any ACTIVE products use this category (case-insensitive match)
    // Soft-deleted products (isActive: false) are excluded
    const productCount = await Product.countDocuments({
        productType: { $regex: new RegExp(`^${category.name}$`, "i") },
        isActive: { $ne: false },
    });

    if (productCount > 0) {
        return next(
            new AppError(
                `Cannot delete: ${productCount} product(s) are using the "${category.label || category.name}" category. Please delete or reassign those products first.`,
                400
            )
        );
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success: true,
        message: "Category deleted successfully.",
        data: null,
    });
});

module.exports = {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
};
