const express = require("express");
const router = express.Router();
const {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/categoryController");

// ===== Public Routes =====
router.get("/", getAllCategories);

// ===== Protected/Admin Routes =====
// TODO: Add authentication middleware later (matching product routes pattern)
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
