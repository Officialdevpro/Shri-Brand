const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true, // One cart per user
      index: true,
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: [true, "Product ID is required"],
        },

        // Lightweight snapshot for fast cart display
        name: {
          type: String,
          required: true,
          trim: true,
        },

        slug: {
          type: String,
          required: true,
        },

        sku: {
          type: String,
          required: true,
        },

        mainImage: {
          type: String,
          required: true,
        },

        // ── Selected pack snapshot ──
        selectedPack: {
          weight: { type: String, required: true },
          weightValue: { type: Number, required: true },
          price: { type: Number, required: true, min: 0 },
          originalPrice: { type: Number, min: 0 },
          discountPercentage: { type: Number, default: 0 },
          stock: { type: Number, required: true, min: 0 },
          stickCount: { type: Number },
          totalSold: { type: Number, default: 0 },
          lowStockThreshold: { type: Number, default: 10 },
        },

        // All available packs snapshot (for pack switching in cart sidebar)
        availablePacks: [
          {
            weight: { type: String },
            weightValue: { type: Number },
            price: { type: Number },
            originalPrice: { type: Number },
            discountPercentage: { type: Number, default: 0 },
            stock: { type: Number },
            stickCount: { type: Number },
            totalSold: { type: Number, default: 0 },
            lowStockThreshold: { type: Number, default: 10 },
          },
        ],

        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },

        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Cart summary (auto-calculated)
    summary: {
      subtotal: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalDiscount: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalItems: {
        type: Number,
        default: 0,
        min: 0,
      },
      itemCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Track last activity for abandoned cart cleanup
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===== INDEXES =====
cartSchema.index({ "items.productId": 1 });
cartSchema.index({ updatedAt: 1 });
// TTL: 30 days
cartSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 2592000 });

// ===== VIRTUALS =====
cartSchema.virtual("isEmpty").get(function () {
  return this.items.length === 0;
});

// ===== INSTANCE METHODS =====

// Calculate cart summary
cartSchema.methods.calculateSummary = function () {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalItems = 0;
  let itemCount = this.items.length;

  this.items.forEach((item) => {
    const packPrice = item.selectedPack.price;
    const packOriginal = item.selectedPack.originalPrice || packPrice;

    const itemTotal = packPrice * item.quantity;
    const itemOriginalTotal = packOriginal * item.quantity;

    subtotal += itemTotal;
    totalDiscount += itemOriginalTotal - itemTotal;
    totalItems += item.quantity;
  });

  this.summary = {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalItems,
    itemCount,
  };

  this.lastActivityAt = Date.now();

  return this.summary;
};

// Add or update item in cart
// `pack` object: { weight, weightValue, price, originalPrice, discountPercentage, stock }
cartSchema.methods.addItem = async function (product, pack, quantity = 1) {
  // Validate stock
  if (pack.stock < quantity) {
    throw new Error(
      `Insufficient stock for ${pack.weight}. Available: ${pack.stock}, Requested: ${quantity}`
    );
  }

  if (!product.isActive) {
    throw new Error("Product is not available");
  }

  // Build packs snapshot
  const packsSnapshot = (product.packs || []).map((p) => ({
    weight: p.weight,
    weightValue: p.weightValue,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPercentage: p.discountPercentage,
    stock: p.stock,
    stickCount: p.stickCount,
    totalSold: p.totalSold,
    lowStockThreshold: p.lowStockThreshold,
  }));

  // Check if same product + same pack already in cart
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.productId.toString() === product._id.toString() &&
      item.selectedPack.weight === pack.weight
  );

  if (existingItemIndex > -1) {
    // Update existing item
    const newQuantity = this.items[existingItemIndex].quantity + quantity;

    if (newQuantity > pack.stock) {
      throw new Error(
        `Cannot add more. Only ${pack.stock} units of ${pack.weight} available`
      );
    }

    this.items[existingItemIndex].quantity = newQuantity;

    // Update snapshot
    this.items[existingItemIndex].name = product.name;
    this.items[existingItemIndex].mainImage = product.mainImage;
    this.items[existingItemIndex].selectedPack = {
      weight: pack.weight,
      weightValue: pack.weightValue,
      price: pack.price,
      originalPrice: pack.originalPrice,
      discountPercentage: pack.discountPercentage,
      stock: pack.stock,
      stickCount: pack.stickCount,
      totalSold: pack.totalSold,
      lowStockThreshold: pack.lowStockThreshold,
    };
    this.items[existingItemIndex].availablePacks = packsSnapshot;
  } else {
    // Add new item
    this.items.push({
      productId: product._id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      mainImage: product.mainImage,
      selectedPack: {
        weight: pack.weight,
        weightValue: pack.weightValue,
        price: pack.price,
        originalPrice: pack.originalPrice,
        discountPercentage: pack.discountPercentage,
        stock: pack.stock,
        stickCount: pack.stickCount,
        totalSold: pack.totalSold,
        lowStockThreshold: pack.lowStockThreshold,
      },
      availablePacks: packsSnapshot,
      quantity,
    });
  }

  return this.save();
};

