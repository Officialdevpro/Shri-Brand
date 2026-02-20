const validator = require("validator");

/**
 * Validate password strength
 * Returns { isValid, errors, strength }
 * strength: 'weak' | 'fair' | 'good' | 'strong'
 */
const validatePassword = (password) => {
    const errors = [];
    let score = 0;

    if (!password || password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    } else {
        score++;
    }

    if (password && password.length >= 12) score++;

    if (/[A-Z]/.test(password)) {
        score++;
    } else {
        errors.push("Password must contain at least one uppercase letter");
    }

    if (/[a-z]/.test(password)) {
        score++;
    } else {
        errors.push("Password must contain at least one lowercase letter");
    }

    if (/[0-9]/.test(password)) {
        score++;
    } else {
        errors.push("Password must contain at least one number");
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score++;
    } else {
        errors.push("Password must contain at least one special character");
    }

    let strength = "weak";
    if (score >= 5) strength = "strong";
    else if (score >= 4) strength = "good";
    else if (score >= 3) strength = "fair";

    return {
        isValid: errors.length === 0,
        errors,
        strength,
        score
    };
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
    if (!email) return { isValid: false, error: "Email is required" };

    const trimmed = email.trim().toLowerCase();

    if (!validator.isEmail(trimmed)) {
        return { isValid: false, error: "Please provide a valid email address" };
    }

    return { isValid: true, email: trimmed };
};

/**
 * Sanitize string input — trim and escape HTML
 */
const sanitizeInput = (str) => {
    if (typeof str !== "string") return str;
    return validator.escape(validator.trim(str));
};

/**
 * Validate name
 */
const validateName = (name) => {
    if (!name || name.trim().length === 0) {
        return { isValid: false, error: "Name is required" };
    }

    if (name.trim().length > 50) {
        return { isValid: false, error: "Name cannot exceed 50 characters" };
    }

    if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) {
        return { isValid: false, error: "Name can only contain letters, spaces, hyphens, and apostrophes" };
    }

    return { isValid: true, name: name.trim() };
};

module.exports = {
    validatePassword,
    validateEmail,
    sanitizeInput,
    validateName
};
