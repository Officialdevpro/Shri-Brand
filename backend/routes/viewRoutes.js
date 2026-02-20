const express = require("express");
const router = express.Router();
const viewController = require("../controllers/viewController");

// Page routes
router.get("/", viewController.renderHomePage);
router.get("/auth", viewController.renderAuthPage);
router.get("/product/:slug", viewController.renderProductPage);
router.get("/checkout", viewController.renderCheckoutPage);

module.exports = router;
