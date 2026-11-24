// ============================================================
// Employee Query & Search Builder (extracted from EmployeesService)
// ============================================================
const prisma = require("../../config/database");
const CacheService = require("../CacheService");
const { ROLES, getAllowedProvinces } = require("../../config/constants");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
  buildDirectorateCondition,
} = require("../../utils/queryBuilder");
const {
  EMPLOYEE_LIST_SELECT,
  EMPLOYEE_SEARCH_SELECT,
  SORT_MAPPING,
} = require("./employeeHelpers");

const EXIT_CASE_TYPES = ["نقل", "تحويل", "استقالة", "تقاعد"];

function findMatchingJobTitleIds(jobMap, token) {
  if (!token || !jobMap) return [];
  const lower = String(token).toLowerCase();
  const ids = [];
  for (const [idStr, entry] of Object.entries(jobMap)) {
    const rankName = typeof entry === "string" ? entry : (entry?.RankName || "");
    const empCat = typeof entry === "object" && entry ? (entry.EmploymentCategory || "") : "";
    if (rankName.toLowerCase().includes(lower) || empCat.toLowerCase().includes(lower)) {
      ids.push(Number(idStr));
    }
  }
  return ids;
}

async function getJobTitlesMap() {
  let map = CacheService.get("all_job_titles_map");
  if (!map) {
    const titles = await prisma.jobTitles.findMany({
      select: { Id: true, RankName: true, EmploymentCategory: true },
    });
    map = {};
    for (const t of titles) {
      map[t.Id] = {
        RankName: t.RankName || "",
        EmploymentCategory: t.EmploymentCategory || "",
      };
    }
    CacheService.set("all_job_titles_map", map, 3600);
  }
  return map;
}

function normalizeGetAllArgs(args) {
  let [
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
    status = "",
  ] = args;

  let statusFilter = (typeof status === "string" ? status : "").trim();
  const filters = typeof page === "object" && page !== null ? page : {};
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

  return {
    requestingUser,
    page,
    limit,
    search: (search || filters.search || "").toString().trim(),
    province: province || "",
    directorate: directorate || "",
    fileStatus: fileStatus || "",
    category: category || "",
    sortBy: sortBy || "Id",
    sortOrder: sortOrder || "desc",
    statusFilter,
  };
}

