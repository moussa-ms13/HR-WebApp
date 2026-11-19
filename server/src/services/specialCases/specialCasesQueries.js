// ============================================================
// Special Cases Queries — Paginated listing & per-employee reads
// ============================================================
const prisma = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
  buildDirectorateCondition,
} = require("../../utils/queryBuilder");
const {
  getLifecycleCondition,
  getYearCondition,
  getDistinctYears,
  assertProvinceAccess,
} = require("./specialCasesHelpers");

async function getAllSpecialCases(
  requestingUser,
  page = 1,
  limit = 25,
  search = "",
  province = "",
  directorate = "",
  statusFilter = "temporary_active",
  caseType = "",
  year = "",
  sortBy = "Id",
  sortOrder = "desc"
) {
  const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

  const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
  if (isForbidden) {
    return {
      data: [],
      meta: {
        total: 0,
        page: safePage,
        limit: safeLimit,
        totalPages: 0,
        counts: { temporary_active: 0, permanent_exit: 0, archived: 0, all: 0 },
        years: [],
      },
    };
  }

  const dirCondition = buildDirectorateCondition(directorate);
  const employeeFilter = {
    Province: provinceFilter,
    ...(dirCondition ? { AND: [dirCondition] } : {}),
  };

  const baseWhere = {
    Employee: employeeFilter,
    ...(caseType && String(caseType).trim() ? { CaseType: String(caseType).trim() } : {}),
  };

  const tokenSearch = buildTokenizedSearch(search, (token) => [
    { Employee: { LastName: { contains: token } } },
    { Employee: { Name: { contains: token } } },
    { Employee: { NIN: { contains: token } } },
    { CaseType: { contains: token } },
    { Destination: { contains: token } },
    { ReferenceDoc: { contains: token } },
    { Employee: { JobTitle: { RankName: { contains: token } } } },
  ]);
  if (tokenSearch) {
    baseWhere.AND = [...(baseWhere.AND || []), ...tokenSearch.AND];
  }

  const yearCondition = getYearCondition(year);
  if (yearCondition) {
    baseWhere.AND = [...(baseWhere.AND || []), yearCondition];
  }

  const buildWhereForStatus = (status) => {
    const cond = getLifecycleCondition(status);
    if (!cond) return baseWhere;
    return { ...baseWhere, AND: [...(baseWhere.AND || []), cond] };
  };

  const currentYear = new Date().getFullYear();
  const effectiveStatus =
    statusFilter === "temporary_active" && year && Number(year) < currentYear
      ? "all"
      : statusFilter;

  const whereClause = buildWhereForStatus(effectiveStatus);

  let orderBy = { Id: "desc" };
  const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
  if (sortBy === "Employee" || sortBy === "employee" || sortBy === "Name") {
    orderBy = { Employee: { LastName: safeOrder } };
  } else if (sortBy === "CaseType" || sortBy === "caseType") {
    orderBy = { CaseType: safeOrder };
  } else if (sortBy === "Destination" || sortBy === "destination") {
    orderBy = { Destination: safeOrder };
  } else if (sortBy === "ReferenceDoc" || sortBy === "referenceDoc") {
    orderBy = { ReferenceDoc: safeOrder };
  } else if (sortBy === "StartDate" || sortBy === "startDate") {
    orderBy = { StartDate: safeOrder };
  } else if (sortBy === "Status" || sortBy === "status" || sortBy === "IsActive") {
    orderBy = { IsActive: safeOrder };
  } else if (sortBy === "Id" || sortBy === "id") {
    orderBy = { Id: safeOrder };
  }

  const isStandardTab = ["temporary_active", "permanent_exit", "archived", "all"].includes(effectiveStatus);

  const [cases, tempActiveCount, permExitCount, archivedCount, allCount, customTotal, years] =
    await Promise.all([
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
        orderBy,
      }),
      prisma.specialCases.count({ where: buildWhereForStatus("temporary_active") }),
      prisma.specialCases.count({ where: buildWhereForStatus("permanent_exit") }),
      prisma.specialCases.count({ where: buildWhereForStatus("archived") }),
      prisma.specialCases.count({ where: buildWhereForStatus("all") }),
      isStandardTab ? Promise.resolve(null) : prisma.specialCases.count({ where: whereClause }),
      getDistinctYears(),
    ]);

  const counts = {
    temporary_active: tempActiveCount,
    permanent_exit: permExitCount,
    archived: archivedCount,
    all: allCount,
  };
  const total = isStandardTab ? counts[effectiveStatus] : customTotal;

  return {
    data: cases,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      counts,
      years,
    },
  };
}

async function getSpecialCasesByEmployee(employeeId, requestingUser) {
  const employee = await prisma.employees.findUnique({
    where: { Id: employeeId },
    select: { Id: true, Province: true },
  });
  if (!employee) throw ApiError.notFound(`Employee ${employeeId} not found.`);
  assertProvinceAccess(employee.Province, requestingUser);

  return prisma.specialCases.findMany({
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
}

module.exports = { getAllSpecialCases, getSpecialCasesByEmployee };
