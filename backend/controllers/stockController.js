"use strict";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 *  PRODUCTION CONTROLLER  —  stockController.js
 *  Shri Brand · Agarbathi Production Suite
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  commitProductionRun() pipeline
 *  ──────────────────────────────
 *  STEP 1  │ Validate request structure
 *  STEP 2  │ Fetch live inventory (rawMaterial, boxes, products WITH packs)
 *  STEP 3  │ Pack-match check  — box weightGm must exist as a pack.weightValue
 *  STEP 4  │ Stock sufficiency — stick kg + box counts
 *  STEP 5  │ Snapshot inventory before any mutation
 *  STEP 6  │ Build packing entries (server recalculates all costs/MRP)
 *  STEP 7  │ Persist ProductionRun (status = "committed")
 *  STEP 8  │ Atomic deductions  — rawMaterial.quantityKg, BoxType.stock
 *  STEP 9  │ Product stock += boxesPacked  +  price recalculation
 *            Uses findOneAndUpdate with positional $ — never calls product.save()
 *            so partial-projection validation errors cannot occur.
 *  STEP 10 │ Return rich response
 * ════════════════════════════════════════════════════════════════════════════════
 */

const Product = require("../models/productModel");
const {
  BoxType,
  RawMaterialInventory,
  ProductionRun,
  buildPackingEntry,
} = require("../models/stockModel");
const catchAsync = require("../utils/catchAsync");
const AppError   = require("../utils/AppError");

// ══════════════════════════════════════════════════════════════════════════════
//  PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const parseNum = (raw, fieldName, allowZero = true) => {
  const n = Number(raw);
  if (isNaN(n) || n < 0 || (!allowZero && n === 0)) {
    throw new AppError(
      `${fieldName} must be a non-negative number${allowZero ? "" : " greater than 0"}`,
      400
    );
  }
  return n;
};

const seedDefaults = async () => {
  const [rmCount, box40, box80] = await Promise.all([
    RawMaterialInventory.countDocuments({ storeKey: "main" }),
    BoxType.findOne({ weightGm: 40 }),
    BoxType.findOne({ weightGm: 80 }),
  ]);
  const ops = [];
  if (!rmCount)
    ops.push(RawMaterialInventory.create({ storeKey: "main", quantityKg: 0, ratePerKg: 0, labourRatePerBox: 1 }));
  if (!box40)
    ops.push(BoxType.create({ label: "40 gm Box", weightGm: 40, stock: 0, ratePerBox: 0, isDefault: true }));
  if (!box80)
    ops.push(BoxType.create({ label: "80 gm Box", weightGm: 80, stock: 0, ratePerBox: 0, isDefault: true }));
  if (ops.length) await Promise.all(ops);
};

/** MRP formula — mirrors frontend exactly */
const calcMRP = (totalCost) => Math.ceil((totalCost * 2) / 5) * 5;

/** Total production cost per box */
const calcTotalCostPerBox = (weightGm, ratePerKg, boxRate, labourRate) => {
  const stick = (weightGm * ratePerKg) / 1000;
  return Math.round((stick + boxRate + labourRate) * 10000) / 10000;
};

// ══════════════════════════════════════════════════════════════════════════════
//  INVENTORY ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

exports.getInventory = catchAsync(async (req, res, next) => {
  await seedDefaults();
  const [rawMaterial, boxes] = await Promise.all([
    RawMaterialInventory.findOne({ storeKey: "main" }).select("-__v"),
    BoxType.find({ isActive: true }).sort("weightGm").select("-__v"),
  ]);
  res.status(200).json({ success: true, data: { rawMaterial, boxes } });
});

exports.updateRawMaterial = catchAsync(async (req, res, next) => {
  const { quantityKg, ratePerKg, labourRatePerBox } = req.body;
  if (quantityKg === undefined && ratePerKg === undefined && labourRatePerBox === undefined)
    return next(new AppError("Provide at least one field: quantityKg, ratePerKg, or labourRatePerBox", 400));

  const updates = {};
  try {
    if (quantityKg      !== undefined) updates.quantityKg       = parseNum(quantityKg,      "quantityKg");
    if (ratePerKg       !== undefined) updates.ratePerKg        = parseNum(ratePerKg,       "ratePerKg");
    if (labourRatePerBox!== undefined) updates.labourRatePerBox = parseNum(labourRatePerBox, "labourRatePerBox");
  } catch (err) { return next(err); }

  if (req.user) updates.lastUpdatedBy = req.user._id;

  const rawMaterial = await RawMaterialInventory.findOneAndUpdate(
    { storeKey: "main" },
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  ).select("-__v");

  res.status(200).json({ success: true, message: "Raw material inventory updated", data: rawMaterial });
});

