// ============================================================
// SystemRecordService — Centralized Audit Logging
// Matches the EXISTING SystemRecords table structure in RafatDB:
//   Id, UserFullName, DeviceName, MachinId, Title,
//   Description, CreatedDate, UsersId, EmployeesId
// ============================================================
const prisma = require("../config/database");
const os = require("os");
const { getClientDeviceName, resolveDeviceName } = require("../utils/requestContext");
const { sanitizePagination, buildTokenizedSearch } = require("../utils/queryBuilder");

class SystemRecordService {
  /**
   * Log an action to the SystemRecords table.
   * @param {Object} params
   * @param {string} params.userFullName  - Full name of the acting user
   * @param {string} params.title         - Action title (e.g. "إضافة مستخدم")
   * @param {string} params.description   - Human-readable description
   * @param {number} params.usersId       - ID of the acting user
   * @param {number} [params.employeesId] - ID of the affected employee (optional)
   * @param {string} [params.ipAddress]   - Real client IP address
   * @param {string} [params.deviceName]  - Explicit device name
   */
  static async log({
    userFullName,
    title,
    description,
    usersId,
    employeesId = null,
    ipAddress = null,
    deviceName = null,
  }) {
    try {
      let resolvedDevice = deviceName;

      if (!resolvedDevice) {
        resolvedDevice = getClientDeviceName(ipAddress);
      } else {
        resolvedDevice = resolveDeviceName(resolvedDevice);
      }

      await prisma.systemRecords.create({
        data: {
          UserFullName: userFullName,
          DeviceName: resolvedDevice || os.hostname(),
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
    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);
    const where = {};
    if (usersId) where.UsersId = usersId;
    
    const tokenSearch = buildTokenizedSearch(search, (token) => [
      { Title: { contains: token } },
      { Description: { contains: token } },
      { UserFullName: { contains: token } },
      { Employee: { LastName: { contains: token } } },
      { Employee: { Name: { contains: token } } },
    ]);
    if (tokenSearch) {
      where.AND = tokenSearch.AND;
    }

    const [records, total] = await Promise.all([
      prisma.systemRecords.findMany({
        where,
        orderBy: { CreatedDate: "desc" },
        skip,
        take: safeLimit,
        select: {
          Id: true,
          UserFullName: true,
          DeviceName: true,
          Title: true,
          Description: true,
          CreatedDate: true,
          UsersId: true,
          EmployeesId: true,
          Employee: {
            select: {
              Id: true,
              Name: true,
              LastName: true,
            },
          },
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
