// ============================================================
// exportFormatters.js — Specialized row formatters per report template
// ============================================================
const { formatDate } = require("./exportColumnsAndStyles");
const { resolveEmployeeWorkplace } = require("../../utils/queryBuilder");

/**
 * Format Nominal List Rows (القائمة الاسمية)
 * @param {Array<object>} employees
 * @returns {Array<object>}
 */
function formatNominalRows(employees) {
  return employees.map((emp, idx) => {
    const isContractual = (emp.JobTitle?.EmploymentCategory || "").includes("متعاقد");
    const gradeLevel = emp.Degree ?? 0;
    const currentGradeOrExp = isContractual
      ? `${gradeLevel} سنة (${(gradeLevel * 1.4).toFixed(1)}%)`
      : `الدرجة ${gradeLevel}`;

    const { resolvedDirectorate } = resolveEmployeeWorkplace(emp);

    return {
      index: idx + 1,
      id: emp.Id,
      fullNameAr: `${emp.LastName} ${emp.Name}`,
      fullNameFr: emp.LastNameFr ? `${emp.LastNameFr} ${emp.NameFr || ""}`.trim() : "—",
      nin: emp.NIN || "—",
      birthDate: formatDate(emp.DateOfBirth),
      placeOfBirth: emp.PlaceOfBirth || "—",
      gender: emp.Gender || "—",
      maritalStatus: emp.MaritalStatus || "—",
      rank: emp.JobTitle?.RankName || "—",
      employmentCategory: emp.JobTitle?.EmploymentCategory || "—",
      assignedPosition: emp.AssignedPosition || "—",
      province: emp.Province || "—",
      directorate: resolvedDirectorate,
      hireDate: formatDate(emp.InstallationDate),
      currentGradeOrExp,
      lastDegreeDate: formatDate(emp.LastDegreeDate),
      status: emp.EmployeeStatus || "مرسم",
      phone: emp.PhoneNumber || "—",
    };
  });
}

/**
 * Format Leaves & Employee States Rows (قائمة العطل والوضعيات)
 * @param {Array<object>} states
 * @param {Date} [now]
 * @returns {Array<object>}
 */
function formatLeavesRows(states, now = new Date()) {
  return states.map((state, idx) => {
    const emp = state.Employee || {};
    let resumeStatusText = "ساري المفعول";
    if (state.IsResumed) {
      resumeStatusText = "تم الاستئناف";
    } else if (new Date(state.EndDate) < now) {
      resumeStatusText = "لم يستأنف (متأخر)";
    }

    return {
      index: idx + 1,
      id: state.Id,
      employeeId: emp.Id,
      fullNameAr: `${emp.LastName || ""} ${emp.Name || ""}`.trim(),
      fullNameFr: emp.LastNameFr ? `${emp.LastNameFr} ${emp.NameFr || ""}`.trim() : "—",
      rank: emp.JobTitle?.RankName || "—",
      province: emp.Province || "—",
      directorate: emp.Directorate || "—",
      leaveType: state.StateTypeOrReason || "عطلة",
      daysCount: state.DaysCount || 0,
      startDate: formatDate(state.StartDate),
      endDate: formatDate(state.EndDate),
      resumeStatus: resumeStatusText,
      actualReturnDate: formatDate(state.ActualReturnDate || state.ResumptionDate),
      notes: state.Notes || "—",
    };
  });
}

/**
 * Format Special Cases Rows (الحالات الخاصة)
 * @param {Array<object>} cases
 * @returns {Array<object>}
 */
function formatSpecialCasesRows(cases) {
  return cases.map((c, idx) => {
    const emp = c.Employee || {};
    return {
      index: idx + 1,
      id: c.Id,
      employeeId: emp.Id,
      fullNameAr: `${emp.LastName || ""} ${emp.Name || ""}`.trim(),
      fullNameFr: emp.LastNameFr ? `${emp.LastNameFr} ${emp.NameFr || ""}`.trim() : "—",
      rank: emp.JobTitle?.RankName || "—",
      province: emp.Province || "—",
      directorate: emp.Directorate || "—",
      caseType: c.CaseType || "حالة خاصة",
      destination: c.Destination || "—",
      startDate: formatDate(c.StartDate),
      endDate: formatDate(c.EndDate),
      referenceDoc: c.ReferenceDoc || "—",
      activeStatus: c.IsActive ? "ساري المفعول" : "منتهي",
    };
  });
}

/**
 * Format Degrees & Experience Allowance Rows (الدرجات وتعويض الخبرة 1.4%)
 * @param {Array<object>} employees
 * @returns {Array<object>}
 */
function formatDegreesExperienceRows(employees) {
  return employees.map((emp, idx) => {
    const isContractual = (emp.JobTitle?.EmploymentCategory || "").includes("متعاقد");
    const level = emp.Degree ?? 0;

    const gradeLevel = isContractual ? `${level} سنة خبرة` : `الدرجة ${level}`;
    const allowanceRate = isContractual ? `${(level * 1.4).toFixed(1)}%` : "—";
    const promotionPace = isContractual ? "سنوي" : "متوسطة";

    return {
      index: idx + 1,
      id: emp.Id,
      fullNameAr: `${emp.LastName} ${emp.Name}`,
      fullNameFr: emp.LastNameFr ? `${emp.LastNameFr} ${emp.NameFr || ""}`.trim() : "—",
      rank: emp.JobTitle?.RankName || "—",
      employmentCategory: emp.JobTitle?.EmploymentCategory || "—",
      province: emp.Province || "—",
      directorate: emp.Directorate || "—",
      gradeLevel,
      allowanceRate,
      effectiveDate: formatDate(emp.LastDegreeDate),
      promotionPace,
      referenceDoc: "مقرر ترقية",
    };
  });
}

/**
 * Format High and Structural Positions Rows (المناصب العليا)
 * @param {Array<object>} employees
 * @returns {Array<object>}
 */
function formatHighPositionsRows(employees) {
  return employees.map((emp, idx) => {
    const activePos = emp.PositionHistories?.[0];
    const posName = activePos?.PositionName || emp.AssignedPosition || "منصب نوعي";
    const installDate = formatDate(activePos?.InstallDate || emp.PositionDate);
    const referenceDoc = activePos?.Reference || "—";

    return {
      index: idx + 1,
      id: emp.Id,
      fullNameAr: `${emp.LastName} ${emp.Name}`,
      fullNameFr: emp.LastNameFr ? `${emp.LastNameFr} ${emp.NameFr || ""}`.trim() : "—",
      rank: emp.JobTitle?.RankName || "—",
      positionName: posName,
      province: emp.Province || "—",
      directorate: emp.Directorate || "—",
      installDate,
      referenceDoc,
      status: emp.EmployeeStatus || "مرسم",
    };
  });
}

module.exports = {
  formatNominalRows,
  formatLeavesRows,
  formatSpecialCasesRows,
  formatDegreesExperienceRows,
  formatHighPositionsRows,
};
