// ============================================================
// ExportService — Facade for Filter Options, Live Previews & Excel Exports
// ============================================================
const excel = require("exceljs");
const prisma = require("../config/database");
const { ROLES } = require("../config/constants");
const CacheService = require("./CacheService");
const { resolveGeographicFilter } = require("../utils/queryBuilder");
const {
  STANDARD_LEAVE_TYPES,
  STANDARD_CASE_TYPES,
  getColumnsDefinition,
  buildOfficialExcelWorksheet,
} = require("./exports/exportColumnsAndStyles");
const { fetchReportData } = require("./exports/exportDataFetchers");

const RAW_FILTER_OPTIONS_CACHE_KEY = "RAW_FILTER_OPTIONS";

const CANONICAL_CATEGORIES = [
  "اسلاك مشتركة",
  "أسلاك تقنية (خاصة)",
  "متعاقدون بدوام كلي",
  "متعاقدون بدوام جزئي",
];

function resolveActiveColumns(reportType, selectedColumns) {
  const availableDefs = getColumnsDefinition(reportType);
  let activeDefs = availableDefs.filter((col) => col.default);
  if (Array.isArray(selectedColumns) && selectedColumns.length > 0) {
    const selectedSet = new Set(selectedColumns);
    const filtered = availableDefs.filter((col) => selectedSet.has(col.key));
    if (filtered.length > 0) activeDefs = filtered;
  }
  return { availableDefs, activeDefs };
}

class ExportService {
  static async _getRawFilterOptions() {
    let raw = CacheService.get(RAW_FILTER_OPTIONS_CACHE_KEY);
    if (raw) return raw;

    const [empLocations, jobTitles, dbLeaveStates, dbCases] = await Promise.all([
      prisma.employees.groupBy({ by: ["Province", "Directorate"], _count: true }),
      prisma.jobTitles.findMany({
        select: { Id: true, RankName: true, EmploymentCategory: true, CategoryLevel: true },
        orderBy: [{ EmploymentCategory: "asc" }, { RankName: "asc" }],
      }),
      prisma.employeeStates.groupBy({ by: ["StateTypeOrReason"], _count: true }),
      prisma.specialCases.groupBy({ by: ["CaseType"], _count: true }),
    ]);

    raw = { empLocations, jobTitles, dbLeaveStates, dbCases };
    CacheService.set(RAW_FILTER_OPTIONS_CACHE_KEY, raw, 600);
    return raw;
  }

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

    const dbLeaveTypes = dbLeaveStates.map((s) => (s.StateTypeOrReason || "").trim()).filter(Boolean);
    const leaveTypes = Array.from(new Set([...STANDARD_LEAVE_TYPES, ...dbLeaveTypes])).sort();

    const dbCaseTypes = dbCases.map((c) => (c.CaseType || "").trim()).filter(Boolean);
    const specialCaseTypes = Array.from(new Set([...STANDARD_CASE_TYPES, ...dbCaseTypes])).sort();

    return {
      provinces: allowedProvinces.filter((p) => provincesSet.has(p) || requestingUser?.role === ROLES.ADMIN),
      directorates: formattedDirectorates,
      employmentCategories: CANONICAL_CATEGORIES,
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

  static getColumnsDefinition(reportType) {
    return getColumnsDefinition(reportType);
  }

  static async getReportData(reportType, filters = {}, requestingUser, limit = null) {
    return fetchReportData(reportType, filters, requestingUser, limit);
  }

  static async getPreview(reportType, filters = {}, selectedColumns = [], requestingUser) {
    const { allowedProvinces } = resolveGeographicFilter(requestingUser);
    const scopeKey =
      requestingUser?.role === ROLES.ADMIN
        ? "admin"
        : [...(allowedProvinces || [])].sort().join("|");
    const previewCacheKey = `export_preview_${scopeKey}_${reportType}_${JSON.stringify(
      filters || {}
    )}_${JSON.stringify(selectedColumns || [])}`;
    const cached = CacheService.get(previewCacheKey);
    if (cached) return cached;

    const { totalCount, rows } = await fetchReportData(reportType, filters, requestingUser, 50);
    const { availableDefs, activeDefs } = resolveActiveColumns(reportType, selectedColumns);

    const preview = rows.map((row) => {
      const item = {};
      activeDefs.forEach((col) => {
        item[col.key] = row[col.key] ?? "—";
      });
      return item;
    });

    const result = {
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

    CacheService.set(previewCacheKey, result, 60);
    return result;
  }

  static async exportCustomExcel(
    reportType,
    filters = {},
    selectedColumns = [],
    customTitle = "",
    requestingUser,
    res
  ) {
    const { totalCount, rows: rawData } = await fetchReportData(reportType, filters, requestingUser, null);
    const { activeDefs } = resolveActiveColumns(reportType, selectedColumns);

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
   * Scoped basic employee export — enforces Geographic RBAC for requestingUser.
   */
  static async exportEmployeesToExcel(res, requestingUser) {
    return this.exportCustomExcel(
      "nominal",
      {},
      [],
      "القائمة الاسمية الشاملة لجميع الموظفين",
      requestingUser,
      res
    );
  }
}

module.exports = ExportService;
