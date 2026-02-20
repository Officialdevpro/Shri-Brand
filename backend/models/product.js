const mongoose = require("mongoose");

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
      enum: {
        values: ["single", "combo", "gift"],
        message: "{VALUE} is not a valid product type",
      },
      required: true,
      default: "single",
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

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
      set: (v) => Math.round(v * 100) / 100, // Store with 2 decimal precision
    },

    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
      validate: {
        validator: function (value) {
          return value >= this.price;
        },
        message:
          "Original price must be greater than or equal to current price",
      },
    },

    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
      set: function (value) {
        // Only auto-calculate if not explicitly set
        if (value !== undefined && value !== null) {
          return value;
        }

        // Auto-calculate from originalPrice and price
        if (this.originalPrice && this.originalPrice > this.price) {
          return Math.round(
            ((this.originalPrice - this.price) / this.originalPrice) * 100,
          );
        }
        return 0;
      },
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
    },

    totalSold: {
      type: Number,
      default: 0,
      min: [0, "Total sold cannot be negative"],
    },

    weight: {
      type: String,
      match: [
        /^\d+(\.\d+)?\s*(g|kg|ml|l)$/i,
        "Weight must be in format like '50g', '0.5kg', '100ml'",
      ],
    },

    burnTime: {
      type: String,
      match: [
        /^\d+\s*(minutes?|hours?|mins?|hrs?)$/i,
        "Burn time must be like '45 minutes' or '1 hour'",
      ],
    },

    stickCount: {
      type: Number,
      min: [0, "Stick count cannot be negative"],
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

// ✅ Virtual Fields (Not Stored in DB)
productSchema.virtual("isLowStock").get(function () {
  return this.stock <= this.lowStockThreshold;
});

productSchema.virtual("isInStock").get(function () {
  return this.stock > 0;
});

productSchema.virtual("stockStatus").get(function () {
  if (this.stock === 0) return "out-of-stock";
  if (this.stock <= this.lowStockThreshold) return "low-stock";
  return "in-stock";
});

productSchema.virtual("discountAmount").get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return this.originalPrice - this.price;
  }
  return 0;
});

// ✅ Optimized Indexes (Only Essential Ones)
// Remove duplicate index definitions for slug and sku since they already have unique: true
productSchema.index({ fragranceCategory: 1 });
productSchema.index({ productType: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
// Compound index for common queries
productSchema.index({ isActive: 1, fragranceCategory: 1 });

// Optional: Index for price range queries if needed
productSchema.index({ price: 1 });

// ✅ Optional: Add method for business logic
productSchema.methods.reserveStock = function (quantity) {
  if (this.stock < quantity) {
    throw new Error(
      `Insufficient stock. Available: ${this.stock}, Requested: ${quantity}`,
    );
  }
  this.stock -= quantity;
  this.totalSold += quantity;
  return this.save();
};

productSchema.methods.restoreStock = function (quantity) {
  this.stock += quantity;
  this.totalSold = Math.max(0, this.totalSold - quantity);
  return this.save();
};

module.exports = mongoose.model("Product", productSchema);