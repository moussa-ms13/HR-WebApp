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
  return s === 'عطلة سنوية' || s.includes('سنوية');
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
