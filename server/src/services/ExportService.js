// ============================================================
// ExportService — Custom Data Export & Nominal Lists Studio
// Modular, clean service orchestrating query builders, formatters, and ExcelJS
// ============================================================
const excel = require("exceljs");
const prisma = require("../config/database");
const { ROLES } = require("../config/constants");
const CacheService = require("./CacheService");
const {
  resolveGeographicFilter,
  buildTokenizedSearch,
} = require("../utils/queryBuilder");
const {
  STANDARD_LEAVE_TYPES,
  STANDARD_CASE_TYPES,
  formatDate,
  getColumnsDefinition,
  getDefaultReportTitle,
  buildOfficialExcelWorksheet,
} = require("./exports/exportColumnsAndStyles");
const {
  formatNominalRows,
  formatLeavesRows,
  formatSpecialCasesRows,
  formatDegreesExperienceRows,
  formatHighPositionsRows,
} = require("./exports/exportFormatters");

const RAW_FILTER_OPTIONS_CACHE_KEY = "RAW_FILTER_OPTIONS";

class ExportService {
  /**
   * Invalidates the in-memory lookup cache when records change.
   */
  static invalidateExportCache() {
    CacheService.del(RAW_FILTER_OPTIONS_CACHE_KEY);
  }

  /**
   * Helper: format date safely as YYYY/MM/DD (backwards-compatible export)
   */
  static formatDate(d) {
    return formatDate(d);
  }

  /**
   * Fetches raw distinct filter options from database or centralized cache (TTL 10m).
   */
  static async _getRawFilterOptions() {
    let raw = CacheService.get(RAW_FILTER_OPTIONS_CACHE_KEY);
    if (raw) return raw;

    const [empLocations, jobTitles, dbLeaveStates, dbCases] = await Promise.all([
      prisma.employees.groupBy({
        by: ["Province", "Directorate"],
        _count: true,
      }),
      prisma.jobTitles.findMany({
        select: {
          Id: true,
          RankName: true,
          EmploymentCategory: true,
          CategoryLevel: true,
        },
        orderBy: [{ EmploymentCategory: "asc" }, { RankName: "asc" }],
      }),
      prisma.employeeStates.groupBy({
        by: ["StateTypeOrReason"],
        _count: true,
      }),
      prisma.specialCases.groupBy({
        by: ["CaseType"],
        _count: true,
      }),
    ]);

    raw = { empLocations, jobTitles, dbLeaveStates, dbCases };
    CacheService.set(RAW_FILTER_OPTIONS_CACHE_KEY, raw, 600);
    return raw;
  }

  /**
   * 1. GET FILTER OPTIONS
   * Returns cascading filter data scoped to user's permissions in < 1ms from in-memory cache.
   */
  static async getFilterOptions(requestingUser) {
    const { allowedProvinces } = resolveGeographicFilter(requestingUser);
    const { empLocations, jobTitles, dbLeaveStates, dbCases } = await this._getRawFilterOptions();

    const provincesSet = new Set();
    const directoratesByProvince = {};

    empLocations.forEach((loc) => {
      const prov = (loc.Province || "").trim();
      const dir = (loc.Directorate || "").trim();

      if (!prov || !allowedProvinces.includes(prov)) return;

      provincesSet.add(prov);

      if (dir) {
        if (!directoratesByProvince[prov]) directoratesByProvince[prov] = new Set();
        directoratesByProvince[prov].add(dir);
      }
    });

    const formattedDirectorates = {};
    for (const [p, dirs] of Object.entries(directoratesByProvince)) {
      formattedDirectorates[p] = Array.from(dirs).sort();
    }

    const employmentCategories = Array.from(
      new Set(jobTitles.map((j) => (j.EmploymentCategory || "").trim()).filter(Boolean))
    ).sort();

    const dbLeaveTypes = dbLeaveStates.map((s) => (s.StateTypeOrReason || "").trim()).filter(Boolean);
    const leaveTypes = Array.from(new Set([...STANDARD_LEAVE_TYPES, ...dbLeaveTypes])).sort();

    const dbCaseTypes = dbCases.map((c) => (c.CaseType || "").trim()).filter(Boolean);
    const specialCaseTypes = Array.from(new Set([...STANDARD_CASE_TYPES, ...dbCaseTypes])).sort();

    return {
      provinces: allowedProvinces.filter((p) => provincesSet.has(p) || requestingUser?.role === ROLES.ADMIN),
      directorates: formattedDirectorates,
      employmentCategories,
      ranks: jobTitles.map((j) => ({
        id: j.Id,
        rankName: j.RankName,
        employmentCategory: j.EmploymentCategory,
        categoryLevel: j.CategoryLevel,
      })),
      leaveTypes,
      specialCaseTypes,
    };
  }

