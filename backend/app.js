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
const orderRoutes = require("./routes/orderRoutes"); // ← NEW
const viewRoutes = require("./routes/viewRoutes");
const postRoutes = require('./routes/blogRoutes');
const categoryRoutes = require("./routes/categoryRoutes");
const stockRoutes = require('./routes/stockRoutes');
const blogImageUpload = require('./routes/blogImgUpload'); // adjust path




// Import middlewares
const errorHandler = require("./middlewares/errorHandler");
const { apiLimiter } = require("./middlewares/rateLimiter");
const AppError = require("./utils/AppError");

const app = express();

// ── View Engine ────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Global Middlewares ─────────────────────────────────────────
app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));

app.use(helmet({ contentSecurityPolicy: false }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(hpp({ whitelist: ["price", "rating", "category"] }));
app.use(compression());

app.use(express.static(path.join(__dirname, "public/user")));

app.use("/api", apiLimiter);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ── Routes ─────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api/v1/inquiries", inquiryRoutes);
app.use("/", viewRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes); // ← NEW
app.use('/api/v1/blogs', postRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/production', stockRoutes);
app.use('/api/v1/blog-images', blogImageUpload);

// ── 404 handler ────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ── Global error handler ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
