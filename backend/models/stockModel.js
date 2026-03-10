const mongoose = require("mongoose");
const { Schema } = mongoose;

// ════════════════════════════════════════════════════════════════════════════════
//  1.  BOX TYPE SCHEMA
//      Represents each box size (40g, 80g, custom) stored in the database.
//      The inventory page's dynamic "Add New Pack" cards map to this collection.
// ════════════════════════════════════════════════════════════════════════════════

const boxTypeSchema = new Schema(
  {
    label: {
      type: String,
      required: [true, "Box label is required (e.g. '40 gm Box')"],
      trim: true,
      maxlength: [60, "Label cannot exceed 60 characters"],
    },

    // Weight in grams — the primary key used by the frontend (selSizeId, selSize)
    weightGm: {
      type: Number,
      required: [true, "Box weight in grams is required"],
      min: [1, "Weight must be at least 1 gram"],
    },

    // Current physical stock count
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    // Purchase cost per empty box (₹)
    ratePerBox: {
      type: Number,
      required: [true, "Rate per box is required"],
      min: [0, "Rate cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Static boxes (40g, 80g) are protected from deletion in the UI
    isDefault: {
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
  }
);

// Virtual: human-readable weight label e.g. "40 gm"
boxTypeSchema.virtual("weightLabel").get(function () {
  return `${this.weightGm} gm`;
});

boxTypeSchema.index({ weightGm: 1 }, { unique: true });
boxTypeSchema.index({ isActive: 1 });

const BoxType = mongoose.model("BoxType", boxTypeSchema);


// ════════════════════════════════════════════════════════════════════════════════
//  2.  RAW MATERIAL INVENTORY SCHEMA
//      A single document (singleton pattern) for the raw incense stick inventory.
//      The frontend reads `stickKg` and `stickRate` from here.
// ════════════════════════════════════════════════════════════════════════════════

const rawMaterialInventorySchema = new Schema(
  {
    // Identifier to enforce singleton — always "main"
    storeKey: {
      type: String,
      default: "main",
      unique: true,
    },

    // Quantity of raw incense stick available (kg)
    quantityKg: {
      type: Number,
      required: [true, "Stick quantity in kg is required"],
      min: [0, "Quantity cannot be negative"],
      set: (v) => Math.round(v * 1000) / 1000, // 3 decimal precision for kg
    },

    // Purchase cost per kilogram of raw stick (₹)
    ratePerKg: {
      type: Number,
      required: [true, "Rate per kg is required"],
      min: [0, "Rate cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Packing labour cost per finished box (₹) — stored here as a global setting
    labourRatePerBox: {
      type: Number,
      required: true,
      default: 1,
      min: [0, "Labour rate cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },

    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: cost per gram of raw stick
rawMaterialInventorySchema.virtual("ratePerGm").get(function () {
  return this.ratePerKg / 1000;
});

const RawMaterialInventory = mongoose.model(
  "RawMaterialInventory",
  rawMaterialInventorySchema
);


// ════════════════════════════════════════════════════════════════════════════════
//  3.  PRODUCTION RUN SCHEMA
//      Created when the user clicks "Commit Stock to Database" on Step 3.
//      Captures a full snapshot of the session so it is self-contained and
//      auditable — no recalculation needed after the fact.
// ════════════════════════════════════════════════════════════════════════════════

// ── 3a. Wholesaler Tier Sub-Schema ────────────────────────────────────────────
//    Maps to the 3 ws-tier rows rendered per pack entry in buildRates()
const wholesalerTierSchema = new Schema(
  {
    tierName: {
      type: String,
      required: true,
      enum: ["Bulk Order Tier", "Mid Order Tier", "Small Order Tier"],
    },

    // Minimum boxes required for this tier (ws_min1..3)
    minBoxes: {
      type: Number,
      required: true,
      min: [1, "Minimum boxes must be at least 1"],
    },

    // Markup percentage over cost (ws_mk1..3)
    markupPercent: {
      type: Number,
      required: true,
      min: [0, "Markup cannot be negative"],
      max: [1000, "Markup cannot exceed 1000%"],
    },

    // Calculated: cost + (cost × markupPercent / 100) — exact, no rounding
    pricePerBox: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Convenience: pricePerBox × minBoxes
    totalAtMinOrder: {
      type: Number,
      min: [0, "Total cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },
  },
  { _id: false } // embedded, no need for separate _id
);


// ── 3b. Packing Entry Sub-Schema ──────────────────────────────────────────────
//    Each item in the Step-2 packLog becomes one PackingEntry document
const packingEntrySchema = new Schema(
  {
    // Reference to the Product (fragrance) selected in the sidebar
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },

    // Denormalised name — keeps the run readable without populating
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    // Reference to the BoxType used for this entry
    boxType: {
      type: Schema.Types.ObjectId,
      ref: "BoxType",
      required: [true, "Box type reference is required"],
    },

    // Snapshot of box weight at time of production (gm)
    boxWeightGm: {
      type: Number,
      required: true,
      min: [1, "Box weight must be at least 1 gram"],
    },

    // Number of boxes packed in this entry
    boxesPacked: {
      type: Number,
      required: true,
      min: [1, "Must pack at least 1 box"],
    },

    // ── Cost snapshot (all in ₹) ─────────────────────────────────────────────
    // Stick cost = boxWeightGm × (stickRatePerKg / 1000)
    stickCostPerBox: {
      type: Number,
      required: true,
      min: [0],
      set: (v) => Math.round(v * 10000) / 10000, // 4 dp for accuracy
    },

    // Box purchase rate at time of packing
    boxCostPerBox: {
      type: Number,
      required: true,
      min: [0],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Packing labour rate at time of packing
    labourCostPerBox: {
      type: Number,
      required: true,
      min: [0],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Total cost = stick + box + labour
    totalCostPerBox: {
      type: Number,
      required: true,
      min: [0],
      set: (v) => Math.round(v * 10000) / 10000,
    },

    // MRP = Math.ceil(totalCostPerBox × 2 / 5) × 5  (page formula)
    mrpPerBox: {
      type: Number,
      required: true,
      min: [0],
    },

    // Total MRP value = mrpPerBox × boxesPacked
    totalMrpValue: {
      type: Number,
      required: true,
      min: [0],
    },

    // Stick consumed by this entry (kg) = (boxesPacked × boxWeightGm) / 1000
    stickUsedKg: {
      type: Number,
      required: true,
      min: [0],
      set: (v) => Math.round(v * 10000) / 10000,
    },

    // Wholesaler pricing tiers — always 3 (Bulk / Mid / Small)
    wholesalerTiers: {
      type: [wholesalerTierSchema],
      validate: {
        // Use function() not arrow so Mongoose passes the correct context.
        // Also allow empty array (0) when entry is being built — the controller
        // always supplies 3 tiers but we don't hard-fail on missing tiers here
        // to avoid a validation error surfacing as "next is not a function".
        validator: function(arr) {
          if (!arr) return false;
          return arr.length === 3;
        },
        message: "Exactly 3 wholesaler tiers are required per packing entry",
      },
    },
  },
  { _id: true }
);

// Virtual: margin percentage above cost
packingEntrySchema.virtual("marginPercent").get(function () {
  if (!this.totalCostPerBox || this.totalCostPerBox === 0) return 0;
  return (
    ((this.mrpPerBox - this.totalCostPerBox) / this.totalCostPerBox) * 100
  );
});


// ── 3c. Inventory Snapshot Sub-Schema ─────────────────────────────────────────
//    Frozen snapshot of the inventory *before* this run was applied.
//    Enables full audit trail and "undo" calculations.
const inventorySnapshotSchema = new Schema(
  {
    stickKg: { type: Number, required: true, min: 0 },
    stickRatePerKg: { type: Number, required: true, min: 0 },
    labourRatePerBox: { type: Number, required: true, min: 0 },

    // Snapshot of every box type at run time
    boxes: [
      {
        boxType: { type: Schema.Types.ObjectId, ref: "BoxType" },
        label: { type: String },
        weightGm: { type: Number },
        stockBefore: { type: Number },
        ratePerBox: { type: Number },
        _id: false,
      },
    ],
  },
  { _id: false }
);


// ── 3d. Production Run (root schema) ─────────────────────────────────────────
const productionRunSchema = new Schema(
  {
    // Human-readable run code, e.g. "RUN-20250303-001"
    runCode: {
      type: String,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: ["draft", "committed", "cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "draft",
    },

    committedAt: {
      type: Date,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Snapshot of all inventory values when the run was started (Step 1 inputs)
    inventorySnapshot: {
      type: inventorySnapshotSchema,
      required: true,
    },

    // All pack log entries from Step 2
    packingEntries: {
      type: [packingEntrySchema],
      validate: {
        validator: (arr) => arr && arr.length > 0,
        message: "At least one packing entry is required to commit a run",
      },
    },

    // ── Run-level computed totals (denormalised for fast queries) ─────────────
    totalStickUsedKg: {
      type: Number,
      min: [0],
      set: (v) => Math.round(v * 10000) / 10000,
    },

    totalBoxesPacked: {
      type: Number,
      min: [0],
    },

    totalProductionValue: {
      type: Number,
      min: [0],
      set: (v) => Math.round(v * 100) / 100,
    },

    // Stick remaining after this run = snapshot.stickKg − totalStickUsedKg
    stickRemainingKg: {
      type: Number,
      set: (v) => Math.round(v * 10000) / 10000,
    },

    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Pre-save: auto-generate runCode and compute totals ────────────────────────
// ✅ Mongoose 7+ uses PROMISE-BASED middleware — do NOT use next() callback.
//    Declare the hook as async and simply throw on error.
//    Using next() in Mongoose 7+ causes "next is not a function" because
//    the callback parameter is no longer passed.
productionRunSchema.pre("save", async function () {
  // Auto-generate runCode on first save
  if (!this.runCode) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand    = Math.floor(1000 + Math.random() * 9000);
    const ms      = Date.now() % 1000000;
    this.runCode  = `RUN-${dateStr}-${ms}${rand}`;
  }

  // Set committedAt when status transitions to committed
  if (this.isModified("status") && this.status === "committed" && !this.committedAt) {
    this.committedAt = new Date();
  }

  // Recompute run-level totals from entries
  if (this.packingEntries && this.packingEntries.length > 0) {
    this.totalStickUsedKg = this.packingEntries.reduce(
      (sum, e) => sum + (e.stickUsedKg || 0),
      0
    );
    this.totalBoxesPacked = this.packingEntries.reduce(
      (sum, e) => sum + (e.boxesPacked || 0),
      0
    );
    this.totalProductionValue = this.packingEntries.reduce(
      (sum, e) => sum + (e.totalMrpValue || 0),
      0
    );
    this.stickRemainingKg =
      (this.inventorySnapshot?.stickKg || 0) - this.totalStickUsedKg;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
productionRunSchema.index({ status: 1, createdAt: -1 });
productionRunSchema.index({ createdBy: 1 });
productionRunSchema.index({ committedAt: -1 });
productionRunSchema.index({ "packingEntries.product": 1 });

// ── Instance Methods ──────────────────────────────────────────────────────────

// Commit the run — transitions status and stamps committedAt
productionRunSchema.methods.commit = function () {
  if (this.status === "committed") {
    throw new Error(`Run ${this.runCode} is already committed`);
  }
  if (!this.packingEntries || this.packingEntries.length === 0) {
    throw new Error("Cannot commit a run with no packing entries");
  }
  this.status = "committed";
  return this.save();
};

// Cancel a run
productionRunSchema.methods.cancel = function () {
  if (this.status === "committed") {
    throw new Error(`Committed runs cannot be cancelled`);
  }
  this.status = "cancelled";
  return this.save();
};

// Get a summary object matching what the frontend's packLog looks like
productionRunSchema.methods.toPackLogFormat = function () {
  return this.packingEntries.map((e) => ({
    name: e.productName,
    size: e.boxWeightGm,
    boxes: e.boxesPacked,
    boxRate: e.boxCostPerBox,
  }));
};

const ProductionRun = mongoose.model("ProductionRun", productionRunSchema);


// ════════════════════════════════════════════════════════════════════════════════
//  UTILITY — buildPackingEntry()
//
//  Helper that mirrors the frontend calculation logic exactly.
//  Call this server-side before pushing to packingEntries[].
//
//  Usage:
//    const entry = buildPackingEntry({
//      product, productName, boxType, stickRatePerKg, labourRatePerBox,
//      boxesPacked, wholesalerInputs   // [{minBoxes, markupPercent}, ...]
//    });
//    productionRun.packingEntries.push(entry);
// ════════════════════════════════════════════════════════════════════════════════

function buildPackingEntry({
  product,        // ObjectId
  productName,    // string
  boxType,        // BoxType document  (needs .weightGm, .ratePerBox, ._id)
  stickRatePerKg, // number
  labourRatePerBox, // number
  boxesPacked,    // number
  wholesalerInputs = [
    { tierName: "Bulk Order Tier",  minBoxes: 1000, markupPercent: 40 },
    { tierName: "Mid Order Tier",   minBoxes: 500,  markupPercent: 60 },
    { tierName: "Small Order Tier", minBoxes: 100,  markupPercent: 80 },
  ],
}) {
  const stickCostPerBox =
    Math.round((boxType.weightGm * (stickRatePerKg / 1000)) * 10000) / 10000;
  const boxCostPerBox = Math.round(boxType.ratePerBox * 100) / 100;
  const labourCost = Math.round(labourRatePerBox * 100) / 100;
  const totalCostPerBox =
    Math.round((stickCostPerBox + boxCostPerBox + labourCost) * 10000) / 10000;

  // MRP formula from the frontend: Math.ceil(totalCost × 2 / 5) × 5
  const mrpPerBox = Math.ceil((totalCostPerBox * 2) / 5) * 5;
  const totalMrpValue = mrpPerBox * boxesPacked;
  const stickUsedKg =
    Math.round(((boxesPacked * boxType.weightGm) / 1000) * 10000) / 10000;

  // Wholesaler tiers — exact price, no rounding (matches frontend calcWSTier)
  const wholesalerTiers = wholesalerInputs.map((t) => {
    const pricePerBox =
      Math.round(
        (totalCostPerBox + (totalCostPerBox * t.markupPercent) / 100) * 100
      ) / 100;
    return {
      tierName: t.tierName,
      minBoxes: t.minBoxes,
      markupPercent: t.markupPercent,
      pricePerBox,
      totalAtMinOrder: Math.round(pricePerBox * t.minBoxes * 100) / 100,
    };
  });

  return {
    product,
    productName,
    boxType: boxType._id,
    boxWeightGm: boxType.weightGm,
    boxesPacked,
    stickCostPerBox,
    boxCostPerBox,
    labourCostPerBox: labourCost,
    totalCostPerBox,
    mrpPerBox,
    totalMrpValue,
    stickUsedKg,
    wholesalerTiers,
  };
}


// ════════════════════════════════════════════════════════════════════════════════
module.exports = {
  BoxType,
  RawMaterialInventory,
  ProductionRun,
  buildPackingEntry,
};