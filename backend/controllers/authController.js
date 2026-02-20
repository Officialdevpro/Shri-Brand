const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const User = require("../models/userModel");
const TempUser = require("../models/tempUserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const { validatePassword, validateEmail, validateName } = require("../utils/validators");
const { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail, sendAccountLockedEmail } = require("../utils/email");
const logger = require("../utils/logger");

// ==================== JWT TOKEN UTILITIES ====================

// Generate access token (short-lived)
const signAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Generate refresh token (long-lived)
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN
  });
};

// Create and send token response (access + refresh)
const createSendToken = async (user, statusCode, res, message = "Success") => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Save hashed refresh token to user document
  await user.saveRefreshToken(refreshToken);

  // Access token cookie (short-lived)
  const accessCookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  };

  // Refresh token cookie (long-lived)
  const refreshCookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_REFRESH_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth/refresh-token" // Only sent to refresh endpoint
  };

  // Send cookies
  res.cookie("jwt", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    message,
    token: accessToken,
    data: {
      user
    }
  });
};

// ==================== SIGNUP PROCESS ====================

// Step 1: Request OTP for signup
exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, confirmPassword } = req.body;

  // 1) Validate required fields
  if (!name || !email || !password || !confirmPassword) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // 2) Validate name
  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    return next(new AppError(nameValidation.error, 400));
  }

  // 3) Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return next(new AppError(emailValidation.error, 400));
  }

  // 4) Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return next(new AppError(passwordValidation.errors.join(". "), 400));
  }

  // 5) Check if passwords match
  if (password !== confirmPassword) {
    return next(new AppError("Passwords do not match", 400));
  }

  // 6) Check if user already exists
  const existingUser = await User.findOne({ email: emailValidation.email });
  if (existingUser) {
    return next(new AppError("Email already registered. Please login instead.", 400));
  }

  // 7) Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

  // 8) Save or update temp user
  let tempUser = await TempUser.findOne({ email: emailValidation.email });

  if (tempUser) {
    tempUser.name = nameValidation.name;
    tempUser.password = password;
    tempUser.otp = otp;
    tempUser.otpExpires = otpExpires;
    tempUser.otpAttempts = 0;
    await tempUser.save();
  } else {
    tempUser = await TempUser.create({
      name: nameValidation.name,
      email: emailValidation.email,
      password,
      otp,
      otpExpires
    });
  }

  // 9) Send OTP email
  try {
    const emailResult = await sendOTPEmail(emailValidation.email, nameValidation.name, otp);
    if (!emailResult.success) {
      throw new Error("Email sending failed");
    }
    logger.auth(`OTP sent for signup: ${emailValidation.email}`);
  } catch (err) {
    await TempUser.findByIdAndDelete(tempUser._id);
    return next(new AppError("Failed to send verification email. Please try again.", 500));
  }

  // 10) Send success response
  res.status(200).json({
    status: "success",
    message: "OTP sent to your email. Please verify within 5 minutes."
  });
});

// Step 2: Verify OTP and complete signup
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  // 1) Validate input
  if (!email || !otp) {
    return next(new AppError("Please provide email and OTP", 400));
  }

  // 2) Find temp user
  const tempUser = await TempUser.findOne({ email: email.toLowerCase().trim() });
  if (!tempUser) {
    return next(new AppError("No signup request found. Please request OTP again.", 400));
  }

  // 3) Check OTP attempts (max 5)
  if (tempUser.otpAttempts >= 5) {
    await TempUser.findByIdAndDelete(tempUser._id);
    return next(new AppError("Too many failed OTP attempts. Please start signup again.", 400));
  }

  // 4) Check if OTP expired
  if (tempUser.otpExpires < Date.now()) {
    await TempUser.findByIdAndDelete(tempUser._id);
    return next(new AppError("OTP has expired. Please request a new one.", 400));
  }

  // 5) Verify OTP
  if (tempUser.otp !== otp) {
    await tempUser.incrementOTPAttempts();
    const remaining = 5 - (tempUser.otpAttempts + 1);
    return next(new AppError(`Invalid OTP. ${remaining} attempt(s) remaining.`, 400));
  }

  // 6) Create actual user
  // IMPORTANT: tempUser.password is already hashed by TempUser's pre-save hook.
  // We must NOT let User's pre-save hook hash it again (double-hashing).
  const newUser = new User({
    name: tempUser.name,
    email: tempUser.email,
    password: tempUser.password,
    isVerified: true
  });
  // Mark password as NOT modified so User's pre-save hook skips hashing
  newUser.$skipPasswordHash = true;
  await newUser.save();

  // 7) Delete temp user
  await TempUser.findByIdAndDelete(tempUser._id);

  // 8) Send welcome email (async, don't wait)
  sendWelcomeEmail(newUser.email, newUser.name).catch(err =>
    logger.error("Welcome email failed:", { error: err.message })
  );

  logger.auth(`New user registered: ${newUser.email}`);

  // 9) Send token response
  await createSendToken(newUser, 201, res, "Account created successfully! Welcome to InstaStick!");
});

