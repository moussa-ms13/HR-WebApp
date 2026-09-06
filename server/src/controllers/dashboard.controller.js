// ============================================================
// Dashboard Controller — DB-level aggregations + In-Memory Cache
// Optimized for i3/8GB RAM with 5-minute TTL caching
// ============================================================
const prisma = require("../config/database");
const NodeCache = require("node-cache");

// Cache with 5-minute TTL, check expired keys every 60 seconds
const dashboardCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * GET /api/dashboard/stats
 * All counts are DB-level aggregations (COUNT).
 * Results are cached for 5 minutes to prevent redundant DB hits.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const cacheKey = "dashboard_stats";
    const cached = dashboardCache.get(cacheKey);
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
          OR: [{ EndDate: { gte: today } }, { EndDate: null }],
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

    dashboardCache.set(cacheKey, result);
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
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const groups = await prisma.employees.groupBy({
      by: ["Province"],
      _count: { Id: true },
      orderBy: { _count: { Id: "desc" } },
    });

    const data = groups.map((g) => ({
      name: g.Province || "غير محدد",
      count: g._count.Id,
    }));

    dashboardCache.set(cacheKey, data);
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
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [states, cases] = await Promise.all([
      prisma.employeeStates.findMany({
        where: {
          IsResumed: false,
          EndDate: { gte: today },
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
          OR: [{ EndDate: { gte: today } }, { EndDate: null }],
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

    dashboardCache.set(cacheKey, combined);
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
    const cached = dashboardCache.get(cacheKey);
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

    dashboardCache.set(cacheKey, data);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ── Strict whitelist of HR operational action titles ──
// Only these actions count as "real work" for KPI scoring.
// Login, Logout, views, and navigation are explicitly excluded.
const HR_ACTION_TITLES = [
  "Add Employee",
  "Edit Employee",
  "Delete Employee",
  "Update Profile Image",
  "Upload Documents",
  "Update Document",
  "Delete Document",
  "Add Employee State",
  "Edit Employee State",
  "Delete Employee State",
  "Add User",
  "Edit User",
  "Delete User",
  "إضافة رتبة جديدة",
  "تعديل رتبة",
  "حذف رتبة",
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
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
    }

    const dateKey = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const cacheKey = `dashboard_user_kpis_${dateKey}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Day boundaries
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

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
    dashboardCache.set(cacheKey, data, 180);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidate all dashboard caches — call after any leave/case write.
 */
exports.clearDashboardCache = () => {
  dashboardCache.flushAll();
};
