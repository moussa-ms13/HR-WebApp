// ============================================================
// Dashboard Controller — DB-level aggregations + In-Memory Cache
// Optimized for i3/8GB RAM with 5-minute TTL caching
// ============================================================
const prisma = require("../config/database");
const CacheService = require("../services/CacheService");
const { ROLES, getAllowedProvinces } = require("../config/constants");

/**
 * Resolves Geographic RBAC scope for dashboard queries & cache keys.
 */
function getDashboardScope(user) {
  if (user && user.role === ROLES.ADMIN) {
    return { isAdmin: true, allowedProvinces: null, scopeKey: "admin", empWhere: {}, relEmpWhere: {} };
  }
  const allowedProvinces = getAllowedProvinces(user);
  const scopeKey = allowedProvinces.length > 0 ? [...allowedProvinces].sort().join("|") : "none";
  const empWhere = allowedProvinces.length > 0 ? { Province: { in: allowedProvinces } } : { Id: -1 };
  return {
    isAdmin: false,
    allowedProvinces,
    scopeKey,
    empWhere,
    relEmpWhere: { Employee: empWhere },
  };
}

/**
 * GET /api/dashboard/stats
 * All counts are DB-level aggregations (COUNT) scoped to the user's allowed provinces.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const scope = getDashboardScope(req.user);
    const cacheKey = `dashboard_stats_${scope.scopeKey}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalEmployees,
      activeLeaves,
      activeCases,
      lateLeaves,
      lateCases,
      totalJobTitles,
      totalDocuments,
    ] = await Promise.all([
      prisma.employees.count({ where: scope.empWhere }),
      prisma.employeeStates.count({
        where: {
          ...scope.relEmpWhere,
          StartDate: { lte: today },
          OR: [
            { EndDate: { gte: today } },
            { IsResumed: false, CustomEndText: { not: null }, NOT: { CustomEndText: "" } },
          ],
        },
      }),
      prisma.specialCases.count({
        where: {
          ...scope.relEmpWhere,
          IsActive: true,
          StartDate: { lte: today },
          OR: [{ EndDate: { gte: today } }, { EndDate: null }],
        },
      }),
      prisma.employeeStates.count({
        where: {
          ...scope.relEmpWhere,
          EndDate: { lt: today },
          IsResumed: false,
          OR: [{ CustomEndText: null }, { CustomEndText: "" }],
        },
      }),
      prisma.specialCases.count({
        where: { ...scope.relEmpWhere, EndDate: { lt: today }, IsActive: true },
      }),
      prisma.jobTitles.count(),
      prisma.employeeFiles.count({ where: scope.relEmpWhere }),
    ]);

    const activeLeavesCases = activeLeaves + activeCases;
    const lateToResume = lateLeaves + lateCases;

    const result = {
      stats: {
        totalEmployees,
        activeLeaves: activeLeavesCases,
        lateToResume,
        totalJobTitles,
        totalDocuments,
      },
    };

    CacheService.set(cacheKey, result, 300);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/employees-by-province
 * DB-level groupBy aggregation — counts per allowed Province.
 */