// ==================== LOGIN ====================

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  // 2) Find user and include password + lockout fields
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select("+password +loginAttempts +lockUntil");

  // 3) Check if user exists
  if (!user) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 4) Check if account is locked
  if (user.isLocked) {
    const remainingMs = user.lockUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return next(new AppError(
      `Account is locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
      423
    ));
  }

  // 5) Check password
  const isPasswordCorrect = await user.comparePassword(password, user.password);

  if (!isPasswordCorrect) {
    // Increment failed attempts
    await user.incrementLoginAttempts();

    // Check if account just got locked
    const updatedUser = await User.findById(user._id).select("+loginAttempts +lockUntil");
    if (updatedUser.isLocked) {
      const lockMinutes = parseInt(process.env.LOCK_TIME) || 30;
      logger.auth(`Account locked: ${email}`, { loginAttempts: updatedUser.loginAttempts });
      // Send notification email (async)
      sendAccountLockedEmail(email, user.name, lockMinutes).catch(err =>
        logger.error("Account locked email failed", { error: err.message })
      );
      return next(new AppError(
        `Account locked due to too many failed attempts. Try again in ${lockMinutes} minutes.`,
        423
      ));
    }

    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const remaining = maxAttempts - (updatedUser.loginAttempts);
    return next(new AppError(
      `Incorrect email or password. ${remaining} attempt(s) remaining before account lock.`,
      401
    ));
  }

  // 6) Check if user is verified
  if (!user.isVerified) {
    return next(new AppError("Please verify your email before logging in", 401));
  }

  // 7) Reset login attempts on successful login
  await user.resetLoginAttempts();

  logger.auth(`User logged in: ${email}`);

  // 8) Send token response
  await createSendToken(user, 200, res, "Logged in successfully!");
});

// ==================== LOGOUT ====================

exports.logout = catchAsync(async (req, res) => {
  // Clear refresh token from database if user is authenticated
  if (req.user) {
    await req.user.clearRefreshToken();
  }

  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true
  });

  res.cookie("refreshToken", "loggedout", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    path: "/api/v1/auth/refresh-token"
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully"
  });
});

// ==================== REFRESH TOKEN ====================

exports.refreshToken = catchAsync(async (req, res, next) => {
  // 1) Get refresh token from cookie or body
  let refreshToken;
  if (req.cookies.refreshToken && req.cookies.refreshToken !== "loggedout") {
    refreshToken = req.cookies.refreshToken;
  } else if (req.body.refreshToken) {
    refreshToken = req.body.refreshToken;
  }

  if (!refreshToken) {
    return next(new AppError("No refresh token provided. Please log in again.", 401));
  }

  // 2) Verify refresh token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  // 3) Find user and verify stored refresh token
  const user = await User.findById(decoded.id).select("+refreshTokenHash");
  if (!user) {
    return next(new AppError("User not found. Please log in again.", 401));
  }

  if (!user.verifyRefreshToken(refreshToken)) {
    // Possible token theft — clear all refresh tokens
    await user.clearRefreshToken();
    logger.auth(`Refresh token mismatch (possible theft): ${user.email}`);
    return next(new AppError("Token has been revoked. Please log in again.", 401));
  }

  // 4) Issue new token pair (token rotation)
  const newAccessToken = signAccessToken(user._id);
  const newRefreshToken = signRefreshToken(user._id);

  // 5) Save new refresh token hash
  await user.saveRefreshToken(newRefreshToken);

  // 6) Set cookies
  res.cookie("jwt", newAccessToken, {
    expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  res.cookie("refreshToken", newRefreshToken, {
    expires: new Date(Date.now() + (process.env.JWT_REFRESH_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth/refresh-token"
  });

  res.status(200).json({
    status: "success",
    token: newAccessToken,
    message: "Token refreshed successfully"
  });
});

// ==================== CHECK AUTH STATUS ====================

exports.checkAuth = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(200).json({
      status: "success",
      isAuthenticated: false
    });
  }

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.isPasswordChangedAfter(decoded.iat)) {
      return res.status(200).json({
        status: "success",
        isAuthenticated: false
      });
    }

    return res.status(200).json({
      status: "success",
      isAuthenticated: true,
      data: { user }
    });
  } catch (error) {
    return res.status(200).json({
      status: "success",
      isAuthenticated: false
    });
  }
});

// ==================== PROTECT MIDDLEWARE ====================

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Get token from header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
    token = req.cookies.jwt;
  }

  // 2) Check if token exists
  if (!token) {
    return next(new AppError("You are not logged in. Please log in to access this resource.", 401));
  }

  // 3) Verify token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Your session has expired. Please log in again.", 401));
    }
    return next(error);
  }

  // 4) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError("The user belonging to this token no longer exists.", 401));
  }

  // 5) Check if user changed password after token was issued
  if (currentUser.isPasswordChangedAfter(decoded.iat)) {
    return next(new AppError("Password was recently changed. Please log in again.", 401));
  }

  // 6) Grant access to protected route
  req.user = currentUser;
  next();
});

// ==================== RESTRICT TO ROLES ====================

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
};

// ==================== FORGOT PASSWORD ====================

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // 1) Validate email
  if (!email) {
    return next(new AppError("Please provide your email address", 400));
  }

  // 2) Get user
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    // Don't reveal if email exists or not (security)
    return res.status(200).json({
      status: "success",
      message: "If an account with that email exists, a password reset link has been sent."
    });
  }

  // 3) Generate reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 4) Create reset URL — point to frontend reset page
  const frontendURL = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  const resetURL = `${frontendURL}/reset-password.html?token=${resetToken}`;

  // 5) Send email
  try {
    const emailResult = await sendPasswordResetEmail(user.email, user.name, resetURL);

    if (!emailResult.success) {
      throw new Error("Email sending failed");
    }

    logger.auth(`Password reset email sent to: ${user.email}`);

    res.status(200).json({
      status: "success",
      message: "If an account with that email exists, a password reset link has been sent."
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError("Failed to send password reset email. Please try again later.", 500));
  }
});

// ==================== RESET PASSWORD ====================

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { password, confirmPassword } = req.body;

  // 1) Validate input
  if (!password || !confirmPassword) {
    return next(new AppError("Please provide password and confirm password", 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError("Passwords do not match", 400));
  }

  // 2) Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return next(new AppError(passwordValidation.errors.join(". "), 400));
  }

  // 3) Hash the token from URL
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  // 4) Find user with valid token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError("Invalid or expired reset token", 400));
  }

  // 5) Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // Reset login attempts too
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  logger.auth(`Password reset completed: ${user.email}`);

  // 6) Log user in
  await createSendToken(user, 200, res, "Password reset successful!");
});

// ==================== UPDATE PASSWORD (FOR LOGGED IN USERS) ====================

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // 1) Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError("Please provide all required fields", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError("New passwords do not match", 400));
  }

  // 2) Validate password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return next(new AppError(passwordValidation.errors.join(". "), 400));
  }

  // 3) Get user with password
  const user = await User.findById(req.user.id).select("+password");

  // 4) Verify current password
  if (!(await user.comparePassword(currentPassword, user.password))) {
    return next(new AppError("Current password is incorrect", 401));
  }

  // 5) Update password
  user.password = newPassword;
  await user.save();

  logger.auth(`Password updated: ${user.email}`);

  // 6) Log user in with new token
  await createSendToken(user, 200, res, "Password updated successfully!");
});

// ==================== RESEND OTP ====================

exports.resendOTP = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // 1) Validate email
  if (!email) {
    return next(new AppError("Please provide email address", 400));
  }

  // 2) Find temp user
  const tempUser = await TempUser.findOne({ email: email.toLowerCase().trim() });
  if (!tempUser) {
    return next(new AppError("No signup request found. Please start signup process again.", 400));
  }

  // 3) Generate new OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = Date.now() + 5 * 60 * 1000;

  // 4) Update temp user
  tempUser.otp = otp;
  tempUser.otpExpires = otpExpires;
  tempUser.otpAttempts = 0; // Reset attempts on resend
  await tempUser.save({ validateBeforeSave: false });

  // 5) Send OTP email
  try {
    const emailResult = await sendOTPEmail(email, tempUser.name, otp);
    if (!emailResult.success) {
      throw new Error("Email sending failed");
    }
    logger.auth(`OTP resent to: ${email}`);
  } catch (err) {
    return next(new AppError("Failed to resend OTP. Please try again.", 500));
  }

  // 6) Send response
  res.status(200).json({
    status: "success",
    message: "New OTP sent to your email"
  });
});

module.exports = exports;
