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
      select: {
        Id: true,
        Name: true,
        LastName: true,
        Province: true,
        JobTitle: { select: { Id: true, RankName: true, EmploymentCategory: true } },
      },
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

    const records = await prisma.degreeHistory.findMany({
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

    return records.map((record) => ({
      ...record,
      Pace: record.PromotionDuration,
    }));
  }

  static async create(employeeId, data, requestingUser) {
    const employee = await this._assertAccess(employeeId, requestingUser);

    if (data.DegreeLevel == null || data.DegreeLevel === "") {
      throw ApiError.badRequest("الدرجة أو سنوات الخبرة مطلوبة.");
    }
    const degreeLevelNum = Number(data.DegreeLevel);
    if (isNaN(degreeLevelNum) || degreeLevelNum < 0 || degreeLevelNum > 45) {
      throw ApiError.badRequest("قيمة الدرجة أو سنوات الخبرة غير صالحة (يجب أن تكون بين 0 و 45).");
    }
    if (!data.EffectiveDate) {
      throw ApiError.badRequest("تاريخ السريان مطلوب.");
    }

    const pace = String(data.PromotionDuration || data.Pace || "").trim();
    const truncatedPace = pace.slice(0, 50);

    const record = await prisma.degreeHistory.create({
      data: {
        EmployeesId: employeeId,
        DegreeLevel: degreeLevelNum,
        PromotionDuration: truncatedPace,
        EffectiveDate: new Date(data.EffectiveDate),
        ReferenceDoc: data.ReferenceDoc || "",
        Notes: data.Notes || null,
      },
    });

    await this._syncEmployeeDegree(employeeId);

    const empCategory = employee.JobTitle?.EmploymentCategory || "";
    const isContractual = empCategory.includes("متعاقد") || pace.includes("%");

    if (isContractual) {
      const percentage = pace.includes("%")
        ? (pace.includes("=") ? pace.split("=").pop().trim() : pace)
        : `${(degreeLevelNum * 1.4).toFixed(1)}%`;

      await SystemRecordService.log({
        userFullName: requestingUser.fullName,
        title: "إضافة تعويض خبرة مهنية",
        description: `تمت إضافة تعويض خبرة مهنية (${degreeLevelNum} سنة - ${percentage}) للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
        usersId: requestingUser.id,
        employeesId: employeeId,
        ipAddress: requestingUser.ipAddress,
      });
    } else {
      await SystemRecordService.log({
        userFullName: requestingUser.fullName,
        title: "إضافة درجة جديدة",
        description: `تمت إضافة الدرجة ${record.DegreeLevel} للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
        usersId: requestingUser.id,
        employeesId: employeeId,
        ipAddress: requestingUser.ipAddress,
      });
    }

    return {
      ...record,
      Pace: record.PromotionDuration,
    };
  }

  static async delete(employeeId, degreeId, requestingUser) {
    const employee = await this._assertAccess(employeeId, requestingUser);

    const existing = await prisma.degreeHistory.findFirst({
      where: { Id: degreeId, EmployeesId: employeeId },
    });
    if (!existing) throw ApiError.notFound(`Degree record ${degreeId} not found.`);

    await prisma.degreeHistory.delete({ where: { Id: degreeId } });
    await this._syncEmployeeDegree(employeeId);

    const empCategory = employee.JobTitle?.EmploymentCategory || "";
    const isContractual = empCategory.includes("متعاقد") || (existing.PromotionDuration && existing.PromotionDuration.includes("%"));

    if (isContractual) {
      await SystemRecordService.log({
        userFullName: requestingUser.fullName,
        title: "حذف تعويض خبرة مهنية",
        description: `تم حذف تعويض خبرة مهنية (${existing.DegreeLevel} سنة) من سجل الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
        usersId: requestingUser.id,
        employeesId: employeeId,
        ipAddress: requestingUser.ipAddress,
      });
    } else {
      await SystemRecordService.log({
        userFullName: requestingUser.fullName,
        title: "حذف سجل درجة",
        description: `تم حذف الدرجة ${existing.DegreeLevel} من سجل الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
        usersId: requestingUser.id,
        employeesId: employeeId,
        ipAddress: requestingUser.ipAddress,
      });
    }

    return { message: "تم حذف السجل بنجاح." };
  }
}

module.exports = DegreeHistoryService;