  /**
   * Metadata & Columns definition per report type
   */
  static getColumnsDefinition(reportType) {
    return getColumnsDefinition(reportType);
  }

  /**
   * 2. RESOLVE REPORT ROWS (Optimized Lean Queries with Promise.all)
   */
  static async getReportData(reportType, filters = {}, requestingUser, limit = null) {
    const { provinceFilter } = resolveGeographicFilter(requestingUser, filters.province);
    const baseWhere = { Province: provinceFilter };

    if (filters.directorate && String(filters.directorate).trim()) {
      baseWhere.Directorate = String(filters.directorate).trim();
    }

    // ──────────────────────────────────────────────
    // TEMPLATE 1: NOMINAL LIST (القائمة الاسمية)
    // ──────────────────────────────────────────────
    if (reportType === "nominal" || !reportType) {
      const where = { ...baseWhere };

      if (filters.status && String(filters.status).trim()) {
        where.EmployeeStatus = String(filters.status).trim();
      }
      if (filters.gender && String(filters.gender).trim()) {
        where.Gender = String(filters.gender).trim();
      }
      if (filters.rankId && Number(filters.rankId)) {
        where.JobTitleId = Number(filters.rankId);
      }
      if (filters.employmentCategory && String(filters.employmentCategory).trim()) {
        where.JobTitle = {
          EmploymentCategory: String(filters.employmentCategory).trim(),
        };
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

      const [totalCount, employees] = await Promise.all([
        prisma.employees.count({ where }),
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
            JobTitle: {
              select: { Id: true, RankName: true, EmploymentCategory: true },
            },
          },
          orderBy: [{ Province: "asc" }, { LastName: "asc" }, { Name: "asc" }],
          take: limit || undefined,
        }),
      ]);

