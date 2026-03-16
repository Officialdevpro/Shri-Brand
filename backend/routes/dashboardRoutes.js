// routes/dashboardRoutes.js
"use strict";

const express = require("express");
const path    = require("path");
const router  = express.Router();

const { protect, restrictTo } = require("../controllers/authController");

const {
  getRevenueDashboard,
  getProductsDashboard,
  getCustomersDashboard,
  getAllDashboard,
} = require("../controllers/dashboardController");

// ── Protect all dashboard routes ─────────────────────────────────────────────
router.use(protect);
router.use(restrictTo("admin"));

// ── Serve the dashboard HTML ─────────────────────────────────────────────────
// Visit: GET /api/dashboard  →  serves dashboard.html
// Place dashboard.html inside:  public/admin/dashboard.html
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/dashboard.html"));
});

// ── Data API endpoints ───────────────────────────────────────────────────────

/**
 * GET /api/dashboard/all
 * Single call — returns revenue + products + customers in one shot.
 */
router.get("/all", getAllDashboard);

/**
 * GET /api/dashboard/revenue
 * Tab 1 — Total revenue, orders today/week, avg order value,
 *          COD vs Razorpay split, revenue chart, order-status breakdown
 */
router.get("/revenue", getRevenueDashboard);

/**
 * GET /api/dashboard/products
 * Tab 2 — Low-stock products, out-of-stock SKUs, top sellers,
 *          products by fragrance category, active vs inactive count
 */
router.get("/products", getProductsDashboard);

/**
 * GET /api/dashboard/customers
 * Tab 3 — Total users, new signups, verified split, repeat customers,
 *          locked accounts, top cities/states, signup chart, top spenders
 */
router.get("/customers", getCustomersDashboard);

module.exports = router;