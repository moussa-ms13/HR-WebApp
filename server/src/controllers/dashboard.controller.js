// ============================================================
// Dashboard Controller — DB-level aggregations + In-Memory Cache
// Optimized for i3/8GB RAM with 5-minute TTL caching
// ============================================================
const prisma = require("../config/database");
const CacheService = require("../services/CacheService");

/**
 * GET /api/dashboard/stats
 * All counts are DB-level aggregations (COUNT).
 * Results are cached for 5 minutes to prevent redundant DB hits.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const cacheKey = "dashboard_stats";
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active: CURRENT_DATE >= StartDate AND (CURRENT_DATE <= EndDate OR EndDate IS NULL)
    // Late: EndDate < CURRENT_DATE AND not resumed
    const [
      totalEmployees,
      activeLeaves,
      activeCases,
      lateLeaves,
      lateCases,
      totalJobTitles,
      totalDocuments,
    ] = await Promise.all([
      prisma.employees.count(),
      prisma.employeeStates.count({
        where: {
          StartDate: { lte: today },
          EndDate: { gte: today },
        },
      }),
      prisma.specialCases.count({
        where: {
          IsActive: true,
          StartDate: { lte: today },
          OR: [{ EndDate: { gte: today } }, { EndDate: null }],
        },
      }),
      prisma.employeeStates.count({
        where: { EndDate: { lt: today }, IsResumed: false },
      }),
      prisma.specialCases.count({
        where: { EndDate: { lt: today }, IsActive: true },
      }),
      prisma.jobTitles.count(),
      prisma.employeeFiles.count(),
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
 * DB-level groupBy aggregation — counts per Province.
 * Cached separately for 5 minutes.
 */
exports.getEmployeesByProvince = async (req, res, next) => {
  try {
    const cacheKey = "dashboard_by_province";
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const groups = await prisma.employees.groupBy({
      by: ["Province"],
      where: {
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
 * Top 5 employees resuming work soon.
 * Uses covering index on (IsResumed, EndDate) with INCLUDE columns.
 * Cached for 5 minutes.
 */
exports.getResumingSoon = async (req, res, next) => {
  try {
    const cacheKey = "dashboard_resuming_soon";
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
          IsResumed: false,
          EndDate: { gte: today, lte: in14Days },
        },
        select: {
          Id: true,
          StateTypeOrReason: true,
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
 * Employees whose EndDate has passed but have NOT resumed work.
 * Sorted by most overdue first. Cached for 5 minutes.
 */
exports.getOverdueResumes = async (req, res, next) => {
  try {
    const cacheKey = "dashboard_overdue_resumes";
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [states, cases] = await Promise.all([
      prisma.employeeStates.findMany({
        where: {
          IsResumed: false,
          EndDate: { lt: today },
        },
        select: {
          Id: true,
          StateTypeOrReason: true,
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

    // Calculate overdue days for each record
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
  "حذف درجة",
  "حذف سجل درجة",
  "إضافة تعويض خبرة مهنية",
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

/**
 * GET /api/dashboard/user-kpis?date=YYYY-MM-DD
 * Admin-only: Aggregates ONLY tangible HR operations per user for a specific day.
 * Excludes Login/Logout/read-only actions.
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

    // Group system records by UserFullName, filtered strictly
    const groups = await prisma.systemRecords.groupBy({
      by: ["UserFullName"],
      _count: { Id: true },
      where: {
        CreatedDate: { gte: startOfDay, lte: endOfDay },
        Title: { in: HR_ACTION_TITLES },
      },
      orderBy: { _count: { Id: "desc" } },
      take: 15,
    });

    const data = groups.map((g) => ({
      name: g.UserFullName || "غير محدد",
      count: g._count.Id,
    }));

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
  CacheService.del("dashboard_stats");
  CacheService.del("dashboard_by_province");
  CacheService.del("dashboard_resuming_soon");
  CacheService.del("dashboard_overdue_resumes");
  CacheService.delByPrefix("dashboard_user_kpis_");
};