      return { totalCount, rows: formatNominalRows(employees) };
    }

    // ──────────────────────────────────────────────
    // TEMPLATE 2: LEAVES REPORT (قائمة العطل والوضعيات)
    // ──────────────────────────────────────────────
    if (reportType === "leaves") {
      const now = new Date();
      const whereState = {
        Employee: { ...baseWhere },
      };

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

      if (filters.dateFrom) {
        whereState.StartDate = { gte: new Date(filters.dateFrom) };
      }
      if (filters.dateTo) {
        whereState.EndDate = { ...whereState.EndDate, lte: new Date(filters.dateTo) };
      }

      const [totalCount, states] = await Promise.all([
        prisma.employeeStates.count({ where: whereState }),
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
      ]);

      return { totalCount, rows: formatLeavesRows(states, now) };
    }

    // ──────────────────────────────────────────────
    // TEMPLATE 3: SPECIAL CASES (الحالات الخاصة)
    // ──────────────────────────────────────────────
    if (reportType === "special-cases") {
      const whereCase = {
        Employee: { ...baseWhere },
      };

      if (filters.caseType && String(filters.caseType).trim()) {
        whereCase.CaseType = String(filters.caseType).trim();
      }

      if (filters.activeStatus === "ساري المفعول") {
        whereCase.IsActive = true;
      } else if (filters.activeStatus === "منتهي") {
        whereCase.IsActive = false;
      }

      if (filters.dateFrom) {
        whereCase.StartDate = { gte: new Date(filters.dateFrom) };
      }
      if (filters.dateTo) {
        whereCase.EndDate = { lte: new Date(filters.dateTo) };
      }

      const [totalCount, cases] = await Promise.all([
        prisma.specialCases.count({ where: whereCase }),
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
      ]);

      return { totalCount, rows: formatSpecialCasesRows(cases) };
    }

    // ──────────────────────────────────────────────
    // TEMPLATE 4: DEGREES & EXPERIENCE (الدرجات وتعويض الخبرة 1.4%)
    // ──────────────────────────────────────────────
    if (reportType === "degrees-experience") {
      const where = { ...baseWhere };

      if (filters.categoryMode === "الدرجات (1-12) للمرسمين") {
        where.JobTitle = {
          EmploymentCategory: { not: { contains: "متعاقد" } },
        };
      } else if (filters.categoryMode === "تعويض الخبرة (1.4%) للمتعاقدين") {
        where.JobTitle = {
          EmploymentCategory: { contains: "متعاقد" },
        };
      }

      const [totalCount, employees] = await Promise.all([
        prisma.employees.count({ where }),
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
            JobTitle: {
              select: { RankName: true, EmploymentCategory: true },
            },
          },
          orderBy: [{ Province: "asc" }, { Degree: "desc" }, { LastName: "asc" }],
          take: limit || undefined,
        }),
      ]);

      return { totalCount, rows: formatDegreesExperienceRows(employees) };
    }

    // ──────────────────────────────────────────────
    // TEMPLATE 5: HIGH & STRUCTURAL POSITIONS (المناصب العليا)
    // ──────────────────────────────────────────────
    if (reportType === "high-positions") {
      const where = {
        ...baseWhere,
        OR: [
          { PositionHistories: { some: { EndDate: null } } },
          { AssignedPosition: { notIn: ["", "بدون منصب", "لا يوجد"] } },
        ],
      };

      const [totalCount, employees] = await Promise.all([
        prisma.employees.count({ where }),
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
      ]);

      return { totalCount, rows: formatHighPositionsRows(employees) };
    }

    return { totalCount: 0, rows: [] };
  }

  /**
   * 3. GET LIVE PREVIEW
   */
  static async getPreview(reportType, filters = {}, selectedColumns = [], requestingUser) {
    const { totalCount, rows } = await this.getReportData(reportType, filters, requestingUser, 50);
    const availableDefs = this.getColumnsDefinition(reportType);

    let activeDefs = availableDefs.filter((col) => col.default);
    if (Array.isArray(selectedColumns) && selectedColumns.length > 0) {
      const selectedSet = new Set(selectedColumns);
      const filtered = availableDefs.filter((col) => selectedSet.has(col.key));
      if (filtered.length > 0) activeDefs = filtered;
    }

    const preview = rows.map((row) => {
      const item = {};
      activeDefs.forEach((col) => {
        item[col.key] = row[col.key] ?? "—";
      });
      return item;
    });

    return {
      success: true,
      reportType,
      totalCount,
      count: totalCount,
      previewCount: preview.length,
      columns: activeDefs,
      availableColumns: availableDefs,
      data: preview,
      rows: preview,
    };
  }

  /**
   * 4. GENERATE OFFICIAL ALGERIAN RTL EXCEL WORKBOOK
   */
  static async exportCustomExcel(reportType, filters = {}, selectedColumns = [], customTitle = "", requestingUser, res) {
    const { totalCount, rows: rawData } = await this.getReportData(reportType, filters, requestingUser, null);
    const availableDefs = this.getColumnsDefinition(reportType);

    let activeDefs = availableDefs.filter((col) => col.default);
    if (Array.isArray(selectedColumns) && selectedColumns.length > 0) {
      const selectedSet = new Set(selectedColumns);
      const filtered = availableDefs.filter((col) => selectedSet.has(col.key));
      if (filtered.length > 0) activeDefs = filtered;
    }

    const workbook = new excel.Workbook();
    workbook.creator = "الجمهورية الجزائرية - وزارة المالية - HR System";
    workbook.created = new Date();

    buildOfficialExcelWorksheet({
      workbook,
      reportType,
      customTitle,
      filters,
      totalCount,
      activeDefs,
      rawData,
    });

    const safeFilename = `Report_${reportType}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);

    await workbook.xlsx.write(res);
  }

  /**
   * Legacy basic export function for backward compatibility
   */
  static async exportEmployeesToExcel(res) {
    return this.exportCustomExcel("nominal", {}, [], "القائمة الاسمية الشاملة لجميع الموظفين", { role: ROLES.ADMIN }, res);
  }
}

module.exports = ExportService;
