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

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        originalPrice: {
          type: Number,
          required: true,
          min: 0,
        },

        discountPercentage: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },

        weight: {
          type: String,
        },

        // Current stock at time of adding (for validation)
        availableStock: {
          type: Number,
          required: true,
          min: 0,
        },

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
// Note: userId already has unique:true which auto-creates an index
cartSchema.index({ "items.productId": 1 }); // Check if product in cart
cartSchema.index({ updatedAt: 1 }); // For cleanup queries
// WARNING: TTL index — carts with no activity for 30 days are auto-deleted by MongoDB.
// This applies to ALL carts including logged-in users. Remove if you want carts to persist indefinitely.
cartSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

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
    const itemTotal = item.price * item.quantity;
    const itemOriginalTotal = item.originalPrice * item.quantity;

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
cartSchema.methods.addItem = async function (product, quantity = 1) {
  // Validate stock
  if (product.stock < quantity) {
    throw new Error(
      `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
    );
  }

  if (!product.isActive) {
    throw new Error("Product is not available");
  }

  // Check if item already exists
  const existingItemIndex = this.items.findIndex(
    (item) => item.productId.toString() === product._id.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item
    const newQuantity = this.items[existingItemIndex].quantity + quantity;

    if (newQuantity > product.stock) {
      throw new Error(`Cannot add more. Only ${product.stock} items available`);
    }

    this.items[existingItemIndex].quantity = newQuantity;

    // Update snapshot in case product details changed
    this.items[existingItemIndex].name = product.name;
    this.items[existingItemIndex].mainImage = product.mainImage;
    this.items[existingItemIndex].price = product.price;
    this.items[existingItemIndex].originalPrice = product.originalPrice;
    this.items[existingItemIndex].discountPercentage = product.discountPercentage;
    this.items[existingItemIndex].availableStock = product.stock;
    this.items[existingItemIndex].weight = product.weight;
  } else {
    // Add new item
    this.items.push({
      productId: product._id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      mainImage: product.mainImage,
      price: product.price,
      originalPrice: product.originalPrice,
      discountPercentage: product.discountPercentage,
      weight: product.weight,
      availableStock: product.stock,
      quantity,
    });
  }

  return this.save();
};

// Update item quantity
cartSchema.methods.updateItemQuantity = async function (productId, quantity) {
  const itemIndex = this.items.findIndex(
    (item) => item.productId.toString() === productId.toString()
  );

  if (itemIndex === -1) {
    throw new Error("Item not found in cart");
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  if (quantity > this.items[itemIndex].availableStock) {
    throw new Error(
      `Cannot update. Only ${this.items[itemIndex].availableStock} items available`
    );
  }

  this.items[itemIndex].quantity = quantity;
  return this.save();
};

// Remove item from cart
cartSchema.methods.removeItem = async function (productId) {
  this.items = this.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );

  return this.save();
};

// Clear entire cart
cartSchema.methods.clearCart = async function () {
  this.items = [];
  return this.save();
};

// Validate cart against current product data
cartSchema.methods.validateCart = async function () {
  const Product = mongoose.model("Product");
  const issues = [];
  const validItems = [];

  for (let item of this.items) {
    const product = await Product.findById(item.productId);

    // Product deleted or inactive
    if (!product || !product.isActive) {
      issues.push({
        productId: item.productId,
        issue: "unavailable",
        message: `${item.name} is no longer available`,
      });
      continue;
    }

    // Stock check
    if (product.stock === 0) {
      issues.push({
        productId: item.productId,
        issue: "out-of-stock",
        message: `${item.name} is out of stock`,
      });
      continue;
    }

    // Quantity adjustment
    if (product.stock < item.quantity) {
      issues.push({
        productId: item.productId,
        issue: "stock-reduced",
        message: `Only ${product.stock} units of ${item.name} available. Quantity adjusted.`,
      });
      item.quantity = product.stock;
    }

    // Price change notification
    if (product.price !== item.price) {
      issues.push({
        productId: item.productId,
        issue: "price-changed",
        message: `Price of ${item.name} changed: ₹${item.price} → ₹${product.price}`,
      });

      // Update snapshot with new price
      item.price = product.price;
      item.originalPrice = product.originalPrice;
      item.discountPercentage = product.discountPercentage;
    }

    // Update available stock
    item.availableStock = product.stock;
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