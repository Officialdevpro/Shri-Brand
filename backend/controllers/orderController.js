const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Order    = require("../models/orderModel");
const Cart     = require("../models/cartModel");
const User     = require("../models/userModel");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const logger   = require("../utils/logger");

// ─────────────────────────────────────────────────────────────────
//  Razorpay client — instantiated once, reused across requests
// ─────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────
//  STEP 1 — CREATE RAZORPAY ORDER
//  POST /api/v1/orders/create-order
//
//  Flow:
//   1. Validate cart exists and is not empty
//   2. Validate shipping address from request body
//   3. Call Razorpay API to create an order → get razorpay_order_id
//   4. Save order in our DB with status = "pending"
//      (at this point money has NOT moved yet)
//   5. Return razorpay_order_id + key_id to frontend
//      (frontend uses these to open the Razorpay popup)
// ─────────────────────────────────────────────────────────────────
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // ── 1. Pull cart from DB ──────────────────────────────────────
  const cart = await Cart.findOne({ userId });

  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty. Please add items before checkout.", 400));
  }

  // ── 2. Validate shipping address ──────────────────────────────
  const { fullName, email, phone, address, city, state, pincode } = req.body;

  if (!fullName || !email || !phone || !address || !city || !state || !pincode) {
    return next(new AppError("All shipping address fields are required.", 400));
  }

  // Basic phone validation
  if (!/^[0-9]{10}$/.test(phone.replace(/\D/g, ""))) {
    return next(new AppError("Please provide a valid 10-digit phone number.", 400));
  }

  // Basic pincode validation
  if (!/^[0-9]{6}$/.test(pincode)) {
    return next(new AppError("Please provide a valid 6-digit PIN code.", 400));
  }

  // ── 3. Calculate totals from DB cart (never trust frontend) ───
  const subtotal      = cart.summary.subtotal;
  const totalDiscount = cart.summary.totalDiscount;
  const shippingCost  = 0;   // free shipping — change as needed
  const total         = subtotal + shippingCost;

  if (total <= 0) {
    return next(new AppError("Order total must be greater than zero.", 400));
  }

  // ── 4. Create Razorpay order ──────────────────────────────────
  //  Razorpay expects amount in PAISE (₹1 = 100 paise)
  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(total * 100),    // paise, must be integer
      currency: "INR",
      receipt:  `receipt_${userId}_${Date.now()}`,
      notes: {
        userId:   userId.toString(),
        customer: fullName,
        email,
      },
    });
  } catch (err) {
    logger.error("Razorpay order creation failed", { error: err.message, userId });
    return next(new AppError("Payment gateway error. Please try again.", 502));
  }

  // ── 5. Build cart snapshot (lock in current prices) ───────────
  const itemsSnapshot = cart.items.map((item) => ({
    productId:          item.productId,
    name:               item.name,
    sku:                item.sku,
    mainImage:          item.mainImage,
    price:              item.price,
    originalPrice:      item.originalPrice,
    discountPercentage: item.discountPercentage || 0,
    quantity:           item.quantity,
    itemTotal:          Math.round(item.price * item.quantity * 100) / 100,
  }));

  // ── 6. Save pending order to DB ───────────────────────────────
  //  We save BEFORE payment so we have a record even if user
  //  closes the browser mid-payment.
  const order = await Order.create({
    userId,
    items: itemsSnapshot,
    shippingAddress: { fullName, email, phone, address, city, state, pincode },
    pricing: { subtotal, totalDiscount, shippingCost, total },
    payment: {
      method:          "razorpay",
      status:          "pending",
      razorpayOrderId: razorpayOrder.id,
    },
    orderStatus: "placed",
  });

  logger.info("Razorpay order created", {
    orderId:         order._id,
    razorpayOrderId: razorpayOrder.id,
    amount:          total,
    userId,
  });

  // ── 7. Return to frontend ─────────────────────────────────────
  //  Frontend needs: key_id (to init Razorpay), razorpay order_id,
  //  amount, and our internal orderId (to call verify-payment).
  res.status(200).json({
    status: "success",
    data: {
      orderId:         order._id,          // our DB order ID
      razorpayOrderId: razorpayOrder.id,   // rzp_... string
      amount:          razorpayOrder.amount, // in paise
      currency:        razorpayOrder.currency,
      keyId:           process.env.RAZORPAY_KEY_ID,
      prefill: {
        name:    fullName,
        email,
        contact: phone,
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────
//  STEP 2 — VERIFY PAYMENT & FULFIL ORDER
//  POST /api/v1/orders/verify-payment
//
//  Flow:
//   1. Receive { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
//   2. Verify signature using HMAC SHA256 — THIS IS THE SECURITY GATE
//      If signature doesn't match → payment is fake → reject
//   3. If valid → mark order as paid, clear cart, attach order to user
//   4. Return success
//
//  WHY SIGNATURE VERIFICATION IS CRITICAL:
//   Anyone can send a POST request with fake payment IDs.
//   The signature is: HMAC_SHA256(razorpayOrderId + "|" + razorpayPaymentId, KEY_SECRET)
//   Only Razorpay knows KEY_SECRET, so only genuine payments
//   produce a valid signature.
// ─────────────────────────────────────────────────────────────────
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  // ── 1. Validate all fields are present ───────────────────────
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return next(new AppError("Missing payment verification fields.", 400));
  }

  // ── 2. Find our order ─────────────────────────────────────────
  const order = await Order.findById(orderId);

  if (!order) {
    return next(new AppError("Order not found.", 404));
  }

  // ── 2a. Ownership check — user can only verify their own order ─
  if (order.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("You are not authorized to verify this order.", 403));
  }

  // ── 2b. Idempotency — don't process an already-paid order ─────
  if (order.payment.status === "paid") {
    return res.status(200).json({
      status: "success",
      message: "Payment already verified.",
      data: { order },
    });
  }

  // ── 2c. Confirm the razorpayOrderId matches what we stored ────
  if (order.payment.razorpayOrderId !== razorpayOrderId) {
    logger.warn("Razorpay order ID mismatch", {
      stored:   order.payment.razorpayOrderId,
      received: razorpayOrderId,
      userId:   req.user.id,
    });
    return next(new AppError("Payment verification failed. Order ID mismatch.", 400));
  }

  // ── 3. VERIFY SIGNATURE (THE SECURITY GATE) ───────────────────
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const isSignatureValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(razorpaySignature,  "hex")
  );

  // ── 4a. SIGNATURE INVALID → payment is fake ───────────────────
  if (!isSignatureValid) {
    // Mark order as failed so admin can see it
    order.payment.status          = "failed";
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    await order.save();

    logger.warn("Invalid Razorpay signature — possible fraud attempt", {
      orderId: order._id,
      userId:  req.user.id,
    });

    return next(new AppError("Payment verification failed. Invalid signature.", 400));
  }

  // ── 4b. SIGNATURE VALID → fulfil the order ────────────────────
  //  We use atomic operations here to prevent partial updates
  //  if something crashes mid-way.

  // Update order to paid
  order.payment.status            = "paid";
  order.payment.razorpayPaymentId = razorpayPaymentId;
  order.payment.razorpaySignature = razorpaySignature;
  order.payment.paidAt            = new Date();
  order.orderStatus               = "placed";
  await order.save();

  // Clear the cart (parallel with user update)
  const cart = await Cart.findOne({ userId: req.user.id });
  if (cart) await cart.clearCart();

  logger.info("Payment verified — order fulfilled", {
    orderId:         order._id,
    orderNumber:     order.orderNumber,
    razorpayPaymentId,
    amount:          order.pricing.total,
    userId:          req.user.id,
  });

  res.status(200).json({
    status: "success",
    message: "Payment verified. Your order has been placed!",
    data: {
      orderNumber: order.orderNumber,
      orderId:     order._id,
      total:       order.pricing.total,
      paidAt:      order.payment.paidAt,
    },
  });
});

