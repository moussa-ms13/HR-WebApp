// ============================================================
// Special Cases Constants & Classification Helpers (Client)
// ============================================================

// Definitive / Permanent Exit Cases
export const PERMANENT_EXIT_TYPES = Object.freeze([
  'تحويل',
  'نقل',
  'تقاعد',
  'استقالة',
  'عزل',
  'وفاة',
]);

// Temporary Statutory Situations
export const TEMPORARY_STATUTORY_TYPES = Object.freeze([
  'استيداع',
  'إحالة على الاستيداع',
  'انتداب',
  'تأدية الخدمة الوطنية',
  'خدمة وطنية',
  'خارج الإطار',
]);

// All Case Types for select filter
export const ALL_SPECIAL_CASE_TYPES = Object.freeze([
  'استيداع',
  'انتداب',
  'تأدية الخدمة الوطنية',
  'خارج الإطار',
  'تحويل',
  'نقل',
  'تقاعد',
  'استقالة',
  'عزل',
  'وفاة',
]);

/**
 * Checks if a case type represents a definitive exit.
 * @param {string} caseType
 * @returns {boolean}
 */
export function isPermanentExit(caseType) {
  if (!caseType) return false;
  return PERMANENT_EXIT_TYPES.includes(String(caseType).trim());
}

/**
 * Checks if a case type represents a temporary statutory situation.
 * @param {string} caseType
 * @returns {boolean}
 */
export function isTemporaryStatutory(caseType) {
  return !isPermanentExit(caseType);
}

/**
 * Returns administrative lifecycle classification, badge styles, and date subtitle text.
 * @param {Object} record - Special case object { CaseType, StartDate, EndDate, IsActive }
 * @returns {Object} status descriptor
 */
export function getSpecialCaseStatus(record) {
  if (!record) {
    return {
      key: 'unknown',
      badgeLabel: '-',
      badgeStyle: 'bg-gray-100 text-gray-600 border border-gray-200',
      dateSubtitle: '-',
      isReintegratable: false,
    };
  }

  const caseType = record.CaseType || '';
  const isActive = record.IsActive !== false;

  // 1. Permanent Exit Cases (تحويل, نقل, تقاعد, استقالة, عزل, وفاة)
  if (isPermanentExit(caseType)) {
    return {
      key: 'permanent_exit',
      badgeLabel: 'قرار نهائي',
      badgeStyle: 'bg-blue-50 text-blue-700 border border-blue-200',
      dateSubtitle: 'قرار نهائي',
      isReintegratable: false,
    };
  }

  // 2. Temporary Statutory Cases (انتداب, استيداع, خدمة وطنية, إلخ)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasEndDate = Boolean(record.EndDate);
  let isPastEndDate = false;
  if (hasEndDate) {
    const end = new Date(record.EndDate);
    if (!isNaN(end.getTime())) {
      end.setHours(0, 0, 0, 0);
      isPastEndDate = end < today;
    }
  }

  const isEnded = !isActive || isPastEndDate;

  if (isEnded) {
    return {
      key: 'archived',
      badgeLabel: 'منتهية (أرشيف)',
      badgeStyle: 'bg-slate-100 text-slate-600 border border-slate-200',
      dateSubtitle: hasEndDate ? null : 'منتهية',
      isReintegratable: false,
    };
  }

  // Active Temporary Case
  return {
    key: 'temporary_active',
    badgeLabel: 'سارية المفعول',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dateSubtitle: hasEndDate ? null : 'مستمرة', // Never 'دائمة' for temporary cases
    isReintegratable: true,
  };
}

/**
 * "عرض السجلات" dropdown options for the Special Cases list.
 * The first entry (temporary_active) is the default operational view.
 */
export const DEFAULT_RECORD_VIEW = 'temporary_active';

export const RECORD_VIEW_OPTIONS = Object.freeze([
  { id: 'temporary_active', label: 'الوضعيات السارية حالياً' },
  { id: 'permanent_exit', label: 'قرارات الخروج النهائي - تحويل/تقاعد' },
  { id: 'archived', label: 'الأرشيف التاريخي - الحالات المنتهية' },
  { id: 'all', label: 'جميع السجلات' },
]);