// Update item quantity
cartSchema.methods.updateItemQuantity = async function (productId, packWeight, quantity) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.selectedPack.weight === packWeight
  );

  if (itemIndex === -1) {
    throw new Error("Item not found in cart");
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  if (quantity > this.items[itemIndex].selectedPack.stock) {
    throw new Error(
      `Cannot update. Only ${this.items[itemIndex].selectedPack.stock} units available for ${packWeight}`
    );
  }

  this.items[itemIndex].quantity = quantity;
  return this.save();
};

// Change the pack for a cart item
cartSchema.methods.changeItemPack = async function (productId, oldPackWeight, newPackWeight, product) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.selectedPack.weight === oldPackWeight
  );

  if (itemIndex === -1) {
    throw new Error("Item not found in cart");
  }

  // Find the new pack from the product
  const newPack = product.getPackByWeight(newPackWeight);
  if (!newPack) {
    throw new Error(`Pack "${newPackWeight}" not found on this product`);
  }

  // Check if same product + new pack already exists in cart
  const existingNewPackIndex = this.items.findIndex(
    (item) =>
      item.productId.toString() === productId.toString() &&
      item.selectedPack.weight === newPackWeight
  );

  if (existingNewPackIndex > -1 && existingNewPackIndex !== itemIndex) {
    // Merge: add quantity to existing entry, remove old entry
    const combinedQty = this.items[existingNewPackIndex].quantity + this.items[itemIndex].quantity;
    if (combinedQty > newPack.stock) {
      throw new Error(`Cannot switch. Only ${newPack.stock} units available for ${newPackWeight}`);
    }
    this.items[existingNewPackIndex].quantity = combinedQty;
    this.items.splice(itemIndex, 1);
  } else {
    // Update pack in place
    const currentQty = this.items[itemIndex].quantity;
    if (currentQty > newPack.stock) {
      throw new Error(`Only ${newPack.stock} units available for ${newPackWeight}. Please reduce quantity first.`);
    }

    const packsSnapshot = (product.packs || []).map((p) => ({
      weight: p.weight,
      weightValue: p.weightValue,
      price: p.price,
      originalPrice: p.originalPrice,
      discountPercentage: p.discountPercentage,
      stock: p.stock,
      stickCount: p.stickCount,
      totalSold: p.totalSold,
      lowStockThreshold: p.lowStockThreshold,
    }));

    this.items[itemIndex].selectedPack = {
      weight: newPack.weight,
      weightValue: newPack.weightValue,
      price: newPack.price,
      originalPrice: newPack.originalPrice,
      discountPercentage: newPack.discountPercentage,
      stock: newPack.stock,
      stickCount: newPack.stickCount,
      totalSold: newPack.totalSold,
      lowStockThreshold: newPack.lowStockThreshold,
    };
    this.items[itemIndex].availablePacks = packsSnapshot;
  }

  return this.save();
};

// Remove item from cart
cartSchema.methods.removeItem = async function (productId, packWeight) {
  if (packWeight) {
    this.items = this.items.filter(
      (item) =>
        !(
          item.productId.toString() === productId.toString() &&
          item.selectedPack.weight === packWeight
        )
    );
  } else {
    // Remove all entries for this product (backward compat)
    this.items = this.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );
  }

  return this.save();
};

// Clear entire cart
cartSchema.methods.clearCart = async function () {
  this.items = [];
  return this.save();
};

