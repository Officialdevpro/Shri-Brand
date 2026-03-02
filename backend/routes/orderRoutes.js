const express = require("express");
const router  = express.Router();

const authController  = require("../controllers/authController");
const orderController = require("../controllers/orderController");

// All order routes require authentication
router.use(authController.protect);

// ── User routes ────────────────────────────────────────────────
router.post("/create-order",    orderController.createOrder);
router.post("/verify-payment",  orderController.verifyPayment);
router.post("/payment-failed",  orderController.paymentFailed);
router.get("/my-orders",        orderController.getMyOrders);
router.get("/:orderId",         orderController.getOrder);

// ── Admin routes ───────────────────────────────────────────────
router.get("/",
  authController.restrictTo("admin"),
  orderController.getAllOrders
);

module.exports = router;