const express = require("express");
const authController = require("../controllers/authController");
const inquiryController = require("../controllers/inquiryController");
const validateObjectId = require("../middlewares/validateObjectId");
const { emailLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Submit contact form inquiry (rate-limited to prevent spam)
router.post("/", emailLimiter, inquiryController.submitInquiry);

// ==================== ADMIN ONLY ROUTES ====================

router.use(authController.protect, authController.restrictTo("admin"));

// Get all inquiries with filtering & pagination
router.get("/", inquiryController.getAllInquiries);

// Get, update status, delete a specific inquiry
router.get("/:id", validateObjectId("id"), inquiryController.getInquiryById);
router.patch("/:id/status", validateObjectId("id"), inquiryController.updateInquiryStatus);
router.delete("/:id", validateObjectId("id"), inquiryController.deleteInquiry);

module.exports = router;