exports.createBoxType = catchAsync(async (req, res, next) => {
  const { label, weightGm, stock = 0, ratePerBox } = req.body;
  if (weightGm  === undefined || weightGm  === "") return next(new AppError("weightGm is required", 400));
  if (ratePerBox === undefined || ratePerBox === "") return next(new AppError("ratePerBox is required", 400));

  let parsedWeight, parsedRate, parsedStock;
  try {
    parsedWeight = parseNum(weightGm,   "weightGm",   false);
    parsedRate   = parseNum(ratePerBox, "ratePerBox");
    parsedStock  = parseNum(stock,      "stock");
  } catch (err) { return next(err); }

  const existing = await BoxType.findOne({ weightGm: parsedWeight, isActive: true });
  if (existing)
    return next(new AppError(`A box type with ${parsedWeight}g already exists (id: ${existing._id})`, 409));

  const box = await BoxType.create({
    label:      label?.trim() || `${parsedWeight} gm Box`,
    weightGm:   parsedWeight,
    stock:      parsedStock,
    ratePerBox: parsedRate,
    isDefault:  false,
  });

  res.status(201).json({ success: true, message: "Box type created", data: box });
});

exports.updateBoxType = catchAsync(async (req, res, next) => {
  const { stock, ratePerBox, label, weightGm } = req.body;
  const box = await BoxType.findById(req.params.id);
  if (!box)          return next(new AppError("Box type not found", 404));
  if (!box.isActive) return next(new AppError("Box type has been removed", 410));
  if (stock === undefined && ratePerBox === undefined && label === undefined && weightGm === undefined)
    return next(new AppError("Provide at least one field to update", 400));

  const updates = {};
  try {
    if (stock      !== undefined) updates.stock      = parseNum(stock,      "stock");
    if (ratePerBox !== undefined) updates.ratePerBox = parseNum(ratePerBox, "ratePerBox");
    if (label      !== undefined) {
      const t = String(label).trim();
      if (!t) return next(new AppError("label cannot be blank", 400));
      updates.label = t;
    }
    if (weightGm !== undefined) {
      if (box.isDefault) return next(new AppError("Weight of a default box type cannot be changed", 403));
      const w = parseNum(weightGm, "weightGm", false);
      const clash = await BoxType.findOne({ weightGm: w, isActive: true, _id: { $ne: box._id } });
      if (clash) return next(new AppError(`Another active box type with weight ${w}g already exists`, 409));
      updates.weightGm = w;
      if (label === undefined) updates.label = `${w} gm Box`;
    }
  } catch (err) { return next(err); }

  const updated = await BoxType.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).select("-__v");
  res.status(200).json({ success: true, message: "Box type updated", data: updated });
});

exports.deleteBoxType = catchAsync(async (req, res, next) => {
  const box = await BoxType.findById(req.params.id);
  if (!box) return next(new AppError("Box type not found", 404));
  if (box.isDefault) return next(new AppError("Default box types (40g, 80g) cannot be deleted", 403));
  box.isActive = false;
  await box.save();
  res.status(200).json({ success: true, message: "Box type removed", data: null });
});

// ══════════════════════════════════════════════════════════════════════════════
//  FRAGRANCE SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════

