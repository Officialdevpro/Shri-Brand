const express = require("express");
const router = express.Router();
const viewController = require("../controllers/viewController");
const profileController = require("../controllers/profileController");
const isAuthenticated = require("../middlewares/isAuthenticated");

const authController = require("../controllers/authController");

// Page routes
router.get("/", viewController.renderHomePage);
router.get("/auth", viewController.renderAuthPage);
router.get("/profile", isAuthenticated, profileController.renderProfilePage);
router.get("/product/:slug", viewController.renderProductPage);
router.get("/blog/:id", viewController.renderBlogPage);
router.get("/checkout", viewController.renderCheckoutPage);
router.get("/admin/blogpost", isAuthenticated, authController.restrictTo("admin"), viewController.renderAdminBlogEditor);

module.exports = router;
