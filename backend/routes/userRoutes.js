const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

const router = express.Router();

// ==================== PROTECTED ROUTES (Must be logged in) ====================

// Apply protect middleware to all routes below
router.use(authController.protect);

// Current user routes
router.get("/me", userController.getMe);
router.patch("/update-me", userController.updateMe);
router.delete("/delete-me", userController.deleteMe);

// Address management
router.post("/addresses", userController.addAddress);
router.patch("/addresses/:addressId", userController.updateAddress);
router.delete("/addresses/:addressId", userController.deleteAddress);



// ==================== ADMIN ONLY ROUTES ====================

// Restrict to admin role for routes below
router.use(authController.restrictTo("admin"));

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.delete("/:id", userController.deleteUser);

module.exports = router;
