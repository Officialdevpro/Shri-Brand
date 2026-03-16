// controllers/dashboardController.js
"use strict";

const Order   = require("../models/orderModel");
const Product = require("../models/productModel");
const User    = require("../models/userModel");

// ─── helpers ────────────────────────────────────────────────────────────────
const startOf = (unit) => {
  const d = new Date();
  if (unit === "day")  { d.setHours(0,0,0,0); }
  if (unit === "week") { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); }
  if (unit === "month"){ d.setDate(1); d.setHours(0,0,0,0); }
  return d;
};

const ok  = (res, data)         => res.status(200).json({ status: "success", data });
const err = (res, e, msg = "Server error") =>
  res.status(500).json({ status: "error", message: msg, detail: e.message });

// ════════════════════════════════════════════════════════════════════════════
//  TAB 1 — REVENUE & ORDERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dashboard/revenue
 * Returns: totalRevenue, ordersToday, ordersThisWeek, avgOrderValue,
 *          paymentMethodSplit, revenueChart (last 30 days), orderStatusBreakdown
 */
exports.getRevenueDashboard = async (req, res) => {
  try {
    const todayStart = startOf("day");
    const weekStart  = startOf("week");
    const monthStart = startOf("month");

    // ── 1. Total revenue (all paid orders) ──────────────────────────────────
    const [revenueResult] = await Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $group: { _id: null, total: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
    ]);
    const totalRevenue = revenueResult?.total ?? 0;
    const totalOrders  = revenueResult?.count ?? 0;

    // ── 2. Orders today & this week ─────────────────────────────────────────
    const [ordersToday] = await Order.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } },
    ]);

    const [ordersThisWeek] = await Order.aggregate([
      { $match: { createdAt: { $gte: weekStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } },
    ]);

    // ── 3. Average order value ───────────────────────────────────────────────
    const avgOrderValue = totalOrders > 0
      ? Math.round((totalRevenue / totalOrders) * 100) / 100
      : 0;

    // ── 4. Payment method split ──────────────────────────────────────────────
    const paymentSplit = await Order.aggregate([
      {
        $group: {
          _id: "$payment.method",
          count:   { $sum: 1 },
          revenue: { $sum: "$pricing.total" },
        },
      },
    ]);

    // ── 5. Revenue chart — last 30 days ─────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const revenueChart = await Order.aggregate([
      { $match: { "payment.status": "paid", createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
            day:   { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$pricing.total" },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year", month: "$_id.month", day: "$_id.day",
                },
              },
            },
          },
          revenue: 1,
          orders:  1,
        },
      },
    ]);

    // ── 6. Order status breakdown ────────────────────────────────────────────
    const statusBreakdown = await Order.aggregate([
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return ok(res, {
      totalRevenue,
      avgOrderValue,
      ordersToday:    { count: ordersToday?.count ?? 0,     revenue: ordersToday?.revenue ?? 0 },
      ordersThisWeek: { count: ordersThisWeek?.count ?? 0,  revenue: ordersThisWeek?.revenue ?? 0 },
      paymentSplit:   paymentSplit.map(p => ({ method: p._id, count: p.count, revenue: p.revenue })),
      revenueChart,
      statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
    });
  } catch (e) {
    return err(res, e, "Failed to load revenue dashboard");
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  TAB 2 — PRODUCTS & INVENTORY
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dashboard/products
 * Returns: lowStockProducts, outOfStockProducts, topSellers,
 *          byCategory (fragranceCategory), activeVsInactive
 */
exports.getProductsDashboard = async (req, res) => {
  try {
    // ── 1. Low stock products ────────────────────────────────────────────────
    //   Any pack where stock > 0 AND stock <= lowStockThreshold
    const lowStockProducts = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$packs" },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: ["$packs.stock", 0] },
              { $lte: ["$packs.stock", "$packs.lowStockThreshold"] },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          mainImage: 1,
          "packs.weight": 1,
          "packs.stock": 1,
          "packs.lowStockThreshold": 1,
          "packs.sku": 1,
        },
      },
      { $limit: 20 },
    ]);

    // ── 2. Out-of-stock packs ────────────────────────────────────────────────
    const outOfStockProducts = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$packs" },
      { $match: { "packs.stock": 0 } },
      {
        $project: {
          name: 1,
          mainImage: 1,
          "packs.weight": 1,
          "packs.sku": 1,
        },
      },
      { $limit: 20 },
    ]);

    // ── 3. Top sellers (by totalSold across all packs) ───────────────────────
    const topSellers = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          totalSoldAll: { $sum: "$packs.totalSold" },
        },
      },
      { $sort: { totalSoldAll: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          mainImage: 1,
          fragranceCategory: 1,
          totalSoldAll: 1,
          "packs.weight": 1,
          "packs.price": 1,
          "packs.totalSold": 1,
        },
      },
    ]);

    // ── 4. Products by fragrance category ───────────────────────────────────
    const byCategory = await Product.aggregate([
      {
        $group: {
          _id: "$fragranceCategory",
          count:  { $sum: 1 },
          active: { $sum: { $cond: ["$isActive", 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // ── 5. Active vs Inactive ────────────────────────────────────────────────
    const [activeStats] = await Product.aggregate([
      {
        $group: {
          _id: null,
          active:   { $sum: { $cond: ["$isActive", 1, 0] } },
          inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
          total:    { $sum: 1 },
        },
      },
    ]);

    return ok(res, {
      lowStockProducts,
      lowStockCount:    lowStockProducts.length,
      outOfStockProducts,
      outOfStockCount:  outOfStockProducts.length,
      topSellers,
      byCategory: byCategory.map(c => ({ category: c._id, count: c.count, active: c.active })),
      activeStats: {
        active:   activeStats?.active   ?? 0,
        inactive: activeStats?.inactive ?? 0,
        total:    activeStats?.total    ?? 0,
      },
    });
  } catch (e) {
    return err(res, e, "Failed to load products dashboard");
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  TAB 3 — CUSTOMERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dashboard/customers
 * Returns: totalUsers, newSignups (today/week/month), verifiedVsUnverified,
 *          repeatCustomers, lockedAccounts, topCities, topStates,
 *          signupChart (last 30 days), topCustomersBySpend
 */
exports.getCustomersDashboard = async (req, res) => {
  try {
    const todayStart = startOf("day");
    const weekStart  = startOf("week");
    const monthStart = startOf("month");

    // ── 1. Total users ───────────────────────────────────────────────────────
    const totalUsers = await User.countDocuments({});

    // ── 2. New signups ───────────────────────────────────────────────────────
    const [newToday]      = await User.aggregate([{ $match: { createdAt: { $gte: todayStart  } } }, { $count: "count" }]);
    const [newThisWeek]   = await User.aggregate([{ $match: { createdAt: { $gte: weekStart   } } }, { $count: "count" }]);
    const [newThisMonth]  = await User.aggregate([{ $match: { createdAt: { $gte: monthStart  } } }, { $count: "count" }]);

    // ── 3. Verified vs Unverified ────────────────────────────────────────────
    const [verifiedStats] = await User.aggregate([
      {
        $group: {
          _id: null,
          verified:   { $sum: { $cond: ["$isVerified", 1, 0] } },
          unverified: { $sum: { $cond: ["$isVerified", 0, 1] } },
        },
      },
    ]);

    // ── 4. Repeat customers (≥2 orders) ─────────────────────────────────────
    const repeatCustomers = await Order.aggregate([
      { $group: { _id: "$userId", orderCount: { $sum: 1 } } },
      { $match: { orderCount: { $gte: 2 } } },
      { $count: "count" },
    ]);

    // ── 5. Locked accounts ───────────────────────────────────────────────────
    const lockedAccounts = await User.countDocuments({
      lockUntil: { $gt: new Date() },
    });

    // ── 6. Top cities & states from shipping addresses ───────────────────────
    const topCities = await Order.aggregate([
      { $group: { _id: "$shippingAddress.city",  count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const topStates = await Order.aggregate([
      { $group: { _id: "$shippingAddress.state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // ── 7. Signup chart — last 30 days ───────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const signupChart = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
            day:   { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year", month: "$_id.month", day: "$_id.day",
                },
              },
            },
          },
          count: 1,
        },
      },
    ]);

    // ── 8. Top customers by total spend ─────────────────────────────────────
    const topCustomersBySpend = await Order.aggregate([
      { $match: { "payment.status": "paid" } },
      {
        $group: {
          _id:        "$userId",
          totalSpend: { $sum: "$pricing.total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from:         "users",
          localField:   "_id",
          foreignField: "_id",
          as:           "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId:     "$_id",
          name:       "$user.name",
          email:      "$user.email",
          totalSpend: 1,
          orderCount: 1,
        },
      },
    ]);

    return ok(res, {
      totalUsers,
      newSignups: {
        today: newToday?.count     ?? 0,
        week:  newThisWeek?.count  ?? 0,
        month: newThisMonth?.count ?? 0,
      },
      verifiedStats: {
        verified:   verifiedStats?.verified   ?? 0,
        unverified: verifiedStats?.unverified ?? 0,
      },
      repeatCustomers: repeatCustomers[0]?.count ?? 0,
      lockedAccounts,
      topCities: topCities.map(c => ({ city:  c._id, count: c.count })),
      topStates: topStates.map(s => ({ state: s._id, count: s.count })),
      signupChart,
      topCustomersBySpend,
    });
  } catch (e) {
    return err(res, e, "Failed to load customers dashboard");
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  COMBINED — single call that returns all three tabs at once
//  (useful for initial page load)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dashboard/all
 */
exports.getAllDashboard = async (req, res) => {
  try {
    const [revenue, products, customers] = await Promise.all([
      buildRevenue(),
      buildProducts(),
      buildCustomers(),
    ]);
    return ok(res, { revenue, products, customers });
  } catch (e) {
    return err(res, e, "Failed to load dashboard");
  }
};

// ── internal builders (same logic, no res/req) ───────────────────────────────
async function buildRevenue() {
  const todayStart    = startOf("day");
  const weekStart     = startOf("week");
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); thirtyDaysAgo.setHours(0,0,0,0);

  const [revenueResult] = await Order.aggregate([
    { $match: { "payment.status": "paid" } },
    { $group: { _id: null, total: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
  ]);
  const totalRevenue = revenueResult?.total ?? 0;
  const totalOrders  = revenueResult?.count ?? 0;

  const [ordersToday]    = await Order.aggregate([{ $match: { createdAt: { $gte: todayStart } } }, { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } }]);
  const [ordersThisWeek] = await Order.aggregate([{ $match: { createdAt: { $gte: weekStart  } } }, { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } }]);

  const paymentSplit   = await Order.aggregate([{ $group: { _id: "$payment.method", count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } }]);
  const statusBreakdown = await Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

  const revenueChart = await Order.aggregate([
    { $match: { "payment.status": "paid", createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }, revenue: { $sum: "$pricing.total" }, orders: { $sum: 1 } } },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    { $project: { _id: 0, date: { $dateToString: { format: "%Y-%m-%d", date: { $dateFromParts: { year: "$_id.year", month: "$_id.month", day: "$_id.day" } } } }, revenue: 1, orders: 1 } },
  ]);

  return {
    totalRevenue,
    avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    ordersToday:    { count: ordersToday?.count ?? 0,     revenue: ordersToday?.revenue ?? 0 },
    ordersThisWeek: { count: ordersThisWeek?.count ?? 0,  revenue: ordersThisWeek?.revenue ?? 0 },
    paymentSplit:   paymentSplit.map(p => ({ method: p._id, count: p.count, revenue: p.revenue })),
    revenueChart,
    statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
  };
}

async function buildProducts() {
  const lowStockProducts = await Product.aggregate([
    { $match: { isActive: true } }, { $unwind: "$packs" },
    { $match: { $expr: { $and: [{ $gt: ["$packs.stock", 0] }, { $lte: ["$packs.stock", "$packs.lowStockThreshold"] }] } } },
    { $project: { name: 1, mainImage: 1, "packs.weight": 1, "packs.stock": 1, "packs.lowStockThreshold": 1, "packs.sku": 1 } }, { $limit: 20 },
  ]);
  const outOfStockProducts = await Product.aggregate([
    { $match: { isActive: true } }, { $unwind: "$packs" }, { $match: { "packs.stock": 0 } },
    { $project: { name: 1, "packs.weight": 1, "packs.sku": 1 } }, { $limit: 20 },
  ]);
  const topSellers = await Product.aggregate([
    { $match: { isActive: true } }, { $addFields: { totalSoldAll: { $sum: "$packs.totalSold" } } },
    { $sort: { totalSoldAll: -1 } }, { $limit: 10 },
    { $project: { name: 1, fragranceCategory: 1, totalSoldAll: 1 } },
  ]);
  const byCategory   = await Product.aggregate([{ $group: { _id: "$fragranceCategory", count: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } }, { $sort: { count: -1 } }]);
  const [activeStats] = await Product.aggregate([{ $group: { _id: null, active: { $sum: { $cond: ["$isActive", 1, 0] } }, inactive: { $sum: { $cond: ["$isActive", 0, 1] } }, total: { $sum: 1 } } }]);

  return {
    lowStockProducts, lowStockCount: lowStockProducts.length,
    outOfStockProducts, outOfStockCount: outOfStockProducts.length,
    topSellers, byCategory: byCategory.map(c => ({ category: c._id, count: c.count, active: c.active })),
    activeStats: { active: activeStats?.active ?? 0, inactive: activeStats?.inactive ?? 0, total: activeStats?.total ?? 0 },
  };
}

async function buildCustomers() {
  const todayStart = startOf("day"); const weekStart = startOf("week"); const monthStart = startOf("month");
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); thirtyDaysAgo.setHours(0,0,0,0);

  const totalUsers = await User.countDocuments({});
  const [newToday]     = await User.aggregate([{ $match: { createdAt: { $gte: todayStart  } } }, { $count: "count" }]);
  const [newThisWeek]  = await User.aggregate([{ $match: { createdAt: { $gte: weekStart   } } }, { $count: "count" }]);
  const [newThisMonth] = await User.aggregate([{ $match: { createdAt: { $gte: monthStart  } } }, { $count: "count" }]);
  const [verifiedStats] = await User.aggregate([{ $group: { _id: null, verified: { $sum: { $cond: ["$isVerified", 1, 0] } }, unverified: { $sum: { $cond: ["$isVerified", 0, 1] } } } }]);
  const repeatCustomers = await Order.aggregate([{ $group: { _id: "$userId", orderCount: { $sum: 1 } } }, { $match: { orderCount: { $gte: 2 } } }, { $count: "count" }]);
  const lockedAccounts = await User.countDocuments({ lockUntil: { $gt: new Date() } });
  const topCities = await Order.aggregate([{ $group: { _id: "$shippingAddress.city",  count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]);
  const topStates = await Order.aggregate([{ $group: { _id: "$shippingAddress.state", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]);
  const signupChart = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    { $project: { _id: 0, date: { $dateToString: { format: "%Y-%m-%d", date: { $dateFromParts: { year: "$_id.year", month: "$_id.month", day: "$_id.day" } } } }, count: 1 } },
  ]);
  const topCustomersBySpend = await Order.aggregate([
    { $match: { "payment.status": "paid" } }, { $group: { _id: "$userId", totalSpend: { $sum: "$pricing.total" }, orderCount: { $sum: 1 } } },
    { $sort: { totalSpend: -1 } }, { $limit: 10 },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, userId: "$_id", name: "$user.name", email: "$user.email", totalSpend: 1, orderCount: 1 } },
  ]);

  return {
    totalUsers,
    newSignups: { today: newToday?.count ?? 0, week: newThisWeek?.count ?? 0, month: newThisMonth?.count ?? 0 },
    verifiedStats: { verified: verifiedStats?.verified ?? 0, unverified: verifiedStats?.unverified ?? 0 },
    repeatCustomers: repeatCustomers[0]?.count ?? 0,
    lockedAccounts,
    topCities: topCities.map(c => ({ city: c._id, count: c.count })),
    topStates: topStates.map(s => ({ state: s._id, count: s.count })),
    signupChart,
    topCustomersBySpend,
  };
}