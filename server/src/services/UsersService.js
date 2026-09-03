// ============================================================
// UsersService — Centralized CRUD for Users & Roles
// Implements conditional data access (Admin sees all, others see own)
// Matches existing RafatDB schema exactly.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES } = require("../config/constants");

class UsersService {
  // ──────────────────────────────────────────────
  // READ — List users (conditional access)
  // ──────────────────────────────────────────────
  static async getAll(requestingUser, page = 1, limit = 50, search = "") {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const where =
      requestingUser.role === ROLES.ADMIN
        ? {}
        : { UserId: requestingUser.userName };

    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      where.OR = [
        { FullName: { contains: trimmedSearch } },
        { UserName: { contains: trimmedSearch } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        skip,
        take: safeLimit,
        select: {
          Id: true,
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
        },
        orderBy: { CreatedDate: "desc" },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      }
    };
  }

  // ──────────────────────────────────────────────
  // READ — Single user by ID
  // ──────────────────────────────────────────────
  static async getById(id, requestingUser) {
    const user = await prisma.users.findUnique({
      where: { Id: id },
      include: { Roles: true },
    });

    if (!user) {
      throw ApiError.notFound(`User with ID ${id} not found.`);
    }

    // Non-admin users can only view their own linked records
    if (
      requestingUser.role !== ROLES.ADMIN &&
      user.UserId !== requestingUser.userName &&
      user.UserName !== requestingUser.userName
    ) {
      throw ApiError.forbidden("You do not have access to this user.");
    }

    const { Password, ...safe } = user;
    return safe;
  }

  // ──────────────────────────────────────────────
  // CREATE — Add a new user with roles
  // ──────────────────────────────────────────────
  static async create(data, requestingUser) {
    // Check for duplicate UserName
    const existing = await prisma.users.findFirst({
      where: { UserName: data.userName },
    });

    if (existing) {
      throw ApiError.conflict(`UserName '${data.userName}' is already taken.`);
    }

    const now = new Date();

    const user = await prisma.users.create({
      data: {
        FullName: data.fullName,
        UserName: data.userName,
        Password: data.password, // Plain text for legacy compatibility
        Role: data.role || ROLES.USER,
        IsSecondaryUser: data.isSecondaryUser || false,
        UserId: data.userId || "",
        Phone: data.phone || null,
        Email: data.email || null,
        Address: data.address || null,
        CreatedDate: now,
        EditedDate: now,
        Roles: {
          create: (data.roles || []).map((r) => ({
            Key: r.key,
            Value: r.value,
          })),
        },
      },
      include: { Roles: true },
    });

    // Audit log
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Add User",
      description: `User '${user.UserName}' created by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
    });

    const { Password, ...safe } = user;
    return safe;
  }

  // ──────────────────────────────────────────────
  // UPDATE — Edit user and replace their roles
  // ──────────────────────────────────────────────
  static async update(id, data, requestingUser) {
    const existing = await prisma.users.findUnique({ where: { Id: id } });

    if (!existing) {
      throw ApiError.notFound(`User with ID ${id} not found.`);
    }

    // Check uniqueness if UserName is changing
    if (data.userName && data.userName !== existing.UserName) {
      const duplicate = await prisma.users.findFirst({
        where: { UserName: data.userName },
      });
      if (duplicate) {
        throw ApiError.conflict(`UserName '${data.userName}' is already taken.`);
      }
    }

    // Use a transaction: update user + delete old roles + create new roles
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.users.update({
        where: { Id: id },
        data: {
          FullName: data.fullName ?? existing.FullName,
          UserName: data.userName ?? existing.UserName,
          ...(data.password && { Password: data.password }),
          Role: data.role ?? existing.Role,
          IsSecondaryUser: data.isSecondaryUser ?? existing.IsSecondaryUser,
          UserId: data.userId !== undefined ? data.userId : existing.UserId,
          Phone: data.phone !== undefined ? data.phone : existing.Phone,
          Email: data.email !== undefined ? data.email : existing.Email,
          Address: data.address !== undefined ? data.address : existing.Address,
          EditedDate: new Date(),
        },
      });

      // Replace roles only if provided
      if (data.roles !== undefined) {
        await tx.roles.deleteMany({ where: { UsersId: id } });
        if (data.roles.length > 0) {
          await tx.roles.createMany({
            data: data.roles.map((r) => ({
              Key: r.key,
              Value: r.value,
              UsersId: id,
            })),
          });
        }
      }

      return tx.users.findUnique({
        where: { Id: id },
        include: { Roles: true },
      });
    });

    // Audit log
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Edit User",
      description: `User '${user.UserName}' updated by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
    });

    const { Password, ...safe } = user;
    return safe;
  }

  // ──────────────────────────────────────────────
  // DELETE — Remove a user and cascade their roles
  // ──────────────────────────────────────────────
  static async delete(id, requestingUser) {
    const existing = await prisma.users.findUnique({ where: { Id: id } });

    if (!existing) {
      throw ApiError.notFound(`User with ID ${id} not found.`);
    }

    // Prevent deleting yourself
    if (existing.UserName === requestingUser.userName) {
      throw ApiError.badRequest("You cannot delete your own account.");
    }

    // Manual cascade: delete SystemRecords referencing this UsersId,
    // then Roles, then the User itself — prevents FK constraint crash.
    await prisma.$transaction([
      prisma.systemRecords.deleteMany({ where: { UsersId: id } }),
      prisma.roles.deleteMany({ where: { UsersId: id } }),
      prisma.users.delete({ where: { Id: id } }),
    ]);

    // Audit log (no usersId since the user is gone)
    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete User",
      description: `User '${existing.UserName}' deleted by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
    });

    return { message: `User '${existing.UserName}' has been deleted.` };
  }
}

module.exports = UsersService;