// Validate cart against current product data (the single source of truth)
// Handles ALL edge cases:
//  - Product deleted/deactivated → item removed
//  - Pack removed from product  → item removed
//  - Stock reduced below qty    → qty capped
//  - Out of stock               → flagged (kept for freeze UI)
//  - Price changed              → snapshot updated
//  - Name/image changed         → snapshot updated
//  - New packs added to product → availablePacks synced
cartSchema.methods.validateCart = async function () {
  const Product = mongoose.model("Product");
  const issues = [];
  const validItems = [];

  if (!this.items || this.items.length === 0) {
    return { valid: true, issues: [] };
  }

  // Batch-fetch all products in one query (performance)
  const productIds = [...new Set(this.items.map((i) => i.productId.toString()))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = {};
  products.forEach((p) => {
    productMap[p._id.toString()] = p;
  });

  for (let item of this.items) {
    const product = productMap[item.productId.toString()];

    // ── Product deleted or deactivated → remove from cart ──
    if (!product || !product.isActive) {
      issues.push({
        productId: item.productId,
        issue: "unavailable",
        message: `${item.name} is no longer available and was removed from your cart.`,
      });
      continue; // Skip — don't add to validItems
    }

    // ── Refresh name / image if changed ──
    if (item.name !== product.name) item.name = product.name;
    if (item.mainImage !== product.mainImage) item.mainImage = product.mainImage;

    // ── Find matching pack ──
    const currentPack = product.getPackByWeight(item.selectedPack.weight);

    if (!currentPack) {
      // Pack removed from product → remove cart item
      issues.push({
        productId: item.productId,
        issue: "pack-unavailable",
        message: `${item.selectedPack.weight} pack for ${item.name} is no longer available and was removed.`,
      });
      continue; // Skip — don't add to validItems
    }

    // ── Stock check ──
    if (currentPack.stock === 0) {
      issues.push({
        productId: item.productId,
        issue: "out-of-stock",
        message: `${item.name} (${item.selectedPack.weight}) is out of stock.`,
      });
      // Keep item in cart (for freeze UI) but update snapshot
    }

    // ── Quantity adjustment if stock < qty ──
    if (currentPack.stock > 0 && currentPack.stock < item.quantity) {
      issues.push({
        productId: item.productId,
        issue: "stock-reduced",
        message: `Only ${currentPack.stock} unit(s) of ${item.name} (${item.selectedPack.weight}) available. Quantity adjusted.`,
      });
      item.quantity = currentPack.stock;
    }

    // ── Price change notification ──
    if (currentPack.price !== item.selectedPack.price) {
      issues.push({
        productId: item.productId,
        issue: "price-changed",
        message: `Price of ${item.name} (${item.selectedPack.weight}) changed: ₹${item.selectedPack.price} → ₹${currentPack.price}`,
      });
    }

    // ── Update selectedPack snapshot ──
    item.selectedPack = {
      weight: currentPack.weight,
      weightValue: currentPack.weightValue,
      price: currentPack.price,
      originalPrice: currentPack.originalPrice,
      discountPercentage: currentPack.discountPercentage,
      stock: currentPack.stock,
      stickCount: currentPack.stickCount,
      totalSold: currentPack.totalSold,
      lowStockThreshold: currentPack.lowStockThreshold,
    };

    // ── Fully sync availablePacks (adds new packs, removes deleted ones) ──
    item.availablePacks = (product.packs || [])
      .slice()
      .sort((a, b) => a.weightValue - b.weightValue)
      .map((p) => ({
        weight: p.weight,
        weightValue: p.weightValue,
        price: p.price,
        originalPrice: p.originalPrice,
        discountPercentage: p.discountPercentage,
        stock: p.stock,
        stickCount: p.stickCount,
        totalSold: p.totalSold,
        lowStockThreshold: p.lowStockThreshold,
      }));

    validItems.push(item);
  }

  this.items = validItems;
  this.calculateSummary();
  await this.save();

  return { valid: issues.length === 0, issues };
};

// ===== MIDDLEWARE =====

// Auto-calculate summary before saving
cartSchema.pre("save", function () {
  if (this.isModified("items")) {
    this.calculateSummary();
  }
});

// Update lastActivityAt on any save
cartSchema.pre("save", function () {
  this.lastActivityAt = Date.now();
});

module.exports = mongoose.model("Cart", cartSchema);