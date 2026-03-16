/**
 * Middleware: restrict access to admin users only.
 *
 * Must be placed AFTER `isAuthenticated` so that req.user is available.
 * If the user is not an admin, they are redirected to the home page.
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.redirect("/");
  }
  next();
};

module.exports = isAdmin;
