// ============================================================
// exportColumnsAndStyles.js — Column Definitions & ExcelJS Styling (DRY)
// Official Algerian Public Administration RTL Excel Styler
// ============================================================

// Standard catalog of Leave Types according to Algerian Civil Service Law (Ordinance 06-03)
const STANDARD_LEAVE_TYPES = [
  "عطلة سنوية",
  "عطلة مرضية قصيرة المدى",
  "عطلة مرضية طويلة المدى",
  "عطلة أمومة",
  "عطلة استثنائية مدفوعة الأجر",
  "عطلة بدون أجر",
  "عطلة أداء مناسك الحج",
  "استيداع",
  "انتداب",
  "خدمة وطنية",
  "استئناف عمل",
];

// Standard catalog of Special Cases
const STANDARD_CASE_TYPES = [
  "نقل",
  "تحويل",
  "استقالة",
  "تقاعد",
  "وفاة",
  "عزل",
  "إنهاء مهام",
  "تسريح",
  "إحالة على الاستيداع",
  "انتداب",
];

/**
 * Format date safely as YYYY/MM/DD
 * @param {Date|string} d
 * @returns {string}
 */
function formatDate(d) {
  if (!d) return "—";
  if (typeof d === "string") {
    const match = d.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
  }
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1900) return "—";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Metadata & Columns definition per report type
 * @param {string} reportType
 * @returns {Array<object>}
 */
