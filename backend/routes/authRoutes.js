const express = require("express");
const { authLimiter, emailLimiter, otpLimiter } = require("../middlewares/rateLimiter");
const authController = require("../controllers/authController");

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Signup process
router.post("/signup", otpLimiter, authController.signup);
router.post("/verify-email", authLimiter, authController.verifyEmail);
router.post("/resend-otp", otpLimiter, authController.resendOTP);

// Login & Logout
router.post("/login", authLimiter, authController.login);
router.post("/logout", authController.logout);

// Password reset
router.post("/forgot-password", emailLimiter, authController.forgotPassword);
router.patch("/reset-password/:token", authLimiter, authController.resetPassword);

// Token refresh
router.post("/refresh-token", authController.refreshToken);

// Auth status check
router.get("/check-auth", authController.checkAuth);

// ==================== PROTECTED ROUTES ====================

// Update password (for logged-in users)
router.patch(
  "/update-password",
  authController.protect,
  authController.updatePassword
);

module.exports = router;
