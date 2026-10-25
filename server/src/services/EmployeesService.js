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
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
} = require("../utils/queryBuilder");
const {
  EMPLOYEE_LIST_SELECT,
  EMPLOYEE_SEARCH_SELECT,
  EMPLOYEE_DETAIL_SELECT,
  EMPLOYEE_SUMMARY_SELECT,
  SORT_MAPPING,
  normalizeFrenchNames,
  computeProfileCompleteness,
  validateEmployeeCreation,
} = require("./employees/employeeHelpers");

const getJobTitlesMap = async () => {
  let map = CacheService.get("all_job_titles_map");
  if (!map) {
    const titles = await prisma.jobTitles.findMany({
      select: { Id: true, RankName: true },
    });
    map = {};
    for (const t of titles) {
      map[t.Id] = t.RankName;
    }
    CacheService.set("all_job_titles_map", map, 3600);
  }
  return map;
};

class EmployeesService {
  /**
   * Fetch paginated and filtered employees based on geographic RBAC.
   */
  static async getAll(
    requestingUser,
    page = 1,
    limit = 25,
    search = "",
    province = "",
    directorate = "",
    fileStatus = "",
    category = "",
    sortBy = "Id",
    sortOrder = "desc",
    status = ""
  ) {
    let statusFilter = (typeof status === "string" ? status : "").trim();
    const filters = (typeof page === "object" && page !== null) ? page : {};
    if (typeof page === "object" && page !== null) {
      const opts = page;
      page = opts.page;
      limit = opts.limit;
      search = opts.search;
      province = opts.province;
      directorate = opts.directorate;
      fileStatus = opts.fileStatus;
      category = opts.category;
      sortBy = opts.sortBy || opts.sort;
      sortOrder = opts.sortOrder || opts.order;
      statusFilter = (opts.status || opts.employeeStatus || opts.EmployeeStatus || status || "").trim();
    }

    const hasSearch = Boolean(
      (typeof search === "string" && search.trim().length > 0) ||
      (filters && filters.search && String(filters.search).trim().length > 0)
    );

    const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

    // Base Geographic Filter via queryBuilder
    const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
    if (isForbidden) {
      return {
        data: [],
        meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0, totalCompletedFiles: 0 },
      };
    }

    let whereClause = { Province: provinceFilter };

    // Directorate Filter (الجهة / المصلحة)
    if (directorate && String(directorate).trim()) {
      whereClause.Directorate = String(directorate).trim();
    }

