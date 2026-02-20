/**
 * Custom Application Error Class
 * Extends the native Error class to provide additional properties for error handling
 */
class AppError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     */
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;

        // Capture stack trace, excluding constructor call from it
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