exports.getEmployeesByProvince = async (req, res, next) => {
  try {
    const scope = getDashboardScope(req.user);
    const cacheKey = `dashboard_by_province_${scope.scopeKey}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const groups = await prisma.employees.groupBy({
      by: ["Province"],
      where: {
        ...scope.empWhere,
        SpecialCases: {
          none: {
            IsActive: true,
            CaseType: { in: ["نقل", "تحويل", "استقالة", "تقاعد"] },
          },
        },
      },
      _count: { Id: true },
      orderBy: { _count: { Id: "desc" } },
    });

    const data = groups.map((g) => ({
      name: g.Province || "غير محدد",
      count: g._count.Id,
    }));

    CacheService.set(cacheKey, data, 300);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/resuming-soon
 * Top 5 employees resuming work soon within user's allowed provinces.
 */
exports.getResumingSoon = async (req, res, next) => {
  try {
    const scope = getDashboardScope(req.user);
    const cacheKey = `dashboard_resuming_soon_${scope.scopeKey}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [states, cases] = await Promise.all([
      prisma.employeeStates.findMany({
        where: {
          ...scope.relEmpWhere,
          IsResumed: false,
          EndDate: { gte: today, lte: in14Days },
          OR: [{ CustomEndText: null }, { CustomEndText: "" }],
        },
        select: {
          Id: true,
          StateTypeOrReason: true,
          ExceptionalReason: true,
          CustomEndText: true,
          EndDate: true,
          Employee: {
            select: { Name: true, LastName: true },
          },
        },
        orderBy: { EndDate: "asc" },
        take: 5,
      }),
      prisma.specialCases.findMany({
        where: {
          ...scope.relEmpWhere,
          IsActive: true,
          EndDate: { not: null, gte: today, lte: in14Days },
        },
        select: {
          Id: true,
          CaseType: true,
          EndDate: true,
          Employee: {
            select: { Name: true, LastName: true },
          },
        },
        orderBy: { EndDate: "asc" },
        take: 5,
      }),
    ]);

    const mappedCases = cases.map((c) => ({
      Id: `case-${c.Id}`,
      StateTypeOrReason: c.CaseType,
      EndDate: c.EndDate,
      Employee: c.Employee,
    }));

    const combined = [...states, ...mappedCases]
      .sort((a, b) => {
        if (!a.EndDate) return 1;
        if (!b.EndDate) return -1;
        return new Date(a.EndDate) - new Date(b.EndDate);
      })
      .slice(0, 5);

    CacheService.set(cacheKey, combined, 300);
    res.json({ success: true, data: combined });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/overdue-resumes
 * Employees whose EndDate has passed without resumption within user's allowed provinces.
 */
exports.getOverdueResumes = async (req, res, next) => {
  try {
    const scope = getDashboardScope(req.user);
    const cacheKey = `dashboard_overdue_resumes_${scope.scopeKey}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [states, cases] = await Promise.all([
      prisma.employeeStates.findMany({
        where: {
          ...scope.relEmpWhere,
          IsResumed: false,
          EndDate: { lt: today },
          OR: [{ CustomEndText: null }, { CustomEndText: "" }],
        },
        select: {
          Id: true,
          StateTypeOrReason: true,
          ExceptionalReason: true,
          CustomEndText: true,
          EndDate: true,
          Employee: {
            select: { Name: true, LastName: true },
          },
        },
        orderBy: { EndDate: "asc" },
        take: 10,
      }),
      prisma.specialCases.findMany({
        where: {
          ...scope.relEmpWhere,
          IsActive: true,
          EndDate: { lt: today },
        },
        select: {
          Id: true,
          CaseType: true,
          EndDate: true,
          Employee: {
            select: { Name: true, LastName: true },
          },
        },
        orderBy: { EndDate: "asc" },
        take: 10,
      }),
    ]);

    const mappedCases = cases.map((c) => ({
      Id: `case-${c.Id}`,
      StateTypeOrReason: c.CaseType,
      EndDate: c.EndDate,
      Employee: c.Employee,
    }));

    const data = [...states, ...mappedCases]
      .map((s) => {
        const endDate = new Date(s.EndDate);
        endDate.setHours(0, 0, 0, 0);
        const diffMs = today - endDate;
        const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return { ...s, overdueDays };
      })
      .sort((a, b) => new Date(a.EndDate) - new Date(b.EndDate))
      .slice(0, 10);

    CacheService.set(cacheKey, data, 300);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ── Strict whitelist of HR operational action titles ──
// Only these actions count as "real work" for KPI scoring.
// Login, Logout, and diagnostic actions are explicitly excluded.
const HR_ACTION_TITLES = [
  // ── Document Uploads & Management ──
  "Upload Documents",
  "Upload Document",
  "Update Document",
  "Delete Document",
  "Bulk Delete Documents",
  "رفع وثائق للموظف",
  "تعديل وثيقة موظف",
  "حذف وثيقة موظف",
  "حذف عدة وثائق لموظف",

  // ── Employees CRUD & Profile ──
  "Add Employee",
  "Edit Employee",
  "Delete Employee",
  "Update Profile Image",
  "إضافة موظف جديد",
  "اضافة موظف",
  "تعديل بيانات موظف",
  "تعديل موظف",
  "حذف موظف",
  "تحديث الصورة الشخصية",

  // ── Career: Ranks, Positions & Promotions ──
  "إضافة ترقية في الرتبة",
  "تعديل سجل الرتبة",
  "تعديل سجل الترقية",
  "حذف سجل الرتبة",
  "حذف سجل الترقية",
  "إضافة منصب عليا",
  "اضافة منصب",
  "تعديل سجل المنصب",
  "حذف سجل المنصب",
  "حذف منصب",

  // ── Degrees & Experience Allowance ──
  "إضافة درجة جديدة",
  "تعديل درجة",
  "حذف درجة",
  "حذف سجل درجة",
  "إضافة تعويض خبرة مهنية",
  "تعديل تعويض خبرة مهنية",
  "حذف تعويض خبرة مهنية",

  // ── Leaves & Employee States ──
  "Add Employee State",
  "Edit Employee State",
  "Delete Employee State",
  "Resume Leave Early",
  "إضافة وضعية/إجازة موظف",
  "تعديل وضعية/إجازة موظف",
  "حذف وضعية/إجازة موظف",
  "استئناف إجازة مبكراً",
  "استئناف عمل",
  "حذف سجل",

  // ── Special Cases ──
  "Add Special Case",
  "Edit Special Case",
  "Delete Special Case",
  "إضافة حالة خاصة",
  "تسجيل حالة",
  "تعديل حالة خاصة",
  "تعديل حالة",
  "حذف حالة خاصة",
  "إنهاء حالة خاصة / إعادة إدماج",

  // ── Job Titles / Grades ──
  "إضافة رتبة جديدة",
  "إضافة رتبة وظيفية",
  "تعديل رتبة",
  "تعديل رتبة وظيفية",
  "حذف رتبة",
  "حذف رتبة وظيفية",

  // ── Users Management ──
  "Add User",
  "Edit User",
  "Delete User",
  "إضافة مستخدم جديد",
  "اضافة مستخدم",
  "تعديل مستخدم",
  "حذف مستخدم",
];

const HR_ACTION_TITLES_SET = new Set(HR_ACTION_TITLES);

/**
 * GET /api/dashboard/user-kpis?date=YYYY-MM-DD
 * Admin-only: Aggregates ONLY tangible HR operations per user for a specific day.
 * Uses indexed CreatedDate seek + O(n) JS Set grouping to avoid SQL Server NVARCHAR(MAX) GROUP BY timeouts.
 * Cached per-date for 3 minutes.
 */
exports.getUserKpis = async (req, res, next) => {
  try {
    // Parse date from query param, default to today
    const dateParam = req.query.date;
    let startOfDay, endOfDay, dateKey;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split("-").map(Number);
      startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      dateKey = dateParam;
    } else {
      const now = new Date();
      startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      dateKey = `${yyyy}-${mm}-${dd}`;
    }

    const cacheKey = `dashboard_user_kpis_${dateKey}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Fast indexed range seek on IX_SystemRecords_CreatedDate_Desc (zero NVARCHAR(MAX) SQL GROUP BY)
    const dayRecords = await prisma.systemRecords.findMany({
      where: {
        CreatedDate: { gte: startOfDay, lte: endOfDay },
      },
      select: {
        UserFullName: true,
        Title: true,
      },
    });

    const countByUser = new Map();
    for (const rec of dayRecords) {
      if (!HR_ACTION_TITLES_SET.has(rec.Title)) continue;
      const name = rec.UserFullName || "غير محدد";
      countByUser.set(name, (countByUser.get(name) || 0) + 1);
    }

    const data = Array.from(countByUser.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Cache for 3 minutes (matches the frontend polling interval)
    CacheService.set(cacheKey, data, 180);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidate all dashboard caches — call after any leave/case write.
 */
exports.clearDashboardCache = () => {
  CacheService.delByPrefix("dashboard_stats_");
  CacheService.delByPrefix("dashboard_by_province_");
  CacheService.delByPrefix("dashboard_resuming_soon_");
  CacheService.delByPrefix("dashboard_overdue_resumes_");
  CacheService.delByPrefix("dashboard_user_kpis_");
};
