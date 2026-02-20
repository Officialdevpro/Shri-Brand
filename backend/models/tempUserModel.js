const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const tempUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide your name"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Please provide your email"],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"]
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: [8, "Password must be at least 8 characters"]
  },
  otp: {
    type: String,
    required: true
  },
  otpExpires: {
    type: Date,
    required: true
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document will auto-delete after 10 minutes
  }
});

// Hash password before saving
tempUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method: Increment OTP attempts
tempUserSchema.methods.incrementOTPAttempts = async function () {
  this.otpAttempts += 1;
  await this.save({ validateBeforeSave: false });
  return this.otpAttempts;
};

const TempUser = mongoose.model("TempUser", tempUserSchema);

module.exports = TempUser;
