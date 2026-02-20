const nodemailer = require("nodemailer");
const logger = require("./logger");

// ── Shared brand styles ───────────────────────────────────────────────────────
const BRAND = {
  name: "Shri Brand",
  tagline: "TRADITION · QUALITY · TRUST",
  color: "#800000",
  colorDark: "#5a0000",
  colorLight: "#9e2020",
  gold: "#C9A84C",
  goldLight: "#e8c96a",
  // Logo served from your public directory
  logoUrl: "https://shrifragrance.in/assets/images/logo/Logo.png",
};

// Shared base template wrapper
const baseTemplate = (headerContent, bodyContent, footerNote = "") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${BRAND.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      background: #f2ece4;
      color: #2a1a1a;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrap {
      max-width: 620px;
      margin: 28px auto;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(80,20,20,0.13), 0 2px 8px rgba(0,0,0,0.06);
    }

    /* ── Header ── */
    .email-header {
      background: linear-gradient(145deg, ${BRAND.colorDark} 0%, ${BRAND.color} 55%, ${BRAND.colorLight} 100%);
      padding: 38px 40px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .email-header::before {
      content: '';
      position: absolute;
      width: 340px; height: 340px;
      border-radius: 50%;
      border: 1px solid rgba(201,168,76,0.15);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .email-header::after {
      content: '';
      position: absolute;
      width: 500px; height: 500px;
      border-radius: 50%;
      border: 1px solid rgba(201,168,76,0.08);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .logo-circle {
      display: inline-block;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.10);
      border: 2px solid rgba(201,168,76,0.40);
      overflow: hidden;
      margin-bottom: 16px;
      position: relative; z-index: 1;
    }
    .logo-circle img {
      width: 100%; height: 100%;
      object-fit: contain;
      padding: 8px;
    }
    .brand-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 1px;
      position: relative; z-index: 1;
    }
    .brand-tagline {
      font-size: 10px;
      letter-spacing: 3.5px;
      color: ${BRAND.gold};
      margin-top: 6px;
      font-weight: 600;
      position: relative; z-index: 1;
    }
    .header-divider {
      width: 50px; height: 2px;
      background: linear-gradient(90deg, transparent, ${BRAND.gold}, transparent);
      margin: 14px auto 0;
      position: relative; z-index: 1;
    }

    /* ── Header badge / title ── */
    .header-badge {
      display: inline-block;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(201,168,76,0.35);
      border-radius: 30px;
      padding: 7px 20px;
      font-size: 12px;
      font-weight: 600;
      color: ${BRAND.goldLight};
      letter-spacing: 1px;
      margin-top: 18px;
      position: relative; z-index: 1;
    }

    /* ── Body ── */
    .email-body {
      padding: 38px 44px;
      background: #ffffff;
    }
    .greeting {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-weight: 600;
      color: ${BRAND.color};
      margin-bottom: 14px;
    }
    .email-body p {
      font-size: 14.5px;
      line-height: 1.75;
      color: #4a3030;
      margin-bottom: 14px;
    }
    .brand-highlight { color: ${BRAND.color}; font-weight: 600; }

    /* ── Info card ── */
    .info-card {
      background: linear-gradient(135deg, #fdf6f0 0%, #faf0f0 100%);
      border: 1.5px solid rgba(128,0,0,0.18);
      border-radius: 14px;
      padding: 22px 26px;
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 9px 0;
      border-bottom: 1px solid rgba(128,0,0,0.08);
      font-size: 14px;
    }
    .info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .info-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #8a6060;
      text-transform: uppercase;
      min-width: 120px;
      padding-top: 2px;
    }
    .info-value { color: #2a1a1a; font-weight: 500; }

    /* ── OTP box ── */
    .otp-box {
      background: linear-gradient(135deg, #fdf6f0, #f9eded);
      border: 2px solid ${BRAND.color};
      border-radius: 14px;
      padding: 28px 20px;
      text-align: center;
      margin: 26px 0;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2.5px;
      color: #8a6060;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .otp-code {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 44px;
      font-weight: 700;
      color: ${BRAND.color};
      letter-spacing: 14px;
      margin: 4px 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #9a7070;
      margin-top: 10px;
    }

    /* ── Alert / Note boxes ── */
    .note-box {
      background: #fffbf0;
      border-left: 4px solid ${BRAND.gold};
      border-radius: 0 10px 10px 0;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 13.5px;
      color: #5a4020;
      line-height: 1.6;
    }
    .alert-box {
      background: #fff2f2;
      border: 1px solid #ffd0d0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 22px 0;
    }
    .alert-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: #c0392b;
      margin-bottom: 6px;
    }

    /* ── Feature list ── */
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: #fdf8f4;
      border-radius: 10px;
      padding: 15px 18px;
      margin-bottom: 10px;
      border-left: 3px solid ${BRAND.color};
    }
    .feature-icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .feature-title {
      font-weight: 600;
      color: ${BRAND.color};
      font-size: 14px;
      margin-bottom: 3px;
    }
    .feature-desc { font-size: 13px; color: #6a4040; line-height: 1.5; }

    /* ── CTA Button ── */
    .cta-wrap { text-align: center; margin: 28px 0; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, ${BRAND.color}, ${BRAND.colorDark});
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 16px rgba(128,0,0,0.30);
    }
    .link-box {
      word-break: break-all;
      background: #f5f0ea;
      border: 1px solid #e0d0c0;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      color: #6a5040;
      margin: 10px 0;
      font-family: monospace;
    }

    /* ── Status badge ── */
    .status-badge {
      display: inline-block;
      background: ${BRAND.color};
      color: white;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .message-area {
      background: #f8f4f0;
      border-radius: 10px;
      padding: 16px;
      font-size: 14px;
      color: #5a4040;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    /* ── Footer ── */
    .email-footer {
      background: linear-gradient(135deg, #f8f2ea 0%, #f2ece2 100%);
      border-top: 1px solid rgba(128,0,0,0.10);
      padding: 24px 40px;
      text-align: center;
    }
    .footer-brand {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 600;
      color: ${BRAND.color};
      margin-bottom: 6px;
    }
    .footer-links {
      margin: 10px 0;
    }
    .footer-links a {
      color: #9a6060;
      text-decoration: none;
      font-size: 12px;
      margin: 0 10px;
    }
    .footer-copy {
      font-size: 11px;
      color: #b09090;
      margin-top: 10px;
      letter-spacing: 0.3px;
    }
    .footer-note {
      font-size: 11px;
      color: #c0a090;
      margin-top: 8px;
      font-style: italic;
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .email-wrap { margin: 0; border-radius: 0; }
      .email-body { padding: 28px 22px; }
      .email-header { padding: 28px 22px 24px; }
      .email-footer { padding: 20px 22px; }
      .info-label { min-width: 90px; }
      .otp-code { font-size: 36px; letter-spacing: 10px; }
    }
  </style>
</head>
<body>
  <div class="email-wrap">

    <!-- Header -->
    <div class="email-header">
      <div class="logo-circle">
        <img src="${BRAND.logoUrl}" alt="${BRAND.name} Logo" />
      </div>
      <div class="brand-name">${BRAND.name}</div>
      <div class="brand-tagline">${BRAND.tagline}</div>
      <div class="header-divider"></div>
      ${headerContent}
    </div>

    <!-- Body -->
    <div class="email-body">
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <div class="footer-brand">${BRAND.name}</div>
      <div class="footer-links">
        <a href="#">Website</a>
        <a href="#">Contact Us</a>
        <a href="#">Privacy Policy</a>
      </div>
      <div class="footer-copy">© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</div>
      ${footerNote ? `<div class="footer-note">${footerNote}</div>` : ""}
    </div>

  </div>
</body>
</html>
`;

// ── Transporter ───────────────────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ── Core send function ────────────────────────────────────────────────────────
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `${BRAND.name} <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.email}`, { subject: options.subject });
    return { success: true };
  } catch (error) {
    logger.error(`Email sending error: ${error.message}`, { to: options.email });
    return { success: false, error: error.message };
  }
};

// ── OTP Email ─────────────────────────────────────────────────────────────────
const sendOTPEmail = async (email, name, otp) => {
  const html = baseTemplate(
    `<div class="header-badge">✦ Email Verification</div>`,
    `
    <p class="greeting">Hello, ${name}!</p>
    <p>Welcome to <span class="brand-highlight">${BRAND.name}</span>. To complete your registration, please use the verification code below.</p>

    <div class="otp-box">
      <div class="otp-label">Your Verification Code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">⏱ Valid for 5 minutes only</div>
    </div>

    <div class="note-box">
      <strong>⚠️ Security Notice:</strong> Never share this code with anyone.
      Our team will never ask for your OTP under any circumstances.
    </div>

    <p style="font-size:13px; color:#9a7070;">Didn't create an account with us? You can safely ignore this email.</p>
    `,
    "This is an automated message — please do not reply directly to this email."
  );

  return await sendEmail({
    email,
    subject: `Your Verification Code — ${BRAND.name}`,
    html,
    text: `Hello ${name}, Your OTP for email verification is: ${otp}. Valid for 5 minutes.`,
  });
};

// ── Password Reset Email ──────────────────────────────────────────────────────
const sendPasswordResetEmail = async (email, name, resetURL) => {
  const html = baseTemplate(
    `<div class="header-badge">🔒 Password Reset</div>`,
    `
    <p class="greeting">Hello, ${name}!</p>
    <p>We received a request to reset the password for your <span class="brand-highlight">${BRAND.name}</span> account. Click the button below to proceed.</p>

    <div class="cta-wrap">
      <a href="${resetURL}" class="cta-btn">Reset My Password</a>
    </div>

    <p style="font-size:13px; color:#8a6060;">Or copy and paste this link into your browser:</p>
    <div class="link-box">${resetURL}</div>

    <div class="note-box">
      <strong>⏱ This link expires in 10 minutes</strong> for your security.
      If you did not request a password reset, please ignore this email — your password will remain unchanged.
    </div>
    `,
    "This is an automated message — please do not reply directly to this email."
  );

  return await sendEmail({
    email,
    subject: `Password Reset Request — ${BRAND.name}`,
    html,
    text: `Hello ${name}, Reset your password here: ${resetURL}. This link expires in 10 minutes.`,
  });
};

// ── Welcome Email ─────────────────────────────────────────────────────────────
const sendWelcomeEmail = async (email, name) => {
  const html = baseTemplate(
    `<div class="header-badge">🎉 Welcome to the Family</div>`,
    `
    <p class="greeting">Welcome, ${name}!</p>
    <p>Your account has been verified and you're now officially part of the <span class="brand-highlight">${BRAND.name}</span> family. We're delighted to have you with us.</p>

    <p style="font-weight:600; color:${BRAND.color}; margin-bottom: 14px;">Here's what you can look forward to:</p>

    <div class="feature-item">
      <div class="feature-icon">🌸</div>
      <div>
        <div class="feature-title">Curated Collections</div>
        <div class="feature-desc">Explore our handpicked range of traditional and modern products crafted with care.</div>
      </div>
    </div>
    <div class="feature-item">
      <div class="feature-icon">🎁</div>
      <div>
        <div class="feature-title">Exclusive Member Offers</div>
        <div class="feature-desc">Enjoy special deals, early access, and personalized recommendations just for you.</div>
      </div>
    </div>
    <div class="feature-item">
      <div class="feature-icon">📦</div>
      <div>
        <div class="feature-title">Reliable Delivery</div>
        <div class="feature-desc">Fast, secure shipping right to your doorstep — every time.</div>
      </div>
    </div>

    <p style="margin-top: 20px;">If you have any questions or need assistance, our support team is always here for you.</p>
    `
  );

  return await sendEmail({
    email,
    subject: `Welcome to ${BRAND.name}! 🎉`,
    html,
    text: `Hello ${name}, Welcome to ${BRAND.name}! Your account is ready. We're excited to have you.`,
  });
};

