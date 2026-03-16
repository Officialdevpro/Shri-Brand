const mongoose = require("mongoose");

// ─── Pack Sub-Schema ───────────────────────────────────────────────────────────
const packSchema = new mongoose.Schema(
  {
    weight: {
      type: String,
      required: [true, "Pack weight label is required (e.g. '40g')"],
      trim: true,
    },
    weightValue: {
      type: Number,
      required: [true, "Pack weight value is required (e.g. 40)"],
      min: [0, "Weight value cannot be negative"],
    },
    price: {
      type: Number,
      required: [true, "Pack price is required"],
      min: [0, "Price cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    sku: {
      type: String,
      uppercase: true,
      trim: true,
    },
    stickCount: {
      type: Number,
      min: [0, "Stick count cannot be negative"],
    },
    totalSold: {
      type: Number,
      default: 0,
      min: [0, "Total sold cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
    },
    // Wholesaler pricing tiers — populated during production run commits
    wholesalerPricing: [
      {
        tierName: {
          type: String,
          required: [true, "Tier name is required"],
          trim: true,
        },
        minBoxes: {
          type: Number,
          required: [true, "Minimum boxes is required"],
          min: [1, "Minimum boxes must be at least 1"],
        },
        pricePerBox: {
          type: Number,
          required: [true, "Price per box is required"],
          min: [0, "Price cannot be negative"],
          set: (v) => Math.round(v * 100) / 100,
        },
      },
    ],
  },
  { _id: true }
);

// ─── Product Schema ────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },

    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      match: [
        /^[A-Z0-9-]+$/,
        "SKU can only contain uppercase letters, numbers, and hyphens",
      ],
    },

    productType: {
      type: String,
      required: true,
      default: "single",
      lowercase: true,
      trim: true,
    },

    fragranceCategory: {
      type: String,
      enum: {
        values: ["floral", "woody", "resin", "heritage", "mixed"],
        message: "{VALUE} is not a valid fragrance category",
      },
      required: true,
    },

    shortDescription: {
      type: String,
      required: true,
      maxlength: [200, "Short description cannot exceed 200 characters"],
    },

    fullDescription: {
      type: String,
      required: true,
      maxlength: [2000, "Full description cannot exceed 2000 characters"],
    },

    // ── Pack-based pricing & stock ──
    packs: {
      type: [packSchema],
      validate: {
        validator: function (arr) {
          return arr && arr.length > 0;
        },
        message: "At least one pack is required",
      },
    },

    burnTime: {
      type: String,
      match: [
        /^\d+\s*(minutes?|hours?|mins?|hrs?)$/i,
        "Burn time must be like '45 minutes' or '1 hour'",
      ],
    },

    usedFor: [
      {
        type: String,
        lowercase: true,
      },
    ],

    mainImage: {
      type: String,
      required: [true, "Main image URL is required"],
      match: [/^https?:\/\/.+/, "Main image must be a valid URL"],
    },

    images: [
      {
        type: String,
        match: [/^https?:\/\/.+/, "Image URL must be valid"],
      },
    ],

    // Cloudinary public IDs for image management
    cloudinary_ids: {
      mainImage: {
        type: String,
        required: false,
      },
      images: [
        {
          type: String,
        },
      ],
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ✅ Virtual: default (lowest) pack — sorted by weightValue ascending
productSchema.virtual("defaultPack").get(function () {
  if (!this.packs || this.packs.length === 0) return null;
  return [...this.packs].sort((a, b) => a.weightValue - b.weightValue)[0];
});

// ✅ Virtual: backward-compat price (from default pack)
productSchema.virtual("price").get(function () {
  const dp = this.defaultPack;
  return dp ? dp.price : 0;
});

productSchema.virtual("originalPrice").get(function () {
  const dp = this.defaultPack;
  return dp ? dp.originalPrice : 0;
});

productSchema.virtual("discountPercentage").get(function () {
  const dp = this.defaultPack;
  return dp ? dp.discountPercentage : 0;
});

productSchema.virtual("weight").get(function () {
  const dp = this.defaultPack;
  return dp ? dp.weight : null;
});

productSchema.virtual("stock").get(function () {
  // Total stock across all packs
  if (!this.packs || this.packs.length === 0) return 0;
  return this.packs.reduce((sum, p) => sum + (p.stock || 0), 0);
});

// ✅ Virtual: backward-compat totalSold (sum across all packs)
productSchema.virtual("totalSold").get(function () {
  if (!this.packs || this.packs.length === 0) return 0;
  return this.packs.reduce((sum, p) => sum + (p.totalSold || 0), 0);
});

// ✅ Virtual: backward-compat stickCount (from default pack)
productSchema.virtual("stickCount").get(function () {
  const dp = this.defaultPack;
  return dp ? dp.stickCount : null;
});

// ✅ Virtual: backward-compat lowStockThreshold (from default pack)
productSchema.virtual("lowStockThreshold").get(function () {
  const dp = this.defaultPack;
  return dp ? (dp.lowStockThreshold ?? 10) : 10;
});

// ✅ Virtual Fields (Not Stored in DB)
productSchema.virtual("isLowStock").get(function () {
  if (!this.packs || this.packs.length === 0) return false;
  return this.packs.some((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 10));
});

productSchema.virtual("isInStock").get(function () {
  return this.stock > 0;
});

productSchema.virtual("stockStatus").get(function () {
  if (this.stock === 0) return "out-of-stock";
  if (this.isLowStock) return "low-stock";
  return "in-stock";
});

productSchema.virtual("discountAmount").get(function () {
  const dp = this.defaultPack;
  if (dp && dp.originalPrice && dp.originalPrice > dp.price) {
    return dp.originalPrice - dp.price;
  }
  return 0;
});

// ✅ Optimized Indexes
productSchema.index({ fragranceCategory: 1 });
productSchema.index({ productType: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ isActive: 1, fragranceCategory: 1 });
productSchema.index({ "packs.price": 1 });

// ✅ Instance Methods
productSchema.methods.getPackByWeight = function (weight) {
  return this.packs.find(
    (p) => p.weight.toLowerCase() === String(weight).toLowerCase(),
  );
};

productSchema.methods.getPackByIndex = function (index) {
  return this.packs[index] || null;
};

productSchema.methods.reserveStock = function (packWeight, quantity) {
  const pack = this.getPackByWeight(packWeight);
  if (!pack) {
    throw new Error(`Pack "${packWeight}" not found`);
  }
  if (pack.stock < quantity) {
    throw new Error(
      `Insufficient stock for ${packWeight}. Available: ${pack.stock}, Requested: ${quantity}`,
    );
  }
  pack.stock -= quantity;
  pack.totalSold = (pack.totalSold || 0) + quantity;
  return this.save();
};

productSchema.methods.restoreStock = function (packWeight, quantity) {
  const pack = this.getPackByWeight(packWeight);
  if (!pack) {
    throw new Error(`Pack "${packWeight}" not found`);
  }
  pack.stock += quantity;
  pack.totalSold = Math.max(0, (pack.totalSold || 0) - quantity);
  return this.save();
};

module.exports = mongoose.model("Product", productSchema);