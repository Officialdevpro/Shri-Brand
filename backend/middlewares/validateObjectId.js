const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

/**
 * Middleware to validate MongoDB ObjectId in route parameters
 * Prevents invalid IDs from reaching the controller
 * 
 * @param {string} paramName - Name of the parameter to validate (default: 'id')
 */
const validateObjectId = (paramName = "id") => {
    return (req, res, next) => {
        const id = req.params[paramName];

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(
                new AppError(`Invalid ${paramName}. Please provide a valid ID.`, 400)
            );
        }

        next();
    };
};

module.exports = validateObjectId;
