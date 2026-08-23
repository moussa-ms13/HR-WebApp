// ============================================================
// JWT Authentication Middleware
// Verifies Bearer tokens and attaches user to req.user
// ============================================================
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../config/constants");

/**
 * Authenticates the request by verifying the JWT Bearer token.
 * Attaches the decoded user payload to `req.user`.
 */
const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw ApiError.unauthorized("No authentication token provided.");
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

/**
 * Factory: restricts access to specific roles.
 * Usage: authorize(ROLES.ADMIN) or authorize(ROLES.ADMIN, ROLES.USER)
 */
const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Role '${req.user.role}' is not authorized for this action.`
      );
    }

    next();
  };
};

/**
 * Checks if the authenticated user has a specific permission key set to true.
 * Permission keys come from the Roles table (e.g. 'Add', 'Delete', 'Employees').
 */
const hasPermission = (...requiredKeys) => {
  return (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    // Admins bypass permission checks
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const userPermissions = req.user.permissions || {};
    const missing = requiredKeys.filter((key) => !userPermissions[key]);

    if (missing.length > 0) {
      throw ApiError.forbidden(
        `Missing required permissions: ${missing.join(", ")}`
      );
    }

    next();
  };
};

module.exports = { authenticate, authorize, hasPermission };
