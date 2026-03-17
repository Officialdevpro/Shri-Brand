const express = require("express");
const router  = express.Router();

const authController  = require("../controllers/authController");
const orderController = require("../controllers/orderController");

// ── User routes (all require login) ────────────────────────────
router.post("/create-order",      authController.protect, orderController.createOrder);
router.post("/create-cod-order",  authController.protect, orderController.createCodOrder);
router.post("/simulate-payment",  authController.protect, orderController.simulatePayment);  // TODO: Remove when Razorpay is live
router.post("/verify-payment",    authController.protect, orderController.verifyPayment);
router.post("/payment-failed",    authController.protect, orderController.paymentFailed);
router.get("/my-orders",          authController.protect, orderController.getMyOrders);
router.get("/:orderId",           authController.protect, orderController.getOrder);

// ── Admin routes ───────────────────────────────────────────────
router.get("/",
  authController.protect,
  authController.restrictTo("admin"),
  orderController.getAllOrders
);

router.patch("/:orderId/status",
  authController.protect,
  authController.restrictTo("admin"),
  orderController.updateOrderStatus
);

router.patch("/:orderId/payment-status",
  authController.protect,
  authController.restrictTo("admin"),
  orderController.updatePaymentStatus
);

router.delete("/:orderId",
  authController.protect,
  authController.restrictTo("admin"),
  orderController.deleteOrder
);

module.exports = router;
