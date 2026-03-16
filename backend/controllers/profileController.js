const Order = require("../models/orderModel");
const catchAsync = require("../utils/catchAsync");

/**
 * GET /profile
 *
 * Renders the profile page with:
 *  - user object (from req.user, set by isAuthenticated middleware)
 *  - orders array (all orders for this user, newest first)
 *  - stats object (totalOrders, delivered, addressCount)
 */
exports.renderProfilePage = catchAsync(async (req, res, next) => {
  const user = req.user;

  // Fetch all orders for this user, newest first
  const orders = await Order.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .select("-payment.razorpaySignature"); // don't expose signature

  // Compute stats
  const stats = {
    totalOrders: orders.length,
    delivered: orders.filter((o) => o.orderStatus === "delivered").length,
    addressCount: user.addresses ? user.addresses.length : 0,
  };

  res.status(200).render("profile", {
    user,
    orders,
    stats,
  });
});