exports.getProductsForPacking = catchAsync(async (req, res, next) => {
  const { search } = req.query;
  const filter = { isActive: true };
  if (search) {
    const s = String(search).trim();
    if (s.length > 100) return next(new AppError("Search query too long", 400));
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { sku:  { $regex: s, $options: "i" } },
    ];
  }

  const products = await Product.find(filter).sort("name").select("_id name sku mainImage packs");

  const data = products.map((p) => ({
    id:        p._id,
    name:      p.name,
    sku:       p.sku,
    mainImage: p.mainImage,
    packs:     p.packs.map((pk) => ({
      weight:      pk.weight,
      weightValue: pk.weightValue,
      stock:       pk.stock,
    })),
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTION RUN — LIST / GET
// ══════════════════════════════════════════════════════════════════════════════

exports.getProductionRuns = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status, sort = "-createdAt" } = req.query;
  const VALID_STATUSES    = ["draft", "committed", "cancelled"];
  const VALID_SORT_FIELDS = ["createdAt", "-createdAt", "committedAt", "-committedAt", "totalBoxesPacked", "-totalBoxesPacked", "totalProductionValue", "-totalProductionValue"];

  const filter = {};
  if (status) {
    if (!VALID_STATUSES.includes(status))
      return next(new AppError(`status must be one of: ${VALID_STATUSES.join(", ")}`, 400));
    filter.status = status;
  }
  if (!VALID_SORT_FIELDS.includes(sort))
    return next(new AppError(`Invalid sort. Use: ${VALID_SORT_FIELDS.join(", ")}`, 400));

  const pageNum  = Math.max(1, Number(page)  || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));

  const [runs, total] = await Promise.all([
    ProductionRun.find(filter).sort(sort).limit(limitNum).skip((pageNum - 1) * limitNum)
      .select("-packingEntries -inventorySnapshot -__v").populate("createdBy", "name email"),
    ProductionRun.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: runs.length, total, totalPages: Math.ceil(total / limitNum), currentPage: pageNum, data: runs });
});

exports.getProductionRun = catchAsync(async (req, res, next) => {
  const run = await ProductionRun.findById(req.params.id).select("-__v")
    .populate("createdBy",              "name email")
    .populate("packingEntries.product", "name sku mainImage")
    .populate("packingEntries.boxType", "label weightGm");
  if (!run) return next(new AppError("Production run not found", 404));
  res.status(200).json({ success: true, data: run });
});

// ══════════════════════════════════════════════════════════════════════════════
//  COMMIT PRODUCTION RUN
// ══════════════════════════════════════════════════════════════════════════════

