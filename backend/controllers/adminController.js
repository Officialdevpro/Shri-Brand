const Order = require("../models/orderModel");
const catchAsync = require("../utils/catchAsync");

/**
 * Render the admin dashboard.
 *
 * Security:
 *  - This controller is only reachable behind `isAuthenticated` + `isAdmin`
 *    middleware, so req.user is guaranteed to exist and have role === "admin".
 *  - The JWT cookie is httpOnly + sameSite:strict, so it is NOT readable by JS.
 *  - We split the name server-side and pass only what the EJS template needs.
 */
exports.renderAdminDashboard = catchAsync(async (req, res) => {
  // Count orders that are still "placed" (i.e. pending action)
  const pendingOrders = await Order.countDocuments({ orderStatus: "placed" });

  // Split the stored "name" into firstName / lastName for the template
  const nameParts = (req.user.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  res.status(200).render("admin/index", {
    user: {
      firstName,
      lastName,
      email: req.user.email,
      role:  req.user.role
    },
    pendingOrders
  });
});