    // Category Filter (فئة / رتبة / حالة)
    if (category && String(category).trim()) {
      const trimmedCat = String(category).trim();
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { JobTitle: { EmploymentCategory: trimmedCat } },
            { JobTitle: { CategoryLevel: trimmedCat } },
            { JobTitle: { RankName: trimmedCat } },
            { EmployeeStatus: trimmedCat },
          ],
        },
      ];
    }

    // File Status Filter (اكتمال الملف)
    if (fileStatus === "complete") {
      whereClause.IsProfileComplete = true;
    } else if (fileStatus === "incomplete") {
      whereClause.IsProfileComplete = false;
    }

    // Employee Status Filter (الوضعية القانونية الأساسية: مرسم / متربص)
    if (statusFilter) {
      const normalizedStatus = (statusFilter === "مثبت" || statusFilter === "نشط") ? "مرسم" : statusFilter;
      whereClause.EmployeeStatus = normalizedStatus;
    } else if (category && ["مرسم", "متربص"].includes(String(category).trim())) {
      whereClause.EmployeeStatus = String(category).trim();
    }

    // Exclude employees having an active exit special case only when browsing without a search term
    let excludedEmployeeIds = null;
    if (!hasSearch) {
      const activeExitCases = await prisma.specialCases.findMany({
        where: {
          IsActive: true,
          CaseType: { in: ["نقل", "تحويل", "استقالة", "تقاعد"] },
        },
        select: { EmployeesId: true },
      });
      excludedEmployeeIds = activeExitCases.map((c) => c.EmployeesId).filter(Boolean);
      if (excludedEmployeeIds.length > 0) {
        whereClause.Id = { notIn: excludedEmployeeIds };
      }
    }

    // ─── Typed Search Parser ──────────────────────────────────
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
      const isNumeric = /^\d+$/.test(trimmedSearch);
      const searchOrConditions = [];

      const tokenSearch = buildTokenizedSearch(trimmedSearch, (token) => [
        { Name: { contains: token } },
        { LastName: { contains: token } },
        { NameFr: { contains: token } },
        { LastNameFr: { contains: token } },
        { JobTitle: { RankName: { contains: token } } },
        { AssignedPosition: { contains: token } },
      ]);
      if (tokenSearch) {
        searchOrConditions.push(tokenSearch);
      }

      searchOrConditions.push({ NIN: { contains: trimmedSearch } });
      if (isNumeric) {
        searchOrConditions.push({ Id: parseInt(trimmedSearch, 10) });
      }

      whereClause.AND = [...(whereClause.AND || []), { OR: searchOrConditions }];
    }

    // Strict Schema-based Sort Mapping
    const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
    let orderBy = { Id: "desc" };

    if (sortBy && SORT_MAPPING[sortBy]) {
      const field = SORT_MAPPING[sortBy];
      orderBy = { [field]: safeOrder };
    } else if (sortBy === "jobTitle" || sortBy === "RankName" || sortBy === "rank") {
      orderBy = { JobTitle: { RankName: safeOrder } };
    }

    // ─── Execute Queries with Count Caching ───────────────────
    const countCacheKey = `emp_count_${JSON.stringify({
      prov: whereClause.Province,
      dir: directorate || "",
      cat: category || "",
      fs: fileStatus || "",
      st: statusFilter || "",
      s: trimmedSearch || "",
    })}`;

    const cachedCounts = CacheService.get(countCacheKey);

    const employeesPromise = prisma.employees.findMany({
      where: whereClause,
      select: EMPLOYEE_LIST_SELECT,
      skip,
      take: safeLimit,
      orderBy,
    });

    let total, totalCompletedFiles, employees;

    if (cachedCounts) {
      employees = await employeesPromise;
      total = cachedCounts.total;
      totalCompletedFiles = cachedCounts.totalCompletedFiles;
    } else {
      let countCompletedPromise;
      if (fileStatus === "complete") {
        countCompletedPromise = Promise.resolve(null);
      } else if (fileStatus === "incomplete") {
        countCompletedPromise = Promise.resolve(0);
      } else {
        const leanCompletedWhere = { IsProfileComplete: true };
        if (whereClause.Province) leanCompletedWhere.Province = whereClause.Province;
        if (whereClause.EmployeeStatus) leanCompletedWhere.EmployeeStatus = whereClause.EmployeeStatus;
        if (excludedEmployeeIds && excludedEmployeeIds.length > 0) {
          leanCompletedWhere.Id = { notIn: excludedEmployeeIds };
        }
        countCompletedPromise = prisma.employees.count({ where: leanCompletedWhere });
      }

      const [empsResult, totalResult, completedResult] = await Promise.all([
        employeesPromise,
        prisma.employees.count({ where: whereClause }),
        countCompletedPromise,
      ]);

      employees = empsResult;
      total = totalResult;
      totalCompletedFiles = completedResult === null ? total : (completedResult ?? 0);

      CacheService.set(countCacheKey, { total, totalCompletedFiles }, 60);
    }

    const jobMap = await getJobTitlesMap();
    const formattedEmployees = employees.map((emp) => ({
      ...emp,
      JobTitle: emp.JobTitleId ? { Id: emp.JobTitleId, RankName: jobMap[emp.JobTitleId] || "" } : null,
      SpecialCases: [],
    }));

    return {
      data: formattedEmployees,
      meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit), totalCompletedFiles },
    };
  }

  /**
   * Lightweight autocomplete lookup for search dropdowns.
   * Strict DTO — no relations/files/career history, hard take: 15.
   */
  static async search(requestingUser, query = "", province = "", directorate = "") {
    const whereClause = {};

    // Geographic RBAC
    if (requestingUser?.role !== ROLES.ADMIN) {
      const allowedProvinces = getAllowedProvinces(requestingUser?.permissions || {});
      if (!allowedProvinces || allowedProvinces.length === 0) return [];
      whereClause.Province = { in: allowedProvinces };
    }

    if (province) {
      const trimmedProv = String(province).trim();
      if (requestingUser?.role === ROLES.ADMIN || (whereClause.Province?.in || []).includes(trimmedProv)) {
        whereClause.Province = trimmedProv;
      }
    }
    if (directorate) {
      whereClause.Directorate = directorate;
    }

    const term = (query || "").trim();
    if (term) {
      const terms = term.split(/\s+/).filter(Boolean);
      const orConditions = [];

      if (terms.length > 0) {
        orConditions.push({
          AND: terms.map((t) => ({
            OR: [
              { Name: { contains: t } },
              { LastName: { contains: t } },
              { NameFr: { contains: t } },
              { LastNameFr: { contains: t } },
              { JobTitle: { RankName: { contains: t } } },
              { AssignedPosition: { contains: t } },
            ],
          })),
        });
      }

      orConditions.push({ NIN: { startsWith: term } });
      const numericId = Number(term);
      if (!Number.isNaN(numericId) && /^\d+$/.test(term)) {
        orConditions.push({ Id: numericId });
      }

      whereClause.AND = [...(whereClause.AND || []), { OR: orConditions }];
    }

    return prisma.employees.findMany({
      where: whereClause,
      select: EMPLOYEE_SEARCH_SELECT,
      take: 15,
      orderBy: [{ LastName: "asc" }, { Name: "asc" }],
    });
  }

  /**
   * Detailed employee profile with indexed relations
   */
  static async getById(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: EMPLOYEE_DETAIL_SELECT,
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    // RBAC Check
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

  /**
   * Lightweight profile summary for the employee header.
   */
  static async getSummary(id, requestingUser) {
    const employee = await prisma.employees.findUnique({
      where: { Id: id },
      select: EMPLOYEE_SUMMARY_SELECT,
    });

    if (!employee) {
      throw ApiError.notFound(`Employee with ID ${id} not found.`);
    }

    // RBAC Check
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

  // ──────────────────────────────────────────────
  // CREATE — Add a new employee
  // ──────────────────────────────────────────────
  static async create(data, requestingUser) {
    validateEmployeeCreation(data);

    // Geographic RBAC Check for Creation
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
        ProfileImagePath: data.ProfileImagePath || "",
        Province: data.Province,
        Directorate: data.Directorate || "",
        AddedDate: now,
        UpdateDate: now,
        UsersId: requestingUser.userName,
        NIN: data.NIN || "",
        SIS: data.SIS || "",
        AssignedPosition: data.AssignedPosition || "",
        ConfirmationDate: data.ConfirmationDate ? new Date(data.ConfirmationDate) : null,
        Degree: Number(data.Degree) || 0,
        EmployeeStatus: data.EmployeeStatus || "مرسم",
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : defaultDate,
        JobTitleId: Number(data.JobTitleId) || 0,
        LastDegreeDate: data.LastDegreeDate ? new Date(data.LastDegreeDate) : defaultDate,
        PositionDate: data.PositionDate ? new Date(data.PositionDate) : null,
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

  // ──────────────────────────────────────────────
  // UPDATE — Edit existing employee
  // ──────────────────────────────────────────────
  static async update(id, data, requestingUser) {
    const existing = await prisma.employees.findUnique({ where: { Id: id } });
    if (!existing) throw ApiError.notFound(`Employee ${id} not found.`);

    // Geographic RBAC Check: Ensure user has access to current province AND new province
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
        Province: data.Province ?? existing.Province,
        Directorate: data.Directorate ?? existing.Directorate,
        UpdateDate: new Date(),
        UsersId: requestingUser.userName,
        NIN: data.NIN ?? existing.NIN,
        SIS: data.SIS ?? existing.SIS,
        AssignedPosition: data.AssignedPosition ?? existing.AssignedPosition,
        ConfirmationDate: data.ConfirmationDate ? new Date(data.ConfirmationDate) : existing.ConfirmationDate,
        Degree: data.Degree !== undefined ? Number(data.Degree) : existing.Degree,
        EmployeeStatus: data.EmployeeStatus ?? existing.EmployeeStatus,
        InstallationDate: data.InstallationDate ? new Date(data.InstallationDate) : existing.InstallationDate,
        LastDegreeDate: data.LastDegreeDate ? new Date(data.LastDegreeDate) : existing.LastDegreeDate,
        JobTitleId: data.JobTitleId !== undefined ? Number(data.JobTitleId) : existing.JobTitleId,
        PositionDate: data.PositionDate ? new Date(data.PositionDate) : existing.PositionDate,
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

  // ──────────────────────────────────────────────
  // DELETE — Remove employee (with manual cascade)
  // ──────────────────────────────────────────────
  static async delete(id, requestingUser) {
    const existing = await prisma.employees.findUnique({ where: { Id: id } });
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

  /**
   * Updates an employee's ProfileImagePath
   */
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
