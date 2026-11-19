// ============================================================
// SpecialCasesService — CRUD with Geographic RBAC
// Handles structural cases: انتداب, تحويل, استيداع, استقالة, تقاعد
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const CacheService = require("./CacheService");
const {
  assertProvinceAccess,
  archiveOriginatingPost,
  restoreOriginatingPost,
  syncEmployeeStatus,
  reinstateEmployeeStatus,
} = require("./specialCases/specialCasesHelpers");
const {
  getAllSpecialCases,
  getSpecialCasesByEmployee,
} = require("./specialCases/specialCasesQueries");

const EMPLOYEE_ACCESS_SELECT = { Id: true, Name: true, LastName: true, Province: true, Directorate: true };

class SpecialCasesService {
  static async getAll(...args) {
    return getAllSpecialCases(...args);
  }

  static async getByEmployee(employeeId, requestingUser) {
    return getSpecialCasesByEmployee(employeeId, requestingUser);
  }

  static async _archiveOriginatingPost(tx, employeesId, data, employee) {
    return archiveOriginatingPost(tx, employeesId, data, employee);
  }

  static async _restoreOriginatingPost(tx, employeesId) {
    return restoreOriginatingPost(tx, employeesId);
  }

  static async _syncEmployeeStatus(tx, employeesId, caseType, opts) {
    return syncEmployeeStatus(tx, employeesId, caseType, opts);
  }

  static async _reinstateEmployeeStatus(tx, employeesId, previousCase) {
    return reinstateEmployeeStatus(tx, employeesId, previousCase);
  }

  static async _verifyAccess(employee, requestingUser) {
    assertProvinceAccess(employee.Province, requestingUser);
  }

  static async create(employeeId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: EMPLOYEE_ACCESS_SELECT,
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    assertProvinceAccess(employee.Province, requestingUser);

    const isActive = data.IsActive !== undefined ? Boolean(data.IsActive) : true;
    // Prevent non-Admin province override on active secondment ("انتداب")
    if (data.CaseType === "انتداب" && isActive && data.Province) {
      assertProvinceAccess(data.Province, requestingUser);
    }

    const startDate = data.StartDate ? new Date(data.StartDate) : new Date();
    const endDate = data.EndDate ? new Date(data.EndDate) : null;
    const destination = data.Destination || null;
    const referenceDoc = data.ReferenceDoc || "";

    const record = await prisma.$transaction(
      async (tx) => {
        if (data.CaseType === "انتداب" && isActive) {
          await archiveOriginatingPost(tx, employeeId, { Destination: destination, ReferenceDoc: referenceDoc }, employee);
        }

        const createdCase = await tx.specialCases.create({
          data: {
            EmployeesId: employeeId,
            CaseType: data.CaseType,
            StartDate: startDate,
            EndDate: endDate,
            Destination: destination,
            ReferenceDoc: referenceDoc,
            IsActive: isActive,
          },
        });

        if (isActive) {
          await syncEmployeeStatus(tx, employeeId, data.CaseType, {
            destination,
            startDate,
            province: data.Province,
            directorate: data.Directorate,
          });
        }

        return createdCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة حالة خاصة",
      description: `تمت إضافة حالة '${record.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return record;
  }

  static async update(employeeId, caseId, data, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: EMPLOYEE_ACCESS_SELECT,
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    assertProvinceAccess(employee.Province, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    const newCaseType = data.CaseType ?? existing.CaseType;
    const newStartDate = data.StartDate ? new Date(data.StartDate) : existing.StartDate;
    const newEndDate =
      data.EndDate !== undefined ? (data.EndDate ? new Date(data.EndDate) : null) : existing.EndDate;
    const newDestination = data.Destination !== undefined ? data.Destination : existing.Destination;
    const newReferenceDoc = data.ReferenceDoc ?? existing.ReferenceDoc;
    const newIsActive = data.IsActive !== undefined ? Boolean(data.IsActive) : existing.IsActive;

    // Prevent non-Admin province override on active secondment ("انتداب")
    if (newCaseType === "انتداب" && newIsActive && data.Province) {
      assertProvinceAccess(data.Province, requestingUser);
    }

    const record = await prisma.$transaction(
      async (tx) => {
        const isTransitioningToSecondment =
          newIsActive &&
          newCaseType === "انتداب" &&
          (!existing.IsActive || existing.CaseType !== "انتداب");

        if (isTransitioningToSecondment) {
          await archiveOriginatingPost(tx, employeeId, { Destination: newDestination, ReferenceDoc: newReferenceDoc }, employee);
        }

        const updatedCase = await tx.specialCases.update({
          where: { Id: caseId },
          data: {
            CaseType: newCaseType,
            StartDate: newStartDate,
            EndDate: newEndDate,
            Destination: newDestination,
            ReferenceDoc: newReferenceDoc,
            IsActive: newIsActive,
          },
        });

        if (newIsActive) {
          await syncEmployeeStatus(tx, employeeId, newCaseType, {
            destination: newDestination,
            startDate: newStartDate,
            province: data.Province,
            directorate: data.Directorate,
          });
        } else {
          await reinstateEmployeeStatus(tx, employeeId, existing);
        }

        return updatedCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل حالة خاصة",
      description: `تم تعديل حالة '${record.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return record;
  }

  static async delete(employeeId, caseId, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: EMPLOYEE_ACCESS_SELECT,
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    assertProvinceAccess(employee.Province, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.specialCases.delete({ where: { Id: caseId } });
        if (existing.IsActive) {
          await reinstateEmployeeStatus(tx, employeeId, existing);
        }
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف حالة خاصة",
      description: `تم حذف حالة '${existing.CaseType}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return { message: "Special case deleted successfully." };
  }

  static async endCase(employeeId, caseId, data = {}, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: employeeId },
      select: EMPLOYEE_ACCESS_SELECT,
    });
    if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
    assertProvinceAccess(employee.Province, requestingUser);

    const existing = await prisma.specialCases.findUnique({ where: { Id: caseId } });
    if (!existing || existing.EmployeesId !== employeeId) {
      throw ApiError.notFound(`SpecialCase ${caseId} not found for employee ${employeeId}.`);
    }

    const endDate = data.endDate ? new Date(data.endDate) : new Date();
    let updatedReferenceDoc = existing.ReferenceDoc || "";
    if (data.reinstatementDoc && String(data.reinstatementDoc).trim()) {
      const docNote = `قرار إعادة إدماج: ${String(data.reinstatementDoc).trim()}`;
      updatedReferenceDoc = updatedReferenceDoc ? `${updatedReferenceDoc} | ${docNote}` : docNote;
    }

    const record = await prisma.$transaction(
      async (tx) => {
        const updatedCase = await tx.specialCases.update({
          where: { Id: caseId },
          data: { IsActive: false, EndDate: endDate, ReferenceDoc: updatedReferenceDoc },
        });
        await reinstateEmployeeStatus(tx, employeeId, existing);
        return updatedCase;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إنهاء حالة خاصة / إعادة إدماج",
      description: `تم إنهاء حالة '${record.CaseType}' وإعادة إدماج الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return record;
  }
}

module.exports = SpecialCasesService;
