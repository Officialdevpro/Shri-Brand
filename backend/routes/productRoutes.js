const express = require("express");
const router = express.Router();
const validateObjectId = require("../middlewares/validateObjectId");
const {
  uploadProductImages,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductsByCategory,
  updateStock,
} = require("../controllers/productController");

// ===== Public Routes =====

// Get featured products (must be before /:identifier to avoid route conflict)
router.get("/featured", getFeaturedProducts);

// Get products by category
router.get("/category/:category", getProductsByCategory);

// Get all products with filters and pagination
router.get("/", getAllProducts);

// Get single product by slug or ID
router.get("/:identifier", getProduct);

// ===== Protected/Admin Routes =====
// TODO: Add authentication middleware later

// Create new product with image upload
router.post("/", uploadProductImages, handleMulterError, createProduct);

// Update product by ID (with optional image upload)
router.put("/:id", validateObjectId(), uploadProductImages, handleMulterError, updateProduct);

// Delete product by ID (soft delete)
router.delete("/:id", validateObjectId(), deleteProduct);

// Update product stock
router.patch("/:id/stock", validateObjectId(), updateStock);

module.exports = router;
