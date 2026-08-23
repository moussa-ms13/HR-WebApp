// ============================================================
// AuthService — Authentication & JWT Token Management
// ============================================================
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");

class AuthService {
  /**
   * Authenticate user by UserName + Password.
   * Returns JWT token and user info with permissions.
   *
   * NOTE: Legacy app stored passwords as plain text.
   * We match plain text for backward compatibility.
   */
  static async login(userName, password) {
    if (!userName || !password) {
      throw ApiError.badRequest("UserName and Password are required.");
    }

    const user = await prisma.users.findFirst({
      where: { UserName: userName },
      select: {
        Id: true,
        Password: true,
        FullName: true,
        UserName: true,
        Role: true,
        IsSecondaryUser: true,
        UserId: true,
        Phone: true,
        Email: true,
        Address: true,
        CreatedDate: true,
        EditedDate: true,
        Roles: { select: { Key: true, Value: true } },
      },
    });

    if (!user) {
      throw ApiError.unauthorized("Invalid credentials.");
    }

    // Plain text comparison for legacy compatibility
    if (user.Password !== password) {
      throw ApiError.unauthorized("Invalid credentials.");
    }

    // Build permissions map from Roles
    const permissions = {};
    for (const role of user.Roles) {
      permissions[role.Key] = role.Value;
    }

    // Create JWT payload
    const payload = {
      id: user.Id,
      userName: user.UserName,
      fullName: user.FullName,
      role: user.Role,
      isSecondaryUser: user.IsSecondaryUser,
      userId: user.UserId,
      permissions,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    // Log the login action
    await SystemRecordService.log({
      userFullName: user.FullName,
      title: "Login",
      description: `User '${user.UserName}' logged in successfully.`,
      usersId: user.Id,
    });

    return {
      token,
      user: {
        id: user.Id,
        fullName: user.FullName,
        userName: user.UserName,
        role: user.Role,
        isSecondaryUser: user.IsSecondaryUser,
        userId: user.UserId,
        phone: user.Phone,
        email: user.Email,
        address: user.Address,
        createdDate: user.CreatedDate,
        editedDate: user.EditedDate,
        permissions,
        // Also provide PascalCase variants to prevent any hardcoded frontend crashes
        Id: user.Id,
        FullName: user.FullName,
        UserName: user.UserName,
        Role: user.Role,
        IsSecondaryUser: user.IsSecondaryUser,
        UserId: user.UserId,
        Phone: user.Phone,
        Email: user.Email,
        Address: user.Address,
        CreatedDate: user.CreatedDate,
        EditedDate: user.EditedDate,
        Roles: user.Roles,
      },
    };
  }
}

module.exports = AuthService;
