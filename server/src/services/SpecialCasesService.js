// ============================================================
// SpecialCasesService — CRUD with Geographic RBAC
// Handles structural cases: انتداب, تحويل, استيداع, استقالة
// Auto-syncs Employee.EmployeeStatus on create/update.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

// Maps case_type -> employee status value
const CASE_TYPE_STATUS_MAP = Object.freeze({
  "انتداب": "منتدب",
  "تحويل": "محوّل",
  "استيداع": "مستودع",
  "استقالة": "مستقيل",
});

class SpecialCasesService {
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
    const employee = await prisma.employees.findUnique({ where: { Id: employeeId } });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    await this._verifyAccess(employee, requestingUser);

    const cases = await prisma.specialCases.findMany({
      where: { EmployeesId: employeeId },
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

    return { message: "Special case deleted successfully." };
  }
}

module.exports = SpecialCasesService;
