// ============================================================
// Special Cases Constants & Classification Helpers
// ============================================================

// Definitive / Permanent Exit Cases from Directorate/Public Service
const PERMANENT_EXIT_TYPES = Object.freeze([
  "تحويل",
  "نقل",
  "تقاعد",
  "استقالة",
  "عزل",
  "وفاة",
]);

// Temporary Statutory Situations in Algerian Civil Service
const TEMPORARY_STATUTORY_TYPES = Object.freeze([
  "استيداع",
  "إحالة على الاستيداع",
  "انتداب",
  "تأدية الخدمة الوطنية",
  "خدمة وطنية",
  "خارج الإطار",
]);

/**
 * Checks if a case type represents a definitive exit.
 * @param {string} caseType
 * @returns {boolean}
 */
function isPermanentExit(caseType) {
  if (!caseType) return false;
  return PERMANENT_EXIT_TYPES.includes(String(caseType).trim());
}

/**
 * Checks if a case type represents a temporary statutory situation.
 * @param {string} caseType
 * @returns {boolean}
 */
function isTemporaryStatutory(caseType) {
  return !isPermanentExit(caseType);
}

module.exports = {
  PERMANENT_EXIT_TYPES,
  TEMPORARY_STATUTORY_TYPES,
  isPermanentExit,
  isTemporaryStatutory,
};
