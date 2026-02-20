const express = require("express");
const cartController = require("../controllers/cartController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router
    .route("/")
    .get(cartController.getCart)
    .post(cartController.addToCart)
    .delete(cartController.clearCart);

router
    .route("/:id")
    .patch(cartController.updateCartItem)
    .delete(cartController.removeFromCart);

module.exports = router;
