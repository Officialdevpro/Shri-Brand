const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const catchAsync = require("../utils/catchAsync");

// Render Home Page with SSR products grouped by dynamic categories
exports.renderHomePage = catchAsync(async (req, res, next) => {
    // Fetch all active categories sorted by display order
    const categories = await Category.find({ isActive: true }).sort("order name");

    // For each category, fetch matching products
    const categoryData = await Promise.all(
        categories.map(async (cat) => {
            const products = await Product.find({
                productType: cat.name,
                isActive: true,
            })
                .sort("-createdAt")
                .limit(12)
                .select("name slug mainImage shortDescription packs productType _id");

            return {
                name: cat.name,
                label: cat.label,
                products,
            };
        })
    );

    res.status(200).render("index", {
        categories: categoryData,
    });
});

// Render Auth Page
exports.renderAuthPage = (req, res) => {
    res.status(200).render("auth");
};

// Render Product Detail Page (SSR with real product data)
exports.renderProductPage = catchAsync(async (req, res, next) => {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });

    if (!product) {
        return res.status(404).render("product", { product: null });
    }

    res.status(200).render("product", { product });
});

// Render Checkout Page
exports.renderCheckoutPage = (req, res) => {
    res.status(200).render("checkout");
};
