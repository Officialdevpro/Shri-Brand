const Product = require("../models/product");
const catchAsync = require("../utils/catchAsync");

// Render Home Page with SSR products
exports.renderHomePage = catchAsync(async (req, res, next) => {
    // Fetch products grouped by type in parallel
    const [products, comboPacks, giftPacks] = await Promise.all([
        Product.find({ productType: "single", isActive: true })
            .sort("-createdAt")
            .limit(12)
            .select("name slug mainImage shortDescription price originalPrice discountPercentage stock productType _id"),
        Product.find({ productType: "combo", isActive: true })
            .sort("-createdAt")
            .limit(6)
            .select("name slug mainImage shortDescription price originalPrice discountPercentage stock productType _id"),
        Product.find({ productType: "gift", isActive: true })
            .sort("-createdAt")
            .limit(6)
            .select("name slug mainImage shortDescription price originalPrice discountPercentage stock productType _id"),
    ]);

    res.status(200).render("index", {
        products,
        comboPacks,
        giftPacks,
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
