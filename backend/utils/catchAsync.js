/**
 * Higher-order function to wrap async route handlers
 * Eliminates the need for try-catch blocks in controllers
 * Automatically catches any errors and passes them to Express error handler
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

module.exports = catchAsync;
