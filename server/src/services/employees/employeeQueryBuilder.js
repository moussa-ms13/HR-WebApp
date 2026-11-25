// ============================================================
// Employee Query & Search Builder (extracted from EmployeesService)
// Uses a 1.2 MB in-memory search index (auto-invalidated on every write)
// for sub-2ms search & filtering even under heavy SQL Server RAM pressure.
// ============================================================
const prisma = require("../../config/database");
const CacheService = require("../CacheService");
const { ROLES, getAllowedProvinces } = require("../../config/constants");
const {
  sanitizePagination,
  resolveGeographicFilter,
  buildDirectorateFilter,
} = require("../../utils/queryBuilder");
const {
  EMPLOYEE_LIST_SELECT,
  SORT_MAPPING,
} = require("./employeeHelpers");

const EXIT_CASE_TYPES = ["نقل", "تحويل", "استقالة", "تقاعد"];
const DIRECTORY_CACHE_KEY = "emp_directory_index";

let directoryLoadPromise = null;

function normalizeSearchText(str) {
  return String(str || "")
    .replace(/\u0640/g, "") // strip Arabic tatweel/kashida
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

async function getJobTitlesMap() {
  let map = CacheService.get("all_job_titles_map");
  if (!map) {
    const titles = await prisma.jobTitles.findMany({
      select: { Id: true, RankName: true, EmploymentCategory: true, CategoryLevel: true },
    });
    map = {};
    for (const t of titles) {
      map[t.Id] = {
        RankName: t.RankName || "",
        EmploymentCategory: t.EmploymentCategory || "",
        CategoryLevel: t.CategoryLevel || "",
      };
    }
    CacheService.set("all_job_titles_map", map, 3600);
  }
  return map;
}

/**
 * Loads and caches the lean directory index (~1.2 MB for ~1,724 employees).
 * Invalidated immediately on every Employee / SpecialCase / JobTitle / Career mutation
 * via CacheService.invalidateEmployeeEcosystem().
 */
async function getEmployeeDirectoryIndex() {
  const cached = CacheService.get(DIRECTORY_CACHE_KEY);
  if (cached) return cached;

  if (directoryLoadPromise) {
    return directoryLoadPromise;
  }

  directoryLoadPromise = (async () => {
    try {
      const [employees, exitCases, jobMap] = await Promise.all([
        prisma.employees.findMany({
          select: {
            ...EMPLOYEE_LIST_SELECT,
            NIN: true,
            InstallationDate: true,
            Degree: true,
          },
          orderBy: { Id: "desc" },
        }),
        prisma.specialCases.findMany({
          where: {
            IsActive: true,
            CaseType: { in: EXIT_CASE_TYPES },
          },
          select: { EmployeesId: true },
        }),
        getJobTitlesMap(),
      ]);

      const exitEmpIds = new Set(exitCases.map((c) => c.EmployeesId));

      const indexed = employees.map((emp) => {
        const jtEntry = emp.JobTitleId ? jobMap[emp.JobTitleId] : null;
        const rankName = typeof jtEntry === "string" ? jtEntry : (jtEntry?.RankName || "");
        const empCategory = typeof jtEntry === "object" && jtEntry ? (jtEntry.EmploymentCategory || "") : "";
        const catLevel = typeof jtEntry === "object" && jtEntry ? (jtEntry.CategoryLevel || "") : "";

        const jobTitleDto = emp.JobTitleId
          ? {
              Id: emp.JobTitleId,
              RankName: rankName,
              EmploymentCategory: empCategory,
              Category: empCategory,
            }
          : null;

        // Exact EMPLOYEE_LIST_SELECT DTO returned to clients
        const listDto = {
          Id: emp.Id,
          Name: emp.Name,
          LastName: emp.LastName,
          LastNameFr: emp.LastNameFr,
          NameFr: emp.NameFr,
          Gender: emp.Gender,
          Province: emp.Province,
          Directorate: emp.Directorate,
          EmployeeStatus: emp.EmployeeStatus,
          AssignedPosition: emp.AssignedPosition,
          IsProfileComplete: emp.IsProfileComplete,
          ProfileImagePath: emp.ProfileImagePath,
          JobTitleId: emp.JobTitleId,
          CorpsType: emp.CorpsType,
          JobTitle: jobTitleDto,
          SpecialCases: [],
        };

        const searchBlob = normalizeSearchText(
          `${emp.LastName || ""} ${emp.Name || ""} ${emp.LastNameFr || ""} ${emp.NameFr || ""} ${rankName} ${emp.AssignedPosition || ""}`
        );

        return {
          Id: emp.Id,
          idStr: String(emp.Id),
          Province: emp.Province || "",
          Directorate: emp.Directorate || "",
          EmployeeStatus: emp.EmployeeStatus || "",
          IsProfileComplete: Boolean(emp.IsProfileComplete),
          NIN: emp.NIN || "",
          ninLower: String(emp.NIN || "").toLowerCase(),
          InstallationDate: emp.InstallationDate ? new Date(emp.InstallationDate).getTime() : 0,
          Degree: Number(emp.Degree) || 0,
          rankName,
          empCategory,
          catLevel,
          hasExit: exitEmpIds.has(emp.Id),
          searchBlob,
          listDto,
        };
      });

      CacheService.set(DIRECTORY_CACHE_KEY, indexed, 300);
      return indexed;
    } finally {
      directoryLoadPromise = null;
    }
  })();

  return directoryLoadPromise;
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

function matchesDirectorateFilter(empDir, dirFilter) {
  if (!dirFilter) return true;
  if (typeof dirFilter === "string") return empDir === dirFilter;
  if (Array.isArray(dirFilter.in)) return dirFilter.in.includes(empDir);
  return true;
}

function compareEntries(a, b, sortField, isAsc) {
  let va, vb;
  switch (sortField) {
    case "Id":
      va = a.Id;
      vb = b.Id;
      break;
    case "Degree":
      va = a.Degree;
      vb = b.Degree;
      break;
    case "InstallationDate":
      va = a.InstallationDate;
      vb = b.InstallationDate;
      break;
    case "IsProfileComplete":
      va = a.IsProfileComplete ? 1 : 0;
      vb = b.IsProfileComplete ? 1 : 0;
      break;
    case "RankName":
      va = a.rankName;
      vb = b.rankName;
      break;
    case "NIN":
      va = a.NIN;
      vb = b.NIN;
      break;
    default:
      va = a.listDto[sortField] ?? "";
      vb = b.listDto[sortField] ?? "";
      break;
  }

  let cmp = 0;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb), "ar");
  }
  return isAsc ? cmp : -cmp;
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

  const allowedProvSet =
    typeof provinceFilter === "string"
      ? new Set([provinceFilter])
      : new Set(provinceFilter?.in || []);

  const dirFilter = buildDirectorateFilter(directorate);
  const trimmedCat = category ? String(category).trim() : "";
  const trimmedFs = String(fileStatus || "").trim();

  let targetEmpStatus = "";
  if (["مرسم", "متربص", "متعاقد"].includes(trimmedFs)) {
    targetEmpStatus = trimmedFs;
  }
  if (statusFilter) {
    targetEmpStatus =
      statusFilter === "مثبت" || statusFilter === "نشط" ? "مرسم" : statusFilter;
  } else if (trimmedCat && ["مرسم", "متربص", "متعاقد"].includes(trimmedCat)) {
    targetEmpStatus = trimmedCat;
  }

  const normSearch = hasSearch ? normalizeSearchText(trimmedSearch) : "";
  const searchTokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
  const searchLower = trimmedSearch.toLowerCase();
  const numericId = /^\d+$/.test(trimmedSearch) ? parseInt(trimmedSearch, 10) : null;

  const index = await getEmployeeDirectoryIndex();

  const filtered = [];
  let totalCompletedFiles = 0;

  for (let i = 0; i < index.length; i++) {
    const item = index[i];

    // 1. Geographic RBAC & Province filter
    if (!allowedProvSet.has(item.Province)) continue;

    // 2. Exit-case exclusion when browsing (not searching)
    if (!hasSearch && item.hasExit) continue;

    // 3. Directorate / Workplace filter
    if (dirFilter && !matchesDirectorateFilter(item.Directorate, dirFilter)) continue;

    // 4. Category filter
    if (trimmedCat) {
      const catMatches =
        item.empCategory === trimmedCat ||
        item.catLevel === trimmedCat ||
        item.rankName === trimmedCat ||
        item.EmployeeStatus === trimmedCat;
      if (!catMatches) continue;
    }

    // 5. Status filter
    if (targetEmpStatus && item.EmployeeStatus !== targetEmpStatus) continue;

    // 6. Profile completeness filter
    if (trimmedFs === "complete" && !item.IsProfileComplete) continue;
    if (trimmedFs === "incomplete" && item.IsProfileComplete) continue;

    // 7. Arabic-normalized tokenized search + NIN + numeric Id
    if (hasSearch) {
      const tokensMatch =
        searchTokens.length > 0 &&
        searchTokens.every((tok) => item.searchBlob.includes(tok));
      const ninMatch = item.ninLower.includes(searchLower);
      const idMatch = numericId !== null && item.Id === numericId;
      if (!tokensMatch && !ninMatch && !idMatch) continue;
    }

    if (item.IsProfileComplete) totalCompletedFiles++;
    filtered.push(item);
  }

  // Sort (index is already pre-sorted by Id DESC, so default order requires ZERO sort!)
  const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
  const isAsc = safeOrder === "asc";
  let sortField = "Id";
  if (sortBy && SORT_MAPPING[sortBy]) {
    sortField = SORT_MAPPING[sortBy];
  } else if (sortBy === "jobTitle" || sortBy === "RankName" || sortBy === "rank") {
    sortField = "RankName";
  }

  if (sortField !== "Id" || isAsc) {
    filtered.sort((a, b) => compareEntries(a, b, sortField, isAsc));
  }

  const total = filtered.length;
  const pageItems = filtered.slice(skip, skip + safeLimit).map((item) => item.listDto);

  return {
    data: pageItems,
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
  let allowedProvSet = null;
  if (requestingUser?.role !== ROLES.ADMIN) {
    const allowedProvinces = getAllowedProvinces(requestingUser?.permissions || {});
    if (!allowedProvinces || allowedProvinces.length === 0) return [];
    allowedProvSet = new Set(allowedProvinces);
  }

  if (province) {
    const trimmedProv = String(province).trim();
    if (requestingUser?.role === ROLES.ADMIN || allowedProvSet?.has(trimmedProv)) {
      allowedProvSet = new Set([trimmedProv]);
    } else {
      return [];
    }
  }

  const dirFilter = buildDirectorateFilter(directorate);
  const term = (query || "").trim();
  const normTerm = term ? normalizeSearchText(term) : "";
  const tokens = normTerm ? normTerm.split(/\s+/).filter(Boolean) : [];
  const termLower = term.toLowerCase();
  const numericId = /^\d+$/.test(term) ? Number(term) : null;

  const index = await getEmployeeDirectoryIndex();
  const matches = [];

  for (let i = 0; i < index.length; i++) {
    const item = index[i];
    if (allowedProvSet && !allowedProvSet.has(item.Province)) continue;
    if (dirFilter && !matchesDirectorateFilter(item.Directorate, dirFilter)) continue;

    if (term) {
      const tokensMatch = tokens.length > 0 && tokens.every((t) => item.searchBlob.includes(t));
      const ninMatch = item.ninLower.startsWith(termLower);
      const idMatch = numericId !== null && item.Id === numericId;
      if (!tokensMatch && !ninMatch && !idMatch) continue;
    }

    matches.push(item);
  }

  matches.sort((a, b) => {
    const cmpLast = String(a.listDto.LastName || "").localeCompare(String(b.listDto.LastName || ""), "ar");
    if (cmpLast !== 0) return cmpLast;
    return String(a.listDto.Name || "").localeCompare(String(b.listDto.Name || ""), "ar");
  });

  return matches.slice(0, 15).map((item) => {
    const d = item.listDto;
    return {
      Id: d.Id,
      Name: d.Name,
      LastName: d.LastName,
      LastNameFr: d.LastNameFr,
      NameFr: d.NameFr,
      Gender: d.Gender,
      Province: d.Province,
      Directorate: d.Directorate,
      EmployeeStatus: d.EmployeeStatus,
      CorpsType: d.CorpsType,
      JobTitleId: d.JobTitleId,
      JobTitle: d.JobTitle
        ? {
            Id: d.JobTitle.Id,
            RankName: d.JobTitle.RankName,
            EmploymentCategory: d.JobTitle.EmploymentCategory,
          }
        : null,
    };
  });
}

module.exports = {
  getJobTitlesMap,
  getEmployeeDirectoryIndex,
  listEmployees,
  searchEmployees,
};
