const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/categoryController");

// ===== Public Routes =====
router.get("/", getAllCategories);

// ===== Protected/Admin Routes =====
router.use(authController.protect, authController.restrictTo("admin"));
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
