// ============================================================
// EmployeesService — Centralized Data Access for Employees (DRY)
// Fast pagination, search, Geographic RBAC, and strict projections
// ============================================================
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");
const CacheService = require("./CacheService");
const { ROLES, getAllowedProvinces } = require("../config/constants");
const {
  resolveGeographicFilter,
  normalizeWorkplaceValue,
} = require("../utils/queryBuilder");
const {
  EMPLOYEE_DETAIL_SELECT,
  EMPLOYEE_SUMMARY_SELECT,
  normalizeFrenchNames,
  computeProfileCompleteness,
  validateEmployeeCreation,
  resolveStatutoryStatus,
} = require("./employees/employeeHelpers");
const {
  listEmployees,
  searchEmployees,
} = require("./employees/employeeQueryBuilder");

function sanitizeProfileImagePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return "";
  const cleaned = rawPath.trim();
  // Only allow safe local employee_images paths; reject external URLs or traversal
  if (cleaned.startsWith("/uploads/employee_images/") && !cleaned.includes("..")) {
    return cleaned;
  }
  return "";
}

class EmployeesService {
  static async getAll(...args) {
    return listEmployees(args);
  }

  static async search(requestingUser, query = "", province = "", directorate = "") {
    return searchEmployees(requestingUser, query, province, directorate);
  }