function getColumnsDefinition(reportType) {
  const commonColumns = [
    { key: "index", label: "الرقم", default: true, align: "center", width: 8 },
    { key: "fullNameAr", label: "اللقب والاسم (عربي)", default: true, align: "right", width: 26 },
    { key: "fullNameFr", label: "اللقب والاسم (FR)", default: true, align: "left", width: 28 },
    { key: "nin", label: "رقم التعريف الوطني (NIN)", default: false, align: "center", width: 22 },
    { key: "birthDate", label: "تاريخ الميلاد", default: true, align: "center", width: 14 },
    { key: "placeOfBirth", label: "مكان الميلاد", default: false, align: "right", width: 18 },
    { key: "gender", label: "الجنس", default: false, align: "center", width: 10 },
    { key: "rank", label: "الرتبة", default: true, align: "right", width: 28 },
    { key: "employmentCategory", label: "فئة التوظيف", default: false, align: "right", width: 22 },
    { key: "assignedPosition", label: "المنصب المعين", default: true, align: "right", width: 24 },
    { key: "province", label: "الولاية", default: true, align: "center", width: 16 },
    { key: "directorate", label: "المديرية / الجهة", default: true, align: "right", width: 28 },
    { key: "hireDate", label: "تاريخ أول تنصيب", default: true, align: "center", width: 15 },
    { key: "currentGradeOrExp", label: "الدرجة / تعويض الخبرة", default: true, align: "center", width: 22 },
    { key: "status", label: "الوضعية القانونية", default: true, align: "center", width: 14 },
    { key: "phone", label: "رقم الهاتف", default: false, align: "center", width: 16 },
  ];

  switch (reportType) {
    case "leaves":
      return [
        { key: "index", label: "الرقم", default: true, align: "center", width: 8 },
        { key: "fullNameAr", label: "اللقب والاسم (عربي)", default: true, align: "right", width: 24 },
        { key: "fullNameFr", label: "اللقب والاسم (FR)", default: true, align: "left", width: 26 },
        { key: "rank", label: "الرتبة", default: true, align: "right", width: 24 },
        { key: "province", label: "الولاية", default: true, align: "center", width: 14 },
        { key: "directorate", label: "المديرية", default: true, align: "right", width: 24 },
        { key: "leaveType", label: "نوع العطلة / الوضعية", default: true, align: "right", width: 24 },
        { key: "daysCount", label: "عدد الأيام", default: true, align: "center", width: 12 },
        { key: "startDate", label: "تاريخ البداية", default: true, align: "center", width: 14 },
        { key: "endDate", label: "تاريخ النهاية", default: true, align: "center", width: 14 },
        { key: "resumeStatus", label: "حالة الاستئناف", default: true, align: "center", width: 18 },
        { key: "actualReturnDate", label: "تاريخ الاستئناف الفعلي", default: true, align: "center", width: 18 },
        { key: "notes", label: "ملاحظات", default: false, align: "right", width: 24 },
      ];

    case "special-cases":
      return [
        { key: "index", label: "الرقم", default: true, align: "center", width: 8 },
        { key: "fullNameAr", label: "اللقب والاسم (عربي)", default: true, align: "right", width: 24 },
        { key: "fullNameFr", label: "اللقب والاسم (FR)", default: true, align: "left", width: 26 },
        { key: "rank", label: "الرتبة", default: true, align: "right", width: 24 },
        { key: "province", label: "الولاية الأصلية", default: true, align: "center", width: 14 },
        { key: "directorate", label: "المديرية الأصلية", default: true, align: "right", width: 24 },
        { key: "caseType", label: "نوع الحالة الخاصة", default: true, align: "center", width: 18 },
        { key: "destination", label: "الجهة المستقبلة / الوجهة", default: true, align: "right", width: 28 },
        { key: "startDate", label: "تاريخ السريان", default: true, align: "center", width: 14 },
        { key: "endDate", label: "تاريخ الانتهاء", default: true, align: "center", width: 14 },
        { key: "referenceDoc", label: "السند الإداري / المرجع", default: true, align: "right", width: 26 },
        { key: "activeStatus", label: "الحالة", default: true, align: "center", width: 14 },
      ];

    case "degrees-experience":
      return [
        { key: "index", label: "الرقم", default: true, align: "center", width: 8 },
        { key: "fullNameAr", label: "اللقب والاسم (عربي)", default: true, align: "right", width: 24 },
        { key: "fullNameFr", label: "اللقب والاسم (FR)", default: true, align: "left", width: 26 },
        { key: "rank", label: "الرتبة", default: true, align: "right", width: 24 },
        { key: "employmentCategory", label: "الفئة", default: true, align: "right", width: 20 },
        { key: "province", label: "الولاية", default: true, align: "center", width: 14 },
        { key: "directorate", label: "المديرية", default: true, align: "right", width: 24 },
        { key: "gradeLevel", label: "الدرجة / سنوات الخبرة", default: true, align: "center", width: 22 },
        { key: "allowanceRate", label: "نسبة التعويض (1.4%)", default: true, align: "center", width: 20 },
        { key: "effectiveDate", label: "تاريخ السريان", default: true, align: "center", width: 14 },
        { key: "promotionPace", label: "وتيرة الترقية", default: true, align: "center", width: 15 },
        { key: "referenceDoc", label: "السند الإداري / المرجع", default: true, align: "right", width: 26 },
      ];

    case "high-positions":
      return [
        { key: "index", label: "الرقم", default: true, align: "center", width: 8 },
        { key: "fullNameAr", label: "اللقب والاسم (عربي)", default: true, align: "right", width: 24 },
        { key: "fullNameFr", label: "اللقب والاسم (FR)", default: true, align: "left", width: 26 },
        { key: "rank", label: "الرتبة الأصلية", default: true, align: "right", width: 24 },
        { key: "positionName", label: "المنصب العالي / الهيكلي", default: true, align: "right", width: 28 },
        { key: "province", label: "الولاية", default: true, align: "center", width: 14 },
        { key: "directorate", label: "المديرية", default: true, align: "right", width: 24 },
        { key: "installDate", label: "تاريخ التعيين / التنصيب", default: true, align: "center", width: 16 },
        { key: "referenceDoc", label: "مرجع القرار / التعيين", default: true, align: "right", width: 26 },
        { key: "status", label: "الوضعية", default: true, align: "center", width: 14 },
      ];

    case "nominal":
    default:
      return commonColumns;
  }
}

/**
 * Builds standard institutional report title
 * @param {string} reportType
 * @param {object} filters
 * @returns {string}
 */
function getDefaultReportTitle(reportType, filters = {}) {
  let loc = "";
  if (filters.directorate) loc = `بـ ${filters.directorate}`;
  else if (filters.province) loc = `لولاية ${filters.province}`;

  switch (reportType) {
    case "leaves":
      return `قائمة الموظفين في وضعية عطلة أو إجازة ${loc}`.trim();
    case "special-cases":
      return `قائمة الموظفين في وضعيات خاصة (نقل / تحويل / انتداب) ${loc}`.trim();
    case "degrees-experience":
      return `سجل الدرجات وتعويض الخبرة المهنية (1.4%) ${loc}`.trim();
    case "high-positions":
      return `قائمة شاغلي المناصب العليا والهيكلية ${loc}`.trim();
    case "nominal":
    default:
      return `القائمة الاسمية لموظفي قطاع الأملاك الوطنية ${loc}`.trim();
  }
}

