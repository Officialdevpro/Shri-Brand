const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const User = require("../models/userModel");

/**
 * Reusable auth-guard middleware for view routes.
 *
 * - If the user has a valid JWT → sets req.user and calls next()
 * - If not authenticated → renders auth.ejs (login/signup page)
 *
 * This does NOT send a 401 JSON response — it is designed for
 * server-rendered pages, not API endpoints.
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // 1. Extract token from cookie or Authorization header
    let token;
    if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
      token = req.cookies.jwt;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. No token → show login page
    if (!token) {
      return res.status(200).render("auth");
    }

    // 3. Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 4. Check user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(200).render("auth");
    }

    // 5. Check if password was changed after token was issued
    if (user.isPasswordChangedAfter(decoded.iat)) {
      return res.status(200).render("auth");
    }

    // 6. Grant access — attach user to request
    req.user = user;
    next();
  } catch (err) {
    // Any JWT error (expired, malformed, etc.) → show login page
    return res.status(200).render("auth");
  }
};

module.exports = isAuthenticated;