exports.commitProductionRun = catchAsync(async (req, res, next) => {
  const { packingEntries: clientEntries, notes } = req.body;

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 1 — Validate request structure
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 1 — Validating request structure...");

  if (!Array.isArray(clientEntries) || clientEntries.length === 0)
    return next(new AppError("packingEntries must be a non-empty array", 400));
  if (clientEntries.length > 100)
    return next(new AppError("A single run cannot exceed 100 packing entries", 400));

  const structErrors = [];
  clientEntries.forEach((e, i) => {
    const p = `entries[${i}]`;
    if (!e || typeof e !== "object") { structErrors.push(`${p}: must be an object`); return; }
    if (!e.productId)                  structErrors.push(`${p}: productId required`);
    if (!String(e.productName || "").trim()) structErrors.push(`${p}: productName required`);
    if (!e.boxTypeId)                  structErrors.push(`${p}: boxTypeId required`);
    if (!e.boxesPacked || Number(e.boxesPacked) < 1)
      structErrors.push(`${p}: boxesPacked must be ≥ 1`);
  });
  if (structErrors.length)
    return next(new AppError(`Payload validation: ${structErrors.join(" | ")}`, 400));

  console.log(`[COMMIT] STEP 1 — OK. ${clientEntries.length} entr(ies) received.`);

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 2 — Fetch live inventory
  //  CRITICAL FIX: products must include "packs" in the select so that
  //  pack-match validation and stock updates work correctly.
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 2 — Fetching live inventory from DB...");

  const uniqueBoxIds     = [...new Set(clientEntries.map((e) => e.boxTypeId))];
  const uniqueProductIds = [...new Set(clientEntries.map((e) => e.productId))];

  const [rawMaterial, boxes, products] = await Promise.all([
    RawMaterialInventory.findOne({ storeKey: "main" }),
    BoxType.find({ _id: { $in: uniqueBoxIds }, isActive: true }),
    // ✅ FIXED: "packs" is now included — without this, pack-match check
    //    and STEP 9 price/stock update cannot work.
    Product.find({ _id: { $in: uniqueProductIds }, isActive: true })
      .select("_id name sku packs"),
  ]);

  if (!rawMaterial)
    return next(new AppError("Raw material inventory not configured. Set it up in Step 1 first.", 404));

  const boxMap     = Object.fromEntries(boxes.map((b)    => [b._id.toString(), b]));
  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  console.log(`[COMMIT] STEP 2 — OK. rawMaterial=${rawMaterial.quantityKg}kg, boxes=${boxes.length}, products=${products.length}`);

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 3 — PACK-MATCH VALIDATION
  //  box.weightGm must match at least one pack.weightValue on the product.
  //  Collects ALL mismatches — returns one error so admin can fix all at once.
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 3 — Running pack-match validation...");

  const packMatchErrors = [];
  const refErrors       = [];

  clientEntries.forEach((e, i) => {
    const prefix  = `Entry ${i + 1} — "${e.productName}"`;
    const product = productMap[String(e.productId)];
    const box     = boxMap[String(e.boxTypeId)];

    if (!product) { refErrors.push(`${prefix}: Product not found or is inactive`); return; }
    if (!box)     { refErrors.push(`${prefix}: Box type (id: ${e.boxTypeId}) not found or is inactive`); return; }

    const matchingPack = product.packs.find(
      (pk) => Number(pk.weightValue) === Number(box.weightGm)
    );

    if (!matchingPack) {
      const available = product.packs.map((pk) => `${pk.weightValue}g (${pk.weight})`).join(", ");
      packMatchErrors.push(
        `${prefix}: Box size ${box.weightGm}g ("${box.label}") does NOT match any pack on this product. ` +
        `Available: [${available || "none"}]`
      );
    } else {
      console.log(`[COMMIT]   ✓ ${prefix} → matched pack "${matchingPack.weight}" (weightValue=${matchingPack.weightValue})`);
    }
  });

  if (refErrors.length)
    return next(new AppError(`Reference errors:\n${refErrors.join("\n")}`, 422));

  if (packMatchErrors.length) {
    console.warn("[COMMIT] STEP 3 — FAILED. Pack mismatches:\n", packMatchErrors.join("\n"));
    return next(new AppError(
      `Pack size mismatch — correct the following before committing:\n\n` +
      packMatchErrors.map((m, i) => `  ${i + 1}. ${m}`).join("\n"),
      422
    ));
  }

  console.log("[COMMIT] STEP 3 — OK. All pack sizes match.");

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 4 — STOCK SUFFICIENCY CHECK
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 4 — Checking stock sufficiency...");

  let totalStickNeeded = 0;
  const boxUsage = {};

  clientEntries.forEach((e) => {
    const box   = boxMap[String(e.boxTypeId)];
    const count = Number(e.boxesPacked);
    totalStickNeeded += (count * box.weightGm) / 1000;
    boxUsage[box._id.toString()] = (boxUsage[box._id.toString()] || 0) + count;
  });

  const stockErrors = [];

  if (totalStickNeeded > rawMaterial.quantityKg + 0.0001) {
    stockErrors.push(
      `Raw stick: need ${totalStickNeeded.toFixed(3)} kg, have ${rawMaterial.quantityKg.toFixed(3)} kg ` +
      `(shortfall: ${(totalStickNeeded - rawMaterial.quantityKg).toFixed(3)} kg)`
    );
  }

  for (const [boxId, needed] of Object.entries(boxUsage)) {
    const box = boxMap[boxId];
    if (needed > box.stock)
      stockErrors.push(`Box "${box.label}" (${box.weightGm}g): need ${needed}, have ${box.stock} (short by ${needed - box.stock})`);
  }

  if (stockErrors.length) {
    console.warn("[COMMIT] STEP 4 — FAILED. Stock errors:\n", stockErrors.join("\n"));
    return next(new AppError(
      `Insufficient stock — resolve before committing:\n\n` +
      stockErrors.map((e, i) => `  ${i + 1}. ${e}`).join("\n"),
      422
    ));
  }

  console.log(`[COMMIT] STEP 4 — OK. Stick needed=${totalStickNeeded.toFixed(3)}kg, available=${rawMaterial.quantityKg.toFixed(3)}kg`);

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 5 — Snapshot inventory before any mutation
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 5 — Snapshotting inventory...");

  const inventorySnapshot = {
    stickKg:          rawMaterial.quantityKg,
    stickRatePerKg:   rawMaterial.ratePerKg,
    labourRatePerBox: rawMaterial.labourRatePerBox,
    boxes: boxes.map((b) => ({
      boxType:     b._id,
      label:       b.label,
      weightGm:    b.weightGm,
      stockBefore: b.stock,
      ratePerBox:  b.ratePerBox,
    })),
  };

  console.log("[COMMIT] STEP 5 — OK.");

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 6 — Build packing entries (server recalculates all costs/MRP)
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 6 — Building packing entries...");

  // ── Wholesaler tier names MUST match the enum in wholesalerTierSchema exactly.
  //    We merge client-supplied minBoxes/markupPercent with server-enforced tierNames.
  //    Never trust the client's tierName — a mismatch causes a Mongoose enum
  //    validation error inside ProductionRun.create() which surfaces as
  //    "next is not a function" because it throws inside the pre-save hook.
  const TIER_NAMES = ["Bulk Order Tier", "Mid Order Tier", "Small Order Tier"];
  const DEFAULT_WS_TIERS = [
    { tierName: "Bulk Order Tier",  minBoxes: 1000, markupPercent: 40 },
    { tierName: "Mid Order Tier",   minBoxes: 500,  markupPercent: 60 },
    { tierName: "Small Order Tier", minBoxes: 100,  markupPercent: 80 },
  ];

  /**
   * Merge client wholesaler inputs with server-enforced tier names.
   * Client sends: [{ tierName, minBoxes, markupPercent }, ...]
   * We keep minBoxes + markupPercent from client but ALWAYS use server tierName.
   */
  const buildWsTiers = (clientTiers) => {
    if (!Array.isArray(clientTiers) || clientTiers.length !== 3) return DEFAULT_WS_TIERS;
    return clientTiers.map((t, i) => ({
      tierName:      TIER_NAMES[i],                                    // ← server-enforced
      minBoxes:      Math.max(1, parseInt(t.minBoxes)      || DEFAULT_WS_TIERS[i].minBoxes),
      markupPercent: Math.max(0, parseFloat(t.markupPercent) ?? DEFAULT_WS_TIERS[i].markupPercent),
    }));
  };

  const builtEntries = clientEntries.map((e) =>
    buildPackingEntry({
      product:          e.productId,
      productName:      e.productName,
      boxType:          boxMap[String(e.boxTypeId)],
      stickRatePerKg:   rawMaterial.ratePerKg,
      labourRatePerBox: rawMaterial.labourRatePerBox,
      boxesPacked:      Number(e.boxesPacked),
      wholesalerInputs: buildWsTiers(e.wholesalerInputs),             // ← always safe
    })
  );

  builtEntries.forEach((e) =>
    console.log(`[COMMIT]   ${e.productName} — ${e.boxesPacked} boxes, MRP ₹${e.mrpPerBox}, cost ₹${e.totalCostPerBox}`)
  );
  console.log("[COMMIT] STEP 6 — OK.");

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 7 — Persist ProductionRun document
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 7 — Persisting ProductionRun...");

  let run;
  try {
    run = await ProductionRun.create({
      status:            "committed",
      createdBy:         req.user?._id || null,
      inventorySnapshot,
      packingEntries:    builtEntries,
      notes:             notes ? String(notes).trim().substring(0, 500) : undefined,
    });
  } catch (createErr) {
    // Surface the real Mongoose validation error instead of letting it
    // bubble up as "next is not a function" from inside the pre-save hook.
    console.error("[COMMIT] STEP 7 — FAILED. ProductionRun.create() threw:", createErr.message);
    if (createErr.name === "ValidationError") {
      const fields = Object.values(createErr.errors).map((e) => e.message).join("; ");
      return next(new AppError(`Production run validation failed: ${fields}`, 422));
    }
    return next(new AppError(`Failed to save production run: ${createErr.message}`, 500));
  }

  console.log(`[COMMIT] STEP 7 — OK. Run created: ${run.runCode} | boxes=${run.totalBoxesPacked} | value=₹${run.totalProductionValue}`);

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 8 — Atomic deduction: rawMaterial.quantityKg + BoxType.stock
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 8 — Deducting raw material and box stock...");

  const deductOps = [
    RawMaterialInventory.updateOne(
      { storeKey: "main" },
      { $inc: { quantityKg: -run.totalStickUsedKg } }
    ),
    ...Object.entries(boxUsage).map(([boxId, used]) =>
      BoxType.updateOne({ _id: boxId }, { $inc: { stock: -used } })
    ),
  ];

  const deductResults = await Promise.allSettled(deductOps);
  const deductFailed  = deductResults.filter((r) => r.status === "rejected");

  if (deductFailed.length) {
    console.error(
      `[COMMIT] STEP 8 — ⚠️  ${deductFailed.length} deduction(s) failed (manual reconciliation required):`,
      deductFailed.map((f) => f.reason?.message).join("\n")
    );
  } else {
    console.log(`[COMMIT] STEP 8 — OK. Deducted ${run.totalStickUsedKg}kg stick. Box deductions: ${JSON.stringify(boxUsage)}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 9 — PRODUCT STOCK ADDITION + PRICE RECALCULATION
  //
  //  ⚠️  WHY findOneAndUpdate INSTEAD OF product.save():
  //  ────────────────────────────────────────────────────
  //  products were loaded with .select("_id name sku packs") — a partial
  //  projection.  Calling .save() on a partially-selected document triggers
  //  full Mongoose schema validation, which throws on required fields that
  //  weren't loaded (mainImage, shortDescription, slug, sku, etc.).
  //  That validation error propagates as "next is not a function" in some
  //  Mongoose / Express versions.
  //
  //  findOneAndUpdate with the positional $ operator:
  //    • targets only the specific pack subdocument
  //    • runValidators: false — skip full-doc validation (safe here)
  //    • atomic at the MongoDB document level
  //    • no pre/post save hooks on unrelated fields
  // ══════════════════════════════════════════════════════════════════════
  console.log("[COMMIT] STEP 9 — Updating product stock and prices...");

  // Aggregate by productId::weightGm to collapse duplicate entries
  const updatePlan = new Map();

  for (const entry of builtEntries) {
    const key = `${entry.product.toString()}::${entry.boxWeightGm}`;
    const box = boxes.find((b) => b.weightGm === entry.boxWeightGm);
    if (!box) continue;

    if (!updatePlan.has(key)) {
      updatePlan.set(key, {
        productId:       entry.product.toString(),
        productName:     entry.productName,
        boxWeightGm:     entry.boxWeightGm,
        totalBoxesToAdd: 0,
        totalCostPerBox: calcTotalCostPerBox(
          entry.boxWeightGm,
          rawMaterial.ratePerKg,
          box.ratePerBox,
          rawMaterial.labourRatePerBox
        ),
      });
    }
    updatePlan.get(key).totalBoxesToAdd += entry.boxesPacked;
  }

  const productUpdateResults = [];

  for (const [, plan] of updatePlan) {
    const { productId, productName, boxWeightGm, totalBoxesToAdd, totalCostPerBox } = plan;
    console.log(`[COMMIT]   Updating "${productName}" — pack ${boxWeightGm}g, +${totalBoxesToAdd} boxes, cost ₹${totalCostPerBox}`);

    try {
      // ── a) Fresh read to get current stock and price ──────────────────
      const freshProduct = await Product.findById(productId).select("name sku packs");

      if (!freshProduct) {
        console.warn(`[COMMIT]   ⚠️  Product ${productId} not found during update — skipping`);
        productUpdateResults.push({ productId, productName, packWeight: `${boxWeightGm}g`, error: "Product not found during update" });
        continue;
      }

      const pack = freshProduct.packs.find((pk) => Number(pk.weightValue) === Number(boxWeightGm));

      if (!pack) {
        console.warn(`[COMMIT]   ⚠️  Pack ${boxWeightGm}g not found on "${productName}" — skipping`);
        productUpdateResults.push({ productId, productName, packWeight: `${boxWeightGm}g`, error: `Pack ${boxWeightGm}g not found on product` });
        continue;
      }

      const previousStock = pack.stock;
      const previousPrice = pack.price;
      const newStock      = previousStock + totalBoxesToAdd;
      const newMRP        = calcMRP(totalCostPerBox);
      const priceChanged  = newMRP !== previousPrice;

      // ── b) Build $set targeting only this pack subdocument ────────────
      //      Uses positional $ — matched by packs._id (the pack's ObjectId)
      const setPayload = {
        "packs.$.stock":         newStock,
        "packs.$.price":         newMRP,
        "packs.$.originalPrice": previousPrice,
      };
      if (priceChanged) {
        setPayload["packs.$.discountPercentage"] = 0;
      }

      // ── c) Atomic update — NO product.save(), NO full validation ──────
      await Product.findOneAndUpdate(
        {
          _id:        freshProduct._id,
          "packs._id": pack._id,       // match the exact subdocument
        },
        { $set: setPayload },
        {
          new:           true,
          runValidators: false,         // safe: we only touch pack fields
        }
      );

      console.log(
        `[COMMIT]   ✓ "${productName}" pack ${boxWeightGm}g: ` +
        `stock ${previousStock} → ${newStock} (+${totalBoxesToAdd}), ` +
        `MRP ₹${previousPrice} → ₹${newMRP}${priceChanged ? " (CHANGED)" : " (unchanged)"}`
      );

      productUpdateResults.push({
        productId,
        productName:  freshProduct.name,
        sku:          freshProduct.sku,
        packWeight:   pack.weight,
        packWeightGm: boxWeightGm,
        stockBefore:  previousStock,
        stockAdded:   totalBoxesToAdd,
        stockAfter:   newStock,
        priceBefore:  previousPrice,
        priceAfter:   newMRP,
        priceChanged,
        costPerBox:   Math.round(totalCostPerBox * 100) / 100,
      });

    } catch (updateErr) {
      // Non-fatal — run is committed and raw materials already deducted.
      console.error(`[COMMIT]   ✗ Failed to update "${productName}" (${boxWeightGm}g):`, updateErr.message);
      productUpdateResults.push({
        productId,
        productName,
        packWeight: `${boxWeightGm}g`,
        error:  updateErr.message,
        status: "FAILED — manual update required",
      });
    }
  }

  const priceChanges = productUpdateResults.filter((r) => r.priceChanged);
  const updateFailed = productUpdateResults.filter((r) => r.error);

  console.log(
    `[COMMIT] STEP 9 — Done. ${productUpdateResults.length} product(s) processed, ` +
    `${priceChanges.length} price change(s), ${updateFailed.length} failure(s).`
  );

  // ══════════════════════════════════════════════════════════════════════
  //  STEP 10 — Final response
  // ══════════════════════════════════════════════════════════════════════
  console.log(`[COMMIT] STEP 10 — Sending success response for run ${run.runCode}.`);

  res.status(201).json({
    success: true,
    message:
      `Run ${run.runCode} committed — ` +
      `${run.totalBoxesPacked} boxes packed across ${run.packingEntries.length} fragrance(s). ` +
      `${priceChanges.length} price(s) updated.` +
      (updateFailed.length ? ` ⚠️  ${updateFailed.length} product update(s) failed.` : ""),
    data: {
      runCode:              run.runCode,
      status:               run.status,
      committedAt:          run.committedAt,
      totalBoxesPacked:     run.totalBoxesPacked,
      totalStickUsedKg:     run.totalStickUsedKg,
      totalProductionValue: run.totalProductionValue,
      stickRemainingKg:     run.stickRemainingKg,
      entriesCount:         run.packingEntries.length,
      productUpdates:       productUpdateResults,
      hasPriceChanges:      priceChanges.length > 0,
      hasUpdateFailures:    updateFailed.length > 0,
    },
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  CANCEL RUN
// ══════════════════════════════════════════════════════════════════════════════

exports.cancelProductionRun = catchAsync(async (req, res, next) => {
  const run = await ProductionRun.findById(req.params.id);
  if (!run) return next(new AppError("Production run not found", 404));

  try {
    await run.cancel();
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  res.status(200).json({ success: true, message: `Run ${run.runCode} cancelled`, data: null });
});