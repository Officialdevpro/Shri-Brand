const mongoose = require("mongoose");
const validator = require("validator");

const inquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Please provide a valid 10-digit mobile number",
      },
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please provide a valid email address"],
    },
    cityRegion: {
      type: String,
      trim: true,
      maxlength: [100, "City/Region cannot exceed 100 characters"],
      default: null,
    },
    purposeOfInquiry: {
      type: String,
      required: [true, "Purpose of inquiry is required"],
      enum: {
        values: [
          "Bulk Order Inquiry",
          "Retail / B2B Inquiry",
          "Temple Supply Partnership",
          "Return Gift Customization",
          "Corporate Gifting",
          "Wholesale / Distributor Interest",
          "Event-Specific Inquiry",
          "Product Customization",
          "General Enquiry",
        ],
        message: "Invalid inquiry purpose selected",
      },
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries by email and status
inquirySchema.index({ email: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ createdAt: -1 });

const Inquiry = mongoose.model("Inquiry", inquirySchema);

module.exports = Inquiry;
