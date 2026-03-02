const express = require("express");
const cartController = require("../controllers/cartController");
const authController = require("../controllers/authController");
const validateObjectId = require("../middlewares/validateObjectId");

const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  ALL CART ROUTES ARE PROTECTED
//  authController.protect will:
//    1. Read JWT from cookie
//    2. Verify signature with secret key
//    3. Check token expiry
//    4. Find user in DB
//    5. Attach req.user — only then the controller runs
//  If any of the above fails → 401, controller never runs
// ─────────────────────────────────────────────────────────────
router.use(authController.protect);

// GET    /api/cart           → get current user's cart
router.get("/", cartController.getCart);

// POST   /api/cart           → add item to cart
// Body: { productId, quantity }
router.post("/", cartController.addToCart);

// POST   /api/cart/validate  → validate cart before checkout
// (must be before /:productId to avoid route conflict)
router.post("/validate", cartController.validateCart);

// PATCH  /api/cart/:productId  → update item quantity
// Body: { quantity }
router.patch("/:productId", validateObjectId("productId"), cartController.updateCartItem);

// DELETE /api/cart             → clear entire cart
router.delete("/", cartController.clearCart);

// DELETE /api/cart/:productId  → remove single item
router.delete("/:productId", validateObjectId("productId"), cartController.removeFromCart);

module.exports = router;