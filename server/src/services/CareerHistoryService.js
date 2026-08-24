// ============================================================
// CareerHistoryService — Rank promotions & higher position history
// One-to-many career tracking per employee, with Geographic RBAC
// and audit logging (mirrors EmployeesService patterns).
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

class CareerHistoryService {
  // ──────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────

  /**
   * Verifies the employee exists and the requesting user
   * has geographic access to their province.
   */
  static async assertEmployeeAccess(employeeId, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: { Id: true, Name: true, LastName: true, Province: true },
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee.");
      }
    }
    return employee;
  }

  /** Fetches a rank history record owned by the given employee. */
  static async getRankRecord(employeeId, recordId) {
    const record = await prisma.rankHistory.findFirst({
      where: { Id: recordId, EmployeesId: employeeId },
    });
    if (!record) throw ApiError.notFound(`Rank history record ${recordId} not found.`);
    return record;
  }

  /** Fetches a position history record owned by the given employee. */
  static async getPositionRecord(employeeId, recordId) {
    const record = await prisma.positionHistory.findFirst({
      where: { Id: recordId, EmployeesId: employeeId },
    });
    if (!record) throw ApiError.notFound(`Position history record ${recordId} not found.`);
    return record;
  }

  // ──────────────────────────────────────────────
  // READ — Both histories ordered by InstallDate desc
  // ──────────────────────────────────────────────
  static async get(employeeId, requestingUser) {
    await this.assertEmployeeAccess(employeeId, requestingUser);

    const [ranks, positions] = await Promise.all([
      prisma.rankHistory.findMany({
        where: { EmployeesId: employeeId },
        orderBy: { InstallDate: "desc" },
      }),
      prisma.positionHistory.findMany({
        where: { EmployeesId: employeeId },
        orderBy: { InstallDate: "desc" },
      }),
    ]);

    return { ranks, positions };
  }

  // ──────────────────────────────────────────────
  // RANK HISTORY — CRUD
  // ──────────────────────────────────────────────

  /** Resolves the denormalized rank name snapshot from JobTitles. */
  static async resolveRankName(rankId, fallbackName) {
    if (!rankId) return fallbackName || "";
    const jobTitle = await prisma.jobTitles.findUnique({ where: { Id: Number(rankId) } });
    if (!jobTitle) throw ApiError.badRequest(`الرتبة المحددة غير موجودة في النظام.`);
    return jobTitle.RankName;
  }

  static async createRank(employeeId, data, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);

    if (!data.InstallDate) {
      throw ApiError.badRequest("تاريخ تثبيت الرتبة مطلوب.");
    }

    const rankId = data.RankId ? Number(data.RankId) : null;
    const rankName = await this.resolveRankName(rankId, (data.RankName || "").trim());

    const record = await prisma.rankHistory.create({
      data: {
        EmployeesId: employeeId,
        RankId: rankId,
        RankName: rankName,
        InstallDate: new Date(data.InstallDate),
        Reference: data.Reference || "",
        Notes: data.Notes || "",
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة ترقية في الرتبة",
      description: `تمت إضافة رتبة '${record.RankName}' للموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return record;
  }

  static async updateRank(employeeId, recordId, data, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);
    const existing = await this.getRankRecord(employeeId, recordId);

    let rankId = existing.RankId;
    let rankName = existing.RankName;

    if (data.RankId !== undefined) {
      rankId = data.RankId ? Number(data.RankId) : null;
      rankName = await this.resolveRankName(rankId, data.RankName);
    } else if (data.RankName !== undefined) {
      rankName = (data.RankName || "").trim();
    }

    const record = await prisma.rankHistory.update({
      where: { Id: recordId },
      data: {
        RankId: rankId,
        RankName: rankName,
        InstallDate: data.InstallDate ? new Date(data.InstallDate) : existing.InstallDate,
        Reference: data.Reference ?? existing.Reference,
        Notes: data.Notes ?? existing.Notes,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل سجل الترقية",
      description: `تم تعديل رتبة '${record.RankName}' للموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return record;
  }

  static async deleteRank(employeeId, recordId, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);
    const existing = await this.getRankRecord(employeeId, recordId);

    await prisma.rankHistory.delete({ where: { Id: recordId } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف سجل الترقية",
      description: `تم حذف رتبة '${existing.RankName}' من سجل الموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return { message: "تم حذف السجل بنجاح." };
  }

  // ──────────────────────────────────────────────
  // POSITION HISTORY — CRUD
  // ──────────────────────────────────────────────

  static async createPosition(employeeId, data, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);

    if (!data.PositionName || !data.PositionName.trim()) {
      throw ApiError.badRequest("اسم المنصب مطلوب.");
    }
    if (!data.InstallDate) {
      throw ApiError.badRequest("تاريخ تولي المنصب مطلوب.");
    }

    const installDate = new Date(data.InstallDate);
    const endDate = data.EndDate ? new Date(data.EndDate) : null;
    if (endDate && endDate < installDate) {
      throw ApiError.badRequest("لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ التولي.");
    }

    const record = await prisma.positionHistory.create({
      data: {
        EmployeesId: employeeId,
        PositionName: data.PositionName.trim(),
        InstallDate: installDate,
        EndDate: endDate,
        Reference: data.Reference || "",
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة منصب عليا",
      description: `تمت إضافة منصب '${record.PositionName}' للموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return record;
  }

  static async updatePosition(employeeId, recordId, data, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);
    const existing = await this.getPositionRecord(employeeId, recordId);

    const installDate = data.InstallDate ? new Date(data.InstallDate) : existing.InstallDate;
    let endDate = existing.EndDate;
    if (data.EndDate !== undefined) {
      endDate = data.EndDate ? new Date(data.EndDate) : null;
    }
    if (endDate && endDate < installDate) {
      throw ApiError.badRequest("لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ التولي.");
    }

    const record = await prisma.positionHistory.update({
      where: { Id: recordId },
      data: {
        PositionName: data.PositionName !== undefined ? data.PositionName.trim() : existing.PositionName,
        InstallDate: installDate,
        EndDate: endDate,
        Reference: data.Reference ?? existing.Reference,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل سجل المنصب",
      description: `تم تعديل منصب '${record.PositionName}' للموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return record;
  }

  static async deletePosition(employeeId, recordId, requestingUser) {
    const employee = await this.assertEmployeeAccess(employeeId, requestingUser);
    const existing = await this.getPositionRecord(employeeId, recordId);

    await prisma.positionHistory.delete({ where: { Id: recordId } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف سجل المنصب",
      description: `تم حذف منصب '${existing.PositionName}' من سجل الموظف '${employee.Name} ${employee.LastName}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
    });

    return { message: "تم حذف السجل بنجاح." };
  }
}

module.exports = CareerHistoryService;
