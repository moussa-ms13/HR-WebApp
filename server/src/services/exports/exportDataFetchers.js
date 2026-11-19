// ============================================================
// Export Report Data Fetchers (extracted from ExportService)
// Lean Prisma queries with automatic count deduplication on full export
// ============================================================
const prisma = require("../../config/database");
const {
  resolveGeographicFilter,
  buildTokenizedSearch,
  buildDirectorateCondition,
} = require("../../utils/queryBuilder");
const {
  formatNominalRows,
  formatLeavesRows,
  formatSpecialCasesRows,
  formatDegreesExperienceRows,
  formatHighPositionsRows,
} = require("./exportFormatters");

async function fetchWithOptionalCount(countFn, rowsFn, limit) {
  if (limit) {
    const [totalCount, items] = await Promise.all([countFn(), rowsFn()]);
    return { totalCount, items };
  }
  const items = await rowsFn();
  return { totalCount: items.length, items };
}

async function fetchNominalReport(baseWhere, filters, limit) {
  const where = { ...baseWhere };

  if (filters.status && String(filters.status).trim()) {
    const st = String(filters.status).trim();
    if (st === "متعاقد") {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { EmployeeStatus: "متعاقد" },
            { JobTitle: { EmploymentCategory: { contains: "متعاقد" } } },
          ],
        },
      ];
    } else if (st === "مرسم" || st === "في الخدمة") {
      where.EmployeeStatus = { in: ["مرسم", "مثبت", "نشط"] };
    } else {
      where.EmployeeStatus = st;
    }
  }
  if (filters.gender && String(filters.gender).trim()) {
    where.Gender = String(filters.gender).trim();
  }
  if (filters.rankId && Number(filters.rankId)) {
    where.JobTitleId = Number(filters.rankId);
  }
  if (filters.employmentCategory && String(filters.employmentCategory).trim()) {
    where.JobTitle = { EmploymentCategory: String(filters.employmentCategory).trim() };
  }

  if (filters.search && String(filters.search).trim()) {
    const tokenSearch = buildTokenizedSearch(filters.search, (token) => [
      { Name: { contains: token } },
      { LastName: { contains: token } },
      { NameFr: { contains: token } },
      { LastNameFr: { contains: token } },
      { NIN: { contains: token } },
      { JobTitle: { RankName: { contains: token } } },
      { AssignedPosition: { contains: token } },
    ]);
    if (tokenSearch) {
      where.AND = [...(where.AND || []), ...tokenSearch.AND];
    }
  }

  const { totalCount, items } = await fetchWithOptionalCount(
    () => prisma.employees.count({ where }),
    () =>
      prisma.employees.findMany({
        where,
        select: {
          Id: true,
          Name: true,
          LastName: true,
          NameFr: true,
          LastNameFr: true,
          NIN: true,
          DateOfBirth: true,
          PlaceOfBirth: true,
          Gender: true,
          MaritalStatus: true,
          Province: true,
          Directorate: true,
          InstallationDate: true,
          Degree: true,
          LastDegreeDate: true,
          EmployeeStatus: true,
          AssignedPosition: true,
          PhoneNumber: true,
          JobTitle: { select: { Id: true, RankName: true, EmploymentCategory: true } },
        },
        orderBy: [{ Province: "asc" }, { LastName: "asc" }, { Name: "asc" }],
        take: limit || undefined,
      }),
    limit
  );

  return { totalCount, rows: formatNominalRows(items) };
}

async function fetchLeavesReport(baseWhere, filters, limit) {
  const now = new Date();
  const whereState = { Employee: { ...baseWhere } };

  if (filters.leaveType && String(filters.leaveType).trim()) {
    whereState.StateTypeOrReason = String(filters.leaveType).trim();
  }
  if (filters.resumeStatus === "ساري المفعول") {
    whereState.IsResumed = false;
    whereState.EndDate = { gte: now };
  } else if (filters.resumeStatus === "لم يستأنف (متأخر)") {
    whereState.IsResumed = false;
    whereState.EndDate = { lt: now };
  } else if (filters.resumeStatus === "تم الاستئناف") {
    whereState.IsResumed = true;
  }

  if (filters.dateFrom) whereState.StartDate = { gte: new Date(filters.dateFrom) };
  if (filters.dateTo) whereState.EndDate = { ...whereState.EndDate, lte: new Date(filters.dateTo) };

  const { totalCount, items } = await fetchWithOptionalCount(
    () => prisma.employeeStates.count({ where: whereState }),
    () =>
      prisma.employeeStates.findMany({
        where: whereState,
        select: {
          Id: true,
          StateTypeOrReason: true,
          DaysCount: true,
          StartDate: true,
          EndDate: true,
          IsResumed: true,
          ActualReturnDate: true,
          ResumptionDate: true,
          Notes: true,
          Employee: {
            select: {
              Id: true,
              Name: true,
              LastName: true,
              NameFr: true,
              LastNameFr: true,
              Province: true,
              Directorate: true,
              JobTitle: { select: { RankName: true } },
            },
          },
        },
        orderBy: [{ StartDate: "desc" }, { Id: "desc" }],
        take: limit || undefined,
      }),
    limit
  );

  return { totalCount, rows: formatLeavesRows(items, now) };
}

