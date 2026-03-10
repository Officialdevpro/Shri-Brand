const express = require("express");
const router  = express.Router();

const authController       = require("../controllers/authController");
const productionController = require("../controllers/stockController");
const validateObjectId     = require("../middlewares/validateObjectId");

// ── All production routes require a valid session + admin role ─────────────────
// router.use(authController.protect);
// router.use(authController.restrictTo("admin"));

// ══════════════════════════════════════════════════════════════════════════════
//  INVENTORY
// ══════════════════════════════════════════════════════════════════════════════

// GET  /api/v1/production/inventory              → full inventory snapshot
// PATCH /api/v1/production/inventory/raw-material → update stick qty / rates
router
  .route("/inventory")
  .get(productionController.getInventory);

router
  .route("/inventory/raw-material")
  .patch(productionController.updateRawMaterial);

// POST   /api/v1/production/inventory/boxes      → add a new box type
// PATCH  /api/v1/production/inventory/boxes/:id  → update box stock / rate
// DELETE /api/v1/production/inventory/boxes/:id  → soft-delete custom box
router
  .route("/inventory/boxes")
  .post(productionController.createBoxType);

router
  .route("/inventory/boxes/:id")
  .patch(validateObjectId("id"), productionController.updateBoxType)
  .delete(validateObjectId("id"), productionController.deleteBoxType);

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTS — Fragrance Sidebar
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/production/products?search=rose    → products for sidebar
router
  .route("/products")
  .get(productionController.getProductsForPacking);

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTION RUNS
//  NOTE: /runs/commit must be declared BEFORE /runs/:id  to avoid Express
//        treating "commit" as a MongoDB ObjectId param.
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/v1/production/runs/commit            → create + commit a run
router
  .route("/runs/commit")
  .post(productionController.commitProductionRun);

// GET  /api/v1/production/runs                   → list all runs (paginated)
router
  .route("/runs")
  .get(productionController.getProductionRuns);

// GET    /api/v1/production/runs/:id             → single run with full detail
// DELETE /api/v1/production/runs/:id             → cancel a draft run
router
  .route("/runs/:id")
  .get(validateObjectId("id"), productionController.getProductionRun)
  .delete(validateObjectId("id"), productionController.cancelProductionRun);

module.exports = router;