// ── Account Locked Email ──────────────────────────────────────────────────────
const sendAccountLockedEmail = async (email, name, lockMinutes) => {
  const html = baseTemplate(
    `<div class="header-badge">🔒 Security Alert</div>`,
    `
    <p class="greeting">Hello, ${name}.</p>
    <p>Your <span class="brand-highlight">${BRAND.name}</span> account has been temporarily locked due to multiple failed login attempts.</p>

    <div class="alert-box">
      <div class="alert-title">Account Locked for ${lockMinutes} Minutes</div>
      <p style="font-size:13px; color:#9a6060; margin-top:6px;">Please wait before trying again, or reset your password below.</p>
    </div>

    <div class="note-box">
      <strong>If this was you</strong> — simply wait ${lockMinutes} minutes and try again.<br/>
      <strong>If this wasn't you</strong> — we strongly recommend resetting your password immediately to secure your account.
    </div>
    `,
    "This security alert was triggered automatically. Do not share your credentials with anyone."
  );

  return await sendEmail({
    email,
    subject: `Security Alert — ${BRAND.name}`,
    html,
    text: `Hello ${name}, Your ${BRAND.name} account has been locked for ${lockMinutes} minutes due to multiple failed login attempts. If this wasn't you, please reset your password immediately.`,
  });
};

