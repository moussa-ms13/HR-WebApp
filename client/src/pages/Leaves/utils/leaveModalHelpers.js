import { normalizeGender } from '../../../utils/leaveCertificateConfig';

export const LEAVE_TYPES = [
  "عطلة سنوية",
  "عطلة مرضية",
  "عطلة أمومة",
  "عطلة استثنائية",
  "عطلة بدون راتب"
];

export const SPECIAL_CASE_TYPES = [
  "في استيداع",
  "تأدية الخدمة الوطنية",
  "توقيف بمقرر",
  "انتداب",
  "استقالة",
  "نقل",
  "تحويل",
  "تقاعد"
];

export const PERMANENT_CASES = new Set(["استقالة", "تقاعد", "نقل"]);

export const DESTINATION_CASES = new Set(["انتداب", "تحويل", "نقل"]);

export function isAnnualLeaveType(type) {
  const s = String(type || '').trim();
  return s === 'عطلة سنوية' || (s.includes('سنوية') && !s.includes('استثنائية'));
}

export function isFemaleEmployee(employee) {
  if (!employee) return false;
  return normalizeGender(employee.Gender || employee.gender) === 'female';
}

export function calculateEndDate(startDate, daysCount) {
  if (!startDate || !daysCount || Number(daysCount) <= 0) return '';
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return '';
  start.setDate(start.getDate() + Number(daysCount) - 1);
  return start.toISOString().split('T')[0];
}

/**
 * Resolves the consumed balance year ("بعنوان سنة") for an annual leave record,
 * with safe fallback to ConsumedBreakdown or StartDate year for legacy records.
 */
export function resolveConsumedYearFromLeave(leave) {
  if (!leave) return null;
  const explicit =
    leave.ConsumedYear ??
    leave.consumedYear ??
    leave.targetYear ??
    leave.TargetYear;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    const yr = parseInt(explicit, 10);
    if (Number.isInteger(yr) && yr > 1900) return yr;
  }

  const rawBreakdown = leave.ConsumedBreakdown ?? leave.consumedBreakdown;
  if (rawBreakdown) {
    try {
      const parsed = typeof rawBreakdown === 'string' ? JSON.parse(rawBreakdown) : rawBreakdown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.year) {
        const yr = parseInt(parsed[0].year, 10);
        if (Number.isInteger(yr) && yr > 1900) return yr;
      }
    } catch (_) {}
  }

  if (leave.StartDate) {
    const d = new Date(leave.StartDate);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      return d.getFullYear();
    }
  }
  return null;
}

/**
 * Normalizes and sorts an employee's annual leave balances ascending by year (2023, 2024, 2025...).
 * When editing an existing annual leave, credits back its currently deducted days to its consumed year
 * so the HR officer sees the true available ceiling for that leave.
 */
export function normalizeBalanceOptions(rawResponse, editingRecord = null) {
  const rawList = (() => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.data?.data)) return rawResponse.data.data;
    if (Array.isArray(rawResponse.records)) return rawResponse.records;
    return [];
  })();

  const isEditingAnnual =
    editingRecord &&
    isAnnualLeaveType(editingRecord.StateTypeOrReason) &&
    !editingRecord.CustomEndText &&
    Number(editingRecord.DaysCount || 0) > 0;

  const editingConsumedYear = isEditingAnnual
    ? Number(editingRecord.ConsumedYear ?? editingRecord.consumedYear ?? 0)
    : 0;
  const editingDays = isEditingAnnual ? Number(editingRecord.DaysCount || 0) : 0;

  return rawList
    .map((b) => {
      const year = Number(b.Year ?? b.year);
      const totalDays = Number(b.TotalDays ?? b.totalDays ?? 30);
      const consumedDays = Number(b.ConsumedDays ?? b.consumedDays ?? 0);
      const remainingDays = Number(b.RemainingDays ?? b.remainingDays ?? 0);
      const isEditedYear = editingConsumedYear > 0 && year === editingConsumedYear;
      const effectiveRemaining = isEditedYear
        ? Math.min(Math.max(totalDays, remainingDays + editingDays), remainingDays + editingDays)
        : remainingDays;

      return {
        year,
        totalDays,
        consumedDays,
        remainingDays,
        effectiveRemaining,
      };
    })
    .filter((b) => Number.isInteger(b.year) && b.year > 1900)
    .sort((a, b) => a.year - b.year);
}

/**
 * Picks the smart default consumption year:
 * - In edit mode: preserves the record's saved ConsumedYear if present in balances.
 * - Otherwise: picks the oldest year (lowest year) with effectiveRemaining > 0.
 */
export function pickDefaultTargetYear(balanceOptions, editingRecord = null) {
  if (!Array.isArray(balanceOptions) || balanceOptions.length === 0) return '';

  if (editingRecord) {
    const savedYear = Number(editingRecord.ConsumedYear ?? editingRecord.consumedYear ?? 0);
    if (savedYear > 0 && balanceOptions.some((b) => b.year === savedYear)) {
      return String(savedYear);
    }
  }

  const oldestAvailable = balanceOptions.find((b) => b.effectiveRemaining > 0);
  if (oldestAvailable) return String(oldestAvailable.year);

  return '';
}
