// ============================================================
// DegreeHistoryService — Degree progression tracking (الدرجات)
// Auto-syncs Employees.Degree with newest degree level.
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

class DegreeHistoryService {
  static async _assertAccess(employeeId, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: { Id: true, Name: true, LastName: true, Province: true },
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowed = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowed.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee.");
      }
    }
    return employee;
  }

  static async _syncEmployeeDegree(employeeId) {
    const latest = await prisma.degreeHistory.findFirst({
      where: { EmployeesId: employeeId },
      orderBy: { EffectiveDate: "desc" },
      select: { DegreeLevel: true, EffectiveDate: true },
    });

    if (latest) {
      await prisma.employees.update({
        where: { Id: employeeId },
        data: {
          Degree: latest.DegreeLevel,
          LastDegreeDate: latest.EffectiveDate,
        },
      });
    }
  }

  static async getByEmployee(employeeId, requestingUser) {
    await this._assertAccess(employeeId, requestingUser);

    return prisma.degreeHistory.findMany({
      where: { EmployeesId: employeeId },
      select: {
        Id: true,
        EmployeesId: true,
        DegreeLevel: true,
        PromotionDuration: true,
        EffectiveDate: true,
        ReferenceDoc: true,
        Notes: true,
      },
      orderBy: { EffectiveDate: "desc" },
    });
  }

  static async create(employeeId, data, requestingUser) {
    const employee = await this._assertAccess(employeeId, requestingUser);

    if (data.DegreeLevel == null || data.DegreeLevel === "") {
      throw ApiError.badRequest("الدرجة مطلوبة.");
    }
    if (!data.EffectiveDate) {
      throw ApiError.badRequest("تاريخ السريان مطلوب.");
    }

    const record = await prisma.degreeHistory.create({
      data: {
        EmployeesId: employeeId,
        DegreeLevel: Number(data.DegreeLevel),
        PromotionDuration: data.PromotionDuration || "",
        EffectiveDate: new Date(data.EffectiveDate),
        ReferenceDoc: data.ReferenceDoc || "",
        Notes: data.Notes || null,
      },
    });

    await this._syncEmployeeDegree(employeeId);

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة درجة جديدة",
      description: `تمت إضافة الدرجة ${record.DegreeLevel} للموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return record;
  }

  static async delete(employeeId, degreeId, requestingUser) {
    const employee = await this._assertAccess(employeeId, requestingUser);

    const existing = await prisma.degreeHistory.findFirst({
      where: { Id: degreeId, EmployeesId: employeeId },
    });
    if (!existing) throw ApiError.notFound(`Degree record ${degreeId} not found.`);

    await prisma.degreeHistory.delete({ where: { Id: degreeId } });
    await this._syncEmployeeDegree(employeeId);

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف سجل درجة",
      description: `تم حذف الدرجة ${existing.DegreeLevel} من سجل الموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return { message: "تم حذف السجل بنجاح." };
  }
}

module.exports = DegreeHistoryService;
