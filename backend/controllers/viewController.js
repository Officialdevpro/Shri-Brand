const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");

// Render Home Page with SSR products grouped by dynamic categories
exports.renderHomePage = catchAsync(async (req, res, next) => {
    // ── Admin check: if logged-in user is admin, render admin dashboard ──
    if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
        try {
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user && user.role === "admin" && !user.isPasswordChangedAfter(decoded.iat)) {
                const pendingOrders = await Order.countDocuments({ orderStatus: "placed" });
                const nameParts = (user.name || "").trim().split(/\s+/);
                const firstName = nameParts[0] || "";
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

                return res.status(200).render("admin/index", {
                    user: { firstName, lastName, email: user.email, role: user.role },
                    pendingOrders
                });
            }
        } catch {
            // Token invalid — fall through to normal home page
        }
    }

    // ── Resolve userRole for non-admin logged-in users ──
    let userRole = "";
    if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
        try {
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user && !user.isPasswordChangedAfter(decoded.iat)) {
                userRole = user.role || "";
            }
        } catch {
            // Token invalid — userRole stays empty
        }
    }

    // 1. Fetch ALL active products
    const products = await Product.find({ isActive: true })
        .sort("createdAt")
        .select("name slug mainImage shortDescription packs productType _id")
        .lean();

    // 2. Group products by productType
    const grouped = {};
    products.forEach((p) => {
        const type = (p.productType || "other").toLowerCase();
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(p);
    });

    // 3. Fetch categories for display labels & ordering (optional)
    const categories = await Category.find({ isActive: true }).sort("order name").lean();
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
        userRole,
    });
});

// Render Auth Page — redirect to / if already logged in (cookie check)
exports.renderAuthPage = catchAsync(async (req, res, next) => {
    const jwt = require("jsonwebtoken");
    const { promisify } = require("util");
    const User = require("../models/userModel");

    // Check if user has a valid JWT cookie
    if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
        try {
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user && !user.isPasswordChangedAfter(decoded.iat)) {
                // User is already authenticated — redirect to home
                return res.redirect("/");
            }
        } catch {
            // Token invalid/expired — fall through to render auth page
        }
    }

    res.status(200).render("auth");
});

// Render Product Detail Page (SSR with real product data)
exports.renderProductPage = catchAsync(async (req, res, next) => {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });

    if (!product) {
        return res.status(404).render("product", { product: null });
    }

    res.status(200).render("product", { product });
});

// Render Checkout Page — auth-guarded, autofills name & email
exports.renderCheckoutPage = catchAsync(async (req, res, next) => {
    const jwt = require("jsonwebtoken");
    const { promisify } = require("util");
    const User = require("../models/userModel");

    // ── Auth guard: only logged-in users ──
    let token;
    if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
        token = req.cookies.jwt;
    }

    if (!token) {
        return res.redirect("/auth");
    }

    try {
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.redirect("/auth");

        res.status(200).render("checkout", {
            userName:  user.name  || "",
            userEmail: user.email || "",
            userRole:  user.role  || "",
        });
    } catch {
        return res.redirect("/auth");
    }
});

// Render Blog Detail Page (client-side fetching, server just injects the blog ID)
exports.renderBlogPage = (req, res) => {
    res.status(200).render("blogView", { blogId: req.params.id });
};

// Render Admin Blog Editor
exports.renderAdminBlogEditor = catchAsync(async (req, res, next) => {
    res.status(200).render("admin/blogpost");
});
