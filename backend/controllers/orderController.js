// TODO: Uncomment when real Razorpay key is provided
// const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Order    = require("../models/orderModel");
const Cart     = require("../models/cartModel");
const User     = require("../models/userModel");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const logger   = require("../utils/logger");

// ─────────────────────────────────────────────────────────────────
//  Razorpay client — TODO: Uncomment when real key is provided
// ─────────────────────────────────────────────────────────────────
// const razorpay = new Razorpay({
//   key_id:     process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

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
// ─────────────────────────────────────────────────────────────────
//  HELPER: Generate dummy Razorpay-style IDs
//  These look realistic so the schema stays consistent.
//  TODO: Remove when real Razorpay key is provided.
// ─────────────────────────────────────────────────────────────────
function generateDummyIds() {
  const hex = (len) => Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)).join('');
  return {
    razorpayOrderId:   `order_SIM${hex(14)}`,
    razorpayPaymentId: `pay_SIM${hex(14)}`,
    razorpaySignature: hex(64),
  };
}

// ─────────────────────────────────────────────────────────────────
//  STEP 1 — CREATE ORDER (Simulated — no Razorpay API call)
//  POST /api/v1/orders/create-order
//
//  TODO: Replace with real Razorpay API call when key is provided.
//        The simulated block is clearly marked below.
// ─────────────────────────────────────────────────────────────────
exports.createOrder = catchAsync(async (req, res, next) => {
  try {
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

    if (!/^[0-9]{10}$/.test(phone.replace(/\D/g, ""))) {
      return next(new AppError("Please provide a valid 10-digit phone number.", 400));
    }

    if (!/^[0-9]{6}$/.test(pincode)) {
      return next(new AppError("Please provide a valid 6-digit PIN code.", 400));
    }

    // ── 3. Calculate totals from DB cart (never trust frontend) ───
    const subtotal      = cart.summary.subtotal;
    const totalDiscount = cart.summary.totalDiscount;
    const shippingCost  = 0;
    const total         = subtotal + shippingCost;

    if (total <= 0) {
      return next(new AppError("Order total must be greater than zero.", 400));
    }

    // ── 4. Generate dummy Razorpay IDs ────────────────────────────
    // TODO: Replace this block with real Razorpay order creation:
    //   const razorpayOrder = await razorpay.orders.create({ amount, currency, receipt, notes });

    const dummyIds = generateDummyIds();


    // ── 5. Build cart snapshot (lock in current prices) ───────────
    const itemsSnapshot = cart.items.map((item) => ({
      productId:          item.productId,
      name:               item.name,
      sku:                item.sku,
      mainImage:          item.mainImage,
      packWeight:         item.selectedPack.weight,
      price:              Number(item.selectedPack.price),
      originalPrice:      Number(item.selectedPack.originalPrice || item.selectedPack.price),
      discountPercentage: item.selectedPack.discountPercentage || 0,
      quantity:           item.quantity,
      itemTotal:          Math.round(Number(item.selectedPack.price) * item.quantity * 100) / 100,
    }));

    // ── 6. Save pending order to DB ───────────────────────────────
    const order = await Order.create({
      userId,
      items: itemsSnapshot,
      shippingAddress: { fullName, email, phone, address, city, state, pincode },
      pricing: { subtotal, totalDiscount, shippingCost, total },
      payment: {
        method:          "razorpay",
        status:          "pending",
        razorpayOrderId: dummyIds.razorpayOrderId,
      },
      orderStatus: "placed",
    });


    logger.info("Simulated order created", {
      orderId:         order._id,
      razorpayOrderId: dummyIds.razorpayOrderId,
      amount:          total,
      userId,
    });

    // ── 7. Return to frontend ─────────────────────────────────────
    res.status(200).json({
      status: "success",
      data: {
        orderId:         order._id,
        razorpayOrderId: dummyIds.razorpayOrderId,
        amount:          Math.round(total * 100),   // paise
        currency:        "INR",
        prefill: {
          name:    fullName,
          email,
          contact: phone,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
//  STEP 2 — SIMULATE PAYMENT (10-second delay happens on frontend)
//  POST /api/v1/orders/simulate-payment
//
//  Called after the frontend's 10-second countdown finishes.
//  Marks the order as paid, reduces product stock, clears cart.
//
//  TODO: Replace this entire handler with the real
//        verifyPayment handler when Razorpay key is provided.
// ─────────────────────────────────────────────────────────────────
exports.simulatePayment = catchAsync(async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) return next(new AppError("Order ID is required.", 400));

    // ── 1. Find order ─────────────────────────────────────────────
    const order = await Order.findById(orderId);
    if (!order) return next(new AppError("Order not found.", 404));

    if (order.userId.toString() !== req.user.id.toString()) {
      return next(new AppError("Not authorized.", 403));
    }

    // Idempotency
    if (order.payment.status === "paid") {
      return res.status(200).json({
        status: "success",
        message: "Payment already verified.",
        data: { order },
      });
    }

    // ── 2. Generate dummy payment + signature IDs ─────────────────
    const dummyIds = generateDummyIds();

    order.payment.status            = "paid";
    order.payment.razorpayPaymentId = dummyIds.razorpayPaymentId;
    order.payment.razorpaySignature = dummyIds.razorpaySignature;
    order.payment.paidAt            = new Date();
    order.orderStatus               = "placed";
    await order.save();

    // ── 3. Clear the cart ─────────────────────────────────────────
    await Cart.deleteOne({ userId: req.user.id });


    // ── 4. Reduce stock for each ordered item ─────────────────────
    const Product = require("../models/productModel");

    for (const item of order.items) {
      try {
        const product = await Product.findById(item.productId);
        if (product && item.packWeight) {
          await product.reserveStock(item.packWeight, item.quantity);
        }
      } catch (stockErr) {
        // Log but don't block order — stock may have changed since cart was validated
        logger.warn("Stock reduction failed", {
          productId: item.productId,
          packWeight: item.packWeight,
          error: stockErr.message,
        });
      }
    }


    logger.info("Simulated payment completed — order fulfilled", {
      orderId:     order._id,
      orderNumber: order.orderNumber,
      dummyPaymentId: dummyIds.razorpayPaymentId,
      amount:      order.pricing.total,
      userId:      req.user.id,
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
  } catch (err) {
    return next(err);
  }
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
//  COD ORDER (Wholesaler-only)
//  POST /api/v1/orders/create-cod-order
//
//  Same shipping validation and stock logic as the Razorpay flow,
//  but no Razorpay IDs. Order is created with payment.method "cod".
// ─────────────────────────────────────────────────────────────────
exports.createCodOrder = catchAsync(async (req, res, next) => {
  // ── 1. Role gate — wholesalers only ──────────────────────────
  if (req.user.role !== "wholesaler") {
    return next(new AppError("Cash on Delivery is available for wholesalers only.", 403));
  }

  const userId = req.user.id;

  // ── 2. Pull cart from DB ─────────────────────────────────────
  const cart = await Cart.findOne({ userId });

  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty. Please add items before checkout.", 400));
  }

  // ── 3. Validate shipping address ────────────────────────────
  const { fullName, email, phone, address, city, state, pincode } = req.body;

  if (!fullName || !email || !phone || !address || !city || !state || !pincode) {
    return next(new AppError("All shipping address fields are required.", 400));
  }

  if (!/^[0-9]{10}$/.test(phone.replace(/\D/g, ""))) {
    return next(new AppError("Please provide a valid 10-digit phone number.", 400));
  }

  if (!/^[0-9]{6}$/.test(pincode)) {
    return next(new AppError("Please provide a valid 6-digit PIN code.", 400));
  }

  // ── 4. Calculate totals from DB cart ─────────────────────────
  const subtotal      = cart.summary.subtotal;
  const totalDiscount = cart.summary.totalDiscount;
  const shippingCost  = 0;
  const total         = subtotal + shippingCost;

  if (total <= 0) {
    return next(new AppError("Order total must be greater than zero.", 400));
  }

  // ── 5. Build cart snapshot ───────────────────────────────────
  const itemsSnapshot = cart.items.map((item) => ({
    productId:          item.productId,
    name:               item.name,
    sku:                item.sku,
    mainImage:          item.mainImage,
    packWeight:         item.selectedPack.weight,
    price:              Number(item.selectedPack.price),
    originalPrice:      Number(item.selectedPack.originalPrice || item.selectedPack.price),
    discountPercentage: item.selectedPack.discountPercentage || 0,
    quantity:           item.quantity,
    itemTotal:          Math.round(Number(item.selectedPack.price) * item.quantity * 100) / 100,
  }));

  // ── 6. Create COD order ──────────────────────────────────────
  const order = await Order.create({
    userId,
    items: itemsSnapshot,
    shippingAddress: { fullName, email, phone, address, city, state, pincode },
    pricing: { subtotal, totalDiscount, shippingCost, total },
    payment: {
      method: "cod",
      status: "pending",
    },
    orderStatus: "placed",
  });


  // ── 7. Reduce stock for each ordered item ────────────────────
  const Product = require("../models/productModel");

  for (const item of order.items) {
    try {
      const product = await Product.findById(item.productId);
      if (product && item.packWeight) {
        await product.reserveStock(item.packWeight, item.quantity);
      }
    } catch (stockErr) {
      logger.warn("Stock reduction failed (COD)", {
        productId: item.productId,
        packWeight: item.packWeight,
        error: stockErr.message,
      });
    }
  }

  // ── 8. Clear the cart ────────────────────────────────────────
  await Cart.deleteOne({ userId });

  logger.info("COD order created", {
    orderId:     order._id,
    orderNumber: order.orderNumber,
    amount:      total,
    userId,
  });

  res.status(200).json({
    status: "success",
    message: "Order placed successfully via Cash on Delivery!",
    data: {
      orderNumber: order.orderNumber,
      orderId:     order._id,
      total:       order.pricing.total,
    },
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
  if (req.query.userId)  filter.userId             = req.query.userId;

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
// ─────────────────────────────────────────────────────────────────
//  ADMIN: UPDATE ORDER STATUS  →  PATCH /api/v1/orders/:orderId/status
// ─────────────────────────────────────────────────────────────────
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { orderStatus } = req.body;
  const validStatuses = ["placed", "processing", "shipped", "delivered", "cancelled"];

  if (!orderStatus || !validStatuses.includes(orderStatus)) {
    return next(new AppError(`Invalid order status. Must be one of: ${validStatuses.join(", ")}`, 400));
  }

  const order = await Order.findById(req.params.orderId).populate("userId", "name email");

  if (!order) return next(new AppError("Order not found.", 404));

  const previousStatus = order.orderStatus;

  // ── Restore stock when cancelling a non-cancelled order ────────
  if (orderStatus === "cancelled" && previousStatus !== "cancelled") {
    const Product = require("../models/productModel");

    for (const item of order.items) {
      try {
        const product = await Product.findById(item.productId);
        if (product && item.packWeight) {
          await product.restoreStock(item.packWeight, item.quantity);
        }
      } catch (stockErr) {
        logger.warn("Stock restore failed on cancel", {
          productId: item.productId,
          packWeight: item.packWeight,
          error: stockErr.message,
        });
      }
    }

    logger.info("Stock restored for cancelled order", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemCount: order.items.length,
    });
  }

  order.orderStatus = orderStatus;
  await order.save();

  logger.info("Admin updated order status", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    previousStatus,
    newStatus: orderStatus,
  });

  res.status(200).json({
    status: "success",
    message: `Order status updated to "${orderStatus}"`,
    data: { order },
  });
});

// ─────────────────────────────────────────────────────────────────
//  ADMIN: UPDATE PAYMENT STATUS  →  PATCH /api/v1/orders/:orderId/payment-status
// ─────────────────────────────────────────────────────────────────
exports.updatePaymentStatus = catchAsync(async (req, res, next) => {
  const { paymentStatus } = req.body;
  const validStatuses = ["pending", "paid", "failed", "refunded"];

  if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
    return next(new AppError(`Invalid payment status. Must be one of: ${validStatuses.join(", ")}`, 400));
  }

  const update = { "payment.status": paymentStatus };
  if (paymentStatus === "paid" && !req.body.skipPaidAt) {
    update["payment.paidAt"] = new Date();
  }

  const order = await Order.findByIdAndUpdate(
    req.params.orderId,
    update,
    { new: true, runValidators: true }
  ).populate("userId", "name email");

  if (!order) return next(new AppError("Order not found.", 404));

  logger.info("Admin updated payment status", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    newStatus: paymentStatus,
  });

  res.status(200).json({
    status: "success",
    message: `Payment status updated to "${paymentStatus}"`,
    data: { order },
  });
});

// ─────────────────────────────────────────────────────────────────
//  ADMIN: DELETE ORDER  →  DELETE /api/v1/orders/:orderId
//
//  Hard delete — use only for test/spam orders.
//  Real orders should be cancelled instead, not deleted.
// ─────────────────────────────────────────────────────────────────
exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) return next(new AppError("Order not found.", 404));

  // ── Restore stock if order was NOT already cancelled ──────────
  if (order.orderStatus !== "cancelled") {
    const Product = require("../models/productModel");

    for (const item of order.items) {
      try {
        const product = await Product.findById(item.productId);
        if (product && item.packWeight) {
          await product.restoreStock(item.packWeight, item.quantity);
        }
      } catch (stockErr) {
        logger.warn("Stock restore failed on delete", {
          productId: item.productId,
          packWeight: item.packWeight,
          error: stockErr.message,
        });
      }
    }

    logger.info("Stock restored for deleted order", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemCount: order.items.length,
    });
  }

  await Order.findByIdAndDelete(req.params.orderId);

  logger.warn("Admin deleted order", {
    orderId: order._id,
    orderNumber: order.orderNumber,
  });

  res.status(200).json({ status: "success", message: "Order deleted successfully", data: null });
});