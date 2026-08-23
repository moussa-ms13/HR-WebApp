// ============================================================
// SystemRecordService — Centralized Audit Logging
// Matches the EXISTING SystemRecords table structure in RafatDB:
//   Id, UserFullName, DeviceName, MachinId, Title,
//   Description, CreatedDate, UsersId, EmployeesId
// ============================================================
const prisma = require("../config/database");
const os = require("os");

class SystemRecordService {
  /**
   * Log an action to the SystemRecords table.
   * @param {Object} params
   * @param {string} params.userFullName  - Full name of the acting user
   * @param {string} params.title         - Action title (e.g. "إضافة مستخدم")
   * @param {string} params.description   - Human-readable description
   * @param {number} params.usersId       - ID of the acting user
   * @param {number} [params.employeesId] - ID of the affected employee (optional)
   */
  static async log({ userFullName, title, description, usersId, employeesId = null }) {
    try {
      await prisma.systemRecords.create({
        data: {
          UserFullName: userFullName,
          DeviceName: os.hostname(),
          MachinId: "WEB-APP",
          Title: title,
          Description: description,
          CreatedDate: new Date(),
          UsersId: usersId,
          EmployeesId: employeesId,
        },
      });
    } catch (error) {
      // Logging failures must never crash the main operation
      console.error("[SystemRecordService] Failed to log action:", error.message);
    }
  }

  /**
   * Retrieve system records with optional filtering and pagination.
   */
  static async getAll({ page = 1, limit = 50, usersId = null, search = "" } = {}) {
    const where = {};
    if (usersId) where.UsersId = usersId;
    
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      where.OR = [
        { Title: { contains: trimmedSearch } },
        { Description: { contains: trimmedSearch } },
        { UserFullName: { contains: trimmedSearch } }
      ];
    }

    const [records, total] = await Promise.all([
      prisma.systemRecords.findMany({
        where,
        orderBy: { CreatedDate: "desc" },
        skip: (page - 1) * limit,
        take: Number(limit),
        select: {
          Id: true,
          UserFullName: true,
          DeviceName: true,
          Title: true,
          Description: true,
          CreatedDate: true,
          UsersId: true,
        },
      }),
      prisma.systemRecords.count({ where }),
    ]);

    return { 
      success: true, 
      data: records, 
      meta: {
        total, 
        page: Number(page), 
        limit: Number(limit), 
        totalPages: Math.ceil(total / limit) 
      }
    };
  }
}

module.exports = SystemRecordService;
