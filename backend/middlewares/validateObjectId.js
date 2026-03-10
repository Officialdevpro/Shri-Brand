// const mongoose = require("mongoose");
// const AppError = require("../utils/AppError");

// /**
//  * Middleware to validate MongoDB ObjectId in route parameters
//  * Prevents invalid IDs from reaching the controller
//  * 
//  * @param {string} paramName - Name of the parameter to validate (default: 'id')
//  */
// const validateObjectId = (paramName = "id") => {
//     return (req, res, next) => {
//         const id = req.params[paramName];

//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return next(
//                 new AppError(`Invalid ${paramName}. Please provide a valid ID.`, 400)
//             );
//         }

//         next();
//     };
// };

// module.exports = validateObjectId;


'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/**
 * Middleware factory — validates that a named URL param is a valid MongoDB ObjectId.
 *
 * Usage:  router.get('/:id', validateObjectId('id'), handler)
 *         router.delete('/:id/comments/:commentId', validateObjectId('id'), validateObjectId('commentId'), handler)
 */
const validateObjectId = (param = 'id') => (req, res, next) => {
  const value = req.params[param];

  if (!value) {
    return next(new AppError(`Missing required URL parameter: ${param}`, 400));
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return next(
      new AppError(
        `Invalid ${param}: "${value}" is not a valid ID. IDs must be 24-character hex strings.`,
        400
      )
    );
  }

  next();
};

module.exports = validateObjectId;