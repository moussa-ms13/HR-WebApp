// ============================================================
// Centralized Error Handling Middleware
// Catches all errors and returns structured JSON responses
// ============================================================
const ApiError = require("../utils/ApiError");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Log the error in development
  if (process.env.NODE_ENV === "development") {
    console.error("─── ERROR ───────────────────────────────────────");
    console.error(`  Path: ${req.method} ${req.originalUrl}`);
    console.error(`  Message: ${err.message}`);
    if (err.stack) console.error(`  Stack: ${err.stack}`);
    console.error("─────────────────────────────────────────────────");
  }

  // Handle known operational errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Handle Prisma-specific errors
  if (err.code === "P2002") {
    const target = err.meta?.target;
    return res.status(409).json({
      success: false,
      message: `A record with this ${target || "value"} already exists.`,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "The requested record was not found.",
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Authentication token has expired.",
    });
  }

  // Fallback: unknown errors
  console.error(err);
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An unexpected error occurred.",
  });
};

module.exports = errorHandler;
