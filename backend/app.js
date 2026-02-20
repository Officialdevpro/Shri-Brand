const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const hpp = require("hpp");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

// Import routes
const inquiryRoutes = require("./routes/inquiryRoutes");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require("./routes/cartRoutes");
const viewRoutes = require("./routes/viewRoutes");

// Import error handler middleware
const errorHandler = require("./middlewares/errorHandler");
const { apiLimiter } = require("./middlewares/rateLimiter");
const AppError = require("./utils/AppError");

// Initialize express app
const app = express();

// ===== View Engine Setup =====
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== Global Middlewares =====

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for HTML pages
}));

// Request logging middleware (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Prevent parameter pollution
app.use(hpp({
  whitelist: ["price", "rating", "category"]
}));

// Compression middleware
app.use(compression());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public/user")));

// Global API rate limiter
app.use("/api", apiLimiter);

// Custom request logger
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ===== Routes =====

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api/v1/inquiries", inquiryRoutes);

// Page routes (SSR with EJS)
app.use("/", viewRoutes);

// API Routes
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/cart", cartRoutes);

// ===== Error Handling =====

// Handle undefined routes (404)
app.use((req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server!`,
      404
    )
  );
});

// Global error handler middleware (should be last)
app.use(errorHandler);

module.exports = app;




// ─────────────────────────────────────────────────────────
// ADD THIS TO YOUR EXISTING app.js
// ─────────────────────────────────────────────────────────

// 1. Import the route (add with your other route imports at the top)


// 2. Mount the route (add with your other app.use() route mounts)


// ─────────────────────────────────────────────────────────
// ADD THIS TO YOUR EXISTING email.js (exports at bottom)
// ─────────────────────────────────────────────────────────

// Update your module.exports to include the two new functions:


// ─────────────────────────────────────────────────────────
// ADD THIS TO YOUR config.env
// ─────────────────────────────────────────────────────────
// ADMIN_EMAIL=your-admin-email@gmail.com
// (If not set, admin notifications will go to EMAIL_USER)