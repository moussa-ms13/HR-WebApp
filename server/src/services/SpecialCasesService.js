// ============================================================
// SpecialCasesService — CRUD with Geographic RBAC
// Handles structural cases: انتداب, تحويل, استيداع, استقالة
// Auto-syncs Employee.EmployeeStatus on create/update.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

const clearDashboardCacheSafe = () => {
  try {
    require("../controllers/dashboard.controller").clearDashboardCache?.();
  } catch (_) {
    // ignore
  }
};

// Maps case_type -> employee status value
const CASE_TYPE_STATUS_MAP = Object.freeze({
  "انتداب": "منتدب",
  "تحويل": "محوّل",
  "استيداع": "مستودع",
  "استقالة": "مستقيل",
});

class SpecialCasesService {
  /**
   * GET /api/special-cases — global paginated list with RBAC + search.
   */
  static async getAll(requestingUser, page = 1, limit = 25, search = "", province = "", directorate = "") {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    let employeeFilter = {};
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (allowed.length === 0) {
        return { data: [], meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0 } };
      }
      employeeFilter.Province = { in: allowed };
    }
    if (province) {
      if (requestingUser.role === ROLES.ADMIN || employeeFilter.Province?.in?.includes(province)) {
        employeeFilter.Province = province;
      }
    }
    if (directorate) {
      employeeFilter.Directorate = directorate;
    }

    const whereClause = { Employee: employeeFilter };
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      const terms = trimmedSearch.split(/\s+/);
      if (terms.length >= 2) {
        whereClause.OR = [
          {
            Employee: {
              ...employeeFilter,
              AND: [
                { Name: { contains: terms[0] } },
                { LastName: { contains: terms.slice(1).join(" ") } },
              ],
            },
          },
          { CaseType: { contains: trimmedSearch } },
        ];
        delete whereClause.Employee;
      } else {
        whereClause.OR = [
          { Employee: { ...employeeFilter, Name: { contains: trimmedSearch } } },
          { Employee: { ...employeeFilter, LastName: { contains: trimmedSearch } } },
          { CaseType: { contains: trimmedSearch } },
        ];
        delete whereClause.Employee;
      }
    }

    const [total, cases] = await Promise.all([
      prisma.specialCases.count({ where: whereClause }),
      prisma.specialCases.findMany({
        where: whereClause,
        select: {
          Id: true,
          EmployeesId: true,
          CaseType: true,
          StartDate: true,
          EndDate: true,
          Destination: true,
          ReferenceDoc: true,
          IsActive: true,
          CreatedAt: true,
          Employee: { select: { Name: true, LastName: true, Province: true } },
        },
        skip,
        take: safeLimit,
        orderBy: { Id: "desc" },
      }),
    ]);

    return {
      data: cases,
      meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  /**
   * Sync the Employee.EmployeeStatus column based on case_type.
   * Called after create/update of a SpecialCase.
   */
  static async _syncEmployeeStatus(employeesId, caseType) {
    const newStatus = CASE_TYPE_STATUS_MAP[caseType];
    if (!newStatus) return; // Unknown type — skip

    await prisma.employees.update({
      where: { Id: employeesId },
      data: {
        EmployeeStatus: newStatus,
        StatusDate: new Date(),
        UpdateDate: new Date(),
      },
    });
  }

  /**
   * RBAC helper: verify the requesting user can access a given employee.
   */
  static async _verifyAccess(employee, requestingUser) {
    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden(`Geographic access denied for province: ${employee.Province}`);
      }
    }
  }

  /**
   * GET /api/employees/:id/special-cases
   * List all special cases for a given employee.
   */
  static async getByEmployee(employeeId, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: { Id: true, Province: true }
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const cases = await prisma.specialCases.findMany({
      where: { EmployeesId: employeeId },
      select: {
        Id: true,
        EmployeesId: true,
        CaseType: true,
        StartDate: true,
        EndDate: true,
        Destination: true,
        ReferenceDoc: true,
        IsActive: true,
        CreatedAt: true,
      },
      orderBy: { Id: "desc" },
    });

    return cases;
  }

  /**
   * POST /api/employees/:id/special-cases
   * Create + auto-sync employee status.
   */
  static async create(employeeId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const record = await prisma.specialCases.create({
      data: {
        EmployeesId: employeeId,
        CaseType: data.CaseType,
        StartDate: new Date(data.StartDate),
        EndDate: data.EndDate ? new Date(data.EndDate) : null,
        Destination: data.Destination || null,
        ReferenceDoc: data.ReferenceDoc,
        IsActive: data.IsActive !== undefined ? data.IsActive : true,
      },
    });

    // Auto-sync employee status
    if (record.IsActive) {
      await this._syncEmployeeStatus(employeeId, record.CaseType);
    }

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Add Special Case",
      description: `${record.CaseType} for '${employee.Name} ${employee.LastName}' by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    clearDashboardCacheSafe();

    return record;
  }

  /**
   * PUT /api/employees/:id/special-cases/:caseId
   * Update + re-sync employee status.
   */
  static async update(employeeId, caseId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    const record = await prisma.specialCases.update({
      where: { Id: caseId },
      data: {
        CaseType: data.CaseType ?? existing.CaseType,
        StartDate: data.StartDate ? new Date(data.StartDate) : existing.StartDate,
        EndDate: data.EndDate !== undefined ? (data.EndDate ? new Date(data.EndDate) : null) : existing.EndDate,
        Destination: data.Destination !== undefined ? data.Destination : existing.Destination,
        ReferenceDoc: data.ReferenceDoc ?? existing.ReferenceDoc,
        IsActive: data.IsActive !== undefined ? data.IsActive : existing.IsActive,
      },
    });

    // Re-sync employee status if case is active
    if (record.IsActive) {
      await this._syncEmployeeStatus(employeeId, record.CaseType);
    }

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Edit Special Case",
      description: `${record.CaseType} updated for '${employee.Name} ${employee.LastName}' by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    clearDashboardCacheSafe();

    return record;
  }

  /**
   * DELETE /api/employees/:id/special-cases/:caseId
   */
  static async delete(employeeId, caseId, requestingUser) {
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    await prisma.specialCases.delete({ where: { Id: caseId } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "Delete Special Case",
      description: `${existing.CaseType} deleted for '${employee.Name} ${employee.LastName}' by '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    clearDashboardCacheSafe();

    return { message: "Special case deleted successfully." };
  }
}

module.exports = SpecialCasesService;