  static async getById(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: EMPLOYEE_DETAIL_SELECT,
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee's province.");
      }
    }

    if (employee?.JobTitle) {
      employee.JobTitle.Category = employee.JobTitle.EmploymentCategory;
    }

    return employee;
  }

  static async getSummary(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: EMPLOYEE_SUMMARY_SELECT,
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(employee.Province)) {
        throw ApiError.forbidden("You do not have geographic access to this employee's province.");
      }
    }

    if (employee?.JobTitle) {
      employee.JobTitle.Category = employee.JobTitle.EmploymentCategory;
    }

    return employee;
  }

  static async create(data, requestingUser) {
    validateEmployeeCreation(data);

    if (requestingUser.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser.permissions || {});
      if (!allowedProvinces.includes(data.Province)) {
        throw ApiError.forbidden(`You cannot create employees in the province: ${data.Province}`);
      }
    }

    const now = new Date();
    const defaultDate = new Date("1900-01-01T00:00:00.000Z");
    const { finalLastNameFr, finalNameFr } = normalizeFrenchNames(data);
    const isProfileComplete = computeProfileCompleteness(data);

    const jobTitleId = Number(data.JobTitleId) || 0;
    let employeeStatus = resolveStatutoryStatus("", data.EmployeeStatus || "مرسم");
    if (jobTitleId > 0) {
      const jobTitle = await prisma.jobTitles.findUnique({
        where: { Id: jobTitleId },
        select: { EmploymentCategory: true },
      });
      if (jobTitle?.EmploymentCategory) {
        employeeStatus = resolveStatutoryStatus(jobTitle.EmploymentCategory, employeeStatus);
      }
    }

    const employee = await prisma.employees.create({
      data: {
        Name: String(data.Name || "").trim(),
        LastName: String(data.LastName || "").trim(),
        LastNameFr: finalLastNameFr,
        NameFr: finalNameFr,
        DateOfBirth: data.DateOfBirth ? new Date(data.DateOfBirth) : defaultDate,
        PlaceOfBirth: data.PlaceOfBirth || "",
        Gender: data.Gender || "",
        MaritalStatus: data.MaritalStatus || data.FamilyStatus || "",
        ProfileImagePath: sanitizeProfileImagePath(data.ProfileImagePath),
        Province: data.Province,
        Directorate: normalizeWorkplaceValue(data.Directorate || "", data.Province || ""),
        AddedDate: now,
        UpdateDate: now,
        UsersId: requestingUser.userName,
        NIN: data.NIN || "",
        SIS: data.SIS || "",
        AssignedPosition:
          employeeStatus === "متعاقد" ? "" : (data.AssignedPosition || ""),
        ConfirmationDate:
          employeeStatus === "متربص" || employeeStatus === "متعاقد"
            ? null
            : data.ConfirmationDate
            ? new Date(data.ConfirmationDate)
            : null,
        Degree: Number(data.Degree) || 0,
        EmployeeStatus: employeeStatus,
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : defaultDate,
        JobTitleId: jobTitleId,
        LastDegreeDate: data.LastDegreeDate ? new Date(data.LastDegreeDate) : defaultDate,
        PositionDate:
          employeeStatus === "متعاقد" || !data.AssignedPosition
            ? null
            : data.PositionDate
            ? new Date(data.PositionDate)
            : null,
        StatusDate: defaultDate,
        Address: data.Address || "",
        Email: data.Email || "",
        NumberOfChildren: Number(data.NumberOfChildren) || 0,
        PhoneNumber: data.PhoneNumber || "",
        IsProfileComplete: isProfileComplete,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة موظف جديد",
      description: `تمت إضافة الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employee.Id,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return employee;
  }

  static async update(id, data, requestingUser) {
    const existing = await prisma.employees.findUnique({ where: { Id: id } });
    if (!existing) throw ApiError.notFound(`Employee ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const { allowedProvinces } = resolveGeographicFilter(requestingUser);
      if (!allowedProvinces.includes(existing.Province)) {
        throw ApiError.forbidden("You do not have access to edit this employee.");
      }
      if (data.Province && !allowedProvinces.includes(data.Province)) {
        throw ApiError.forbidden(`You cannot move an employee to province: ${data.Province}`);
      }
    }

    const { finalLastNameFr, finalNameFr } = normalizeFrenchNames(data, existing);
    const isProfileComplete = computeProfileCompleteness(data, existing);

    const targetJobTitleId = data.JobTitleId !== undefined ? Number(data.JobTitleId) : existing.JobTitleId;
    let targetEmployeeStatus = resolveStatutoryStatus("", data.EmployeeStatus ?? existing.EmployeeStatus ?? "مرسم");
    if (targetJobTitleId > 0) {
      const jobTitle = await prisma.jobTitles.findUnique({
        where: { Id: targetJobTitleId },
        select: { EmploymentCategory: true },
      });
      if (jobTitle?.EmploymentCategory) {
        targetEmployeeStatus = resolveStatutoryStatus(jobTitle.EmploymentCategory, targetEmployeeStatus);
      }
    }

    const nextProvince = data.Province ?? existing.Province;
    const nextDirectorate =
      data.Directorate !== undefined
        ? normalizeWorkplaceValue(data.Directorate, nextProvince)
        : data.Province !== undefined && data.Province !== existing.Province
        ? normalizeWorkplaceValue(existing.Directorate, nextProvince)
        : existing.Directorate;

    const employee = await prisma.employees.update({
      where: { Id: id },
      data: {
        Name: data.Name !== undefined ? String(data.Name).trim() : existing.Name,
        LastName: data.LastName !== undefined ? String(data.LastName).trim() : existing.LastName,
        LastNameFr: finalLastNameFr,
        NameFr: finalNameFr,
        DateOfBirth: data.DateOfBirth ? new Date(data.DateOfBirth) : existing.DateOfBirth,
        PlaceOfBirth: data.PlaceOfBirth ?? existing.PlaceOfBirth,
        Gender: data.Gender !== undefined ? data.Gender : existing.Gender,
        MaritalStatus: (data.MaritalStatus !== undefined ? data.MaritalStatus : data.FamilyStatus) ?? existing.MaritalStatus,
        Province: nextProvince,
        Directorate: nextDirectorate,
        UpdateDate: new Date(),
        UsersId: requestingUser.userName,
        NIN: data.NIN ?? existing.NIN,
        SIS: data.SIS ?? existing.SIS,
        AssignedPosition:
          targetEmployeeStatus === "متعاقد"
            ? ""
            : (data.AssignedPosition ?? existing.AssignedPosition),
        ConfirmationDate:
          targetEmployeeStatus === "متربص" || targetEmployeeStatus === "متعاقد"
            ? null
            : data.ConfirmationDate
            ? new Date(data.ConfirmationDate)
            : existing.ConfirmationDate,
        Degree: data.Degree !== undefined ? Number(data.Degree) : existing.Degree,
        EmployeeStatus: targetEmployeeStatus,
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : existing.InstallationDate,
        LastDegreeDate: data.LastDegreeDate ? new Date(data.LastDegreeDate) : existing.LastDegreeDate,
        JobTitleId: targetJobTitleId,
        PositionDate:
          targetEmployeeStatus === "متعاقد" ||
          (data.AssignedPosition !== undefined && !data.AssignedPosition)
            ? null
            : data.PositionDate !== undefined
            ? (data.PositionDate ? new Date(data.PositionDate) : null)
            : existing.PositionDate,
        Address: data.Address ?? existing.Address,
        Email: data.Email ?? existing.Email,
        NumberOfChildren: data.NumberOfChildren !== undefined ? Number(data.NumberOfChildren) : existing.NumberOfChildren,
        PhoneNumber: data.PhoneNumber ?? existing.PhoneNumber,
        IsProfileComplete: isProfileComplete,
      },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل بيانات موظف",
      description: `تم تعديل بيانات الموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employee.Id,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return employee;
  }

  static async delete(id, requestingUser) {
    const existing = await prisma.employees.findUnique({
      where: { Id: id },
      select: { Id: true, Name: true, LastName: true, Province: true },
    });
    if (!existing) throw ApiError.notFound(`Employee ${id} not found.`);

    if (requestingUser.role !== ROLES.ADMIN) {
      const { allowedProvinces } = resolveGeographicFilter(requestingUser);
      if (!allowedProvinces.includes(existing.Province)) {
        throw ApiError.forbidden("You do not have geographic access to delete this employee.");
      }
    }

    await prisma.$transaction([
      prisma.systemRecords.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeeFiles.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeesRecords.deleteMany({ where: { EmployeesId: id } }),
      prisma.employeeStates.deleteMany({ where: { EmployeesId: id } }),
      prisma.leaveBalance.deleteMany({ where: { EmployeeId: id } }),
      prisma.specialCases.deleteMany({ where: { EmployeesId: id } }),
      prisma.rankHistory.deleteMany({ where: { EmployeesId: id } }),
      prisma.positionHistory.deleteMany({ where: { EmployeesId: id } }),
      prisma.degreeHistory.deleteMany({ where: { EmployeesId: id } }),
      prisma.employees.delete({ where: { Id: id } }),
    ]);

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف موظف",
      description: `تم حذف الموظف '${existing.LastName} ${existing.Name}' (رقم: ${id}) بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return { message: "Employee deleted successfully." };
  }

  static async uploadProfileImage(employeeId, file, requestingUser) {
    const employee = await this.getById(employeeId, requestingUser);

    if (!file) {
      throw ApiError.badRequest("No image provided.");
    }

    const relativePath = `/uploads/employee_images/${employeeId}/${file.filename}`;

    await prisma.employees.update({
      where: { Id: employeeId },
      data: { ProfileImagePath: relativePath },
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تحديث الصورة الشخصية",
      description: `تم تحديث الصورة الشخصية للموظف '${employee.LastName} ${employee.Name}' بواسطة '${requestingUser.userName}'.`,
      usersId: requestingUser.id,
      employeesId: employeeId,
      ipAddress: requestingUser.ipAddress,
    });

    CacheService.invalidateEmployeeEcosystem();
    return { ProfileImagePath: relativePath };
  }
}

module.exports = EmployeesService;