/**
 * Applies institutional RTL styling and formatting to an ExcelJS worksheet
 */
function buildOfficialExcelWorksheet({
  workbook,
  reportType,
  customTitle,
  filters,
  totalCount,
  activeDefs,
  rawData,
}) {
  const worksheet = workbook.addWorksheet("القائمة الاسمية");

  // RTL orientation for Arabic official document
  worksheet.views = [{ rightToLeft: true }];

  const colCount = activeDefs.length;
  const lastColLetter = worksheet.getColumn(colCount).letter;

  // ─── Header Block ──────────────────────────────────────────
  // Row 1: Republic Header
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const row1 = worksheet.getCell("A1");
  row1.value = "الجمهورية الجزائرية الديمقراطية الشعبية";
  row1.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF333333" } };
  row1.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 24;

  // Row 2: Ministry Header
  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const row2 = worksheet.getCell("A2");
  row2.value = "وزارة المالية — المديرية العامة للأملاك الوطنية";
  row2.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF105B38" } };
  row2.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 22;

  // Row 3: Dynamic Report Title
  const titleText = customTitle && customTitle.trim()
    ? customTitle.trim()
    : getDefaultReportTitle(reportType, filters);

  worksheet.mergeCells(`A3:${lastColLetter}3`);
  const row3 = worksheet.getCell("A3");
  row3.value = titleText;
  row3.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  row3.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF124E35" },
  };
  row3.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(3).height = 34;

  // Row 4: Metadata Summary (Filters, Export Date, Count)
  const exportDateStr = formatDate(new Date());
  const filterSummaryParts = [];
  if (filters.province) filterSummaryParts.push(`الولاية: ${filters.province}`);
  if (filters.directorate) filterSummaryParts.push(`الجهة: ${filters.directorate}`);
  if (filters.rank) filterSummaryParts.push(`الرتبة: ${filters.rank}`);
  filterSummaryParts.push(`تاريخ الاستخراج: ${exportDateStr}`);
  filterSummaryParts.push(`إجمالي السجلات: ${totalCount}`);

  worksheet.mergeCells(`A4:${lastColLetter}4`);
  const row4 = worksheet.getCell("A4");
  row4.value = filterSummaryParts.join("   |   ");
  row4.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  row4.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(4).height = 20;

  // Row 5: Empty Spacer
  worksheet.getRow(5).height = 8;

  // Row 6: Table Column Headers
  const headerRow = worksheet.getRow(6);
  headerRow.height = 28;

  activeDefs.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.label;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B6B48" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F4028" } },
      bottom: { style: "medium", color: { argb: "FF0F4028" } },
      left: { style: "thin", color: { argb: "FF0F4028" } },
      right: { style: "thin", color: { argb: "FF0F4028" } },
    };
  });

  // ─── Data Rows ─────────────────────────────────────────────
  let currentRowIdx = 7;
  rawData.forEach((row, rIdx) => {
    const dataRow = worksheet.getRow(currentRowIdx);
    dataRow.height = 22;
    const isZebra = rIdx % 2 === 1;

    activeDefs.forEach((col, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      let val = row[col.key];
      if (col.key === "index") val = rIdx + 1;
      cell.value = val ?? "—";

      cell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
      if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }

      cell.alignment = {
        vertical: "middle",
        horizontal: col.align || "right",
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    currentRowIdx++;
  });

  // Auto-fit column widths with safety margins
  activeDefs.forEach((col, idx) => {
    const worksheetCol = worksheet.getColumn(idx + 1);
    worksheetCol.width = col.width || 20;
  });

  return worksheet;
}

module.exports = {
  STANDARD_LEAVE_TYPES,
  STANDARD_CASE_TYPES,
  formatDate,
  getColumnsDefinition,
  getDefaultReportTitle,
  buildOfficialExcelWorksheet,
};