// ── Inquiry Confirmation (to user) ────────────────────────────────────────────
const sendInquiryConfirmationEmail = async (email, fullName, purposeOfInquiry) => {
  const html = baseTemplate(
    `<div class="header-badge">✦ Inquiry Received</div>`,
    `
    <p class="greeting">Thank you, ${fullName}!</p>
    <p>We have successfully received your inquiry at <span class="brand-highlight">${BRAND.name}</span>. Our team will review it and get back to you as soon as possible.</p>

    <div class="info-card">
      <div class="info-row">
        <div class="info-label">Inquiry Type</div>
        <div class="info-value">${purposeOfInquiry}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Status</div>
        <div class="info-value"><span class="status-badge">✓ Received</span></div>
      </div>
      <div class="info-row">
        <div class="info-label">Response Time</div>
        <div class="info-value">Within 24–48 business hours</div>
      </div>
    </div>

    <div class="note-box">
      <strong>📌 Please note:</strong> Avoid submitting duplicate inquiries.
      For urgent matters, feel free to reach us directly through our official contact channels.
    </div>

    <p style="font-size:13px; color:#9a7070;">Did not submit this inquiry? Please disregard this email.</p>
    `,
    "This is an automated confirmation — please do not reply directly to this email."
  );

  return await sendEmail({
    email,
    subject: `We've Received Your Inquiry — ${BRAND.name}`,
    html,
    text: `Hello ${fullName}, Thank you for contacting ${BRAND.name}. We have received your inquiry about "${purposeOfInquiry}" and will respond within 24–48 business hours.`,
  });
};

