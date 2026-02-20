const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide your name"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Please provide your email"],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, "Please provide a valid email address"]
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: [8, "Password must be at least 8 characters long"],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^[0-9]{10}$/.test(v);
      },
      message: "Please provide a valid 10-digit phone number"
    }
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  addresses: [{
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
  }],

  // Security fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  refreshTokenHash: {
    type: String,
    select: false
  },

  // Token fields
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
// userSchema.index({ email: 1 });
// userSchema.index({ isVerified: 1 });

// Virtual: check if account is currently locked
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre("save", async function () {
  // Skip if password not modified, OR if explicitly told to skip (e.g. transferring pre-hashed password from TempUser)
  if (!this.isModified("password") || this.$skipPasswordHash) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Update passwordChangedAt when password is modified
userSchema.pre("save", function () {
  if (!this.isModified("password") || this.isNew) return;
  this.passwordChangedAt = Date.now() - 1000;
});

// Filter out inactive users in queries
userSchema.pre(/^find/, function () {
  this.find({ active: { $ne: false } });
});

// Instance method: Compare password
userSchema.methods.comparePassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method: Check if password was changed after JWT was issued
userSchema.methods.isPasswordChangedAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method: Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Instance method: Create email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Instance method: Increment login attempts and lock if needed
userSchema.methods.incrementLoginAttempts = async function () {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = (parseInt(process.env.LOCK_TIME) || 30) * 60 * 1000; // Convert minutes to ms

  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1, lockUntil: null }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account if max attempts reached
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return await this.updateOne(updates);
};

// Instance method: Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  return await this.updateOne({
    $set: { loginAttempts: 0, lockUntil: null }
  });
};

// Instance method: Save hashed refresh token
userSchema.methods.saveRefreshToken = async function (refreshToken) {
  this.refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  await this.save({ validateBeforeSave: false });
};

// Instance method: Verify refresh token
userSchema.methods.verifyRefreshToken = function (refreshToken) {
  const hash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  return this.refreshTokenHash === hash;
};

// Instance method: Clear refresh token
userSchema.methods.clearRefreshToken = async function () {
  this.refreshTokenHash = undefined;
  await this.save({ validateBeforeSave: false });
};

const User = mongoose.model("User", userSchema);

module.exports = User;
