const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

// ==================== UTILITY FUNCTIONS ====================

// Filter object to only include allowed fields
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

// ==================== GET CURRENT USER ====================

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).lean();

  res.status(200).json({
    status: "success",
    data: {
      user
    }
  });
});

// ==================== UPDATE USER PROFILE ====================

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user tries to update password
  if (req.body.password || req.body.confirmPassword) {
    return next(new AppError("This route is not for password updates. Please use /update-password", 400));
  }

  // 2) Filter allowed fields
  const filteredBody = filterObj(req.body, "name", "email", "phone");

  // 3) If email is being updated, check if it's already taken
  if (filteredBody.email && filteredBody.email !== req.user.email) {
    const existingUser = await User.findOne({ email: filteredBody.email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }
    // Mark as unverified if email changes
    filteredBody.isVerified = false;
  }

  // 4) Update user
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    data: {
      user: updatedUser
    }
  });
});

// ==================== DELETE ACCOUNT ====================

exports.deleteMe = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  // 1) Check if password provided
  if (!password) {
    return next(new AppError("Please provide your password to delete account", 400));
  }

  // 2) Get user with password
  const user = await User.findById(req.user.id).select("+password");

  // 3) Verify password
  if (!(await user.comparePassword(password, user.password))) {
    return next(new AppError("Incorrect password", 401));
  }

  // 4) Soft delete (set active to false)
  await User.findByIdAndUpdate(req.user.id, { active: false });

  // 5) Clear cookie
  res.cookie("jwt", "deleted", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true
  });

  res.status(204).json({
    status: "success",
    data: null
  });
});

// ==================== ADDRESS MANAGEMENT ====================

// Add new address (max 2)
exports.addAddress = catchAsync(async (req, res, next) => {
  const { addressLine1, addressLine2, city, state, pincode, phone, isDefault } = req.body;

  // 1) Check address limit
  const currentUser = await User.findById(req.user.id);
  if (currentUser.addresses && currentUser.addresses.length >= 2) {
    return next(new AppError("You can only save up to 2 addresses. Please delete one first.", 400));
  }

  // 2) Validate required fields
  if (!addressLine1 || !city || !state || !pincode || !phone) {
    return next(new AppError("Please provide all required address fields", 400));
  }

  // 2) If this is default, unset other defaults
  if (isDefault) {
    await User.findByIdAndUpdate(req.user.id, {
      $set: { "addresses.$[].isDefault": false }
    });
  }

  // 3) Add address
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      $push: {
        addresses: { addressLine1, addressLine2, city, state, pincode, phone, isDefault }
      }
    },
    { new: true }
  );

  res.status(201).json({
    status: "success",
    message: "Address added successfully",
    data: {
      addresses: user.addresses
    }
  });
});

// Update address
exports.updateAddress = catchAsync(async (req, res, next) => {
  const { addressId } = req.params;
  const { addressLine1, addressLine2, city, state, pincode, phone, isDefault } = req.body;

  // 1) Find user and address
  const user = await User.findById(req.user.id);
  const address = user.addresses.id(addressId);

  if (!address) {
    return next(new AppError("Address not found", 404));
  }

  // 2) If setting as default, unset other defaults
  if (isDefault && !address.isDefault) {
    user.addresses.forEach(addr => {
      if (addr._id.toString() !== addressId) {
        addr.isDefault = false;
      }
    });
  }

  // 3) Update address fields
  if (addressLine1) address.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
  if (city) address.city = city;
  if (state) address.state = state;
  if (pincode) address.pincode = pincode;
  if (phone) address.phone = phone;
  if (isDefault !== undefined) address.isDefault = isDefault;

  await user.save();

  res.status(200).json({
    status: "success",
    message: "Address updated successfully",
    data: {
      addresses: user.addresses
    }
  });
});

// Delete address
exports.deleteAddress = catchAsync(async (req, res, next) => {
  const { addressId } = req.params;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { addresses: { _id: addressId } } },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    message: "Address deleted successfully",
    data: {
      addresses: user.addresses
    }
  });
});



// ==================== ADMIN: GET ALL USERS ====================

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().lean();

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users
    }
  });
});

// ==================== ADMIN: GET USER BY ID ====================

exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).lean();

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      user
    }
  });
});

// ==================== ADMIN: UPDATE USER ====================

exports.updateUser = catchAsync(async (req, res, next) => {
  // Only allow these fields to be updated by admin
  const filteredBody = filterObj(req.body, "name", "email", "phone", "role", "active");

  const user = await User.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "User updated successfully",
    data: {
      user
    }
  });
});

// ==================== ADMIN: CREATE USER (bypass OTP) ====================

exports.createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, role } = req.body;

  // 1) Validate required fields
  if (!name || !email || !password) {
    return next(new AppError("Name, email, and password are required", 400));
  }

  if (password.length < 8) {
    return next(new AppError("Password must be at least 8 characters", 400));
  }

  // 2) Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return next(new AppError("A user with this email already exists", 400));
  }

  // 3) Create user directly (admin-created users are auto-verified)
  const newUser = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
    phone: phone || undefined,
    role: role || "user",
    isVerified: true
  });

  // Remove password from output
  newUser.password = undefined;

  res.status(201).json({
    status: "success",
    message: "User created successfully",
    data: {
      user: newUser
    }
  });
});

// ==================== ADMIN: DELETE USER ====================

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(204).json({
    status: "success",
    data: null
  });
});

module.exports = exports;
