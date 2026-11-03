// ============================================================
// JWT Authentication Middleware
// Verifies Bearer tokens and attaches user to req.user
// ============================================================
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../config/constants");

const { extractClientIp, asyncLocalStorage } = require("../utils/requestContext");

// Short-lived cache (5s) for live DB permissions so updates take effect without requiring re-login
const userPermsCache = new Map();
const USER_PERMS_TTL_MS = 5000;

function invalidateUserPermissionsCache(userId) {
  if (userId !== undefined && userId !== null) {
    userPermsCache.delete(Number(userId));
  } else {
    userPermsCache.clear();
  }
}

async function getLiveUserAuthData(userId) {
  const numericId = Number(userId);
  if (!numericId || isNaN(numericId)) return null;

  const now = Date.now();
  const cached = userPermsCache.get(numericId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const dbUser = await prisma.users.findUnique({
    where: { Id: numericId },
    select: {
      Id: true,
      UserName: true,
      FullName: true,
      Role: true,
      Roles: { select: { Key: true, Value: true } },
    },
  });

  if (!dbUser) return null;

  const permissions = {};
  for (const r of dbUser.Roles || []) {
    permissions[r.Key] = r.Value;
  }

  const data = {
    role: dbUser.Role,
    userName: dbUser.UserName,
    fullName: dbUser.FullName,
    permissions,
  };

  userPermsCache.set(numericId, { data, expiresAt: now + USER_PERMS_TTL_MS });
  return data;
}

/**
 * Authenticates the request by verifying the JWT Bearer token.
 * Attaches the decoded user payload (hydrated with live DB permissions) to `req.user` with client IP.
 */
const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("No authentication token provided.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cleanIp = extractClientIp(req);
    req.clientIp = cleanIp;

    let liveAuth = null;
    try {
      liveAuth = await getLiveUserAuthData(decoded.id ?? decoded.Id);
    } catch (_) {
      // Fallback to JWT payload if DB lookup fails transiently
    }

    req.user = {
      ...decoded,
      ...(liveAuth
        ? {
            role: liveAuth.role || decoded.role,
            userName: liveAuth.userName || decoded.userName,
            fullName: liveAuth.fullName || decoded.fullName,
            permissions: { ...(decoded.permissions || {}), ...liveAuth.permissions },
          }
        : {}),
      ipAddress: cleanIp,
    };

    const store = asyncLocalStorage.getStore();
    if (store) {
      store.user = req.user;
      store.clientIp = cleanIp;
      return next();
    }

    // Fallback if requestContextMiddleware was bypassed
    asyncLocalStorage.run(
      { clientIp: cleanIp, userAgent: (req.headers && req.headers["user-agent"]) || "", user: req.user },
      () => next()
    );
  } catch (err) {
    next(err);
  }
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
 * Checks if the authenticated user has all specified permission keys set to true.
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

/**
 * Checks if the authenticated user has AT LEAST ONE of the specified permission keys set to true.
 * Useful for operations like leave resumption where either checkBoxAdd OR checkBoxEdit is sufficient.
 */
const hasAnyPermission = (...allowedKeys) => {
  return (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const userPermissions = req.user.permissions || {};
    const hasAtLeastOne = allowedKeys.some((key) => Boolean(userPermissions[key]));

    if (!hasAtLeastOne) {
      throw ApiError.forbidden(
        `Missing required permissions (need at least one of: ${allowedKeys.join(", ")})`
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  hasPermission,
  hasAnyPermission,
  invalidateUserPermissionsCache,
};
