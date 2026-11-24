// ============================================================
// Leave Helpers — Lifecycle Filters, Years Cache & Payload Normalizers
// ============================================================
const prisma = require("../../config/database");
const CacheService = require("../CacheService");

const ANNUAL_LEAVE_TYPE = "عطلة سنوية";

function getLeaveLifecycleCondition(statusFilter) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeCondition = {
    IsResumed: false,
    OR: [{ EndDate: { gte: today } }, { CustomEndText: { not: null } }],
  };

  const resumedCondition = {
    OR: [
      { IsResumed: true },
      {
        AND: [
          { EndDate: { lt: today } },
          { OR: [{ CustomEndText: null }, { CustomEndText: "" }] },
        ],
      },
    ],
  };

  switch (statusFilter) {
    case "active":
      return activeCondition;
    case "resumed":
      return resumedCondition;
    case "all":
      return null;
    default:
      return activeCondition;
  }
}

function getYearCondition(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return null;
  const startOfYear = new Date(y, 0, 1);
  const endOfYear = new Date(y + 1, 0, 1);
  return {
    OR: [
      { StartDate: { gte: startOfYear, lt: endOfYear } },
      { EndDate: { gte: startOfYear, lt: endOfYear } },
      { ConsumedYear: y },
    ],
  };
}

async function getDistinctYears() {
  const cacheKey = "distinct_years_employee_states";
  const cached = CacheService.get(cacheKey);
  if (cached) return cached;

  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT YEAR(StartDate) AS y
      FROM EmployeeStates
      WHERE StartDate IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(EndDate) AS y
      FROM EmployeeStates
      WHERE EndDate IS NOT NULL
      ORDER BY y DESC`;
    const years = rows.map((r) => Number(r.y)).filter((y) => Number.isInteger(y) && y > 0);
    CacheService.set(cacheKey, years, 600);
    return years;
  } catch (_) {
    return [];
  }
}

/**
 * Attaches live remaining annual leave breakdown (`_remainingBreakdown`) and
 * syncs `RemainingBalanceAfter` strictly for "عطلة سنوية".
 */
function attachLiveRemainingBreakdown(st) {
  if (!st || st.StateTypeOrReason !== ANNUAL_LEAVE_TYPE) return st;

  let resolvedConsumedYear = st.ConsumedYear ?? null;
  if (!resolvedConsumedYear && st.ConsumedBreakdown) {
    try {
      const parsed = JSON.parse(st.ConsumedBreakdown);
      if (Array.isArray(parsed) && parsed[0]?.year) {
        resolvedConsumedYear = Number(parsed[0].year) || null;
      }
    } catch (_) {}
  }

  const rawBalances = st.Employee?.LeaveBalances;
  if (!Array.isArray(rawBalances)) {
    return {
      ...st,
      ConsumedYear: resolvedConsumedYear,
      targetYear: resolvedConsumedYear,
    };
  }

  const positive = rawBalances
    .filter((b) => Number(b.RemainingDays) > 0)
    .sort((a, b) => Number(a.Year) - Number(b.Year));

  const breakdown = positive.map((b) => ({
    year: b.Year,
    days: Number(b.RemainingDays),
  }));
  const liveTotal = breakdown.reduce((sum, r) => sum + r.days, 0);

  return {
    ...st,
    ConsumedYear: resolvedConsumedYear,
    targetYear: resolvedConsumedYear,
    RemainingBalanceAfter: liveTotal,
    _remainingBreakdown: breakdown,
  };
}

function parseOptionalDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function resolveCustomEndText(data, stateType, existingValue = null, isUpdate = false) {
  const isAnnualType = String(stateType || "").includes("سنوية");
  if (data.isOpenEnded === false || isAnnualType) return null;

  const hasCustom = data.CustomEndText !== undefined || data.customEndText !== undefined;
  if (isUpdate && !hasCustom) return existingValue ?? null;

  const raw = data.CustomEndText !== undefined ? data.CustomEndText : data.customEndText;
  return raw ? String(raw).trim() || null : null;
}

function resolveExceptionalReason(data, stateType, existingValue = null, isUpdate = false) {
  if (!String(stateType || "").includes("استثنائية")) return null;

  const hasReason = data.ExceptionalReason !== undefined || data.exceptionalReason !== undefined;
  if (isUpdate && !hasReason) return existingValue ?? null;

  const raw = data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason;
  const cleaned = raw ? String(raw).replace(/^[(\s]+|[)\s]+$/g, "").trim() : "";
  return cleaned || null;
}

function resolveMedicalFields(data, existing = null) {
  const isUpdate = Boolean(existing);

  const hasDoc = data.DoctorName !== undefined || data.doctorName !== undefined;
  const rawDoc = data.DoctorName !== undefined ? data.DoctorName : data.doctorName;
  const DoctorName = isUpdate && !hasDoc ? existing.DoctorName : rawDoc ? String(rawDoc).trim() : null;

  const hasCertDate = data.CertificateDate !== undefined || data.certificateDate !== undefined;
  const rawCertDate = data.CertificateDate !== undefined ? data.CertificateDate : data.certificateDate;
  const CertificateDate = isUpdate && !hasCertDate ? existing.CertificateDate : parseOptionalDate(rawCertDate);

  const hasDoc2 =
    data.SecondDoctorName !== undefined ||
    data.secondDoctorName !== undefined ||
    data.doctorName2 !== undefined;
  const rawDoc2 =
    data.SecondDoctorName !== undefined
      ? data.SecondDoctorName
      : data.secondDoctorName !== undefined
      ? data.secondDoctorName
      : data.doctorName2;
  const SecondDoctorName =
    isUpdate && !hasDoc2 ? existing.SecondDoctorName : rawDoc2 ? String(rawDoc2).trim() : null;

  const hasCertDate2 =
    data.SecondCertificateDate !== undefined ||
    data.secondCertificateDate !== undefined ||
    data.certificateDate2 !== undefined;
  const rawCertDate2 =
    data.SecondCertificateDate !== undefined
      ? data.SecondCertificateDate
      : data.secondCertificateDate !== undefined
      ? data.secondCertificateDate
      : data.certificateDate2;
  const SecondCertificateDate =
    isUpdate && !hasCertDate2 ? existing.SecondCertificateDate : parseOptionalDate(rawCertDate2);

  return { DoctorName, CertificateDate, SecondDoctorName, SecondCertificateDate };
}

module.exports = {
  ANNUAL_LEAVE_TYPE,
  getLeaveLifecycleCondition,
  getYearCondition,
  getDistinctYears,
  attachLiveRemainingBreakdown,
  parseOptionalDate,
  resolveCustomEndText,
  resolveExceptionalReason,
  resolveMedicalFields,
};