// ─────────────────────────────────────────────────────────────────
//  HANDLE PAYMENT FAILURE (called from frontend when popup closes
//  with error or user dismisses)
//  POST /api/v1/orders/payment-failed
// ─────────────────────────────────────────────────────────────────
exports.paymentFailed = catchAsync(async (req, res, next) => {
  const { orderId, reason } = req.body;

  if (!orderId) return next(new AppError("Order ID is required.", 400));

  const order = await Order.findById(orderId);

  if (!order) return next(new AppError("Order not found.", 404));

  if (order.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("Not authorized.", 403));
  }

  // Only update if still pending (don't overwrite a paid order)
  if (order.payment.status === "pending") {
    order.payment.status = "failed";
    order.notes = reason || "Payment cancelled by user";
    await order.save();

    logger.info("Payment marked as failed", { orderId, userId: req.user.id, reason });
  }

  res.status(200).json({
    status: "success",
    message: "Payment failure recorded.",
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET MY ORDERS  →  GET /api/v1/orders/my-orders
// ─────────────────────────────────────────────────────────────────
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ userId: req.user.id })
    .sort({ createdAt: -1 })   // newest first
    .select("-payment.razorpaySignature");  // don't expose signature to frontend

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: { orders },
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET SINGLE ORDER  →  GET /api/v1/orders/:orderId
// ─────────────────────────────────────────────────────────────────
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId)
    .select("-payment.razorpaySignature");

  if (!order) return next(new AppError("Order not found.", 404));

  // Users can only see their own orders
  if (order.userId.toString() !== req.user.id.toString() && req.user.role !== "admin") {
    return next(new AppError("You are not authorized to view this order.", 403));
  }

  res.status(200).json({
    status: "success",
    data: { order },
  });
});

// ─────────────────────────────────────────────────────────────────
//  ADMIN: GET ALL ORDERS  →  GET /api/v1/orders
// ─────────────────────────────────────────────────────────────────
exports.getAllOrders = catchAsync(async (req, res, next) => {
  // Simple pagination
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip  = (page - 1) * limit;

  // Optional filters
  const filter = {};
  if (req.query.status)  filter.orderStatus        = req.query.status;
  if (req.query.payment) filter["payment.status"]  = req.query.payment;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email phone"),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    status:  "success",
    results: orders.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: { orders },
  });
});