async function listEmployees(rawArgs) {
  const {
    requestingUser,
    page,
    limit,
    search: trimmedSearch,
    province,
    directorate,
    fileStatus,
    category,
    sortBy,
    sortOrder,
    statusFilter,
  } = normalizeGetAllArgs(rawArgs);

  const hasSearch = trimmedSearch.length > 0;
  const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

  const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
  if (isForbidden) {
    return {
      data: [],
      meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0, totalCompletedFiles: 0 },
    };
  }

  const whereClause = { Province: provinceFilter };
  const andConditions = [];

  const dirCondition = buildDirectorateCondition(directorate);
  if (dirCondition) andConditions.push(dirCondition);

  if (category && String(category).trim()) {
    const trimmedCat = String(category).trim();
    andConditions.push({
      OR: [
        { JobTitle: { EmploymentCategory: trimmedCat } },
        { JobTitle: { CategoryLevel: trimmedCat } },
        { JobTitle: { RankName: trimmedCat } },
        { EmployeeStatus: trimmedCat },
      ],
    });
  }

  if (fileStatus === "complete") {
    whereClause.IsProfileComplete = true;
  } else if (fileStatus === "incomplete") {
    whereClause.IsProfileComplete = false;
  } else if (["مرسم", "متربص", "متعاقد"].includes(String(fileStatus || "").trim())) {
    whereClause.EmployeeStatus = String(fileStatus).trim();
  }

  if (statusFilter) {
    whereClause.EmployeeStatus =
      statusFilter === "مثبت" || statusFilter === "نشط" ? "مرسم" : statusFilter;
  } else if (category && ["مرسم", "متربص", "متعاقد"].includes(String(category).trim())) {
    whereClause.EmployeeStatus = String(category).trim();
  }

  // Native relational exclusion (avoids SQL Server 2100-parameter limit on large NOT IN arrays)
  const excludeExitCondition = {
    SpecialCases: {
      none: {
        IsActive: true,
        CaseType: { in: EXIT_CASE_TYPES },
      },
    },
  };
  if (!hasSearch) {
    andConditions.push(excludeExitCondition);
  }

  const jobMap = await getJobTitlesMap();

  if (hasSearch) {
    const isNumeric = /^\d+$/.test(trimmedSearch);
    const searchOrConditions = [];

    const tokenSearch = buildTokenizedSearch(trimmedSearch, (token) => {
      const matchedJobIds = findMatchingJobTitleIds(jobMap, token);
      return [
        { Name: { contains: token } },
        { LastName: { contains: token } },
        { NameFr: { contains: token } },
        { LastNameFr: { contains: token } },
        ...(matchedJobIds.length > 0 ? [{ JobTitleId: { in: matchedJobIds } }] : []),
        { AssignedPosition: { contains: token } },
      ];
    });
    if (tokenSearch) searchOrConditions.push(tokenSearch);

    searchOrConditions.push({ NIN: { contains: trimmedSearch } });
    if (isNumeric) searchOrConditions.push({ Id: parseInt(trimmedSearch, 10) });

    andConditions.push({ OR: searchOrConditions });
  }

  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
  let orderBy = { Id: "desc" };
  if (sortBy && SORT_MAPPING[sortBy]) {
    orderBy = { [SORT_MAPPING[sortBy]]: safeOrder };
  } else if (sortBy === "jobTitle" || sortBy === "RankName" || sortBy === "rank") {
    orderBy = { JobTitle: { RankName: safeOrder } };
  }

  // Only cache counts when NOT searching (prevents arbitrary search-string cache flooding)
  const countCacheKey = !hasSearch
    ? `emp_count_${JSON.stringify({
        prov: whereClause.Province,
        dir: directorate || "",
        cat: category || "",
        fs: fileStatus || "",
        st: statusFilter || "",
      })}`
    : null;

  const cachedCounts = countCacheKey ? CacheService.get(countCacheKey) : null;

  const employeesPromise = prisma.employees.findMany({
    where: whereClause,
    select: EMPLOYEE_LIST_SELECT,
    skip,
    take: safeLimit,
    orderBy,
  });

  let total;
  let totalCompletedFiles;
  let employees;

  if (cachedCounts) {
    employees = await employeesPromise;
    total = cachedCounts.total;
    totalCompletedFiles = cachedCounts.totalCompletedFiles;
  } else {
    let countCompletedPromise;
    if (hasSearch) {
      // Skip unnecessary 3rd DB count query during live search
      countCompletedPromise = Promise.resolve(0);
    } else if (fileStatus === "complete") {
      countCompletedPromise = Promise.resolve(null);
    } else if (fileStatus === "incomplete") {
      countCompletedPromise = Promise.resolve(0);
    } else {
      const leanCompletedWhere = { IsProfileComplete: true };
      if (whereClause.Province) leanCompletedWhere.Province = whereClause.Province;
      if (whereClause.EmployeeStatus) leanCompletedWhere.EmployeeStatus = whereClause.EmployeeStatus;
      leanCompletedWhere.SpecialCases = excludeExitCondition.SpecialCases;
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

    if (countCacheKey) {
      CacheService.set(countCacheKey, { total, totalCompletedFiles }, 60);
    }
  }

  const formattedEmployees = employees.map((emp) => {
    const jtEntry = emp.JobTitleId ? jobMap[emp.JobTitleId] : null;
    const rankName = typeof jtEntry === "string" ? jtEntry : (jtEntry?.RankName || "");
    const empCategory = typeof jtEntry === "object" && jtEntry ? (jtEntry.EmploymentCategory || "") : "";
    return {
      ...emp,
      JobTitle: emp.JobTitleId
        ? { Id: emp.JobTitleId, RankName: rankName, EmploymentCategory: empCategory, Category: empCategory }
        : null,
      SpecialCases: [],
    };
  });

  return {
    data: formattedEmployees,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      totalCompletedFiles,
    },
  };
}

async function searchEmployees(requestingUser, query = "", province = "", directorate = "") {
  const whereClause = {};

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

  const dirCondition = buildDirectorateCondition(directorate);
  if (dirCondition) {
    whereClause.AND = [...(whereClause.AND || []), dirCondition];
  }

  const term = (query || "").trim();
  if (term) {
    const jobMap = await getJobTitlesMap();
    const terms = term.split(/\s+/).filter(Boolean);
    const orConditions = [];

    if (terms.length > 0) {
      orConditions.push({
        AND: terms.map((t) => {
          const matchedJobIds = findMatchingJobTitleIds(jobMap, t);
          return {
            OR: [
              { Name: { contains: t } },
              { LastName: { contains: t } },
              { NameFr: { contains: t } },
              { LastNameFr: { contains: t } },
              ...(matchedJobIds.length > 0 ? [{ JobTitleId: { in: matchedJobIds } }] : []),
              { AssignedPosition: { contains: t } },
            ],
          };
        }),
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

module.exports = {
  getJobTitlesMap,
  listEmployees,
  searchEmployees,
};
