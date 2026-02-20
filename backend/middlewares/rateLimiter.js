const rateLimit = require("express-rate-limit");

/**
 * Centralized rate limiter configurations
 */

// Global API rate limiter
const apiLimiter = rateLimit({
    max: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many requests from this IP. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: "fail",
            message: "Too many requests from this IP. Please try again later."
        });
    }
});

// Strict rate limiter for auth operations (prevent brute force)
const authLimiter = rateLimit({
    max: 5,
    windowMs: 15 * 60 * 1000, // 5 requests per 15 minutes
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: "fail",
            message: "Too many authentication attempts. Please try again in 15 minutes."
        });
    }
});

// Email rate limiter (prevent spam)
const emailLimiter = rateLimit({
    max: 3,
    windowMs: 60 * 60 * 1000, // 3 requests per hour
    message: "Too many email requests. Please try again in an hour.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: "fail",
            message: "Too many email requests. Please try again in an hour."
        });
    }
});

// OTP rate limiter
const otpLimiter = rateLimit({
    max: 5,
    windowMs: 60 * 60 * 1000, // 5 OTP requests per hour
    message: "Too many OTP requests. Please try again in an hour.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: "fail",
            message: "Too many OTP requests. Please try again in an hour."
        });
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    emailLimiter,
    otpLimiter
};
