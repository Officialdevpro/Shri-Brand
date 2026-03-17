const express = require("express");
const router = express.Router();
const viewController = require("../controllers/viewController");
const profileController = require("../controllers/profileController");
const isAuthenticated = require("../middlewares/isAuthenticated");

// Page routes
router.get("/", viewController.renderHomePage);
router.get("/auth", viewController.renderAuthPage);
router.get("/profile", isAuthenticated, profileController.renderProfilePage);
router.get("/product/:slug", viewController.renderProductPage);
router.get("/blog/:id", viewController.renderBlogPage);
router.get("/checkout", viewController.renderCheckoutPage);

module.exports = router;