// ── Inquiry Notification (to admin) ──────────────────────────────────────────
const sendInquiryNotificationToAdmin = async (inquiryData) => {
  const { fullName, email, mobileNumber, cityRegion, purposeOfInquiry, message } = inquiryData;

  const html = baseTemplate(
    `<div class="header-badge">📬 New Inquiry Alert</div>`,
    `
    <p style="color:#6a4040; margin-bottom: 20px;">
      A new contact form submission has been received on <strong>${BRAND.name}</strong>.
      Please review and respond within the expected timeframe.
    </p>

    <div class="info-card">
      <div class="info-row">
        <div class="info-label">Full Name</div>
        <div class="info-value">${fullName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Email</div>
        <div class="info-value">${email}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Mobile</div>
        <div class="info-value">${mobileNumber}</div>
      </div>
      <div class="info-row">
        <div class="info-label">City / Region</div>
        <div class="info-value">${cityRegion || "—"}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Purpose</div>
        <div class="info-value"><span class="status-badge">${purposeOfInquiry}</span></div>
      </div>
      <div class="info-row">
        <div class="info-label">Message</div>
        <div class="info-value">
          <div class="message-area">${message || "No additional message provided."}</div>
        </div>
      </div>
    </div>
    `,
    "Admin notification — generated automatically by the Shri Brand inquiry system."
  );

  return await sendEmail({
    email: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `[New Inquiry] ${purposeOfInquiry} — ${fullName}`,
    html,
    text: `New inquiry from ${fullName} (${email}). Purpose: ${purposeOfInquiry}. Mobile: ${mobileNumber}. City: ${cityRegion || "N/A"}. Message: ${message || "None"}.`,
  });
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAccountLockedEmail,
  sendInquiryConfirmationEmail,
  sendInquiryNotificationToAdmin,
};