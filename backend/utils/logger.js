/**
 * Structured logger utility
 * Color-coded for development, JSON for production
 */

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

const getTimestamp = () => new Date().toISOString();

const isProd = () => process.env.NODE_ENV === "production";

const formatMessage = (level, message, meta = {}) => {
    if (isProd()) {
        // JSON format for production (easy to parse by log aggregators)
        return JSON.stringify({
            timestamp: getTimestamp(),
            level,
            message,
            ...meta
        });
    }

    // Color-coded format for development
    const levelColors = {
        INFO: colors.green,
        WARN: colors.yellow,
        ERROR: colors.red,
        DEBUG: colors.cyan,
        AUTH: colors.magenta
    };

    const color = levelColors[level] || colors.reset;
    const timestamp = `${colors.gray}[${getTimestamp()}]${colors.reset}`;
    const levelTag = `${color}[${level}]${colors.reset}`;
    const metaStr = Object.keys(meta).length > 0
        ? ` ${colors.gray}${JSON.stringify(meta)}${colors.reset}`
        : "";

    return `${timestamp} ${levelTag} ${message}${metaStr}`;
};

const logger = {
    info: (message, meta) => console.log(formatMessage("INFO", message, meta)),
    warn: (message, meta) => console.warn(formatMessage("WARN", message, meta)),
    error: (message, meta) => console.error(formatMessage("ERROR", message, meta)),
    debug: (message, meta) => {
        if (!isProd()) console.log(formatMessage("DEBUG", message, meta));
    },
    auth: (message, meta) => console.log(formatMessage("AUTH", message, meta))
};

module.exports = logger;
