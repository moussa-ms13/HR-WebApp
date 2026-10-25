// ============================================================
// exportConfig.js — Configuration, Options & Title Generator for Custom Exports (DRY)
// ============================================================

export const REPORT_TYPE_OPTIONS = [
  { value: 'nominal', label: 'القائمة الاسمية للموظفين' },
  { value: 'leaves', label: 'قائمة الموظفين في عطلة' },
  { value: 'special-cases', label: 'قائمة الحالات الخاصة' },
  { value: 'degrees-experience', label: 'الدرجات وتعويض الخبرة المهنية' },
  { value: 'high-positions', label: 'شاغلو المناصب العليا' },
];

/**
 * Builds smart institutional title for reports
 */
export function buildSmartReportTitle({
  reportType,
  selectedProvince,
  selectedDirectorate,
  employmentCategory,
  leaveType,
  caseType,
  categoryMode,
}) {
  let base = 'القائمة الاسمية للموظفين';
  if (reportType === 'leaves') base = 'قائمة الموظفين في عطلة';
  else if (reportType === 'special-cases') base = 'قائمة الموظفين في حالة خاصة';
  else if (reportType === 'degrees-experience') {
    if (categoryMode === 'grades') base = 'سجل ترقيات الدرجات (1-12) للموظفين المرسمين';
    else if (categoryMode === 'experience') base = 'سجل تعويض الخبرة المهنية (1.4%) للأعوان المتعاقدين';
    else base = 'سجل الدرجات وتعويض الخبرة المهنية (1.4%)';
  } else if (reportType === 'high-positions') {
    base = 'قائمة شاغلي المناصب العليا والهيكلية';
  }

  const parts = [];
  if (selectedDirectorate) {
    parts.push(`لموظفي ${selectedDirectorate}`);
  } else if (selectedProvince) {
    parts.push(`— ولاية ${selectedProvince}`);
  }

  if (reportType === 'nominal') {
    if (employmentCategory) parts.push(`(${employmentCategory})`);
  } else if (reportType === 'leaves') {
    if (leaveType) parts.push(`(${leaveType})`);
  } else if (reportType === 'special-cases') {
    if (caseType) parts.push(`(${caseType})`);
  }

  return [base, ...parts].filter(Boolean).join(' ');
}

/**
 * Compiles active filter parameters into query-ready object
 */
export function compileReportFilters({
  reportType,
  selectedProvince,
  selectedDirectorate,
  searchQuery = '',
  employmentCategory,
  rankId,
  status,
  gender,
  leaveType,
  resumeStatus,
  dateFrom,
  dateTo,
  caseType,
  activeStatus,
  categoryMode,
}) {
  const f = {};
  if (selectedProvince) f.province = selectedProvince;
  if (selectedDirectorate) f.directorate = selectedDirectorate;
  if (searchQuery.trim()) f.search = searchQuery.trim();

  if (reportType === 'nominal') {
    if (employmentCategory) f.employmentCategory = employmentCategory;
    if (rankId) f.rankId = rankId;
    if (status) f.status = status;
    if (gender) f.gender = gender;
  } else if (reportType === 'leaves') {
    if (leaveType) f.leaveType = leaveType;
    if (resumeStatus) f.resumeStatus = resumeStatus;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
  } else if (reportType === 'special-cases') {
    if (caseType) f.caseType = caseType;
    if (activeStatus) f.activeStatus = activeStatus;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
  } else if (reportType === 'degrees-experience') {
    if (categoryMode) f.categoryMode = categoryMode;
  }
  return f;
}