async function fetchSpecialCasesReport(baseWhere, filters, limit) {
  const whereCase = { Employee: { ...baseWhere } };

  if (filters.caseType && String(filters.caseType).trim()) {
    whereCase.CaseType = String(filters.caseType).trim();
  }
  if (filters.activeStatus === "ساري المفعول") whereCase.IsActive = true;
  else if (filters.activeStatus === "منتهي") whereCase.IsActive = false;

  if (filters.dateFrom) whereCase.StartDate = { gte: new Date(filters.dateFrom) };
  if (filters.dateTo) whereCase.EndDate = { lte: new Date(filters.dateTo) };

  const { totalCount, items } = await fetchWithOptionalCount(
    () => prisma.specialCases.count({ where: whereCase }),
    () =>
      prisma.specialCases.findMany({
        where: whereCase,
        select: {
          Id: true,
          CaseType: true,
          StartDate: true,
          EndDate: true,
          Destination: true,
          ReferenceDoc: true,
          IsActive: true,
          Employee: {
            select: {
              Id: true,
              Name: true,
              LastName: true,
              NameFr: true,
              LastNameFr: true,
              Province: true,
              Directorate: true,
              JobTitle: { select: { RankName: true } },
            },
          },
        },
        orderBy: [{ StartDate: "desc" }, { Id: "desc" }],
        take: limit || undefined,
      }),
    limit
  );

  return { totalCount, rows: formatSpecialCasesRows(items) };
}

async function fetchDegreesExperienceReport(baseWhere, filters, limit) {
  const where = { ...baseWhere };

  if (filters.categoryMode === "الدرجات (1-12) للمرسمين") {
    where.JobTitle = { EmploymentCategory: { not: { contains: "متعاقد" } } };
  } else if (filters.categoryMode === "تعويض الخبرة (1.4%) للمتعاقدين") {
    where.JobTitle = { EmploymentCategory: { contains: "متعاقد" } };
  }

  const { totalCount, items } = await fetchWithOptionalCount(
    () => prisma.employees.count({ where }),
    () =>
      prisma.employees.findMany({
        where,
        select: {
          Id: true,
          Name: true,
          LastName: true,
          NameFr: true,
          LastNameFr: true,
          Province: true,
          Directorate: true,
          Degree: true,
          LastDegreeDate: true,
          JobTitle: { select: { RankName: true, EmploymentCategory: true } },
        },
        orderBy: [{ Province: "asc" }, { Degree: "desc" }, { LastName: "asc" }],
        take: limit || undefined,
      }),
    limit
  );

  return { totalCount, rows: formatDegreesExperienceRows(items) };
}

async function fetchHighPositionsReport(baseWhere, limit) {
  const where = {
    ...baseWhere,
    OR: [
      { PositionHistories: { some: { EndDate: null } } },
      { AssignedPosition: { notIn: ["", "بدون منصب", "لا يوجد"] } },
    ],
  };

  const { totalCount, items } = await fetchWithOptionalCount(
    () => prisma.employees.count({ where }),
    () =>
      prisma.employees.findMany({
        where,
        select: {
          Id: true,
          Name: true,
          LastName: true,
          NameFr: true,
          LastNameFr: true,
          Province: true,
          Directorate: true,
          PositionDate: true,
          AssignedPosition: true,
          EmployeeStatus: true,
          JobTitle: { select: { RankName: true } },
          PositionHistories: {
            where: { EndDate: null },
            orderBy: { InstallDate: "desc" },
            take: 1,
            select: { PositionName: true, InstallDate: true, Reference: true },
          },
        },
        orderBy: [{ Province: "asc" }, { LastName: "asc" }],
        take: limit || undefined,
      }),
    limit
  );

  return { totalCount, rows: formatHighPositionsRows(items) };
}

async function fetchReportData(reportType, filters = {}, requestingUser, limit = null) {
  const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, filters.province);
  if (isForbidden) return { totalCount: 0, rows: [] };

  const baseWhere = { Province: provinceFilter };
  const dirCondition = buildDirectorateCondition(filters.directorate);
  if (dirCondition) {
    baseWhere.AND = [...(baseWhere.AND || []), dirCondition];
  }

  if (reportType === "nominal" || !reportType) return fetchNominalReport(baseWhere, filters, limit);
  if (reportType === "leaves") return fetchLeavesReport(baseWhere, filters, limit);
  if (reportType === "special-cases") return fetchSpecialCasesReport(baseWhere, filters, limit);
  if (reportType === "degrees-experience") return fetchDegreesExperienceReport(baseWhere, filters, limit);
  if (reportType === "high-positions") return fetchHighPositionsReport(baseWhere, limit);

  return { totalCount: 0, rows: [] };
}

module.exports = { fetchReportData };
