const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
//  ORDER MODEL
//
//  KEY DESIGN DECISIONS:
//
//  1. cartSnapshot  — We copy every item's name, image, price,
//     quantity at order time. If the product is deleted or its
//     price changes 6 months later, the order still shows exactly
//     what was bought and at what price. This is non-negotiable
//     for any real e-commerce store.
//
//  2. payment sub-document  — All Razorpay IDs are stored here.
//     We keep razorpaySignature so we can re-verify anytime
//     if a dispute comes up.
//
//  3. status machine  — orderStatus goes in one direction only:
//     placed → processing → shipped → delivered
//     (or placed → cancelled at any early stage)
//     This makes it easy to filter orders for admin dashboards.
//
//  4. No TTL index  — Orders must NEVER be auto-deleted.
//     Unlike carts, orders are permanent financial records.
// ─────────────────────────────────────────────────────────────

const cartItemSnapshotSchema = new mongoose.Schema(
  {
    productId:          { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name:               { type: String, required: true },
    sku:                { type: String, required: true },
    mainImage:          { type: String, required: true },
    packWeight:         { type: String, required: true },                    // which pack was ordered
    price:              { type: Number, required: true, min: 0 },       // price at order time
    originalPrice:      { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0 },
    quantity:           { type: Number, required: true, min: 1 },
    itemTotal:          { type: Number, required: true, min: 0 },       // price × quantity
  },
  { _id: false }  // no _id needed on sub-documents
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email:    { type: String, required: true, trim: true },
    phone:    { type: String, required: true, trim: true },
    address:  { type: String, required: true, trim: true },
    city:     { type: String, required: true, trim: true },
    state:    { type: String, required: true, trim: true },
    pincode:  { type: String, required: true, trim: true },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    subtotal:      { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    shippingCost:  { type: Number, default: 0, min: 0 },
    total:         { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // ── Owner ──────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Order must belong to a user"],
      index:    true,
    },

    // ── What was ordered (immutable snapshot) ──────────────────
    items: {
      type:     [cartItemSnapshotSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: "Order must have at least one item",
      },
    },

    // ── Where to ship ──────────────────────────────────────────
    shippingAddress: {
      type:     shippingAddressSchema,
      required: true,
    },

    // ── Money ──────────────────────────────────────────────────
    pricing: {
      type:     pricingSchema,
      required: true,
    },

    // ── Payment ────────────────────────────────────────────────
    payment: {
      method: {
        type:    String,
        enum:    ["razorpay", "cod"],
        required: true,
      },
      status: {
        type:    String,
        enum:    ["pending", "paid", "failed", "refunded"],
        default: "pending",
      },

      // Razorpay fields (only set after successful payment)
      razorpayOrderId:   { type: String, default: null },   // from Razorpay API (step 1)
      razorpayPaymentId: { type: String, default: null },   // from Razorpay popup (step 2)
      razorpaySignature: { type: String, default: null },   // HMAC for verification (step 2)

      paidAt: { type: Date, default: null },
    },

    // ── Fulfilment status ──────────────────────────────────────
    orderStatus: {
      type:    String,
      enum:    ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
    },

    // ── Human-readable order number ────────────────────────────
    orderNumber: {
      type:   String,
      unique: true,
      // Auto-generated in pre-save hook below
    },

    // ── Optional notes ─────────────────────────────────────────
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,                       // createdAt, updatedAt
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── INDEXES ────────────────────────────────────────────────────
orderSchema.index({ "payment.razorpayOrderId": 1 });    // fast lookup during verification
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });                   // newest first for order history

// ── AUTO-GENERATE ORDER NUMBER ─────────────────────────────────
// Format: SB-20240215-A3F9  (SB = Shri Brand, date, 4 random hex chars)
orderSchema.pre("save", async function () {
  if (this.isNew) {
    const date    = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random  = Math.random().toString(16).slice(2, 6).toUpperCase();
    this.orderNumber = `SB-${date}-${random}`;
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;