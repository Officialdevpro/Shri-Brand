const Inquiry = require("../models/inquiryModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { validateEmail, sanitizeInput } = require("../utils/validators");
const {
  sendInquiryConfirmationEmail,
  sendInquiryNotificationToAdmin,
} = require("../utils/email");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const VALID_PURPOSES = [
  "Bulk Order Inquiry",
  "Retail / B2B Inquiry",
  "Temple Supply Partnership",
  "Return Gift Customization",
  "Corporate Gifting",
  "Wholesale / Distributor Interest",
  "Event-Specific Inquiry",
  "Product Customization",
  "General Enquiry",
];

/**
 * Validate and sanitize the contact form fields
 * Returns { errors, sanitized } — errors is an array of strings
 */
const validateInquiryInput = (body) => {
  const errors = [];
  const sanitized = {};

  // Full Name
  if (!body.fullName || !body.fullName.trim()) {
    errors.push("Full name is required");
  } else if (body.fullName.trim().length > 100) {
    errors.push("Full name cannot exceed 100 characters");
  } else {
    sanitized.fullName = sanitizeInput(body.fullName);
  }

  // Mobile Number
  if (!body.mobileNumber || !body.mobileNumber.trim()) {
    errors.push("Mobile number is required");
  } else if (!/^[0-9]{10}$/.test(body.mobileNumber.trim())) {
    errors.push("Please provide a valid 10-digit mobile number");
  } else {
    sanitized.mobileNumber = body.mobileNumber.trim();
  }

  // Email
  const emailResult = validateEmail(body.email);
  if (!emailResult.isValid) {
    errors.push(emailResult.error);
  } else {
    sanitized.email = emailResult.email;
  }

  // City/Region (optional)
  if (body.cityRegion && body.cityRegion.trim()) {
    if (body.cityRegion.trim().length > 100) {
      errors.push("City/Region cannot exceed 100 characters");
    } else {
      sanitized.cityRegion = sanitizeInput(body.cityRegion);
    }
  }

  // Purpose of Inquiry
  if (!body.purposeOfInquiry || !body.purposeOfInquiry.trim()) {
    errors.push("Purpose of inquiry is required");
  } else if (!VALID_PURPOSES.includes(body.purposeOfInquiry.trim())) {
    errors.push(
      `Invalid purpose of inquiry. Must be one of: ${VALID_PURPOSES.join(", ")}`,
    );
  } else {
    sanitized.purposeOfInquiry = body.purposeOfInquiry.trim();
  }

  // Message (optional)
  if (body.message && body.message.trim()) {
    if (body.message.trim().length > 1000) {
      errors.push("Message cannot exceed 1000 characters");
    } else {
      sanitized.message = sanitizeInput(body.message);
    }
  }

  return { errors, sanitized };
};

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

/**
 * POST /api/v1/inquiries
 * Submit a new contact form inquiry
 * Public route
 */
exports.submitInquiry = catchAsync(async (req, res, next) => {
  // 1) Validate & sanitize input
  const { errors, sanitized } = validateInquiryInput(req.body);

  if (errors.length > 0) {
    return next(new AppError(errors.join(". "), 400));
  }

  // 2) Save inquiry to DB
  const inquiry = await Inquiry.create({
    ...sanitized,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
  });

  logger.info("New inquiry submitted", {
    inquiryId: inquiry._id,
    email: inquiry.email,
    purpose: inquiry.purposeOfInquiry,
  });

  // 3) Send emails (non-blocking — don't fail the request if email fails)
  Promise.allSettled([
    sendInquiryConfirmationEmail(
      inquiry.email,
      inquiry.fullName,
      inquiry.purposeOfInquiry,
    ),
    sendInquiryNotificationToAdmin({
      fullName: inquiry.fullName,
      email: inquiry.email,
      mobileNumber: inquiry.mobileNumber,
      cityRegion: inquiry.cityRegion,
      purposeOfInquiry: inquiry.purposeOfInquiry,
      message: inquiry.message,
    }),
  ]).then((results) => {
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        logger.error(`Inquiry email [${i}] failed`, {
          error: result.reason?.message,
        });
      }
    });
  });

  // 4) Respond
  res.status(201).json({
    success: true,
    status: "success",
    message:
      "Thank you for contacting us! We have received your inquiry and will get back to you within 24–48 business hours.",
    data: {
      inquiryId: inquiry._id,
      submittedAt: inquiry.createdAt,
    },
  });
});

/**
 * GET /api/v1/inquiries
 * Get all inquiries — Admin only
 */
exports.getAllInquiries = catchAsync(async (req, res, next) => {
  const {
    status,
    purpose,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  // Build filter
  const filter = {};
  if (status) {
    if (!["pending", "reviewed", "resolved"].includes(status)) {
      return next(
        new AppError(
          "Invalid status filter. Use: pending, reviewed, or resolved",
          400,
        ),
      );
    }
    filter.status = status;
  }
  if (purpose) {
    if (!VALID_PURPOSES.includes(purpose)) {
      return next(new AppError(`Invalid purpose filter.`, 400));
    }
    filter.purposeOfInquiry = purpose;
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "status",
    "purposeOfInquiry",
  ];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

  const [inquiries, total] = await Promise.all([
    Inquiry.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Inquiry.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    status: "success",
    results: inquiries.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalInquiries: total,
      limit: limitNum,
    },
    data: { inquiries },
  });
});

/**
 * GET /api/v1/inquiries/:id
 * Get a single inquiry by ID — Admin only
 */
exports.getInquiryById = catchAsync(async (req, res, next) => {
  const inquiry = await Inquiry.findById(req.params.id);

  if (!inquiry) {
    return next(new AppError("No inquiry found with that ID", 404));
  }

  res.status(200).json({
    success: true,
    status: "success",
    data: { inquiry },
  });
});

/**
 * PATCH /api/v1/inquiries/:id/status
 * Update inquiry status — Admin only
 */
exports.updateInquiryStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new AppError("Status is required", 400));
  }

  if (!["pending", "reviewed", "resolved"].includes(status)) {
    return next(
      new AppError(
        "Invalid status. Must be: pending, reviewed, or resolved",
        400,
      ),
    );
  }

  const inquiry = await Inquiry.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true },
  );

  if (!inquiry) {
    return next(new AppError("No inquiry found with that ID", 404));
  }

  logger.info("Inquiry status updated", {
    inquiryId: inquiry._id,
    status: inquiry.status,
  });

  res.status(200).json({
    success: true,
    status: "success",
    message: `Inquiry marked as ${status}`,
    data: { inquiry },
  });
});

/**
 * DELETE /api/v1/inquiries/:id
 * Delete an inquiry — Admin only
 */
exports.deleteInquiry = catchAsync(async (req, res, next) => {
  const inquiry = await Inquiry.findByIdAndDelete(req.params.id);

  if (!inquiry) {
    return next(new AppError("No inquiry found with that ID", 404));
  }

  logger.info("Inquiry deleted", { inquiryId: req.params.id });

  res.status(200).json({
    success: true,
    status: "success",
    message: "Inquiry deleted successfully",
  });
});
