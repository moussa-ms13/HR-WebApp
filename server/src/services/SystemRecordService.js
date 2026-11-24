// ============================================================
// SystemRecordService — Centralized Audit Logging
// Matches the EXISTING SystemRecords table structure in RafatDB:
//   Id, UserFullName, DeviceName, MachinId, Title,
//   Description, CreatedDate, UsersId, EmployeesId
// ============================================================
const prisma = require("../config/database");
const os = require("os");
const CacheService = require("./CacheService");
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
      CacheService.delByPrefix("dashboard_user_kpis_");
    } catch (error) {
      // Logging failures must never crash the main operation
      console.error("[SystemRecordService] Failed to log action:", error.message);
    }
  }

  /**
   * Retrieve system records with optional filtering and pagination.
   */
  static async getAll({ page = 1, limit = 50, usersId = null, search = "", action = "", sortBy = "Id", sortOrder = "desc" } = {}) {
    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);
    const where = {};
    if (usersId) where.UsersId = usersId;
    if (action) where.Title = { contains: action };

    const trimmedSearch = String(search || "").trim();
    const searchTokens = trimmedSearch ? trimmedSearch.split(/\s+/).filter(Boolean).slice(0, 5) : [];

    // Pre-resolve matching Employee IDs in one fast indexed lookup instead of correlated EXISTS subqueries on 15k+ rows
    const matchedEmpIdsByToken = new Map();
    if (searchTokens.length > 0) {
      const empLookups = await Promise.all(
        searchTokens.map((token) =>
          prisma.employees.findMany({
            where: {
              OR: [
                { LastName: { contains: token } },
                { Name: { contains: token } },
              ],
            },
            select: { Id: true },
            take: 200,
          })
        )
      );
      searchTokens.forEach((token, idx) => {
        matchedEmpIdsByToken.set(
          token,
          empLookups[idx].map((e) => e.Id)
        );
      });
    }

    const tokenSearch = buildTokenizedSearch(trimmedSearch, (token) => {
      const empIds = matchedEmpIdsByToken.get(token) || [];
      return [
        { Title: { contains: token } },
        { Description: { contains: token } },
        { UserFullName: { contains: token } },
        { DeviceName: { contains: token } },
        ...(empIds.length > 0 ? [{ EmployeesId: { in: empIds } }] : []),
      ];
    });
    if (tokenSearch) {
      if (where.Title) {
        where.AND = [
          { Title: where.Title },
          ...tokenSearch.AND
        ];
        delete where.Title;
      } else {
        where.AND = tokenSearch.AND;
      }
    }

    // Clustered PK (Id) is strictly monotonic with CreatedDate — ordering by Id avoids expensive LOB sort/key lookups
    let orderBy = { Id: "desc" };
    const direction = sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";
    if (sortBy === "Id" || sortBy === "CreatedDate") orderBy = { Id: direction };
    else if (sortBy === "Title") orderBy = { Title: direction };
    else if (sortBy === "UserFullName") orderBy = { UserFullName: direction };
    else if (sortBy === "DeviceName") orderBy = { DeviceName: direction };
    else if (sortBy === "Employee") orderBy = { Employee: { LastName: direction } };

    const [records, total] = await Promise.all([
      prisma.systemRecords.findMany({
        where,
        orderBy,
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
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}

module.exports = SystemRecordService;
