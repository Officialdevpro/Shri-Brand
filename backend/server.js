const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables FIRST
dotenv.config({ path: "./config.env" });

const logger = require("./utils/logger");

// ===== Handle Uncaught Exceptions (must be at the top) =====
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(`${err.name}: ${err.message}`);
  console.error("Stack:", err.stack);
  process.exit(1);
});

// Import app after environment variables are loaded
const app = require("./app");

// ===== Configuration =====
const PORT = process.env.PORT || 5000;
const DB = process.env.DATABASE;
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate required environment variables
if (!DB) {
  logger.error("DATABASE connection string is not defined in config.env");
  process.exit(1);
}

// ===== MongoDB Connection =====
mongoose
  .connect(DB)
  .then(() => {
    logger.info("MongoDB connected successfully");

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`Health:    http://localhost:${PORT}/health`);
      logger.info(`Products:  http://localhost:${PORT}/api/v1/products`);
      logger.info(`Auth:      http://localhost:${PORT}/api/v1/auth`);
      logger.info(`Users:     http://localhost:${PORT}/api/v1/users`);
      logger.info(`Cart:      http://localhost:${PORT}/api/v1/cart`);
      logger.info(`Cart Test: http://localhost:${PORT}/cart-test.html`);
    });

    // ===== Handle Unhandled Promise Rejections =====
    process.on("unhandledRejection", (err) => {
      logger.error("UNHANDLED REJECTION! Shutting down gracefully...");
      logger.error(`${err.name}: ${err.message}`);

      // Close server & exit process
      server.close(() => {
        logger.info("Server closed");
        process.exit(1);
      });
    });

    // ===== Graceful Shutdown (SIGTERM) =====
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        logger.info("Server closed. Process terminated.");
      });
    });

    // ===== Graceful Shutdown (SIGINT - Ctrl+C) =====
    process.on("SIGINT", () => {
      logger.info("SIGINT received. Shutting down gracefully...");
      server.close(() => {
        logger.info("Server closed. Process terminated.");
        process.exit(0);
      });
    });
  })
  .catch((err) => {
    logger.error("MongoDB connection error:");
    logger.error(err.message);
    console.error("Stack:", err.stack);
    process.exit(1);
  });
