const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const catchAsync = require("../utils/catchAsync");

// Render Home Page with SSR products grouped by dynamic categories
exports.renderHomePage = catchAsync(async (req, res, next) => {
    // 1. Fetch ALL active products
    const products = await Product.find({ isActive: true })
        .sort("createdAt")
        .select("name slug mainImage shortDescription packs productType _id");

    // 2. Group products by productType
    const grouped = {};
    products.forEach((p) => {
        const type = (p.productType || "other").toLowerCase();
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(p);
    });

    // 3. Fetch categories for display labels & ordering (optional)
    const categories = await Category.find({ isActive: true }).sort("order name");
    const catMap = {};
    categories.forEach((c) => {
        catMap[c.name.toLowerCase()] = { label: c.label, order: c.order };
    });

    // 4. Build category data — use Category label if available, else capitalize type
    const categoryData = Object.keys(grouped).map((type) => ({
        name: type,
        label: catMap[type] ? catMap[type].label : type.charAt(0).toUpperCase() + type.slice(1),
        order: catMap[type] ? catMap[type].order : 999,
        products: grouped[type],
    }));

    // Sort by category order
    categoryData.sort((a, b) => a.order - b.order);

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
